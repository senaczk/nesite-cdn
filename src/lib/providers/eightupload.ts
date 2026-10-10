import { UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

/**
 * 8upload is intentionally NOT wired up as a usable adapter.
 *
 * Audit findings (2026-10-10):
 *  - The upload UI lives on https://8upload.com/, not on the i.8upload.com host
 *    given in the brief. i.8upload.com is a Cloudflare R2 bucket endpoint that
 *    answers 404 "Object not found" for its own root.
 *  - A real POST of a 70-byte PNG to https://8upload.com/upload/mt/ returned HTTP
 *    200 with the body `"\/uploads\/904bc62554ce"`, but that path 404s on
 *    i.8upload.com and returns the site's HTML on 8upload.com. No working public
 *    direct URL could be verified, so there is nothing honest to show a user.
 *  - Server-side extension enforcement is real: the same endpoint rejected
 *    probe.txt with "probe - invalid image file." Images only.
 *  - CORS: i.8upload.com answers Access-Control-Allow-Origin: https://8upload.com
 *    (the provider's own origin only), and OPTIONS on the upload URL answers 405.
 *    A third-party page can therefore never read the response.
 *  - Page config caps uploads at 12500 KB (~12.5 MB), max 10 files, images only.
 *
 * So: UNSUPPORTED. The adapter below deliberately refuses to upload rather than
 * pointing at a 404 URL.
 */

const MB = 1024 * 1024;

export const eightuploadMeta: ProviderMeta = {
  id: 'eightupload',
  name: '8upload',
  description: 'Image-only host. Upload path verified, but the public file URL is not.',
  status: 'unsupported',
  integration: 'none',
  endpoint: 'https://8upload.com/upload/mt/',
  method: 'POST',
  fileField: 'images[]',
  requiresAuth: false,
  auth: 'No API key',
  cors: 'Blocked — Access-Control-Allow-Origin is pinned to https://8upload.com; preflight on the upload URL returns 405.',
  responseFormat: 'JSON string containing an escaped path, e.g. "\/uploads\/904bc62554ce"',
  directUrl: 'NOT VERIFIED — the returned path 404s on i.8upload.com',
  expiration: 'Unknown. Site copy advertises "unlimited storage", but that was not verifiable.',
  maxFileSizeBytes: 12.5 * MB,
  maxFileSizeNote: '~12.5 MB (12500 KB in the uploader config).',
  supportedFileTypes: 'Images only: gif, jpeg, jpg, png, swf, psd, bmp, tif, tiff, jpc, jp2, jpx, jb2, iff, xbm, webp, avif',
  notes: 'Left out of the picker. See the audit entry in docs/provider-audit.md.',
};

const REFUSAL = '8upload is not available here: its upload endpoint works but the resulting file URL is not publicly reachable, and its CORS policy allows only 8upload.com.';

export const eightupload: ProviderAdapter = {
  meta: eightuploadMeta,
  buildUpstreamRequest(file: File) {
    return { url: eightuploadMeta.endpoint, method: 'POST', fields: [['images[]', file]] };
  },
  parseResponse(): NormalizedUpload {
    // No verified direct URL exists, so no success path may be produced here.
    throw new UploadError('unsupported', REFUSAL);
  },
};