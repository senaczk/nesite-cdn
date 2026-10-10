import { httpError, UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

const MB = 1024 * 1024;

export const zassMeta: ProviderMeta = {
  id: 'zass',
  name: 'Zass CDN',
  description: 'Next.js uploader advertising a 2 GB ceiling and permanent links.',
  status: 'ready',
  integration: 'direct',
  endpoint: 'https://cdn.zass.in/upload',
  method: 'POST',
  fileField: 'file',
  requiresAuth: false,
  auth: 'No API key',
  cors: 'Allowed — verified: OPTIONS and POST responses return Access-Control-Allow-Origin: *.',
  responseFormat: 'JSON { success, url, fileName, fileId, size }',
  directUrl: 'url',
  expiration: 'Documentation claims every upload returns a permanent URL. Not independently verifiable.',
  maxFileSizeBytes: 2 * 1024 * MB,
  maxFileSizeNote: '2 GB (stated on cdn.zass.in and its documentation page).',
  supportedFileTypes: 'any (docs: "No restriction on file types")',
  notes: 'Real upload verified 2026-10-10 and the returned URL was downloaded and byte-compared.',
};

/**
 * Verified response:
 *   {"success":true,"url":"https://cdn.zass.in/M8hUUG7Ahd.txt","fileName":"probe.txt","fileId":"M8hUUG7Ahd","size":53}
 */
export function parseZass(status: number, _contentType: string | null, body: string): NormalizedUpload {
  if (status < 200 || status >= 300) {
    throw httpError(status, 'Zass CDN', body);
  }
  let json: { success?: boolean; url?: string; fileName?: string; fileId?: string; size?: number; error?: string; message?: string };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new UploadError('parse', 'Zass CDN returned a response that is not JSON.', { status, detail: body.slice(0, 240) });
  }
  if (json.success === false || json.error) {
    throw new UploadError('parse', `Zass CDN: ${json.error ?? json.message ?? 'upload refused'}`, { status });
  }
  if (json.success !== true || !json.url) {
    throw new UploadError('parse', 'Zass CDN did not confirm a successful upload.', { status });
  }
  return { url: json.url, meta: { fileId: json.fileId ?? null, fileName: json.fileName ?? null, size: json.size ?? null } };
}

export const zass: ProviderAdapter = {
  meta: zassMeta,
  buildUpstreamRequest(file: File) {
    return { url: zassMeta.endpoint, method: 'POST', fields: [['file', file]] };
  },
  parseResponse: parseZass,
};