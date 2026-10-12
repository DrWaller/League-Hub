// Server-side only. Finds logo files in Vercel Blob that nothing on the site points at any more
// (every upload leaves the previous file behind), so they can be deleted.

import { list } from "@vercel/blob";
import { sql, ensureSchema } from "./db";

export interface UnusedBlob {
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export interface CleanupScan {
  unused: UnusedBlob[];
  unusedBytes: number;
  keptCount: number;
  keptBytes: number;
}

// Files this new are never touched, in case one is being saved right now.
const MIN_AGE_MS = 15 * 60 * 1000;
const FOLDER = "team-logos/";

const pathOf = (url: string): string => {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url;
  }
};

// Every logo file the database points at: team logos and per-season logos.
async function referencedPaths(): Promise<Set<string>> {
  await ensureSchema();
  const [teams, seasons] = await Promise.all([
    sql`SELECT logo_url FROM team_logos;`,
    sql`SELECT logo_url FROM team_season_looks WHERE logo_url IS NOT NULL;`,
  ]);
  const set = new Set<string>();
  for (const r of [...teams.rows, ...seasons.rows]) {
    if (r.logo_url) set.add(pathOf(r.logo_url as string));
  }
  return set;
}

export async function scanUnusedLogos(): Promise<CleanupScan> {
  const referenced = await referencedPaths();
  // If the database gave us nothing, something is wrong; never treat every file as unused.
  if (referenced.size === 0) throw new Error("No saved logos were found in the database, so nothing was checked.");

  const unused: UnusedBlob[] = [];
  let keptCount = 0;
  let keptBytes = 0;
  let cursor: string | undefined;
  const now = Date.now();
  do {
    const page = await list({ prefix: FOLDER, limit: 1000, cursor });
    for (const b of page.blobs) {
      const isReferenced = referenced.has(pathOf(b.url));
      const tooNew = now - new Date(b.uploadedAt).getTime() < MIN_AGE_MS;
      if (isReferenced || tooNew) {
        keptCount++;
        keptBytes += b.size;
      } else {
        unused.push({ url: b.url, name: b.pathname.replace(FOLDER, ""), size: b.size, uploadedAt: new Date(b.uploadedAt).toISOString() });
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  unused.sort((a, b) => b.size - a.size);
  return { unused, unusedBytes: unused.reduce((n, b) => n + b.size, 0), keptCount, keptBytes };
}
