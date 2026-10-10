import { httpError, UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

const MB = 1024 * 1024;

export const senxcMeta: ProviderMeta = {
  id: 'senxc',
  name: 'SenaVuck CDN',
  description: 'Cloudflare Worker uploader, plain multipart, no account.',
  status: 'ready',
  integration: 'direct',
  endpoint: 'https://cp.senxc.my.id/api/upload',
  method: 'POST',
  fileField: 'file',
  requiresAuth: false,
  auth: 'No API key',
  cors: 'Allowed — verified: OPTIONS /api/upload returns Access-Control-Allow-Origin: * with POST, GET, OPTIONS.',
  responseFormat: 'JSON { link, name, size }',
  directUrl: 'link (scheme-less host/path — prefixed with https://)',
  expiration: 'Not documented. No expiry field in the upload response.',
  maxFileSizeBytes: 20 * MB,
  maxFileSizeNote: '20 MB (limit declared on cp.senxc.my.id).',
  supportedFileTypes: 'any',
  notes: 'Real upload verified 2026-10-10 and the returned link was downloaded and byte-compared.',
};

/**
 * Verified response:
 *   {"link":"cp.senxc.my.id/f/383e7447d.txt","name":"probe.txt","size":53}
 * The `link` value carries no scheme; their own page does `'https://' + link`.
 */
export function parseSenxc(status: number, _contentType: string | null, body: string): NormalizedUpload {
  if (status < 200 || status >= 300) {
    throw httpError(status, 'SenaVuck CDN', body);
  }
  let json: { link?: string; name?: string; size?: number; error?: string };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new UploadError('parse', 'SenaVuck CDN returned a response that is not JSON.', { status, detail: body.slice(0, 240) });
  }
  if (json.error) {
    throw new UploadError('parse', `SenaVuck CDN: ${json.error}`, { status });
  }
  if (!json.link) {
    throw new UploadError('parse', 'SenaVuck CDN accepted the request but returned no link.', { status });
  }
  const url = json.link.startsWith('http') ? json.link : `https://${json.link}`;
  return { url, meta: { name: json.name ?? null, size: typeof json.size === 'number' ? json.size : null } };
}

export const senxc: ProviderAdapter = {
  meta: senxcMeta,
  buildUpstreamRequest(file: File) {
    return { url: senxcMeta.endpoint, method: 'POST', fields: [['file', file]] };
  },
  parseResponse: parseSenxc,
};