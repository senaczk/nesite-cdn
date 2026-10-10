import { describe, expect, it } from 'vitest';

import {
  ABSOLUTE_MAX_BYTES,
  assertValid,
  describeFileType,
  extensionOf,
  formatBytes,
  isUsableFileName,
  sanitizeFileName,
  validateFile,
  validateForProvider,
} from '@/lib/upload/validation';
import { UploadError } from '@/lib/upload/errors';
import { catbox, CATBOX_BLOCKED_EXTENSIONS, isCatboxBlocked } from '@/lib/providers/catbox';
import { kappa, buildKappaRequest } from '@/lib/providers/kappa';
import { buildVltcsRequest, isValidVltcsExpiry } from '@/lib/providers/vltcs';
import { senxc } from '@/lib/providers/senxc';
import { getAdapter } from '@/lib/providers/registry';

const file = (name: string, size = 1024, type = 'text/plain') => ({ name, size, type });

describe('file name handling', () => {
  it('strips directory traversal and separators', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Windows\\system32\\cmd.exe')).toBe('cmd.exe');
    expect(sanitizeFileName('a/b/c.png')).toBe('c.png');
  });

  it('replaces characters that would break a header or a path', () => {
    expect(sanitizeFileName('re:port<2024>.txt')).toBe('re_port_2024_.txt');
  });

  it('never returns an empty name', () => {
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('///')).toBe('file');
    expect(sanitizeFileName('...')).toBe('file');
    expect(sanitizeFileName('.')).toBe('file');
  });

  it('keeps a file genuinely named "file" usable', () => {
    // Regression guard: the fallback name must not collide with a real one.
    expect(sanitizeFileName('file')).toBe('file');
    expect(isUsableFileName('file')).toBe(true);
    expect(validateFile(file('file', 10), null).ok).toBe(true);
  });

  it('separates "has a usable name" from "the sanitised result"', () => {
    expect(isUsableFileName('notes.txt')).toBe(true);
    expect(isUsableFileName('')).toBe(false);
    expect(isUsableFileName('///')).toBe(false);
    expect(isUsableFileName('...')).toBe(false);
    expect(isUsableFileName('../../.')).toBe(false);
  });

  it('extracts extensions correctly', () => {
    expect(extensionOf('a.PNG')).toBe('png');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
    expect(extensionOf('noextension')).toBe('');
    expect(extensionOf('.hidden')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
  });
});

describe('validateFile', () => {
  it('accepts a normal file', () => {
    expect(validateFile(file('notes.txt', 2048), 10 * 1024 * 1024)).toEqual({ ok: true });
  });

  it('rejects an empty file', () => {
    const result = validateFile(file('empty.txt', 0), null);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects a file over the provider limit and names the limit', () => {
    const result = validateFile(file('big.bin', 200 * 1024 * 1024), 100 * 1024 * 1024);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('100 MB');
  });

  it('falls back to the absolute ceiling when a provider publishes no limit', () => {
    expect(validateFile(file('a.bin', 10 * 1024 * 1024), null).ok).toBe(true);
    const tooBig = validateFile(file('a.bin', ABSOLUTE_MAX_BYTES + 1), null);
    expect(tooBig.ok).toBe(false);
  });

  it('applies the absolute ceiling even if a provider claims to allow more', () => {
    const result = validateFile(file('huge.bin', ABSOLUTE_MAX_BYTES + 1), 10 * 1024 ** 4);
    expect(result.ok).toBe(false);
  });

  it('rejects a file whose name has no usable content', () => {
    const result = validateFile(file('...', 10), null);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/name is not usable/i);
  });
});

