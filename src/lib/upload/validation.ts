import { UploadError } from './errors';

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

/** Hard ceiling enforced everywhere, regardless of what a provider advertises. */
export const ABSOLUTE_MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Characters that are unsafe in a filename or an HTTP header. Written as a
 * predicate rather than a regex literal so no control byte ever has to appear
 * in this source file.
 */
const UNSAFE_PUNCTUATION = new Set(['/', '\\', ':', '*', '?', '"', '<', '>', '|']);

function stripUnsafeChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 0x20 || code === 0x7f;
    out += isControl || UNSAFE_PUNCTUATION.has(ch) ? '_' : ch;
  }
  return out;
}

/** True when a name still carries real content once separators and dots go. */
function hasContent(value: string): boolean {
  for (const ch of value) {
    if (ch !== '.' && !/\s/.test(ch)) return true;
  }
  return false;
}

/**
 * Strips path separators and characters that would break a header or a path, so
 * a name can never escape. A name with no real content left (empty, all
 * separators, all dots) falls back to 'file'.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = stripUnsafeChars(base).trim();
  if (!hasContent(cleaned)) return 'file';
  return cleaned.slice(0, 200);
}

/**
 * Whether the *original* name carries any real content.
 *
 * Checked against the original rather than `sanitizeFileName(name) === 'file'`,
 * because 'file' is also the fallback for an empty name — comparing the result
 * would wrongly reject a file genuinely called "file".
 */
export function isUsableFileName(name: string): boolean {
  const base = name.split(/[\\/]/).pop() ?? '';
  return hasContent(stripUnsafeChars(base).trim());
}

export function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

/**
 * Validates a picked file against a provider's declared limits.
 *
 * `supportedFileTypes` on ProviderMeta is the human-readable summary shown on the
 * card; only providers with a genuinely verified restriction pass a concrete
 * matcher here (see `validateForProvider`).
 */
export function validateFile(file: FileLike, maxFileSizeBytes: number | null): ValidationResult {
  if (!file.name) {
    return { ok: false, error: 'That file has no name. Pick another file.' };
  }
  if (!isUsableFileName(file.name)) {
    return { ok: false, error: 'That file name is not usable. Rename it and try again.' };
  }
  if (file.size === 0) {
    return { ok: false, error: `"${sanitizeFileName(file.name)}" is empty (0 bytes). Nothing to upload.` };
  }
  const limit = Math.min(maxFileSizeBytes ?? ABSOLUTE_MAX_BYTES, ABSOLUTE_MAX_BYTES);
  if (file.size > limit) {
    return {
      ok: false,
      error: `"${sanitizeFileName(file.name)}" is ${formatBytes(file.size)}. The limit for this provider is ${formatBytes(limit)}.`,
    };
  }
  return { ok: true };
}

export interface ProviderConstraints {
  id: string;
  maxFileSizeBytes: number | null;
  /** Verified extension allow/deny list. Empty means "any type accepted". */
  blockedExtensions?: readonly string[];
}

/**
 * Provider-specific validation that goes beyond size. Only restrictions that
 * were actually observed during the audit are encoded here.
 */
export function validateForProvider(file: FileLike, provider: ProviderConstraints): ValidationResult {
  const base = validateFile(file, provider.maxFileSizeBytes);
  if (!base.ok) return base;

  if (provider.blockedExtensions?.length) {
    const ext = extensionOf(file.name);
    if (ext && provider.blockedExtensions.includes(ext)) {
      return { ok: false, error: `${provider.id} does not accept .${ext} files.` };
    }
  }
  return { ok: true };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function describeFileType(file: FileLike): string {
  if (file.type) return file.type;
  const ext = extensionOf(file.name);
  return ext ? `.${ext} file` : 'unknown type';
}

/** Throws an UploadError rather than returning a result, for adapter-level use. */
export function assertValid(file: FileLike, provider: ProviderConstraints): void {
  const result = validateForProvider(file, provider);
  if (!result.ok) {
    throw new UploadError('validation', result.error ?? 'That file cannot be uploaded here.');
  }
}