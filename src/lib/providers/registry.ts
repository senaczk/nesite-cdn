import { athars } from './athars';
import { catbox } from './catbox';
import { cmnty } from './cmnty';
import { eightupload } from './eightupload';
import { kappa } from './kappa';
import { nekohime } from './nekohime';
import { senxc } from './senxc';
import { vltcs } from './vltcs';
import { xcute } from './xcute';
import { zass } from './zass';
import { isUsable, type ProviderAdapter, type ProviderMeta, type ProviderStatus } from './types';

/**
 * Every provider from the brief, in the order the audit found them easiest to
 * reason about: the ones that work from the browser first, proxied ones next,
 * and the ones we cannot honestly offer last.
 */
export const adapters: readonly ProviderAdapter[] = [
  kappa,
  senxc,
  xcute,
  cmnty,
  vltcs,
  zass,
  nekohime,
  catbox,
  eightupload,
  athars,
];

const byId = new Map(adapters.map((a) => [a.meta.id, a]));

export function getAdapter(id: string): ProviderAdapter | undefined {
  return byId.get(id);
}

export function listProviders(): ProviderMeta[] {
  return adapters.map((a) => a.meta);
}

/** Providers a user can actually pick. */
export function listSelectableProviders(): ProviderMeta[] {
  return adapters.filter((a) => isUsable(a.meta)).map((a) => a.meta);
}

/** Providers we audit but do not offer, so the UI can still explain them. */
export function listUnavailableProviders(): ProviderMeta[] {
  return adapters.filter((a) => !isUsable(a.meta)).map((a) => a.meta);
}

export function countByStatus(): Record<ProviderStatus, ProviderMeta[]> {
  const out: Record<ProviderStatus, ProviderMeta[]> = { ready: [], partial: [], unverified: [], unsupported: [] };
  for (const meta of listProviders()) out[meta.status].push(meta);
  return out;
}

/**
 * The allowlist the serverless proxy is allowed to talk to. Hard-coded on
 * purpose: the proxy must never accept a caller-supplied URL.
 */
export const PROXY_ALLOWED_PROVIDER_IDS = ['nekohime', 'catbox'] as const;
export type ProxyProviderId = (typeof PROXY_ALLOWED_PROVIDER_IDS)[number];

export function isProxyAllowed(id: string): id is ProxyProviderId {
  return (PROXY_ALLOWED_PROVIDER_IDS as readonly string[]).includes(id);
}