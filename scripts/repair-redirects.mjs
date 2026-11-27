/**
 * Repair CMS redirect rules (the website applies them before rendering a page).
 *
 * Finds and fixes:
 *   - self-redirects (A -> A)
 *   - rules that start from a URL a live blog post or case study uses now
 *     (they would send that page's visitors somewhere else)
 *   - chains (A -> B -> C becomes A -> C) and loops (sent to the listing page)
 *
 * Dry run by default: prints what it would change and writes nothing.
 *   npm run db:repair-redirects            # preview
 *   npm run db:repair-redirects -- --apply # write the changes
 */
import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

function listingFor(path) {
  if (path.startsWith('/case-studies/')) return '/case-studies';
  if (path.startsWith('/blog/')) return '/blog';
  return '/';
}

async function main() {
  const [rules, blogs, caseStudies] = await Promise.all([
    prisma.redirect.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.blogPost.findMany({
      where: { OR: [{ status: 'PUBLISHED' }, { publishedAt: { not: null } }] },
      select: { slug: true },
    }),
    prisma.caseStudy.findMany({ where: { publishedAt: { not: null } }, select: { slug: true } }),
  ]);

  const livePaths = new Set([
    ...blogs.map(b => `/blog/${b.slug}`),
    ...caseStudies.map(c => `/case-studies/${c.slug}`),
  ]);

  const toDelete = new Map(); // id -> reason
  for (const r of rules) {
    if (r.fromPath === r.toPath) toDelete.set(r.id, 'self-redirect');
    else if (livePaths.has(r.fromPath)) toDelete.set(r.id, 'starts from a live page');
  }

  // Resolve chains over the rules that survive.
  const next = new Map(rules.filter(r => !toDelete.has(r.id)).map(r => [r.fromPath, r.toPath]));
  const toUpdate = []; // { rule, toPath, reason }
  for (const r of rules) {
    if (toDelete.has(r.id)) continue;
    const seen = new Set([r.fromPath]);
    let target = r.toPath;
    let loop = false;
    while (next.has(target)) {
      if (seen.has(target)) { loop = true; break; }
      seen.add(target);
      target = next.get(target);
    }
    if (loop) target = listingFor(r.fromPath);
    if (target === r.fromPath) toDelete.set(r.id, 'resolves to itself');
    else if (target !== r.toPath) toUpdate.push({ rule: r, toPath: target, reason: loop ? 'loop' : 'chain' });
  }

  console.log(`${rules.length} redirect rules, ${livePaths.size} live pages.\n`);
  if (toDelete.size === 0 && toUpdate.length === 0) {
    console.log('Nothing to repair.');
    return;
  }

  for (const r of rules) {
    if (toDelete.has(r.id)) console.log(`DELETE  ${r.fromPath} -> ${r.toPath}   (${toDelete.get(r.id)})`);
  }
  for (const u of toUpdate) {
    console.log(`UPDATE  ${u.rule.fromPath} -> ${u.rule.toPath}  becomes  -> ${u.toPath}   (${u.reason})`);
  }

  if (!apply) {
    console.log('\nDry run: nothing was written. Re-run with --apply to make these changes.');
    return;
  }

  await prisma.$transaction([
    prisma.redirect.deleteMany({ where: { id: { in: [...toDelete.keys()] } } }),
    ...toUpdate.map(u => prisma.redirect.update({ where: { id: u.rule.id }, data: { toPath: u.toPath } })),
  ]);
  console.log(`\nApplied: ${toDelete.size} deleted, ${toUpdate.length} updated.`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
