import { httpError, UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

export const cmntyMeta: ProviderMeta = {
  id: 'cmnty',
  name: 'CMNTY CDN',
  description: 'Self-documenting Express API; /api/upload returns usage examples.',
  status: 'ready',
  integration: 'direct',
  endpoint: 'https://cdn.cmnty.web.id/upload',
  method: 'POST',
  fileField: 'file',
  requiresAuth: false,
  auth: 'No API key',
  cors: 'Allowed — verified: OPTIONS and POST responses return Access-Control-Allow-Origin: *.',
  responseFormat: 'JSON { success, message, url, id, filename, size, mime, ext }',
  directUrl: 'url',
  expiration: 'Not documented. No expiry field in the upload response.',
  maxFileSizeBytes: null,
  maxFileSizeNote: 'Not verified — the API publishes no limit, so no client-side cap is claimed.',
  supportedFileTypes: 'any (the API states it accepts any field name and any file type)',
  notes:
    'Real upload verified 2026-10-10 and the returned path was downloaded and byte-compared. /api/upload also answers GET with the API description. The API returns an http:// URL; it 308-redirects to https://.',
};

/**
 * Verified response:
 *   {"success":true,"message":"File uploaded successfully to CDN","url":"http://cdn.cmnty.web.id/txt/8i5o23",
 *    "id":"8i5o23","filename":"probe.txt","size":53,"mime":"text/plain","ext":"txt"}
 */
export function parseCmnty(status: number, _contentType: string | null, body: string): NormalizedUpload {
  if (status < 200 || status >= 300) {
    throw httpError(status, 'CMNTY CDN', body);
  }
  let json: { success?: boolean; url?: string; id?: string; filename?: string; size?: number; mime?: string; message?: string };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new UploadError('parse', 'CMNTY CDN returned a response that is not JSON.', { status, detail: body.slice(0, 240) });
  }
  if (json.success === false) {
    throw new UploadError('parse', `CMNTY CDN: ${json.message ?? 'upload refused'}`, { status });
  }
  if (json.success !== true || !json.url) {
    throw new UploadError('parse', 'CMNTY CDN did not confirm a successful upload.', { status });
  }
  return {
    url: json.url,
    meta: { id: json.id ?? null, filename: json.filename ?? null, size: json.size ?? null, mime: json.mime ?? null },
  };
}

export const cmnty: ProviderAdapter = {
  meta: cmntyMeta,
  buildUpstreamRequest(file: File) {
    return { url: cmntyMeta.endpoint, method: 'POST', fields: [['file', file]] };
  },
  parseResponse: parseCmnty,
};