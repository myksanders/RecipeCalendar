// Build the web app into a fresh folder, then swap it into web/dist.
//
// Vite normally empties web/dist in place, which fails on macOS with
// "ENOTEMPTY, Directory not empty" if anything touches the folder meanwhile
// (the running app, a second build, Finder or Spotlight). Building next to it
// and renaming avoids that, and the running app keeps its old files until the swap.
import { existsSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'web', 'dist');
const next = `${dist}.next`;
const old = `${dist}.old`;
const remove = (dir) => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

remove(next);
await build({ configFile: join(root, 'vite.config.ts'), build: { outDir: next, emptyOutDir: true } });

try {
  remove(old);
} catch {
  // a leftover from an earlier build that couldn't be removed; renamed aside below
}
if (existsSync(old)) renameSync(old, `${old}-${Date.now()}`);
if (existsSync(dist)) renameSync(dist, old);
renameSync(next, dist);
try {
  remove(old);
} catch (err) {
  console.warn(`Built fine, but couldn't remove the previous build at ${old} (${err.code}). It's safe to delete.`);
}
