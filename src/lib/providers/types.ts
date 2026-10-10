/**
 * Shared provider contract.
 *
 * Every adapter in this folder is a plain object with two jobs:
 *   1. describe what the service can do (meta), and
 *   2. describe + normalise one concrete HTTP conversation (buildUpstreamRequest
 *      + parseResponse).
 *
 * Keeping the upstream request description data-only is what lets the Vercel
 * proxy reuse the exact same provider logic as the browser client, instead of
 * re-implementing (and drifting from) it server side.
 */

import { PROXY_BODY_LIMIT_BYTES } from '@/lib/upload/limits';

/** How the browser is expected to reach the provider. */
export type Integration = 'direct' | 'proxy' | 'none';

/** Audit verdict for a provider. See docs/provider-audit.md. */
export type ProviderStatus = 'ready' | 'partial' | 'unverified' | 'unsupported';

export interface ProviderAcknowledgement {
  title: string;
  body: string;
}

export interface ProviderMeta {
  id: string;
  name: string;
  /** One line shown on the radio card. */
  description: string;
  status: ProviderStatus;
  integration: Integration;
  /** Absolute upload endpoint used by `buildUpstreamRequest`. */
  endpoint: string;
  method: 'POST';
  /** multipart field name the upstream expects for the binary. */
  fileField: string;
  requiresAuth: boolean;
  /** Short human-readable auth summary, e.g. "No API key". */
  auth: string;
  cors: string;
  responseFormat: string;
  /** Where the direct URL lives in the upstream response. */
  directUrl: string;
  expiration: string;
  /** Null means "not verified" — never guessed. */
  maxFileSizeBytes: number | null;
  maxFileSizeNote: string;
  /** Extensions the provider is known to accept, or 'any' when verified unfiltered. */
  supportedFileTypes: string;
  /** Set when the user must acknowledge a real policy conflict first. */
  acknowledgement?: ProviderAcknowledgement;
  notes?: string;
}

/** One multipart field for the upstream request. Order is preserved. */
export type UpstreamField = readonly [name: string, value: string | Blob];

export interface UpstreamRequest {
  url: string;
  method: 'POST';
  fields: readonly UpstreamField[];
}

export interface UploadContext {
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

export interface NormalizedUpload {
  /** Exactly what the provider handed back, normalised to an absolute https/http URL. */
  url: string;
  /** Provider-specific extras (expiry, retention, id...) when the API reports them. */
  meta: Record<string, string | number | boolean | null>;
}

export interface ProviderAdapter {
  readonly meta: ProviderMeta;
  /**
   * Describes the upstream HTTP request for `file`. Never executed in the
   * browser for `integration: 'proxy'` providers, but still unit-tested.
   */
  buildUpstreamRequest(file: File): UpstreamRequest;
  /**
   * Same as `buildUpstreamRequest`, but honours UI-supplied options. Only
   * providers that actually expose a knob implement this.
   */
  buildRequest?(file: File, options: UploadOptions): UpstreamRequest;
  /**
   * Turns a successful upstream response into a direct URL.
   * Must throw UploadError on anything it cannot positively identify — never
   * invent a URL.
   */
  parseResponse(status: number, contentType: string | null, body: string): NormalizedUpload;
}

/** Upload options the UI can surface. */
export interface UploadOptions {
  /** Optional expiry string for providers that support one (vltcs: '30m' | '7d' | 'permanent'). */
  expiry?: string;
}

export function isUsable(meta: ProviderMeta): boolean {
  return meta.status === 'ready' || meta.status === 'partial';
}

/**
 * The size a provider will actually accept, once the relay's body limit is
 * taken into account. Lives here so the UI, the uploader and the proxy can
 * never disagree about the ceiling.
 */
/**
 * The "No API Key" badge is only shown for a provider whose audit positively
 * confirmed `requiresAuth: false`. A provider that needs a credential must not
 * get the badge, and must not be selectable without one configured.
 */
export function showsNoApiKeyBadge(meta: ProviderMeta): boolean {
  return meta.requiresAuth === false;
}

export function effectiveMaxSize(meta: ProviderMeta): number | null {
  const declared = meta.maxFileSizeBytes;
  if (meta.integration === 'proxy') {
    return declared == null ? PROXY_BODY_LIMIT_BYTES : Math.min(declared, PROXY_BODY_LIMIT_BYTES);
  }
  return declared;
}