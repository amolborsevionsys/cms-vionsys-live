// One-time copy of all CMS data from the old MongoDB database into PostgreSQL.
//
// Usage:
//   1. Create the tables first:   npm run db:push
//   2. In .env set:
//        MONGO_URL=mongodb+srv://...                                   (old, only read)
//        DATABASE_URL=postgresql://...@localhost:5432/vionsys?schema=cms (new, written)
//   3. Run:                       npm run db:migrate-from-mongo
//
// MongoDB is never modified. Existing ids are kept, and rows already present in
// PostgreSQL are skipped, so the script can be re-run safely.
//
// The table list, field types and insert order all come from prisma/schema.prisma,
// so this stays correct if fields are added before the migration is run.
// MongoDB never enforced relations; PostgreSQL does. Rows that point at a record
// that doesn't exist are reported: optional links are cleared, rows whose
// required link is missing are skipped.

import { MongoClient, ObjectId } from "mongodb";
import { PrismaClient, Prisma } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* .env is optional when variables are already set */
}

const { MONGO_URL, DATABASE_URL } = process.env;
if (!MONGO_URL?.startsWith("mongodb")) {
  console.error("MONGO_URL must be set to the old mongodb:// or mongodb+srv:// URL.");
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(DATABASE_URL ?? "")) {
  console.error("DATABASE_URL must be set to the new postgresql:// URL (with ?schema=cms).");
  process.exit(1);
}

const { models, enums } = Prisma.dmmf.datamodel;
const enumValues = new Map(enums.map((e) => [e.name, new Set(e.values.map((v) => v.name))]));
const modelByName = new Map(models.map((m) => [m.name, m]));
const delegateName = (model) => model.name[0].toLowerCase() + model.name.slice(1);

// ---------- insert order: parents before children ----------

function insertOrder() {
  const deps = new Map(
    models.map((m) => [
      m.name,
      new Set(
        m.fields
          .filter((f) => f.kind === "object" && f.relationFromFields?.length && f.type !== m.name)
          .map((f) => f.type),
      ),
    ]),
  );
  const order = [];
  const done = new Set();
  while (order.length < models.length) {
    const ready = models.filter(
      (m) => !done.has(m.name) && [...deps.get(m.name)].every((d) => done.has(d)),
    );
    if (!ready.length) throw new Error("Relation cycle between models; cannot order inserts.");
    for (const m of ready) {
      order.push(m);
      done.add(m.name);
    }
  }
  return order;
}

// ---------- value conversion ----------

const plainJson = (v) =>
  JSON.parse(
    JSON.stringify(v, (_k, val) =>
      val && typeof val === "object" && val._bsontype === "ObjectId" ? String(val) : val,
    ),
  );

