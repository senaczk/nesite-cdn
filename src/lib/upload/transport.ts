import { UploadError, toUploadError } from './errors';

/**
 * Upload transport.
 *
 * XMLHttpRequest, not fetch: fetch still cannot report *upload* progress in any
 * browser, and the brief requires an accurate progress bar. XHR gives us
 * `upload.onprogress` plus a real timeout and abort, which is what we need.
 */

export interface XhrUploadOptions {
  url: string;
  formData: FormData;
  timeoutMs: number;
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

export interface XhrUploadResponse {
  status: number;
  contentType: string | null;
  body: string;
}

export function postFormData(options: XhrUploadOptions): Promise<XhrUploadResponse> {
  const { url, formData, timeoutMs, signal, onProgress } = options;

  return new Promise<XhrUploadResponse>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError('cancelled', 'Upload cancelled.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      fn();
    };

    const onAbort = () => {
      xhr.abort();
      finish(() => reject(new UploadError('cancelled', 'Upload cancelled.')));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    xhr.open('POST', url, true);
    xhr.timeout = timeoutMs;
    // The browser must be the one adding the multipart boundary.
    xhr.responseType = 'text';

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      };
    }

    xhr.onload = () => {
      finish(() =>
        resolve({
          status: xhr.status,
          contentType: xhr.getResponseHeader('content-type'),
          body: typeof xhr.responseText === 'string' ? xhr.responseText : '',
        }),
      );
    };
    xhr.onerror = () => finish(() => reject(new UploadError('network', 'The network dropped during the upload.')));
    xhr.ontimeout = () => finish(() => reject(new UploadError('timeout', 'The provider did not respond in time.')));
    xhr.onabort = () => finish(() => reject(new UploadError('cancelled', 'Upload cancelled.')));

    try {
      xhr.send(formData);
    } catch (err) {
      finish(() => reject(toUploadError(err, 'The provider')));
    }
  });
}

/** Serverless functions on Vercel can only hold a request for so long. */
export const DIRECT_UPLOAD_TIMEOUT_MS = 120_000;
/** Proxied uploads go through our function first, so they get a shorter leash. */
export const PROXY_UPLOAD_TIMEOUT_MS = 90_000;