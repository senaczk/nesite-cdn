import { httpError, UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta, UpstreamRequest } from './types';

const MB = 1024 * 1024;

export const vltcsMeta: ProviderMeta = {
  id: 'vltcs',
  name: 'Violetics CDN',
  description: 'Fully documented CDN with optional per-file expiry.',
  status: 'ready',
  integration: 'direct',
  endpoint: 'https://s7.vltcs.my.id/api/upload',
  method: 'POST',
  fileField: 'file',
  requiresAuth: false,
  auth: 'No API key (their docs state "No SDK, no auth for the public endpoints")',
  cors: 'Allowed — verified: OPTIONS /api/upload returns Access-Control-Allow-Origin: * with POST allowed.',
  responseFormat: 'JSON { success, file: { id, name, size, mimeType, uploadedAt, expiresAt, url, ... } }',
  directUrl: 'file.url',
  expiration: 'Configurable per upload via the `expiry` field (e.g. 30m, 2h, 7d, 1w, or "permanent"). Default: permanent.',
  maxFileSizeBytes: 50 * MB,
  maxFileSizeNote: '50 MB (stated in their API reference).',
  supportedFileTypes: 'any',
  notes:
    'Real upload verified 2026-10-10 and the returned URL was downloaded and byte-compared. The API returns an http:// URL that redirects to https://.',
};

/**
 * Verified response:
 *   {"creator":"...","success":true,"file":{"id":"0ddce288375d","name":"probe.txt","size":53,
 *    "mimeType":"text/plain","uploadedAt":"...","expiresAt":null,"url":"http://s7.vltcs.my.id/d/0ddce288375d.txt"}}
 */
export function parseVltcs(status: number, _contentType: string | null, body: string): NormalizedUpload {
  if (status < 200 || status >= 300) {
    throw httpError(status, 'Violetics CDN', body);
  }
  let json: { success?: boolean; file?: Record<string, unknown>; error?: string };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new UploadError('parse', 'Violetics CDN returned a response that is not JSON.', { status, detail: body.slice(0, 240) });
  }
  if (json.success === false || json.error) {
    throw new UploadError('parse', `Violetics CDN: ${json.error ?? 'upload refused'}`, { status });
  }
  const url = json.file?.url;
  if (typeof url !== 'string' || !url) {
    throw new UploadError('parse', 'Violetics CDN accepted the request but returned no URL.', { status });
  }
  return {
    url,
    meta: {
      id: (json.file!.id as string) ?? null,
      name: (json.file!.originalName as string) ?? (json.file!.name as string) ?? null,
      size: (json.file!.size as number) ?? null,
      mimeType: (json.file!.mimeType as string) ?? null,
      expiresAt: (json.file!.expiresAt as string) ?? null,
    },
  };
}

/** Expiry grammar from their docs: `<number><m|h|d|w>` or the literal `permanent`. */
export const VLTCS_EXPIRY_PRESETS = [
  { value: 'permanent', label: 'Never expires' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '1w', label: '1 week' },
];

export function isValidVltcsExpiry(value: string): boolean {
  return value === 'permanent' || /^\d+[mhdw]$/.test(value);
}

export function buildVltcsRequest(file: File, expiry?: string): UpstreamRequest {
  const fields: UpstreamRequest['fields'][number][] = [['file', file]];
  if (expiry && isValidVltcsExpiry(expiry)) {
    fields.push(['expiry', expiry]);
  }
  return { url: vltcsMeta.endpoint, method: 'POST', fields };
}

export const vltcs: ProviderAdapter = {
  meta: vltcsMeta,
  buildUpstreamRequest: (file) => buildVltcsRequest(file),
  buildRequest: (file, options) => buildVltcsRequest(file, options.expiry),
  parseResponse: parseVltcs,
};