import { db } from './db.js';
import { HttpError } from './http.js';

const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']);
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export async function prepareUpload(input) {
  const fileName = typeof input?.file_name === 'string' ? input.file_name.trim() : '';
  const sizeBytes = Number(input?.size_bytes); const contentType = String(input?.content_type ?? '').toLowerCase(); const sha256 = String(input?.sha256 ?? '').toLowerCase();
  if (!fileName || fileName.length > 200 || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 25 * 1024 * 1024 || !TYPES.has(contentType) || !SHA256.test(sha256)) throw new HttpError(422, 'Choose a PNG, JPEG, WebP, SVG or PDF up to 25 MB.');
  return db().prepareArtworkUpload({ fileName, sizeBytes, contentType, sha256 });
}

export async function download(id) {
  if (!UUID.test(String(id))) throw new HttpError(404, 'Artwork not found.');
  const file = await db().getArtwork(id); if (!file) throw new HttpError(404, 'Artwork not found.');
  return file;
}
