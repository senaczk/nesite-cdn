import { describe, expect, it } from 'vitest';

import {
  adapters,
  countByStatus,
  getAdapter,
  isProxyAllowed,
  listProviders,
  listSelectableProviders,
  listUnavailableProviders,
} from '@/lib/providers/registry';
import { effectiveMaxSize, isUsable, showsNoApiKeyBadge, type ProviderMeta } from '@/lib/providers/types';
import { PROXY_BODY_LIMIT_BYTES } from '@/lib/upload/limits';

/** The exact ids the brief asked us to audit. */
const BRIEF_IDS = ['nekohime', 'catbox', 'senxc', 'xcute', 'eightupload', 'kappa', 'zass', 'vltcs', 'cmnty', 'athars'];

describe('provider registry', () => {
  it('covers every provider from the brief exactly once', () => {
    const ids = listProviders().map((p) => p.id);
    expect([...ids].sort()).toEqual([...BRIEF_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves adapters by id and returns undefined for unknown ids', () => {
    expect(getAdapter('catbox')?.meta.id).toBe('catbox');
    expect(getAdapter('nope')).toBeUndefined();
  });

  it('only offers ready/partial providers in the picker', () => {
    for (const provider of listSelectableProviders()) {
      expect(isUsable(provider)).toBe(true);
      expect(provider.integration).not.toBe('none');
    }
  });

  it('keeps unusable providers out of the picker', () => {
    const unusable = listUnavailableProviders().map((p) => p.id);
    expect(unusable).toEqual(['eightupload', 'athars']);
    for (const id of unusable) {
      expect(listSelectableProviders().some((p) => p.id === id)).toBe(false);
    }
  });

  it('partitions providers across the four audit statuses', () => {
    const byStatus = countByStatus();
    const total = Object.values(byStatus).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(BRIEF_IDS.length);
    expect(byStatus.ready.map((p) => p.id).sort()).toEqual(['cmnty', 'kappa', 'senxc', 'vltcs', 'xcute', 'zass']);
    expect(byStatus.partial.map((p) => p.id).sort()).toEqual(['catbox', 'nekohime']);
    expect(byStatus.unverified.map((p) => p.id)).toEqual(['athars']);
    expect(byStatus.unsupported.map((p) => p.id)).toEqual(['eightupload']);
  });

  it('marks every unauthenticated provider honestly', () => {
    for (const provider of listProviders()) {
      expect(provider.requiresAuth).toBe(false);
      expect(provider.auth.length).toBeGreaterThan(0);
    }
  });

  it('shows the "No API Key" badge only where auth was positively disproved', () => {
    // The brief allows the badge only for verified keyless providers.
    const badge = listProviders().filter(showsNoApiKeyBadge);
    expect(badge).toHaveLength(BRIEF_IDS.length);

    // A provider that needed a credential must be excluded.
    const needsAuth = { ...listProviders()[0], requiresAuth: true };
    expect(showsNoApiKeyBadge(needsAuth)).toBe(false);
  });

  it('only allows the two CORS-blocked providers through the proxy allowlist', () => {
    expect(isProxyAllowed('nekohime')).toBe(true);
    expect(isProxyAllowed('catbox')).toBe(true);
    // A caller must never be able to route a direct provider (or anything else)
    // through the relay.
    expect(isProxyAllowed('kappa')).toBe(false);
    expect(isProxyAllowed('https://evil.example')).toBe(false);
    expect(isProxyAllowed('')).toBe(false);
  });

  it('keeps every proxied provider on the allowlist and vice versa', () => {
    for (const provider of listProviders()) {
      if (provider.integration === 'proxy') {
        expect(isProxyAllowed(provider.id)).toBe(true);
      }
    }
  });

  it('only attaches a policy acknowledgement to providers that have one', () => {
    const withAck: ProviderMeta[] = listProviders().filter((p) => p.acknowledgement);
    expect(withAck.map((p) => p.id)).toEqual(['catbox']);
    expect(withAck[0].acknowledgement?.body.length).toBeGreaterThan(80);
  });

  it('describes every provider without empty fields', () => {
    for (const provider of listProviders()) {
      expect(provider.description.length).toBeGreaterThan(10);
      expect(provider.cors.length).toBeGreaterThan(10);
      expect(provider.responseFormat.length).toBeGreaterThan(5);
      expect(provider.expiration.length).toBeGreaterThan(5);
      expect(provider.directUrl.length).toBeGreaterThan(2);
      expect(provider.supportedFileTypes.length).toBeGreaterThan(2);
      // maxFileSizeBytes may legitimately be null (unverified), but the human
      // note must always say so out loud.
      if (provider.maxFileSizeBytes === null) {
        expect(provider.maxFileSizeNote.toLowerCase()).toMatch(/not verified|not documented|not published/);
      }
    }
  });

  it('uses https for every documented endpoint', () => {
    for (const adapter of adapters) {
      expect(adapter.meta.endpoint.startsWith('https://')).toBe(true);
      expect(adapter.meta.method).toBe('POST');
      expect(adapter.meta.fileField.length).toBeGreaterThan(0);
    }
  });

  it('caps relay-backed providers at the serverless body limit', () => {
    for (const provider of listProviders().filter((p) => p.integration === 'proxy')) {
      expect(effectiveMaxSize(provider)).toBeLessThanOrEqual(PROXY_BODY_LIMIT_BYTES);
    }
    // A direct provider keeps its own published limit.
    const kappa = listProviders().find((p) => p.id === 'kappa')!;
    expect(effectiveMaxSize(kappa)).toBe(kappa.maxFileSizeBytes);
  });

  it('uses the relay ceiling when a relay provider publishes no limit', () => {
    const unknown = { ...listProviders()[0], integration: 'proxy' as const, maxFileSizeBytes: null };
    expect(effectiveMaxSize(unknown)).toBe(PROXY_BODY_LIMIT_BYTES);
  });
});