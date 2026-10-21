import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { openDb } from './db';
import { createRepo } from './repo';
import { seedIfEmpty } from './seed';
import { createPhotoStore } from './services/photos';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(process.env.DATA_DIR ?? join(root, 'data'));
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

mkdirSync(dataDir, { recursive: true });
const db = openDb(join(dataDir, 'meal-planner.sqlite'));
const repo = createRepo(db);
if (process.env.SEED !== '0') seedIfEmpty(repo);

const app = buildApp({
  repo,
  photos: createPhotoStore(join(dataDir, 'photos')),
  webDist: join(root, 'web', 'dist'),
  logger: process.env.LOG === '1',
});

await app.listen({ port, host });

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === 'IPv4' && !a.internal)
  .map((a) => `http://${a!.address}:${port}`);
console.log(`\nMeal planner running.\n  This computer:  http://localhost:${port}`);
for (const a of addresses) console.log(`  On your Wi-Fi:  ${a}`);
console.log(`  Data folder:    ${dataDir}\n`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    db.close();
    process.exit(0);
  });
}
