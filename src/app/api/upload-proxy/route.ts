import { NextResponse } from 'next/server';

import { getAdapter, isProxyAllowed } from '@/lib/providers/registry';
import { UploadError, httpError } from '@/lib/upload/errors';
import { PROXY_BODY_LIMIT_BYTES } from '@/lib/upload/limits';

/**
 * Allowlisted upload proxy.
 *
 * Two providers in the audit ship no Access-Control-Allow-Origin header, so a
 * browser on cdn.nesite.my.id cannot read their responses no matter how the
 * request is shaped. This function is the only supported path for them.
 *
 * What it deliberately does NOT do:
 *  - accept a caller-supplied URL (the target is chosen from a fixed allowlist),
 *  - accept a caller-supplied field name or extra headers (the adapter decides),
 *  - keep the file: the body is streamed straight to the provider and dropped,
 *  - log file contents, names, or the upstream body beyond a short error hint.
 *
 * Vercel caps serverless request bodies at 4.5 MB, so this path only works for
 * small files. The UI enforces the same cap before it gets here.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 45_000;

export async function POST(request: Request): Promise<Response> {
  // 1. Reject anything over our own ceiling before touching the body.
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > PROXY_BODY_LIMIT_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `Proxied uploads are limited to ${Math.round(PROXY_BODY_LIMIT_BYTES / 1024 / 1024)} MB because they pass through a serverless function. Choose a smaller file, or pick a direct provider.`,
      },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the upload body.' }, { status: 400 });
  }

  // 2. The provider must be on the allowlist. No URLs from the caller, ever.
  const providerId = form.get('provider');
  if (typeof providerId !== 'string' || !isProxyAllowed(providerId)) {
    return NextResponse.json({ ok: false, error: 'Unknown or non-proxied provider.' }, { status: 400 });
  }
  const adapter = getAdapter(providerId);
  if (!adapter || adapter.meta.integration !== 'proxy') {
    return NextResponse.json({ ok: false, error: 'That provider must be uploaded to directly.' }, { status: 400 });
  }

  // 3. Exactly one file, within the ceiling.
  const entry = form.get('file');
  if (!(entry instanceof File) || entry.size === 0) {
    return NextResponse.json({ ok: false, error: 'No file was received.' }, { status: 400 });
  }
  if (entry.size > PROXY_BODY_LIMIT_BYTES) {
    return NextResponse.json(
      { ok: false, error: `Proxied uploads are limited to ${Math.round(PROXY_BODY_LIMIT_BYTES / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  // 4. Build the upstream request from the adapter, not from caller input.
  const upstream = adapter.buildUpstreamRequest(entry);
  const outgoing = new FormData();
  for (const [name, value] of upstream.fields) outgoing.append(name, value);

  // 5. Forward, with a hard timeout. Nothing is written to disk or a database.
  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(upstream.url, { method: upstream.method, body: outgoing, signal: timeout, redirect: 'follow' });
  } catch (err) {
    const aborted = timeout.aborted || (err instanceof Error && err.name === 'TimeoutError');
    return NextResponse.json(
      {
        ok: false,
        error: aborted
          ? `${adapter.meta.name} did not respond within ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)}s.`
          : `Could not reach ${adapter.meta.name} from the server.`,
      },
      { status: aborted ? 504 : 502 },
    );
  }

  const body = await response.text();
  const contentType = response.headers.get('content-type');

  // 6. The same parser the browser path uses decides success vs. failure.
  try {
    const result = adapter.parseResponse(response.status, contentType, body);
    return NextResponse.json({ ok: true, url: result.url, meta: result.meta });
  } catch (err) {
    const uploadError: UploadError = err instanceof UploadError ? err : httpError(response.status, adapter.meta.name, body);
    // Metadata only: status, provider id, error code. No file name, no body dump.
    console.warn('[nesite-proxy] provider=%s status=%s code=%s', providerId, response.status, uploadError.code);
    return NextResponse.json(
      { ok: false, error: uploadError.message, code: uploadError.code, status: response.status },
      { status: response.status >= 400 ? response.status : 502 },
    );
  }
}

/** Anything other than POST is not part of this API. */
export async function GET(): Promise<Response> {
  return NextResponse.json({ ok: false, error: 'Use POST with multipart/form-data.' }, { status: 405 });
}