function convertScalar(field, v) {
  if (v instanceof ObjectId) v = v.toHexString();
  switch (field.type) {
    case "String":
      return String(v);
    case "Int":
      return Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : undefined;
    case "Float":
      return Number.isFinite(Number(v)) ? Number(v) : undefined;
    case "Boolean":
      return typeof v === "boolean" ? v : undefined;
    case "DateTime": {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    case "Json":
      return plainJson(v);
    default:
      if (field.kind === "enum") return enumValues.get(field.type)?.has(v) ? v : undefined;
      return v;
  }
}

function fallbackFor(field) {
  if (field.isList) return [];
  if (field.kind === "enum") return [...enumValues.get(field.type)][0];
  return { String: "", Int: 0, Float: 0, Boolean: false, Json: {}, DateTime: new Date() }[field.type];
}

// Turn one MongoDB document into a PostgreSQL row for `model`.
function toRow(model, doc, problems) {
  const row = {};
  for (const field of model.fields) {
    if (field.kind === "object") continue; // relations are set through their scalar fk fields
    const key = field.isId ? "_id" : (field.dbName ?? field.name);
    let v = doc[key];

    if (field.isList) {
      // A missing list in MongoDB just means "empty".
      v = Array.isArray(v) ? v.map((x) => convertScalar(field, x)).filter((x) => x !== undefined) : [];
    } else if (v !== undefined && v !== null) {
      v = convertScalar(field, v);
    }

    if (v === undefined || v === null) {
      if (field.hasDefaultValue || field.isUpdatedAt) continue; // let the database fill it
      if (!field.isRequired) {
        if (field.type !== "Json") row[field.name] = null; // nullable Json: leave unset = NULL
        continue;
      }
      problems.push(`${field.name} missing, used "${JSON.stringify(fallbackFor(field))}"`);
      v = fallbackFor(field);
    }
    row[field.name] = v;
  }
  return row;
}

// ---------- main ----------

const mongo = new MongoClient(MONGO_URL);
const prisma = new PrismaClient();
const existingIds = new Map(); // model name -> Set of ids now in PostgreSQL
const deferred = []; // self-references applied after all rows exist
let totalFailed = 0;

try {
  await mongo.connect();
  const db = mongo.db();
  console.log(`Reading from MongoDB database "${db.databaseName}"\n`);

  const docsByModel = new Map();
  for (const model of models) {
    docsByModel.set(model.name, await db.collection(model.dbName ?? model.name).find({}).toArray());
  }

  for (const model of insertOrder()) {
    const docs = docsByModel.get(model.name);
    const relations = model.fields.filter((f) => f.kind === "object" && f.relationFromFields?.length);
    const ids = new Set();
    let copied = 0;
    const notes = [];

    for (const doc of docs) {
      const problems = [];
      const row = toRow(model, doc, problems);
      let skip = false;

      for (const rel of relations) {
        const fk = rel.relationFromFields[0];
        const target = row[fk];
        if (target == null) continue;
        if (rel.type === model.name) {
          // self-reference (e.g. MediaFolder.parent): set it once every row exists
          deferred.push({ model, id: row.id, data: { [fk]: target } });
          row[fk] = null;
          continue;
        }
        if (!existingIds.get(rel.type)?.has(target)) {
          const fkField = model.fields.find((f) => f.name === fk);
          if (fkField.isRequired) {
            problems.push(`skipped: ${fk} -> ${rel.type} ${target} does not exist`);
            skip = true;
          } else {
            problems.push(`${fk} cleared: ${rel.type} ${target} does not exist`);
            row[fk] = null;
          }
        }
      }

      if (!skip) {
        try {
          await prisma[delegateName(model)].upsert({
            where: { id: row.id },
            create: row,
            update: {},
          });
          ids.add(row.id);
          copied++;
        } catch (err) {
          problems.push(`failed: ${err.message.split("\n").filter(Boolean).pop().trim()}`);
          skip = true;
        }
      }
      if (skip) totalFailed++;
      if (problems.length) notes.push(`   ! ${model.name} ${row.id}: ${problems.join("; ")}`);
    }

    existingIds.set(model.name, ids);
    console.log(`${model.name.padEnd(20)} ${copied}/${docs.length} copied`);
    for (const n of notes) console.log(n);
  }

  for (const { model, id, data } of deferred) {
    const [fk, target] = Object.entries(data)[0];
    if (existingIds.get(model.name)?.has(id) && existingIds.get(model.name).has(target)) {
      await prisma[delegateName(model)].update({ where: { id }, data });
    } else {
      console.log(`   ! ${model.name} ${id}: ${fk} cleared: ${target} does not exist`);
    }
  }

  // Implicit many-to-many links (MongoDB stored them as id arrays on both sides).
  for (const model of models) {
    for (const rel of model.fields.filter(
      (f) => f.kind === "object" && f.isList && !f.relationFromFields?.length,
    )) {
      const other = modelByName.get(rel.type);
      const back = other.fields.find((f) => f.relationName === rel.relationName && f.type === model.name);
      if (!back?.isList || model.name > other.name) continue; // only m-n, handle each pair once
      const ownKey = `${rel.type[0].toLowerCase()}${rel.type.slice(1)}Ids`;
      const otherKey = `${model.name[0].toLowerCase()}${model.name.slice(1)}Ids`;
      const fallbackOwnKey = `${rel.name.replace(/s$/, "")}Ids`; // e.g. tags -> tagIds
      const fallbackOtherKey = `${back.name.replace(/s$/, "")}Ids`; // e.g. posts -> postIds

      const links = new Map();
      const add = (a, b) => {
        if (!existingIds.get(model.name)?.has(a) || !existingIds.get(other.name)?.has(b)) return;
        if (!links.has(a)) links.set(a, new Set());
        links.get(a).add(b);
      };
      for (const d of docsByModel.get(model.name)) {
        for (const t of d[ownKey] ?? d[fallbackOwnKey] ?? []) add(String(d._id), String(t));
      }
      for (const d of docsByModel.get(other.name)) {
        for (const s of d[otherKey] ?? d[fallbackOtherKey] ?? []) add(String(s), String(d._id));
      }
      let count = 0;
      for (const [a, bs] of links) {
        await prisma[delegateName(model)].update({
          where: { id: a },
          data: { [rel.name]: { connect: [...bs].map((id) => ({ id })) } },
        });
        count += bs.size;
      }
      console.log(`${`${model.name}<->${other.name}`.padEnd(20)} ${count} links`);
    }
  }

  console.log(totalFailed ? `\nDone with ${totalFailed} row(s) not copied (listed above).` : "\nDone. Every row copied.");
  process.exitCode = totalFailed ? 2 : 0;
} finally {
  await Promise.allSettled([mongo.close(), prisma.$disconnect()]);
}
