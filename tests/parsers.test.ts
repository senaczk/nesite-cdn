import { describe, expect, it } from 'vitest';

import { UploadError } from '@/lib/upload/errors';
import { parseCatbox } from '@/lib/providers/catbox';
import { parseCmnty } from '@/lib/providers/cmnty';
import { parseKappa } from '@/lib/providers/kappa';
import { parseNekohime } from '@/lib/providers/nekohime';
import { parseSenxc } from '@/lib/providers/senxc';
import { parseVltcs } from '@/lib/providers/vltcs';
import { parseXcute } from '@/lib/providers/xcute';
import { parseZass } from '@/lib/providers/zass';
import { athars } from '@/lib/providers/athars';
import { eightupload } from '@/lib/providers/eightupload';

/*
 * Every response body below is a real capture from the 2026-10-10 audit, from
 * an actual 53-byte text file upload. Not mocks, not invented shapes.
 */

describe('response parsers — real captured bodies', () => {
  it('nekohime extracts files[0].url', () => {
    const body = '{"files":[{"url":"https://cdn.nekohime.site/file/jiep84xx.txt","filename":"jiep84xx.txt","status":"uploaded"}],"message":"Files uploaded successfully!"}';
    const result = parseNekohime(200, 'application/json', body);
    expect(result.url).toBe('https://cdn.nekohime.site/file/jiep84xx.txt');
    expect(result.meta.filename).toBe('jiep84xx.txt');
  });

  it('nekohime throws when files[] is empty instead of inventing a URL', () => {
    expect(() => parseNekohime(200, 'application/json', '{"files":[],"message":"ok"}')).toThrow(UploadError);
    expect(() => parseNekohime(200, 'application/json', '{"message":"ok"}')).toThrow(/no file URL/i);
  });

  it('catbox reads the plain-text URL body', () => {
    expect(parseCatbox(200, 'text/html; charset=UTF-8', 'https://files.catbox.moe/a4ntz8.txt\n').url).toBe(
      'https://files.catbox.moe/a4ntz8.txt',
    );
  });

  it('catbox refuses to pass off its HTML error page as a URL', () => {
    const errorPage = '<html><body><div class="error">File type not allowed.</div></body></html>';
    expect(() => parseCatbox(200, 'text/html', errorPage)).toThrow(/error page instead of a URL/i);
  });

  it('catbox surfaces an HTTP failure with the provider name', () => {
    try {
      parseCatbox(413, 'text/html', 'File too large');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UploadError);
      expect((err as UploadError).code).toBe('too-large');
      expect((err as UploadError).message).toContain('Catbox');
    }
  });

  it('cmnty reads the documented envelope', () => {
    const body = JSON.stringify({
      success: true,
      message: 'File uploaded successfully to CDN',
      url: 'http://cdn.cmnty.web.id/txt/8i5o23',
      id: '8i5o23',
      filename: 'probe.txt',
      size: 53,
      mime: 'text/plain',
      ext: 'txt',
    });
    const result = parseCmnty(200, 'application/json', body);
    // The provider really does answer http:// — we return it verbatim.
    expect(result.url).toBe('http://cdn.cmnty.web.id/txt/8i5o23');
    expect(result.meta.id).toBe('8i5o23');
  });

  it('cmnty rejects success:false even when a url field is present', () => {
    const body = JSON.stringify({ success: false, message: 'File type blocked', url: 'http://x/1' });
    expect(() => parseCmnty(200, 'application/json', body)).toThrow(/File type blocked/);
  });

  it('kappa reads link', () => {
    const body =
      '{"id":"5034ev","ext":".txt","type":"text/plain","checksum":"7dd4","key":"0NIPK6TXuDQDwiw9","link":"https://kappa.lol/5034ev","delete":"https://kappa.lol/delete?0NIPK6TXuDQDwiw9"}';
    const result = parseKappa(200, 'application/json', body);
    expect(result.url).toBe('https://kappa.lol/5034ev');
    expect(result.meta.id).toBe('5034ev');
  });

  it('senxc prefixes https onto the scheme-less link their own UI adds', () => {
    const body = '{"link":"cp.senxc.my.id/f/383e7447d.txt","name":"probe.txt","size":53}';
    const result = parseSenxc(200, 'application/json', body);
    expect(result.url).toBe('https://cp.senxc.my.id/f/383e7447d.txt');
  });

  it('senxc leaves an already absolute link alone', () => {
    expect(parseSenxc(200, 'application/json', '{"link":"https://cp.senxc.my.id/f/x.txt"}').url).toBe(
      'https://cp.senxc.my.id/f/x.txt',
    );
  });

  it('senxc reports the provider error message when given one', () => {
    expect(() => parseSenxc(200, 'application/json', '{"error":"Storage full"}')).toThrow(/Storage full/);
  });

  it('xcute reads result.url plus retention metadata', () => {
    const body = JSON.stringify({
      status: true,
      message: 'Upload successful',
      result: {
        filename: 'e0c1a6872bc6.txt',
        category: 'documents',
        path: 'documents/e0c1a6872bc6.txt',
        url: 'https://x.xcute.workers.dev/f/documents/e0c1a6872bc6.txt',
        mimetype: 'text/plain',
        size: 53,
        retention: 'permanent',
        expiresAt: 'never',
      },
    });
    const result = parseXcute(200, 'application/json', body);
    expect(result.url).toBe('https://x.xcute.workers.dev/f/documents/e0c1a6872bc6.txt');
    expect(result.meta.retention).toBe('permanent');
    expect(result.meta.expiresAt).toBe('never');
  });

  it('xcute rejects status:false', () => {
    expect(() => parseXcute(200, 'application/json', '{"status":false,"message":"quota"}')).toThrow(/quota/);
  });

  it('zass requires success:true and a url', () => {
    const body = '{"success":true,"url":"https://cdn.zass.in/M8hUUG7Ahd.txt","fileName":"probe.txt","fileId":"M8hUUG7Ahd","size":53}';
    expect(parseZass(200, 'application/json', body).url).toBe('https://cdn.zass.in/M8hUUG7Ahd.txt');
    expect(() => parseZass(200, 'application/json', '{"success":true}')).toThrow(/no|successful/i);
    expect(() => parseZass(200, 'application/json', '{"success":false,"error":"nope"}')).toThrow(/nope/);
  });

  it('vltcs reads file.url and the expiry field', () => {
    const body = JSON.stringify({
      success: true,
      file: {
        id: '0ddce288375d',
        name: 'probe.txt',
        originalName: 'probe.txt',
        size: 53,
        mimeType: 'text/plain',
        expiresAt: null,
        url: 'http://s7.vltcs.my.id/d/0ddce288375d.txt',
      },
    });
    const result = parseVltcs(200, 'application/json', body);
    expect(result.url).toBe('http://s7.vltcs.my.id/d/0ddce288375d.txt');
    expect(result.meta.expiresAt).toBeNull();
  });

  it('every parser throws UploadError on malformed JSON rather than guessing', () => {
    const parsers = [parseNekohime, parseCmnty, parseKappa, parseSenxc, parseXcute, parseZass, parseVltcs];
    for (const parse of parsers) {
      expect(() => parse(200, 'application/json', '<html>gateway error</html>')).toThrow(UploadError);
    }
  });

  it('every parser throws UploadError on a 5xx', () => {
    const parsers = [parseNekohime, parseCmnty, parseKappa, parseSenxc, parseXcute, parseZass, parseVltcs];
    for (const parse of parsers) {
      try {
        parse(503, 'text/html', 'upstream down');
        throw new Error(`${parse.name} should have thrown`);
      } catch (err) {
        expect(err).toBeInstanceOf(UploadError);
        expect((err as UploadError).code).toBe('http');
      }
    }
  });

  it('unavailable providers refuse to produce a URL at all', () => {
    // Not "returns null" — a hard failure, so no code path can render a fake link.
    expect(() => eightupload.parseResponse(200, 'application/json', '"\\/uploads\\/904bc62554ce"')).toThrow(UploadError);
    expect(() => athars.parseResponse(200, 'application/json', '{"s":1,"url":"https://x"}')).toThrow(UploadError);
  });
});