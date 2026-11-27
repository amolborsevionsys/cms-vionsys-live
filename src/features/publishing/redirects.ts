import { prisma } from '@/lib/prisma';

/*
 * Redirect rules for slug changes and deletions.
 *
 * Invariants (the website applies CMS redirects before rendering a page, so a
 * stale rule can hide or hijack a live page):
 *  1. A live page owns its URL: no redirect may start from it.
 *  2. No self-redirects (A → A) and no loops (A → B → A).
 *  3. No chains: every rule points at a final destination (A → C, not A → B → C).
 */

/** A live item now uses this URL: remove any rule that would send its visitors elsewhere. */
export async function claimPath(path: string) {
  await prisma.redirect.deleteMany({ where: { fromPath: path } });
}

/** A live item moved from oldPath to newPath. */
export async function recordMove(oldPath: string, newPath: string) {
  if (oldPath === newPath) return;
  await prisma.$transaction([
    // Collapse chains: rules that pointed at the old URL now point at the new one.
    prisma.redirect.updateMany({ where: { toPath: oldPath }, data: { toPath: newPath } }),
    prisma.redirect.upsert({
      where: { fromPath: oldPath },
      update: { toPath: newPath, statusCode: 301 },
      create: { fromPath: oldPath, toPath: newPath, statusCode: 301 },
    }),
    // The new URL is live now. Also removes a would-be loop (new → old became new → new).
    prisma.redirect.deleteMany({ where: { fromPath: newPath } }),
  ]);
}

/** A live item was deleted: its URL (and anything that pointed at it) goes to the listing page. */
export async function recordRemoval(path: string, listingPath: string) {
  await prisma.$transaction([
    prisma.redirect.updateMany({ where: { toPath: path }, data: { toPath: listingPath } }),
    prisma.redirect.upsert({
      where: { fromPath: path },
      update: { toPath: listingPath, statusCode: 301 },
      create: { fromPath: path, toPath: listingPath, statusCode: 301 },
    }),
  ]);
}
