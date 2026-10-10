'use client';

import { CATBOX_BLOCKED_EXTENSIONS } from './catbox';
import { getAdapter } from './registry';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta, UploadOptions } from './types';
import { effectiveMaxSize } from './types';
import { UploadError } from '@/lib/upload/errors';
import { DIRECT_UPLOAD_TIMEOUT_MS, PROXY_UPLOAD_TIMEOUT_MS, postFormData } from '@/lib/upload/transport';
import { validateForProvider } from '@/lib/upload/validation';

/** Re-exported so callers can reach the relay ceiling without a second import. */
export { PROXY_BODY_LIMIT_BYTES } from '@/lib/upload/limits';

/** Where our own serverless proxy lives. */
export const PROXY_PATH = '/api/upload-proxy';

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  /** 0-100, clamped. */
  percent: number;
}

export interface PerformUploadArgs {
  providerId: string;
  file: File;
  options?: UploadOptions;
  signal?: AbortSignal;
  onProgress?: (event: UploadProgressEvent) => void;
}

/**
 * Runs one upload through one provider.
 *
 * Direct providers POST straight to the provider from the browser. Proxied
 * providers POST to our own allowlisted Vercel function, which rebuilds the
 * upstream request using the *same* adapter — so provider-specific knowledge
 * still lives in exactly one place.
 */
export async function performUpload({
  providerId,
  file,
  options = {},
  signal,
  onProgress,
}: PerformUploadArgs): Promise<NormalizedUpload> {
  const adapter = getAdapter(providerId);
  if (!adapter) {
    throw new UploadError('unsupported', `Unknown provider "${providerId}".`);
  }
  const { meta } = adapter;

  if (meta.status !== 'ready' && meta.status !== 'partial') {
    throw new UploadError(meta.status === 'unsupported' ? 'unsupported' : 'unverified', describeUnavailable(meta));
  }

  const check = validateForProvider(file, {
    id: meta.id,
    maxFileSizeBytes: effectiveLimit(adapter),
    blockedExtensions: BLOCKED_EXTENSIONS[meta.id],
  });
  if (!check.ok) {
    throw new UploadError('validation', check.error ?? 'That file cannot be uploaded here.');
  }

  const report = (loaded: number, total: number) => {
    if (!onProgress) return;
    onProgress({ loaded, total, percent: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0 });
  };

  if (meta.integration === 'proxy') {
    return uploadThroughProxy(meta.id, file, { signal, report });
  }
  return uploadDirect(adapter, file, options, { signal, report });
}

async function uploadDirect(
  adapter: ProviderAdapter,
  file: File,
  options: UploadOptions,
  ctx: { signal?: AbortSignal; report: (loaded: number, total: number) => void },
): Promise<NormalizedUpload> {
  const upstream = adapter.buildRequest?.(file, options) ?? adapter.buildUpstreamRequest(file);
  const formData = new FormData();
  for (const [name, value] of upstream.fields) formData.append(name, value);

  const res = await postFormData({
    url: upstream.url,
    formData,
    timeoutMs: DIRECT_UPLOAD_TIMEOUT_MS,
    signal: ctx.signal,
    onProgress: ctx.report,
  });

  // The adapter decides whether this is a URL or an error. No fallback guessing.
  return adapter.parseResponse(res.status, res.contentType, res.body);
}

async function uploadThroughProxy(
  providerId: string,
  file: File,
  ctx: { signal?: AbortSignal; report: (loaded: number, total: number) => void },
): Promise<NormalizedUpload> {
  const formData = new FormData();
  formData.append('provider', providerId);
  formData.append('file', file, file.name);

  const res = await postFormData({
    url: PROXY_PATH,
    formData,
    timeoutMs: PROXY_UPLOAD_TIMEOUT_MS,
    signal: ctx.signal,
    onProgress: ctx.report,
  });

  let json: { ok?: boolean; url?: string; meta?: Record<string, unknown>; error?: string };
  try {
    json = JSON.parse(res.body) as typeof json;
  } catch {
    throw new UploadError('parse', `The upload proxy returned an unreadable response (HTTP ${res.status}).`, {
      status: res.status,
    });
  }

  if (!json.ok || typeof json.url !== 'string' || !json.url) {
    throw new UploadError('parse', json.error ?? `The upload proxy failed (HTTP ${res.status}).`, { status: res.status });
  }
  return { url: json.url, meta: (json.meta as NormalizedUpload['meta']) ?? {} };
}

/**
 * Restrictions that were actually observed during the audit, not guessed.
 * Sourced from the Catbox adapter so the list has exactly one definition.
 */
const BLOCKED_EXTENSIONS: Record<string, readonly string[] | undefined> = {
  catbox: CATBOX_BLOCKED_EXTENSIONS,
};

/** The size this provider will actually accept, relay ceiling included. */
export function effectiveLimit(adapter: ProviderAdapter): number | null {
  return effectiveMaxSize(adapter.meta);
}

function describeUnavailable(meta: ProviderMeta): string {
  switch (meta.id) {
    case 'eightupload':
      return '8upload is unavailable: its upload works but the resulting file URL is not publicly reachable.';
    case 'athars':
      return 'Athars CDN is unavailable: its backend answered HTTP 522 during the audit.';
    default:
      return `${meta.name} is not available.`;
  }
}