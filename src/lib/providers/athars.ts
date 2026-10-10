import { UploadError } from '@/lib/upload/errors';
import type { NormalizedUpload, ProviderAdapter, ProviderMeta } from './types';

/**
 * athars.space is intentionally NOT wired up as a usable adapter.
 *
 * Audit findings (2026-10-10):
 *  - The page is a chunked uploader: it POSTs 50 MB slices to upload.php with
 *    the fields chunkIndex, fileId, totalChunks and file (10 concurrent workers),
 *    then POSTs action=merge with fileId, fileName and totalChunks, then polls
 *    upload.php?check_status=<fileId> until { s: 1, url } or { s: 3, msg }.
 *  - At audit time every backend path returned HTTP 522 from Cloudflare
 *    (origin unreachable): /upload.php, /api/upload, /api/files and the
 *    check_status query all answered 522, while the cached HTML root still
 *    returned 200. So the protocol is documented but the service is down.
 *  - No terms, rate limits or retention policy were published to check against.
 *
 * So: UNVERIFIED. The chunked protocol is recorded here for a future re-audit,
 * but the adapter refuses to upload rather than half-implementing a merge dance
 * against a dead origin.
 */

export const atharsMeta: ProviderMeta = {
  id: 'athars',
  name: 'Athars CDN',
  description: 'Chunked uploader (50 MB slices + merge). Backend was down at audit time.',
  status: 'unverified',
  integration: 'none',
  endpoint: 'https://athars.space/upload.php',
  method: 'POST',
  fileField: 'file (plus chunkIndex, fileId, totalChunks — then action=merge, then ?check_status=)',
  requiresAuth: false,
  auth: 'No API key observed',
  cors: 'Unverified — Cloudflare returned 522 for every backend path.',
  responseFormat: 'Chunk ack on each slice; merge returns { fileId }; final URL only after check_status returns { s: 1, url }',
  directUrl: 'NOT VERIFIED — could not complete one upload while the origin was 522',
  expiration: 'Not documented.',
  maxFileSizeBytes: null,
  maxFileSizeNote: 'Not documented. Client slices at 50 MB per request, which is not the same as a total-size limit.',
  supportedFileTypes: 'any (page copy claims images, video, documents)',
  notes: 'Left out of the picker. Re-audit once upload.php answers something other than 522.',
};

const REFUSAL =
  'Athars CDN is not available here: its backend answered HTTP 522 (origin unreachable) for every upload path during the audit.';

export const athars: ProviderAdapter = {
  meta: atharsMeta,
  buildUpstreamRequest(file: File) {
    // Mirrors the single-slice shape of the site's own chunk upload.
    return {
      url: atharsMeta.endpoint,
      method: 'POST',
      fields: [
        ['chunkIndex', '0'],
        ['fileId', 'nesite-cdn'],
        ['totalChunks', '1'],
        ['file', file],
      ],
    };
  },
  parseResponse(): NormalizedUpload {
    throw new UploadError('unverified', REFUSAL);
  },
};