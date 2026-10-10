import { UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

const MB = 1024 * 1024;

export const nekohimeMeta: ProviderMeta = {
  id: 'nekohime',
  name: 'Nekohime Cloud',
  description: 'Global CDN uploader with a plain multipart endpoint.',
  status: 'partial',
  integration: 'proxy',
  endpoint: 'https://cdn.nekohime.site/upload',
  method: 'POST',
  fileField: 'file',
  requiresAuth: false,
  auth: 'No API key',
  cors: 'None — verified: POST responses carry no Access-Control-Allow-Origin, so browser-direct upload is blocked.',
  responseFormat: 'JSON { files: [{ url, filename, status }], message }',
  directUrl: 'files[0].url',
  expiration: 'Not documented. No expiry field in the upload response.',
  maxFileSizeBytes: 100 * MB,
  maxFileSizeNote: '100 MB (client-side limit in Nekohime Cloud\'s own upload page).',
  supportedFileTypes: 'any',
  notes:
    'Real upload verified 2026-10-10. Reachable from our own proxy only; the browser path is blocked by the missing CORS header.',
};

/**
 * Verified response:
 *   {"files":[{"url":"https://cdn.nekohime.site/file/jiep84xx.txt","filename":"jiep84xx.txt","status":"uploaded"}],"message":"Files uploaded successfully!"}
 */
export function parseNekohime(status: number, _contentType: string | null, body: string): NormalizedUpload {
  if (status < 200 || status >= 300) {
    throw new UploadError('http', `Nekohime Cloud returned HTTP ${status}.`, { status, detail: body.slice(0, 240) });
  }

  let json: { files?: { url?: string; filename?: string }[] };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new UploadError('parse', 'Nekohime Cloud returned a response that is not JSON.', { status, detail: body.slice(0, 240) });
  }

  const entry = json.files?.[0];
  if (!entry?.url) {
    throw new UploadError('parse', 'Nekohime Cloud accepted the request but returned no file URL.', { status });
  }
  return { url: entry.url, meta: { filename: entry.filename ?? null } };
}

export const nekohime: ProviderAdapter = {
  meta: nekohimeMeta,
  buildUpstreamRequest(file: File) {
    return { url: nekohimeMeta.endpoint, method: 'POST', fields: [['file', file]] };
  },
  parseResponse: parseNekohime,
};