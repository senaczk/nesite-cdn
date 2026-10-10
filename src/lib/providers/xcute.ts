import { httpError, UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

const TB = 1024 * 1024 * 1024 * 1024;

export const xcuteMeta: ProviderMeta = {
  id: 'xcute',
  name: 'SILENTPHANTOM',
  description: 'Cloudflare Worker uploader with published API docs.',
  status: 'ready',
  integration: 'direct',
  endpoint: 'https://x.xcute.workers.dev/api/upload',
  method: 'POST',
  fileField: 'file',
  requiresAuth: false,
  auth: 'No API key (docs state "Anonymous, no API key required")',
  cors: 'Allowed — verified: upload responses and OPTIONS return Access-Control-Allow-Origin: *.',
  responseFormat: 'JSON { status, message, result: { url, filename, mimetype, size, retention, expiresAt, ... } }',
  directUrl: 'result.url',
  expiration: 'Permanent — the API reports retention: "permanent", expiresAt: "never".',
  // Their docs literally say "max size: 1000 Tera per file". We refuse to present
  // that as a real guarantee, so the adapter leaves the usable limit open and the
  // UI relies on the verified 5 GB Vercel/edge-safe working ceiling instead.
  maxFileSizeBytes: 5 * TB,
  maxFileSizeNote: 'Docs advertise "1000 Tera per file" (not a credible figure). Treated as effectively unlimited.',
  supportedFileTypes: 'any',
  notes:
    'Real upload verified 2026-10-10 and the returned URL was downloaded and byte-compared. Filenames are randomised; originals are not stored.',
};

/**
 * Verified response:
 *   {"status":true,"message":"Upload successful","result":{"filename":"e0c1a6872bc6.txt","category":"documents",
 *    "path":"documents/e0c1a6872bc6.txt","url":"https://x.xcute.workers.dev/f/documents/e0c1a6872bc6.txt",
 *    "mimetype":"text/plain","size":53,"retention":"permanent","expiresAt":"never", ...}}
 */
export function parseXcute(status: number, _contentType: string | null, body: string): NormalizedUpload {
  if (status < 200 || status >= 300) {
    throw httpError(status, 'SILENTPHANTOM', body);
  }
  let json: { status?: boolean; message?: string; error?: string; result?: Record<string, unknown> };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new UploadError('parse', 'SILENTPHANTOM returned a response that is not JSON.', { status, detail: body.slice(0, 240) });
  }
  if (json.status === false || json.error) {
    throw new UploadError('parse', `SILENTPHANTOM: ${json.error ?? json.message ?? 'upload refused'}`, { status });
  }
  const url = json.result?.url;
  if (typeof url !== 'string' || !url) {
    throw new UploadError('parse', 'SILENTPHANTOM accepted the request but returned no URL.', { status });
  }
  const result = json.result ?? {};
  return {
    url,
    meta: {
      filename: (result.filename as string) ?? null,
      size: (result.size as number) ?? null,
      mimetype: (result.mimetype as string) ?? null,
      retention: (result.retention as string) ?? null,
      expiresAt: (result.expiresAt as string) ?? null,
    },
  };
}

export const xcute: ProviderAdapter = {
  meta: xcuteMeta,
  buildUpstreamRequest(file: File) {
    return { url: xcuteMeta.endpoint, method: 'POST', fields: [['file', file]] };
  },
  parseResponse: parseXcute,
};