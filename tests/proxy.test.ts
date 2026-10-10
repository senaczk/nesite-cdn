import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, POST } from '@/app/api/upload-proxy/route';
import { PROXY_BODY_LIMIT_BYTES } from '@/lib/upload/limits';

import { makeFile, makeRequest, jsonOf } from './helpers';

const PROXYABLE = ['nekohime', 'catbox'];

/** Reads the (url, init) pair out of the single stubbed fetch call. */
function callOf(spy: ReturnType<typeof stubFetch>): [string, RequestInit] {
  expect(spy).toHaveBeenCalledTimes(1);
  const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
  return [url, init];
}

function stubFetch(status: number, body: string, contentType = 'application/json') {
  const spy = vi.fn(async () => new Response(body, { status, headers: { 'content-type': contentType } }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  // Safety net: a unit test must never reach a real provider. Tests that need
  // an upstream response install their own stub via stubFetch().
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('unexpected network call: a unit test must stub fetch');
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('POST /api/upload-proxy', () => {
  it('rejects a GET — this endpoint only speaks multipart POST', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect((await jsonOf(res)).ok).toBe(false);
  });

  it('refuses a provider that is not on the allowlist', async () => {
    for (const provider of ['kappa', 'xcute', 'zass', '', 'https://evil.example', '../secrets']) {
      const res = await POST(makeRequest({ provider, file: makeFile() }));
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).error).toMatch(/Unknown or non-proxied provider/);
    }
  });

  it('rejects a body larger than the relay ceiling before reading it', async () => {
    const request = makeRequest({ provider: 'nekohime', file: makeFile() });
    // Forge an oversized declared length without allocating 4 MB of memory.
    const headers = new Headers(request.headers);
    headers.set('content-length', String(PROXY_BODY_LIMIT_BYTES + 1));
    const res = await POST(new Request(request, { headers }));
    expect(res.status).toBe(413);
    expect((await jsonOf(res)).error).toMatch(/serverless function/i);
  });

  it('rejects a real oversized file', async () => {
    const res = await POST(makeRequest({ provider: 'catbox', file: makeFile(PROXY_BODY_LIMIT_BYTES + 1024) }));
    expect(res.status).toBe(413);
  });

  it('rejects a missing or empty file', async () => {
    expect((await POST(makeRequest({ provider: 'nekohime' }))).status).toBe(400);
    expect((await POST(makeRequest({ provider: 'nekohime', file: makeFile(0) }))).status).toBe(400);
  });

  it('rejects a non-file "file" field', async () => {
    const form = new FormData();
    form.append('provider', 'nekohime');
    form.append('file', 'just a string');
    const res = await POST(new Request('http://local/api/upload-proxy', { method: 'POST', body: form }));
    expect(res.status).toBe(400);
  });

  it('forwards to the provider endpoint the adapter chose — not a caller-supplied URL', async () => {
    const spy = stubFetch(200, '{"files":[{"url":"https://cdn.nekohime.site/file/abc.txt"}]}');
    const res = await POST(makeRequest({ provider: 'nekohime', file: makeFile(53, 'probe.txt') }));

    expect(res.status).toBe(200);
    const [upstreamUrl, init] = callOf(spy);
    expect(upstreamUrl).toBe('https://cdn.nekohime.site/upload');
    expect(init.method).toBe('POST');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('lets the adapter shape the upstream form, including catbox hidden fields', async () => {
    const spy = stubFetch(200, 'https://files.catbox.moe/abc123.txt', 'text/html; charset=UTF-8');
    const res = await POST(makeRequest({ provider: 'catbox', file: makeFile(53, 'probe.txt') }));

    expect(res.status).toBe(200);
    const [upstreamUrl, init] = callOf(spy);
    expect(upstreamUrl).toBe('https://catbox.moe/user/api.php');
    const body = init.body as FormData;
    expect(body.get('reqtype')).toBe('fileupload');
    expect(body.get('userhash')).toBe('');
    expect(body.get('fileToUpload')).toBeInstanceOf(File);
  });

  it('returns the provider URL verbatim on success', async () => {
    stubFetch(200, '{"files":[{"url":"https://cdn.nekohime.site/file/spaj6her.txt","filename":"spaj6her.txt"}]}');
    const res = await POST(makeRequest({ provider: 'nekohime', file: makeFile() }));
    expect(await jsonOf(res)).toEqual({
      ok: true,
      url: 'https://cdn.nekohime.site/file/spaj6her.txt',
      meta: { filename: 'spaj6her.txt' },
    });
  });

  it('never fabricates a URL when the provider returns an error body', async () => {
    stubFetch(200, '{"files":[],"message":"Files uploaded successfully!"}');
    const res = await POST(makeRequest({ provider: 'nekohime', file: makeFile() }));
    const json = await jsonOf(res);
    expect(json.ok).toBe(false);
    expect(json.url).toBeUndefined();
    expect(json.error).toMatch(/no file URL/i);
  });

  it('does not pass a catbox HTML error page through as a URL', async () => {
    stubFetch(200, '<html><div class="error">File type not allowed.</div></html>', 'text/html');
    const res = await POST(makeRequest({ provider: 'catbox', file: makeFile(53, 'evil.exe') }));
    const json = await jsonOf(res);
    expect(json.ok).toBe(false);
    expect(json.url).toBeUndefined();
  });

  it('reports a provider 4xx/5xx without leaking the upstream body as a URL', async () => {
    stubFetch(503, 'upstream exploded', 'text/plain');
    const res = await POST(makeRequest({ provider: 'nekohime', file: makeFile() }));
    const json = await jsonOf(res);
    expect(json.ok).toBe(false);
    expect(json.url).toBeUndefined();
    expect(json.status).toBe(503);
    expect(json.code).toBe('http');
  });

  it('maps a network failure to 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const res = await POST(makeRequest({ provider: 'catbox', file: makeFile() }));
    expect(res.status).toBe(502);
    expect((await jsonOf(res)).error).toMatch(/Could not reach Catbox/);
  });

  it('only ever sends the file, never the caller-chosen provider, upstream', async () => {
    const spy = stubFetch(200, 'https://files.catbox.moe/x.txt', 'text/html');
    await POST(makeRequest({ provider: 'catbox', file: makeFile(), extra: { evil: 'value' } }));
    const [, init] = callOf(spy);
    const body = init.body as FormData;
    expect(body.get('provider')).toBeNull();
    expect(body.get('evil')).toBeNull();
  });

  it('sends both allowlisted providers without an allowlist regression', async () => {
    for (const provider of PROXYABLE) {
      const spy = stubFetch(
        200,
        provider === 'catbox' ? 'https://files.catbox.moe/x.txt' : '{"files":[{"url":"https://cdn.nekohime.site/file/x.txt"}]}',
        provider === 'catbox' ? 'text/html' : 'application/json',
      );
      const res = await POST(makeRequest({ provider, file: makeFile() }));
      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledOnce();
    }
  });
});