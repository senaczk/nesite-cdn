# NESITE CDN

**Upload Once. Share Everywhere.**
One interface. Multiple file hosts.

A single dark-mode front-end for uploading a file to one of several verified
public file hosts, with a separate adapter per provider and the real URL the
provider returned.

Target domain: `cdn.nesite.my.id` · Deploy target: Vercel

---

## What this actually does

Pick a file → pick a provider → upload → copy the URL. Files go **straight from
your browser** to the provider you chose. Nesite does not keep your files.

Every provider in the picker was audited against its real API and confirmed with
a real upload whose returned URL was downloaded and byte-verified. Providers
that could not be verified that way are not in the picker — the UI says why.

| Status | Providers |
| --- | --- |
| **READY** — direct browser upload | Kappa · SenaVuck · SILENTPHANTOM · CMNTY CDN · Violetics CDN · Zass CDN |
| **PARTIAL** — works, needs the relay | Nekohime Cloud · Catbox |
| **UNVERIFIED** — backend down | Athars CDN |
| **UNSUPPORTED** — no usable public URL | 8upload |

Full evidence, request/response captures and policy notes:
**[docs/provider-audit.md](docs/provider-audit.md)**.

### Before you enable Catbox

Catbox's FAQ forbids using it as a CDN or third-party image host without prior
approval. A multi-provider uploader is close to that description. Catbox is
therefore behind an explicit acknowledgement checkbox quoting the clause, and
stays unselected until you tick it. Read the audit doc before deciding.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Vitest.

Chosen because it runs natively on Vercel and hosts both the UI and the one
serverless function this project needs, without a second deployment.

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (no network) |
| `npm run smoke` | **Real uploads** to live providers, then verifies each URL |

### Verified at the time of writing

| Check | Result |
| --- | --- |
| `npm test` | 82 / 82 passed |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | succeeded — `/` static, `/api/upload-proxy` dynamic |
| `npm run smoke` | **8 / 8 providers passed**, every URL downloaded and SHA-256 verified |
| Relay end-to-end | live upload through `/api/upload-proxy` for both relay providers; allowlist, size, method and error paths all correct |

> Building on Android/arm64 (Termux)? Next 16 defaults to Turbopack, which has no
> native bindings there. Use `npx next build --webpack` locally. Vercel runs
> Turbopack natively, so `npm run build` is correct as-is for deployment.

---

## Architecture

```
src/
  app/
    layout.tsx                  shell, viewport, max-width container
    page.tsx                    renders <UploadConsole/>
    globals.css                 dark theme tokens, neon accents
    api/upload-proxy/route.ts   allowlisted serverless relay
  components/
    Header                      brand + headline
    FileDropzone                step 01 — choose/drop a file
    ProviderSelector            step 02 — radio cards, one per provider
    UploadProgress              live progress + cancel
    UploadResult                the URL + Copy button
    UploadConsole               state machine wiring the five together
  lib/
    providers/
      types.ts                  ProviderAdapter contract
      registry.ts               id -> adapter, status counts, proxy allowlist
      kappa.ts senxc.ts xcute.ts cmnty.ts vltcs.ts zass.ts
      nekohime.ts catbox.ts     relay-backed
      eightupload.ts athars.ts  present, but refuse to upload
      client.ts                 adapter -> transport
    upload/
      validation.ts             size / name / extension checks
      errors.ts                 one error type for every failure path
      transport.ts              XHR upload with progress, timeout, abort
      limits.ts                 relay body ceiling
```

### The adapter contract

Each provider is one module exporting one object:

```ts
interface ProviderAdapter {
  meta: ProviderMeta;                                        // audit facts shown in the UI
  buildUpstreamRequest(file: File): UpstreamRequest;          // data only, never executed client-side for relay providers
  buildRequest?(file: File, options: UploadOptions): UpstreamRequest;  // only when a provider exposes a real option
  parseResponse(status, contentType, body): NormalizedUpload;  // throws rather than guessing
}
```

Three rules every adapter obeys:

1. **`parseResponse` throws instead of guessing.** If the body does not contain a
   positively identifiable URL, it raises an `UploadError`. There is no
   fallback path, no string-concat fallback, no "best effort" URL.
2. **No fabricated URLs.** The user only ever sees a URL the provider actually
   returned. Where a provider returns a scheme-less link (SenaVuck) or an `http://`
   link (CMNTY, Violetics), we pass it through as returned and say so, rather
   than rewriting it into something the provider never said.
3. **Failures are uniform.** Every path — 4xx, 5xx, timeout, network drop,
   cancellation, unparseable body — produces an `UploadError` with a code the UI
   can render directly.

### Direct vs relay

`meta.integration` decides the transport:

- **`direct`** — the browser POSTs to the provider. Six providers. No Nesite
  server involved at all.
- **`proxy`** — the browser POSTs to `/api/upload-proxy`, which forwards to the
  provider using **the same adapter**. Nekohime and Catbox ship no CORS header,
  so a cross-origin browser can never read their responses; relaying a request
  you are entitled to make is the supported fix.
- **`none`** — not selectable. The adapter exists to record the audit result and
  throws `UploadError('unsupported' | 'unverified')` rather than half-implementing
  an upload it cannot complete.

### The relay is narrow on purpose

- Fixed allowlist of two provider **ids**. The caller never supplies a URL.
- The adapter builds the upstream form, so caller-supplied fields are dropped.
- 4 MB ceiling (Vercel caps serverless bodies at 4.5 MB).
- 45 s upstream timeout.
- Nothing stored — streamed to the provider and dropped.
- Logs carry provider id, status and error code only. Never file contents or
  names.

---

## Security & privacy

- **Nothing is stored.** No disk, no database, no object storage. Direct uploads
  never touch the Nesite server.
- **No credentials.** Every provider used here needs none, so there are no keys
  in the frontend and no `.env` secrets required. See `.env.example`.
- **Uploads only on explicit action.** No file leaves the device until the user
  presses Upload.
- **Name sanitising** strips path separators and control characters before any
  request is built.
- **Size validation** before upload, with the provider's real limit; unknown
  limits are shown as "not published" rather than guessed.
- **Extension blocking** where a provider genuinely enforces one (Catbox).
- **Timeouts and cancellation** on every request.
- **Double-submission guard** via a ref, so two fast clicks cannot both fire.
- **Proxy allowlist**, size cap and timeout as above.
- Security headers (`nosniff`, `no-referrer`, `DENY`) in `next.config.ts`.
- The UI states plainly that **anything you upload becomes public** under the
  provider's policy.

---

## Deployment

See **[docs/deployment-vercel.md](docs/deployment-vercel.md)**.

No deployment or DNS change has been performed. `cdn.nesite.my.id` needs to be
pointed at the project yourself, with your explicit go-ahead.

---

## Testing

`npm test` covers the registry, every response parser, file validation, the error
mapping, and the relay's allowlist and failure paths. Parser fixtures are **real
captured responses** from the audit, not invented shapes.

`npm run smoke` is separate and does **real uploads** — one small file per
provider, then downloads each returned URL and compares SHA-256. It is not part
of `npm test` and should be run deliberately.

---

## Known limitations

- Relay-backed providers (Nekohime, Catbox) are capped at **4 MB** because of the
  Vercel serverless body limit.
- CMNTY and Violetics return `http://` URLs that redirect to `https://`. Nesite
  shows them exactly as returned.
- Kappa, CMNTY and Athars publish no size limit; the UI says "not published".
- Athars CDN may become usable once its origin is back — re-audit and the
  adapter is already scaffolded.
- No provider has been load-tested; none publishes a rate limit. Do not build
  bulk uploading on this without checking first.