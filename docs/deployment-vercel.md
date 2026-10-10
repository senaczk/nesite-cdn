# Deploying NESITE CDN to Vercel

Target: `cdn.nesite.my.id`

> **No deployment or DNS change has been performed.** This document is the
> procedure for you to follow, with your explicit go-ahead.

---

## 1. Requirements

- A Vercel account
- Node.js 20 or newer
- This repository pushed to GitHub, GitLab or Bitbucket

---

## 2. Environment variables

**None are required.**

Every provider integrated here works without an API key, and the relay carries
no secrets — its allowlist is hard-coded in
[`src/lib/providers/registry.ts`](../src/lib/providers/registry.ts) precisely so
that no destination URL can ever come from the client.

If you later add a provider that needs a credential, it must go in a **server
environment variable** read only inside a server route. Never in `NEXT_PUBLIC_*`,
which ships to the browser. See [`.env.example`](../.env.example).

---

## 3. Deploy

### Via the Vercel dashboard

1. **Add New → Project**, then import the repository.
2. Framework preset: **Next.js** (detected automatically).
3. Build command: `npm run build` · Output: default (`.next`).
4. Leave **Install Command** as `npm install`.
5. **Deploy.**

### Via the Vercel CLI

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
```

---

## 4. Point the domain

Only after you are satisfied with the preview:

1. Project → **Settings → Domains** → **Add** `cdn.nesite.my.id`.
2. Vercel shows the records to add — typically an `A` record to
   `76.76.21.21`, or a `CNAME` to `cname.vercel-dns.com`.
3. Add them at your DNS registrar.

`A` record:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `cdn` | `76.76.21.21` |

Propagation can take a few minutes to a few hours. Vercel's domain panel flips to
**Valid** automatically once it resolves.

---

## 5. Verify after deploy

```bash
curl -sS https://cdn.nesite.my.id | head -20
curl -sS -X POST https://cdn.nesite.my.id/api/upload-proxy        # expect 405
curl -sS -X POST https://cdn.nesite.my.id/api/upload-proxy \
  -F 'provider=https://evil.example' -F 'file=@README.md'        # expect 400
curl -sS -X POST https://cdn.nesite.my.id/api/upload-proxy \
  -F 'provider=kappa' -F 'file=@README.md'                      # expect 400 (not proxied)
```

The last two confirm the relay is not an open proxy.

Then run the live smoke test against production:

```bash
npm run smoke
```

---

## 6. The serverless relay on Vercel

`src/app/api/upload-proxy/route.ts` runs as a Node.js function with:

| Setting | Value | Why |
| --- | --- | --- |
| `runtime` | `nodejs` | needs `FormData`, `File`, `AbortSignal.timeout` |
| `maxDuration` | `60` | upstream timeout is 45 s |
| Request body | ≤ 4 MB | Vercel caps serverless request bodies at 4.5 MB |

On the Hobby plan a function may run for a shorter wall-clock limit than
`maxDuration` requests. If relay uploads start failing on deploy, either move the
project to a Pro plan or lower `UPSTREAM_TIMEOUT_MS` in
`route.ts`.

---

## 7. Cost and limits

- The page is static and costs nothing per view on the free tier.
- **Relay invocations consume function execution time.** Direct uploads never
  touch Vercel at all — only Nekohime and Catbox traffic does.
- No provider used here charges money and none needs an account.

---

## 8. Rollback

`vercel rollback` restores the previous deployment. Removing the custom domain
from Project → Settings → Domains stops serving `cdn.nesite.my.id` without
touching the deployment itself.

---

## 9. Re-running the provider audit

Provider APIs change. Before trusting this app in production, re-check the
providers:

```bash
npm run smoke
```

That performs a real upload per provider and verifies each returned URL. Full
method and evidence: [`provider-audit.md`](provider-audit.md).