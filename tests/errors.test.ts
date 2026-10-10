import { describe, expect, it } from 'vitest';

import { UploadError, describeError, httpError, isUploadError, toUploadError } from '@/lib/upload/errors';

describe('UploadError', () => {
  it('carries a code, status and short detail', () => {
    const err = new UploadError('http', 'boom', { status: 500, detail: 'x' });
    expect(err.name).toBe('UploadError');
    expect(err.code).toBe('http');
    expect(err.status).toBe(500);
    expect(isUploadError(err)).toBe(true);
  });

  it('survives being thrown and caught as an Error', () => {
    try {
      throw new UploadError('validation', 'bad file');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as UploadError).code).toBe('validation');
    }
  });
});

describe('httpError mapping', () => {
  it('maps 413 to too-large', () => {
    expect(httpError(413, 'Catbox').code).toBe('too-large');
  });

  it('maps 429 to rate-limited with actionable wording', () => {
    const err = httpError(429, 'Kappa');
    expect(err.code).toBe('rate-limited');
    expect(err.message).toMatch(/wait a moment/i);
  });

  it('maps 401/403 to http', () => {
    expect(httpError(401, 'Kappa').code).toBe('http');
    expect(httpError(403, 'Kappa').code).toBe('http');
  });

  it('maps 5xx to http and mentions the provider', () => {
    const err = httpError(503, 'Zass CDN');
    expect(err.code).toBe('http');
    expect(err.message).toContain('Zass CDN');
  });

  it('truncates a long upstream body so nothing huge reaches the UI', () => {
    const err = httpError(500, 'X', 'y'.repeat(10_000));
    expect(err.detail!.length).toBeLessThanOrEqual(240);
  });
});

describe('toUploadError', () => {
  it('passes an UploadError through untouched', () => {
    const original = new UploadError('parse', 'nope');
    expect(toUploadError(original, 'Kappa')).toBe(original);
  });

  it('maps an AbortError DOMException to cancelled', () => {
    expect(toUploadError(new DOMException('stop', 'AbortError'), 'Kappa').code).toBe('cancelled');
  });

  it('maps a TimeoutError DOMException to timeout', () => {
    expect(toUploadError(new DOMException('slow', 'TimeoutError'), 'Kappa').code).toBe('timeout');
  });

  it('maps a fetch TypeError to a network error that mentions the origin', () => {
    // Browsers use TypeError for both a dead network and a blocked CORS read;
    // we cannot tell them apart and must not pretend to.
    const err = toUploadError(new TypeError('Failed to fetch'), 'Nekohime Cloud');
    expect(err.code).toBe('network');
    expect(err.message).toContain('Nekohime Cloud');
    expect(err.message).toMatch(/down or blocking this origin/i);
  });

  it('falls back to a generic network error for unknown throws', () => {
    expect(toUploadError('weird', 'Kappa').code).toBe('network');
  });
});

describe('describeError', () => {
  it('always yields a non-empty sentence', () => {
    expect(describeError(new UploadError('timeout', 'slow'))).toBe('slow');
    expect(describeError(new Error('kaboom'))).toContain('kaboom');
    expect(describeError(undefined).length).toBeGreaterThan(0);
  });
});