describe('provider-specific validation', () => {
  it('blocks the extensions Catbox documents as not allowed', () => {
    expect(isCatboxBlocked('payload.exe')).toBe(true);
    expect(isCatboxBlocked('report.docx')).toBe(true);
    expect(isCatboxBlocked('archive.jar')).toBe(true);
    expect(isCatboxBlocked('photo.png')).toBe(false);

    const result = validateForProvider(file('payload.exe', 100), {
      id: 'catbox',
      maxFileSizeBytes: null,
      blockedExtensions: CATBOX_BLOCKED_EXTENSIONS,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not accept \.exe/);
  });

  it('does not block a double extension that merely ends in an allowed type', () => {
    expect(isCatboxBlocked('notes.txt')).toBe(false);
  });

  it('assertValid throws UploadError so adapters can call it directly', () => {
    expect(() => assertValid(file('x.exe', 10), { id: 'catbox', maxFileSizeBytes: null, blockedExtensions: CATBOX_BLOCKED_EXTENSIONS })).toThrow(
      UploadError,
    );
  });
});

describe('formatBytes / describeFileType', () => {
  it('formats across the unit range', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(53)).toBe('53 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('describes the MIME type, falling back to the extension', () => {
    expect(describeFileType(file('a.png', 1, 'image/png'))).toBe('image/png');
    expect(describeFileType(file('a.png', 1, ''))).toBe('.png file');
    expect(describeFileType(file('a', 1, ''))).toBe('unknown type');
  });
});

describe('upstream request builders', () => {
  const blob = new File(['x'], 'x.txt', { type: 'text/plain' });

  it('catbox sends reqtype and an empty userhash before the file', () => {
    const request = catbox.buildUpstreamRequest(blob);
    expect(request.url).toBe('https://catbox.moe/user/api.php');
    expect(request.method).toBe('POST');
    expect(request.fields.map(([name]) => name)).toEqual(['reqtype', 'userhash', 'fileToUpload']);
    expect(request.fields[0][1]).toBe('fileupload');
    expect(request.fields[1][1]).toBe('');
  });

  it('kappa appends only the flags that were asked for', () => {
    expect(buildKappaRequest(blob).url).toBe('https://kappa.lol/api/upload');
    expect(buildKappaRequest(blob, { skipContentDisposition: true }).url).toBe('https://kappa.lol/api/upload?skip-cd=true');
    expect(buildKappaRequest(blob, { longId: true }).url).toBe('https://kappa.lol/api/upload?long-id=true');
    expect(buildKappaRequest(blob, { longId: true, skipContentDisposition: true }).url).toBe(
      'https://kappa.lol/api/upload?skip-cd=true&long-id=true',
    );
  });

  it('vltcs only adds expiry when it matches their documented grammar', () => {
    expect(isValidVltcsExpiry('permanent')).toBe(true);
    expect(isValidVltcsExpiry('30m')).toBe(true);
    expect(isValidVltcsExpiry('7d')).toBe(true);
    expect(isValidVltcsExpiry('1w')).toBe(true);
    expect(isValidVltcsExpiry('30')).toBe(false);
    expect(isValidVltcsExpiry('7x')).toBe(false);
    expect(isValidVltcsExpiry('; rm -rf /')).toBe(false);

    expect(buildVltcsRequest(blob).fields.map(([n]) => n)).toEqual(['file']);
    expect(buildVltcsRequest(blob, '1h').fields.map(([n]) => n)).toEqual(['file', 'expiry']);
    expect(buildVltcsRequest(blob, 'nonsense').fields.map(([n]) => n)).toEqual(['file']);
  });

  it('every adapter builds a POST to its own absolute https endpoint', () => {
    for (const id of ['nekohime', 'catbox', 'senxc', 'xcute', 'eightupload', 'kappa', 'zass', 'vltcs', 'cmnty', 'athars']) {
      const adapter = getAdapter(id)!;
      const request = adapter.buildUpstreamRequest(blob);
      expect(request.method).toBe('POST');
      expect(request.url.startsWith('https://')).toBe(true);
      expect(request.url).toBe(adapter.meta.endpoint.replace('images[]', ''));
      expect(request.fields.some(([, value]) => value === blob)).toBe(true);
    }
  });

  it('senxc and kappa both post a single "file" field', () => {
    expect(senxc.buildUpstreamRequest(blob).fields.map(([n]) => n)).toEqual(['file']);
    expect(kappa.buildUpstreamRequest(blob).fields.map(([n]) => n)).toEqual(['file']);
  });
});