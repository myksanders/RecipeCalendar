import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export function createPhotoStore(dir: string) {
  mkdirSync(dir, { recursive: true });

  function save(recipeId: number, data: Buffer, contentType: string): string {
    const ext = EXT[contentType.split(';')[0].trim().toLowerCase()];
    if (!ext) throw new Error(`Unsupported image type: ${contentType}`);
    const name = `${recipeId}-${Date.now()}-${randomBytes(3).toString('hex')}.${ext}`;
    writeFileSync(join(dir, name), data);
    return `/photos/${name}`;
  }

  function remove(urlPath: string | null) {
    if (!urlPath?.startsWith('/photos/')) return;
    try {
      unlinkSync(join(dir, basename(urlPath)));
    } catch {
      // already gone
    }
  }

  async function download(recipeId: number, url: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !EXT[type.split(';')[0].trim().toLowerCase()]) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_PHOTO_BYTES) return null;
      return save(recipeId, buf, type);
    } catch {
      return null;
    }
  }

  return { save, remove, download, dir };
}

export type PhotoStore = ReturnType<typeof createPhotoStore>;
