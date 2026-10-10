/**
 * One error type for every failure path, so the UI can render a stable message
 * without re-deriving what went wrong at each call site.
 */

export type UploadErrorCode =
  | 'validation'
  | 'unsupported'
  | 'not-configured'
  | 'http'
  | 'rate-limited'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'parse'
  | 'unverified'
  | 'too-large';

export class UploadError extends Error {
  readonly code: UploadErrorCode;
  readonly status?: number;
  /** Raw upstream body, kept short and never containing file bytes. */
  readonly detail?: string;

  constructor(code: UploadErrorCode, message: string, opts: { status?: number; detail?: string } = {}) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.status = opts.status;
    this.detail = opts.detail;
  }
}

export function isUploadError(value: unknown): value is UploadError {
  return value instanceof UploadError;
}

/**
 * Turns an upstream HTTP status into an UploadError with a message a human can
 * act on. 4xx means the request itself was wrong; 5xx is the provider's problem.
 */
export function httpError(status: number, providerName: string, detail?: string): UploadError {
  const short = detail ? detail.slice(0, 240) : undefined;

  if (status === 413) {
    return new UploadError('too-large', `${providerName} rejected the file as too large.`, { status, detail: short });
  }
  if (status === 429) {
    return new UploadError('rate-limited', `${providerName} is rate-limiting requests. Wait a moment and try again.`, {
      status,
      detail: short,
    });
  }
  if (status === 401 || status === 403) {
    return new UploadError('http', `${providerName} refused the request (HTTP ${status}).`, { status, detail: short });
  }
  if (status >= 500) {
    return new UploadError('http', `${providerName} is having trouble right now (HTTP ${status}).`, { status, detail: short });
  }
  return new UploadError('http', `${providerName} returned HTTP ${status}.`, { status, detail: short });
}

/** Normalises anything thrown during upload into an UploadError. */
export function toUploadError(err: unknown, providerName: string): UploadError {
  if (isUploadError(err)) return err;

  if (err instanceof DOMException && err.name === 'AbortError') {
    return new UploadError('cancelled', 'Upload cancelled.');
  }
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return new UploadError('timeout', `${providerName} did not respond in time.`);
  }
  if (err instanceof TypeError) {
    // fetch() reports every network-layer failure as a TypeError; browsers also
    // use it for a blocked CORS response, which we cannot distinguish here.
    return new UploadError('network', `Could not reach ${providerName}. The provider may be down or blocking this origin.`);
  }
  const message = err instanceof Error ? err.message : String(err);
  return new UploadError('network', `Upload to ${providerName} failed: ${message}`);
}

/** Short, user-facing sentence for any thrown value. */
export function describeError(err: unknown): string {
  const e = toUploadError(err, 'The provider');
  return e.message;
}