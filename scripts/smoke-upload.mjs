#!/usr/bin/env node
/**
 * Live smoke test — REAL uploads against the real provider APIs.
 *
 * This is deliberately NOT part of `npm test`. It performs genuine uploads and
 * then downloads each result to confirm the URL is real and the bytes match.
 * Read docs/provider-audit.md before running it.
 *
 *   node scripts/smoke-upload.mjs               # every live-testable provider
 *   node scripts/smoke-upload.mjs kappa zass    # only those
 *
 * Exits non-zero if any provider fails.
 */

import { createHash } from 'node:crypto';

const PROBE = `nesite cdn smoke test ${new Date().toISOString()}\n`;
const EXPECTED_SHA = createHash('sha256').update(PROBE).digest('hex');
const TIMEOUT_MS = 60_000;

/** A fresh File per request — a FormData body can only be consumed once. */
const probeFile = () => new File([PROBE], 'nesite-smoke.txt', { type: 'text/plain' });

const REGISTRY = {
  kappa: {
    name: 'Kappa',
    url: 'https://kappa.lol/api/upload',
    fields: () => [['file', probeFile()]],
    extract: (body) => JSON.parse(body).link,
  },
  senxc: {
    name: 'SenaVuck CDN',
    url: 'https://cp.senxc.my.id/api/upload',
    fields: () => [['file', probeFile()]],
    extract: (body) => {
      const link = JSON.parse(body).link;
      return link.startsWith('http') ? link : `https://${link}`;
    },
  },
  xcute: {
    name: 'SILENTPHANTOM',
    url: 'https://x.xcute.workers.dev/api/upload',
    fields: () => [['file', probeFile()]],
    extract: (body) => JSON.parse(body).result.url,
  },
  cmnty: {
    name: 'CMNTY CDN',
    url: 'https://cdn.cmnty.web.id/upload',
    fields: () => [['file', probeFile()]],
    extract: (body) => JSON.parse(body).url,
  },
  vltcs: {
    name: 'Violetics CDN',
    url: 'https://s7.vltcs.my.id/api/upload',
    fields: () => [['file', probeFile()]],
    extract: (body) => JSON.parse(body).file.url,
  },
  zass: {
    name: 'Zass CDN',
    url: 'https://cdn.zass.in/upload',
    fields: () => [['file', probeFile()]],
    extract: (body) => JSON.parse(body).url,
  },
  nekohime: {
    name: 'Nekohime Cloud',
    url: 'https://cdn.nekohime.site/upload',
    fields: () => [['file', probeFile()]],
    extract: (body) => JSON.parse(body).files[0].url,
  },
  catbox: {
    name: 'Catbox',
    url: 'https://catbox.moe/user/api.php',
    fields: () => [
      ['reqtype', 'fileupload'],
      ['userhash', ''],
      ['fileToUpload', probeFile()],
    ],
    extract: (body) => body.trim(),
  },
};

const requested = process.argv.slice(2);
const targets = requested.length ? requested : Object.keys(REGISTRY);

async function run(id) {
  const spec = REGISTRY[id];
  const form = new FormData();
  for (const [name, value] of spec.fields()) form.append(name, value);

  const uploadRes = await fetch(spec.url, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // A cross-origin browser always sends this; matching it exercises the real
    // CORS path rather than a same-origin server-to-server one.
    headers: { Origin: 'https://cdn.nesite.my.id' },
  });
  const text = await uploadRes.text();

  if (!uploadRes.ok) {
    throw new Error(`upload HTTP ${uploadRes.status}: ${text.slice(0, 160)}`);
  }

  const url = spec.extract(text);
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new Error(`no URL in response: ${text.slice(0, 160)}`);
  }

  const dlRes = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
  if (!dlRes.ok) throw new Error(`download HTTP ${dlRes.status} from ${url}`);

  const bytes = Buffer.from(await dlRes.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== EXPECTED_SHA) {
    throw new Error(`content mismatch at ${url}: got ${bytes.length} bytes, sha ${actual.slice(0, 12)}`);
  }

  return { url, bytes: bytes.length };
}

let failures = 0;
for (const id of targets) {
  if (!REGISTRY[id]) {
    console.error(`SKIP  ${id}: not a live-testable provider`);
    failures += 1;
    continue;
  }
  process.stdout.write(`… ${id.padEnd(9)} uploading ${PROBE.length} B probe... `);
  try {
    const { url, bytes } = await run(id);
    console.log(`\nPASS ${REGISTRY[id].name}\n         ${url}\n         downloaded ${bytes} B, sha256 matches`);
  } catch (err) {
    failures += 1;
    console.log(`\nFAIL ${id}\n         ${err.message}`);
  }
}

console.log(`\n${failures === 0 ? 'All providers passed.' : `${failures} provider(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);