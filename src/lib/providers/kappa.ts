import { httpError, UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta, UpstreamRequest } from './types';

export const kappaMeta: ProviderMeta = {
  id: 'kappa',
  name: 'Kappa',
  description: 'SvelteKit file host; short links plus a delete key per upload.',
  status: 'ready',
  integration: 'direct',
  endpoint: 'https://kappa.lol/api/upload',
  method: 'POST',
  fileField: 'file',
  requiresAuth: false,
  auth: 'No API key',
  cors: 'Allowed — verified: cross-origin POST returns Access-Control-Allow-Origin: * (preflight answers 204 with POST allowed).',
  responseFormat: 'JSON { id, ext, type, checksum, key, link, delete }',
  directUrl: 'link',
  expiration: 'Not documented. No expiry field in the upload response.',
  maxFileSizeBytes: null,
  maxFileSizeNote: 'Not verified — kappa.lol publishes no limit, so no client-side cap is claimed.',
  supportedFileTypes: 'any (UI previews images/video/audio; the endpoint accepted text/plain)',
  notes:
    'Real upload verified 2026-10-10 and the returned link was downloaded and byte-compared. The response includes a per-file "delete" URL and a one-time key.',
};

/**
 * Verified response:
 *   {"id":"5034ev","ext":".txt","type":"text/plain","checksum":"...","key":"0NIPK6TXuDQDwiw9",
 *    "link":"https://kappa.lol/5034ev","delete":"https://kappa.lol/delete?0NIPK6TXuDQDwiw9"}
 */
export function parseKappa(status: number, _contentType: string | null, body: string): NormalizedUpload {
  if (status < 200 || status >= 300) {
    throw httpError(status, 'Kappa', body);
  }
  let json: { id?: string; link?: string; ext?: string; type?: string; checksum?: string; key?: string; error?: string; message?: string };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new UploadError('parse', 'Kappa returned a response that is not JSON.', { status, detail: body.slice(0, 240) });
  }
  if (json.error) {
    throw new UploadError('parse', `Kappa: ${json.error}`, { status });
  }
  if (!json.link) {
    throw new UploadError('parse', 'Kappa accepted the request but returned no link.', { status });
  }
  const url = json.link.startsWith('http') ? json.link : `https://${json.link}`;
  return { url, meta: { id: json.id ?? null, ext: json.ext ?? null, type: json.type ?? null, checksum: json.checksum ?? null } };
}

/**
 * Kappa supports two documented query flags, both honoured by their own UI:
 *   ?skip-cd=true   -> serve inline instead of as an attachment
 *   ?long-id=true   -> use the long random id instead of the short one
 */
export function buildKappaRequest(file: File, options: { skipContentDisposition?: boolean; longId?: boolean } = {}): UpstreamRequest {
  const flags: string[] = [];
  if (options.skipContentDisposition) flags.push('skip-cd=true');
  if (options.longId) flags.push('long-id=true');
  const query = flags.length ? `?${flags.join('&')}` : '';
  return {
    url: `${kappaMeta.endpoint}${query}`,
    method: 'POST',
    fields: [['file', file]],
  };
}

export const kappa: ProviderAdapter = {
  meta: kappaMeta,
  buildUpstreamRequest: (file) => buildKappaRequest(file),
  parseResponse: parseKappa,
};