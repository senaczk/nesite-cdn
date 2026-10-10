import { httpError, UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

const MB = 1024 * 1024;

export const catboxMeta: ProviderMeta = {
  id: 'catbox',
  name: 'Catbox',
  description: 'Anonymous host with a long-lived public API (api.php).',
  status: 'partial',
  integration: 'proxy',
  endpoint: 'https://catbox.moe/user/api.php',
  method: 'POST',
  fileField: 'fileToUpload',
  requiresAuth: false,
  auth: 'No API key (userhash is sent empty, exactly like the anonymous web form)',
  cors: 'None — verified: OPTIONS /user/api.php answers HTTP 412 with no Access-Control-Allow-Origin.',
  responseFormat: 'text/plain — the direct URL, or an HTML error page',
  directUrl: 'the whole response body is the URL',
  expiration: 'Anonymous uploads are removed after 2 years of inactivity. Account uploads are permanent.',
  maxFileSizeBytes: 200 * MB,
  maxFileSizeNote: '200 MB (stated on catbox.moe homepage).',
  supportedFileTypes: 'All except .exe, .scr, .cpl, .doc*, .jar',
  acknowledgement: {
    title: 'Catbox terms conflict with third-party file hosting',
    body:
      'Catbox\'s FAQ states: "You cannot use Catbox for commercial services without prior approval. Examples include: a CDN... or as source for videos that are streamed on sites other than files.catbox.moe directly." ' +
      'Nesite CDN republishes Catbox links through a multi-provider interface, which is close to that description. Enable it only if you have Catbox\'s approval, or if you accept the risk that your files or the service may be removed.',
  },
  notes:
    'Real upload verified 2026-10-10. Catbox bans .exe/.scr/.cpl/.doc*/.jar and purges accounts over prohibited content. Requests must stay low-volume.',
};

/** Extensions Catbox refuses outright. */
export const CATBOX_BLOCKED_EXTENSIONS = ['exe', 'scr', 'cpl', 'jar', 'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm'];

export function isCatboxBlocked(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return CATBOX_BLOCKED_EXTENSIONS.includes(ext);
}

/**
 * Verified response body (HTTP 200, text/html):
 *   https://files.catbox.moe/a4ntz8.txt
 * Anything else is Catbox's error page and must not be shown as a URL.
 */
export function parseCatbox(status: number, contentType: string | null, body: string): NormalizedUpload {
  const trimmed = body.trim();

  if (status < 200 || status >= 300) {
    throw httpError(status, 'Catbox', trimmed);
  }

  // A successful Catbox upload answers with nothing but the URL.
  if (/^https?:\/\/[^\s"'<>]+$/.test(trimmed)) {
    return { url: trimmed, meta: {} };
  }

  // Catbox renders errors as an HTML page. Never let that through as a "URL".
  if (contentType?.includes('text/html') || /<html|<div|<br/i.test(trimmed)) {
    throw new UploadError('parse', 'Catbox rejected the upload and returned an error page instead of a URL.', {
      status,
      detail: trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 240),
    });
  }

  throw new UploadError('parse', 'Catbox returned a response that is not a file URL.', { status, detail: trimmed.slice(0, 240) });
}

export const catbox: ProviderAdapter = {
  meta: catboxMeta,
  buildUpstreamRequest(file: File) {
    return {
      url: catboxMeta.endpoint,
      method: 'POST',
      fields: [
        // Same hidden fields the anonymous web form submits.
        ['reqtype', 'fileupload'],
        ['userhash', ''],
        [catboxMeta.fileField, file],
      ],
    };
  },
  parseResponse: parseCatbox,
};