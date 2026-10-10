# Provider Audit — NESITE CDN

Audit date: **2026-10-10** (UTC)
Method: read each provider's public docs, read its published JavaScript to find
the real upload call, then send **one small non-sensitive 53-byte text file**
(`nesite cdn provider audit probe 2026-10-10T01:05:19Z`) to each candidate
endpoint and download the result back.

Nothing below is inferred from a marketing page alone. Where a fact could not be
verified, the cell says **not verified** rather than guessing.

---

## Status summary

| Status | Count | Providers |
| --- | --- | --- |
| **READY** | 6 | Kappa, SenaVuck, SILENTPHANTOM, CMNTY CDN, Violetics CDN, Zass CDN |
| **PARTIAL** | 2 | Nekohime Cloud, Catbox — both work, but only through our serverless relay |
| **UNVERIFIED** | 1 | Athars CDN — backend was down (HTTP 522) |
| **UNSUPPORTED** | 1 | 8upload — uploads work, the resulting file URL does not |

Every READY provider was confirmed by a **real upload whose returned URL was
downloaded and byte-compared against the probe**. The evidence is in
[Verified uploads](#verified-uploads-real-traffic).

---

## Main table

| Provider | Upload Endpoint | Method | File Field | Auth | CORS | Response Format | Direct URL | Expiration | Max Size | Test Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Kappa** | `https://kappa.lol/api/upload` | POST | `file` | None | **Allowed** — `ACAO: *` on POST and preflight (204) | JSON `{id, ext, type, checksum, key, link, delete}` | `link` | Not documented | Not published | **READY** — real upload + download verified | Endpoint found in `_app/immutable/nodes/4.*.js`. Supports `?skip-cd=true` and `?long-id=true`. Response carries a per-file delete key. |
| **SenaVuck** | `https://cp.senxc.my.id/api/upload` | POST | `file` | None | **Allowed** — `ACAO: *`, methods `POST, GET, OPTIONS` | JSON `{link, name, size}` | `link` (scheme-less; prefixed with `https://`) | Not documented | 20 MB (site) | **READY** — real upload + download verified | Endpoint and 20 MB limit read from the site's own inline script. |
| **SILENTPHANTOM** | `https://x.xcute.workers.dev/api/upload` | POST | `file` | None | **Allowed** — `ACAO: *` | JSON `{status, message, result:{url, filename, mimetype, size, retention, expiresAt}}` | `result.url` | **Permanent** (`retention: "permanent"`, `expiresAt: "never"`) | Docs say "1000 Tera" — not credible, treated as unlimited | **READY** — real upload + download verified | Has a real `/api/docs` page stating "Anonymous, no API key required". Also accepts JSON `{url}` for remote fetches. Original filenames are not stored; names are randomised. |
| **CMNTY CDN** | `https://cdn.cmnty.web.id/upload` (alias `/api/upload`) | POST | `file` | None | **Allowed** — `ACAO: *` | JSON `{success, message, url, id, filename, size, mime, ext}` | `url` | Not documented | Not published | **READY** — real upload + download verified | `GET /api/upload` returns the API's own usage documentation. Accepts any field name. **Returns an `http://` URL** that 308-redirects to `https://`; we pass it through verbatim rather than rewriting it. |
| **Violetics CDN** | `https://s7.vltcs.my.id/api/upload` | POST | `file` (+ optional `expiry`) | None | **Allowed** — `ACAO: *`, methods incl. POST | JSON `{success, file:{id, name, size, mimeType, uploadedAt, expiresAt, url}}` | `file.url` | **Configurable** — `<n><m\|h\|d\|w>` or `permanent`; default permanent | 50 MB (their docs) | **READY** — real upload + download verified | Best-documented provider on this list; `/docs` publishes full request/response examples for cURL, JS, Python and Go. **Returns an `http://` URL** that redirects to `https://`. Only provider here with a real expiry knob, surfaced in the UI. |
| **Zass CDN** | `https://cdn.zass.in/upload` | POST | `file` | None | **Allowed** — `ACAO: *` | JSON `{success, url, fileName, fileId, size}` | `url` | Docs claim permanent (not independently verifiable) | 2 GB (their docs) | **READY** — real upload + download verified | Endpoint read from the Next.js chunk that calls `axios.post("/upload", FormData)`. Docs page lives at `/dokumentasi` (not `/documentation`). |
| **Nekohime Cloud** | `https://cdn.nekohime.site/upload` | POST | `file` | None | **Blocked** — POST responses carry **no** `Access-Control-Allow-Origin` (verified with an explicit `Origin` header) | JSON `{files:[{url, filename, status}], message}` | `files[0].url` | Not documented | 100 MB (client-side check in their own page) | **PARTIAL** — real upload verified; browser-direct path impossible | Endpoint confirmed by decoding their obfuscated `assets/js/min.js` (string table rotated to `0x360f4`). Front page itself is Cloudflare-injected but `/upload` works. **Needs our relay.** |
| **Catbox** | `https://catbox.moe/user/api.php` | POST | `fileToUpload` (+ `reqtype=fileupload`, `userhash=`) | None (anonymous) | **Blocked** — `OPTIONS` answers **HTTP 412** with no ACAO | `text/plain` — the URL itself, or an HTML error page | the whole body | Anonymous uploads removed after **2 years of inactivity** | 200 MB (homepage) | **PARTIAL** — real upload verified; browser-direct path impossible | Long-standing public API used by ShareX etc. **Bans `.exe`, `.scr`, `.cpl`, `.doc*`, `.jar`** — enforced client-side in our UI. **Terms conflict:** their FAQ forbids using Catbox as a CDN/third-party image host without prior approval. Gated behind an explicit acknowledgement checkbox. |
| **Athars CDN** | `https://athars.space/upload.php` | POST | `file` + `chunkIndex`, `fileId`, `totalChunks`; then `action=merge`; then poll `?check_status=` | None observed | Unverified — Cloudflare returned **522** for every backend path | Chunk ack → merge returns `{fileId}` → `{s:1, url}` or `{s:3, msg}` | only after `check_status` returns `{s:1,url}` | Not documented | Not documented | **UNVERIFIED** — backend down | Protocol fully recovered from the page's inline script (50 MB slices, 10 concurrent workers, resumable). But `/upload.php`, `/api/upload`, `/api/files` and `?check_status=` **all returned HTTP 522** while the cached HTML root still returned 200. No terms or rate limits published. Not offered. |
| **8upload** | `https://8upload.com/upload/mt/` | POST | `images[]` | None | **Blocked** — `ACAO: https://8upload.com` (own origin only); preflight on the upload URL returns **405** | JSON string, escaped path | **NOT VERIFIED** | Unknown | ~12.5 MB (12500 KB), max 10 files, **images only** | **UNSUPPORTED** | See below. |

---

## Verified uploads (real traffic)

One 53-byte text file was uploaded to each candidate endpoint, then the returned
URL was fetched and its bytes compared to what was sent. These are **real
uploads, not mocks**.

| # | Provider | Endpoint | HTTP | URL returned | Download re-check |
| --- | --- | --- | --- | --- | --- |
| 1 | Nekohime Cloud | `POST /upload` | 200 | `https://cdn.nekohime.site/file/jiep84xx.txt` | 200, 53 B, `content-type: text/plain` ✅ |
| 2 | CMNTY CDN | `POST /upload` | 200 | `http://cdn.cmnty.web.id/txt/8i5o23` | 200 over https, 53 B ✅ |
| 3 | Kappa | `POST /api/upload` | 200 | `https://kappa.lol/5034ev` | 200, 53 B ✅ |
| 4 | SILENTPHANTOM | `POST /api/upload` | 200 | `https://x.xcute.workers.dev/f/documents/e0c1a6872bc6.txt` | 200, 53 B ✅ |
| 5 | SenaVuck | `POST /api/upload` | 200 | `https://cp.senxc.my.id/f/383e7447d.txt` | 200, 53 B ✅ |
| 6 | Violetics CDN | `POST /api/upload` | 200 | `http://s7.vltcs.my.id/d/0ddce288375d.txt` | 200, 53 B ✅ |
| 7 | Zass CDN | `POST /upload` | 200 | `https://cdn.zass.in/M8hUUG7Ahd.txt` | 200, 53 B ✅ |
| 8 | Catbox | `POST /user/api.php` | 200 | `https://files.catbox.moe/a4ntz8.txt` | 200, 53 B ✅ |
| 9 | 8upload | `POST /upload/mt/` | 200 | `"\/uploads\/904bc62554ce"` | **404** on `i.8upload.com` ❌ |
| 10 | Athars CDN | `POST /upload.php` | **522** | — | — |

Captured request/response pairs are embedded as literals in
[`tests/parsers.test.ts`](../tests/parsers.test.ts) so the exact shapes above are
regression-tested. Re-run live traffic yourself with `npm run smoke`.

### Repeat verification run

`npm run smoke` was re-run against the finished build. It uploaded a fresh
47-byte probe to each integrated provider **with a cross-origin `Origin:` header**
(matching what a browser on `cdn.nesite.my.id` sends), then downloaded each
returned URL and compared the SHA-256:

| Provider | Returned URL | Download |
| --- | --- | --- |
| Kappa | `https://kappa.lol/yJ3ueO` | 47 B, sha256 ✅ |
| SenaVuck CDN | `https://cp.senxc.my.id/f/e33e6e825.txt` | 47 B, sha256 ✅ |
| SILENTPHANTOM | `https://x.xcute.workers.dev/f/documents/8cc696be4390.txt` | 47 B, sha256 ✅ |
| CMNTY CDN | `http://cdn.cmnty.web.id/txt/hdpqbt` | 47 B, sha256 ✅ |
| Violetics CDN | `http://s7.vltcs.my.id/d/8c51704fc33a.txt` | 47 B, sha256 ✅ |
| Zass CDN | `https://cdn.zass.in/3ReXku121Q.txt` | 47 B, sha256 ✅ |
| Nekohime Cloud | `https://cdn.nekohime.site/file/cirbivfj.txt` | 47 B, sha256 ✅ |
| Catbox | `https://files.catbox.moe/y8yqau.txt` | 47 B, sha256 ✅ |

Catbox returned the *same* URL as the earlier audit upload, because it is
content-addressed and the bytes were identical — an incidental confirmation that
the earlier result was real.

### Relay verified end-to-end

The production build was served locally and `/api/upload-proxy` was exercised
against the live providers:

| Request | Result |
| --- | --- |
| `POST` `provider=nekohime` + 53 B file | `200 {"ok":true,"url":"https://cdn.nekohime.site/file/lry4qcrh.txt"}` — downloaded, sha256 matched ✅ |
| `POST` `provider=catbox` + 53 B file | `200 {"ok":true,"url":"https://files.catbox.moe/a4ntz8.txt"}` — downloaded, sha256 matched ✅ |
| `POST` `provider=catbox` + `.exe` file | `412 {"ok":false,"error":"Catbox returned HTTP 412.","code":"http"}` — **no URL field** ✅ |
| `POST` `provider=https://evil.example` | `400 Unknown or non-proxied provider.` ✅ |
| `POST` `provider=kappa` (direct, not proxied) | `400 Unknown or non-proxied provider.` ✅ |
| `POST` with no file / empty file | `400 No file was received.` ✅ |
| `GET` on the route | `405` ✅ |

### How each endpoint was found

| Provider | Evidence |
| --- | --- |
| Nekohime | `/assets/js/min.js` is obfuscated. Its string array was extracted and the rotation IIFE (`0x360f4`) re-run in Node, decoding index `0x12b → "/upload"`, `0x13b → "file"`, `0xfa → "POST"`, `0x130 → "files"`, `0x10a → "url"`, and `0x6400000` (100 MB) as the client-side size check. |
| Catbox | `index.html` form: `action="/user/api.php"`, hidden `reqtype=fileupload`, hidden empty `userhash`; `resources/uploadform.js` posts `url:"user/api.php"` with `fileToUpload`. |
| SenaVuck | Inline `<script>` in the page: `fd.append('file', file)` → `fetch('/api/upload', {method:'POST'})`, returning `data.link`, with a 20 MB guard. |
| SILENTPHANTOM | Has a real `/api/docs` page with cURL examples and a documented response body. |
| Kappa | `_app/immutable/nodes/4.*.js` (SvelteKit): `` N.open("POST", `/api/upload${o}`) `` with `append("file", C)`. |
| Violetics | `/docs` publishes a full API reference, plus `/js/upload.js` shows `form.append('file', …); form.append('expiry', …)` → `POST /api/upload`. |
| Zass | Next.js chunk `1ql1-*.js`: `axios.post("/upload", FormData)` with `p.append("file", n)`, then `a.data.success`. |
| CMNTY | `GET /api/upload` returns the API's own machine-readable description. |
| Athars | Page inline script: 50 MB `CHUNK_SIZE`, `MAX_CONCURRENT = 10`, fields `chunkIndex`/`fileId`/`totalChunks`/`file`, then `action=merge`, then `check_status` polling on `{s:1,url}`. |
| 8upload | Page config `uploadUrl:'upload/mt/'`, input `name="images[]"`, `maxFileSize:12500`, image-only extension allowlist. |

---

## CORS findings

A browser on `cdn.nesite.my.id` can only read a provider's response if that
provider sends `Access-Control-Allow-Origin` on the **actual POST response** —
not just on the preflight.

| Provider | Preflight `OPTIONS` | POST response | Browser-direct upload |
| --- | --- | --- | --- |
| Kappa | 204, `ACAO: *`, POST allowed | `ACAO: *` ✅ | ✅ |
| SenaVuck | 200, `ACAO: *` | `ACAO: *` ✅ | ✅ |
| SILENTPHANTOM | — | `ACAO: *` ✅ | ✅ |
| CMNTY | 204, `ACAO: *` | `ACAO: *` ✅ | ✅ |
| Violetics | 204, `ACAO: *` | `ACAO: *` ✅ | ✅ |
| Zass | 204, `ACAO: *` | `ACAO: *` ✅ | ✅ |
| Nekohime | 200, **no ACAO** | **no ACAO** (tested with an explicit `Origin:` header) | ❌ relay required |
| Catbox | **412** | **no ACAO** | ❌ relay required |
| Athars | timed out | 522 | ❌ unavailable anyway |
| 8upload | **405** | `ACAO: https://8upload.com` | ❌ origin-pinned |

> Note on 8upload: the host in the brief, `i.8upload.com`, is a Cloudflare R2
> bucket endpoint — its own root returns 404 "Object not found". The actual
> uploader is on `8upload.com`.

---

## The relay (`/api/upload-proxy`)

Nekohime and Catbox work perfectly but send no CORS header, so a page on a
different origin can never read the response. A server-side relay is the only
way to use them without bypassing anything — CORS is a browser read restriction,
and relaying a request you are allowed to make is not authentication bypass.

The relay is deliberately narrow:

- **Fixed allowlist.** Only `nekohime` and `catbox`. The caller sends a provider
  *id*, never a URL. Any other value is a 400.
- **The adapter builds the upstream request.** Field names, hidden fields
  (`reqtype`, `userhash`) and the target URL all come from the provider adapter —
  the same module the tests cover. Caller-supplied fields are never forwarded.
- **The same parser decides success.** A provider error page can never be
  returned as a URL.
- **Size ceiling: 4 MB.** Vercel caps serverless request bodies at 4.5 MB, so
  files larger than this cannot go through the relay. The UI enforces the same
  number and labels proxied providers *"capped by relay"*.
- **45 s upstream timeout**, then a 504.
- **Nothing is stored.** The body is streamed to the provider and dropped. No
  disk, no database, no object storage.
- **Logs carry metadata only** — provider id, upstream status, error code. Never
  file contents, file names, or upstream response bodies.

---

## Provider policy notes worth reading before you ship

**Catbox — terms conflict (important).** From `catbox.moe/faq.php`, verbatim:

> You cannot use Catbox for commercial services without prior approval.
> Examples include: a CDN (Content Delivery Network); image host for your
> business/ecommerce site (embedding hotlinks to Catbox files on your Wordpress
> site that has ads or monetization); or as source for videos that are streamed
> on sites other than files.catbox.moe directly.

Nesite CDN republishes Catbox links through a multi-provider interface, which is
close to that description. This is **the single biggest compliance risk in the
project.** Rather than silently enabling it or silently dropping it, the UI
requires an explicit acknowledgement checkbox quoting that clause, and the
provider stays unselected until the user ticks it. If you have Catbox's approval,
enable it; if not, leave it ticked-off and consider removing it.

**Catbox content rules.** `.exe`, `.scr`, `.cpl`, `.doc*` and `.jar` are not
allowed. Our UI blocks those extensions before the request is made. Accounts and
uploads are purged for prohibited content.

**Nekohime Cloud.** No terms, privacy policy, rate limit or retention policy was
found — only "maximum file size limit for uploads is 100 MB per file". Absence of
published terms is itself a risk factor for a production front-end.

**Athars CDN.** No published terms, rate limits, or retention policy. It is also
currently down.

**8upload.** Image-only, ~12.5 MB, `ACAO` pinned to its own origin, and — the
decisive problem — it returns a path that is **not publicly reachable**.

---

## Not verified / open questions

Stated plainly rather than papered over:

- **Kappa, CMNTY, Athars publish no maximum size.** We refuse to invent one, so
  their `maxFileSizeBytes` is `null` and the UI shows *"not published"*.
- **Zass's "2 GB" and SILENTPHANTOM's "1000 Tera"** are self-reported and were
  not load-tested. We do not claim them as guarantees.
- **Zass's "permanent" URLs and SILENTPHANTOM's `retention: "permanent"`** are
  reported by the API but cannot be independently verified.
- **Rate limits** were not published by Kappa, SenaVuck, CMNTY, Violetics, Zass,
  Nekohime or SILENTPHANTOM, and were not load-tested. Do not build a bulk
  uploader on top of this without checking first.
- **Catbox's 200 MB and Nekohime's 100 MB** are the providers' own stated limits;
  only the small-file path was exercised.
- No provider was tested for behaviour with concurrent or repeated uploads.

---

## Reproducing the audit

```bash
npm install
npm test                 # unit tests over the captured response shapes
npm run typecheck
npm run lint
npm run build

# real uploads, one small file per provider, then downloads each result
npm run smoke
```

`npm run smoke` performs genuine uploads and verifies each returned URL by
downloading it and comparing the SHA-256. It is intentionally excluded from
`npm test`.

### Results at the time of writing

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm test` | **82 passed / 82** across 5 files |
| Type check | `npm run typecheck` | clean |
| Lint | `npm run lint` | clean, 0 problems |
| Build | `npm run build` | succeeded — `/` static, `/api/upload-proxy` dynamic |
| Live uploads | `npm run smoke` | **8 / 8 providers passed**, every URL downloaded and sha256-verified |
| Relay E2E | local server + `curl` | allowlist, size, method and error paths all correct |

> **Building on Android/arm64 (Termux):** Next 16 defaults to Turbopack, which
> needs native bindings that are unavailable on this platform and only WASM
> fallbacks exist. Use `npx next build --webpack` locally. Vercel runs Turbopack
> natively, so `npm run build` is correct as written for deployment.