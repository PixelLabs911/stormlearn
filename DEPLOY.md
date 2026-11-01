# Deploying StormLearn

The app is a standard Next.js 15 App Router project with six API routes and no
database — all user data lives in the browser's localStorage. That makes it a
clean fit for Vercel (or any Node host). Upload size is ~666 KB of source.

## Pre-flight: already fixed in this repo

Two things would have broken a default Vercel deploy. Both are now handled.

**1. Fluid Compute — required, not optional.**
`src/app/api/generate/route.ts` sets `maxDuration = 120` and
`src/app/api/transcribe/route.ts` sets `maxDuration = 180`. On the Hobby plan
those values are rejected at deploy time unless Fluid Compute is enabled:

```
Error: Builder returned invalid maxDuration value for Serverless Function
"api/generate". Serverless Functions must have a maxDuration between 1 and 60
for plan hobby.
```

With Fluid Compute on, Hobby allows up to 300s, so both routes fit.
`vercel.json` sets `"fluid": true` for this reason. If your Vercel CLI or
project rejects that key, enable it in the dashboard instead —
**Project → Settings → Functions → Fluid Compute** — and delete the key.

**2. Node ≥ 20.16.**
`pdfjs-dist@5.4.149` declares `engines: ">=20.16.0 || >=22.3.0"`. Vercel's
legacy default Node version can be older than that, which fails the install.
`vercel.json` pins `NODE_VERSION=22.x` and `package.json` declares the engine
requirement.

Everything else needs no configuration: no build-time env vars, no filesystem
writes (Vercel's FS is read-only), no absolute paths, no native modules.

---

## Path A — Vercel CLI with a token (one command)

Best when you want the deploy done now and don't want to set up a Git repo.

1. Create a token at **https://vercel.com/account/tokens** → *Create Token*.
   Scope: your account, permission **Full Access** (Deploy needs it), no
   expiration or a short one you revoke afterwards.
2. From the project root:

```bash
npx vercel deploy --prod --token=YOUR_TOKEN --yes
```

`--yes` accepts the default project name and settings so it won't block on
prompts. It prints a Production URL like `https://stormlearn-xxxx.vercel.app`.

**Revoke the token when you're done.** A full-access token is equivalent to
account credentials, so don't paste it into chats, commits, or CI logs — and if
you do hand one to an agent, delete it afterwards.

To deploy later changes: `npx vercel deploy --prod` again.

## Path B — GitHub + Vercel Git integration (most durable)

Best for a link that keeps updating and survives indefinitely.

```bash
cd /home/user/stormlearn      # or wherever you keep the project
git init && git add -A && git commit -m "StormLearn"
gh repo create stormlearn --private --source=. --push   # or push via github.com UI
```

Then at **https://vercel.com/new**, import the repo. Vercel auto-detects
Next.js; accept the defaults and deploy. Every subsequent `git push` to the
default branch redeploys automatically, and you get a permanent
`*.vercel.app` URL plus per-PR preview URLs.

`.gitignore` already excludes `node_modules/` and `.next/` — Vercel rebuilds
both from the lockfile.

## Path C — any container host (Fly.io, Railway, Render, Koyeb, Cloud Run, a VPS)

`Dockerfile` is a two-stage build that ships only the compiled output and
runtime dependencies. Nothing in it is host-specific.

```bash
docker build -t stormlearn .
docker run --rm -p 3000:3000 stormlearn
# open http://localhost:3000
```

For a host, point it at the repo and let it find the Dockerfile:

```bash
fly launch --no-deploy && fly deploy     # Fly.io
railway up                               # Railway (also reads railway.json)
```

Google Cloud Run needs the port passed through, since it injects `$PORT`:

```bash
gcloud run deploy stormlearn --source . --port 3000 --allow-unauthenticated
```

**Verified:** the runtime image's assumption was tested directly in the sandbox.
A tree containing only `.next`, `node_modules` (dev dependencies pruned) and
`package.json` — no `src/`, no config files — started in **310ms**, served
`/`, `/new`, `/review` and `/settings` with 200, and answered
`POST /api/generate` with 16 key terms, 4 cards and 3 questions. The app needs
no source files at runtime and writes nothing to disk, so a read-only container
filesystem is fine.

Note the image runs `npx next start` rather than `npm start` on purpose: the
`prestart` hook would try to reinstall and rebuild inside an image that is
already built and may be read-only.

## Path D — Node hosts without Docker (Railway Nixpacks, Render, Heroku, a bare VPS)

`nixpacks.toml` and `railway.json` pin Node 22 and define the build and start
commands, so a Git-push deploy works with no further setup. On Render, use:

| Field | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci && npm run build` |
| Start command | `npx next start -H 0.0.0.0 -p $PORT` |
| Env var | `NODE_VERSION=22.x` |

Requirements anywhere: **Node ≥ 20.16** (`pdfjs-dist` needs it) and the ability
to run a long-lived Node process. `maxDuration` exports are Vercel-only and are
ignored elsewhere — the equivalent limit is your host's HTTP request timeout, so
raise that to ~180s if the platform allows, or large-PDF generation may be cut
off mid-request.

**Not supported:** Netlify and GitHub Pages. Netlify's Next.js runtime does not
handle `maxDuration` values above its own ceilings, and GitHub Pages serves
static files only — it cannot run the six API routes this app depends on.

---

## After deploying, check these

| Check | Expect |
| --- | --- |
| `/`, `/new`, `/review`, `/settings` | 200 |
| Generate from the sample notes on `/new` | notes, cards, quiz, podcast all populate, engine badge says **Demo** |
| Settings → paste an OpenAI/Anthropic/Gemini key → **Test** | badge flips to **LLM**; without a key the demo engine still works |
| Reload the page | your sets persist (localStorage, per browser) |

### Known platform caveats

- **Data is per-browser.** localStorage means a set created on your laptop does
  not appear on your phone. A permanent link is shareable, but each visitor
  gets their own independent library. Real cross-device sync would need a
  database and auth — not built here.
- **Audio transcription needs an OpenAI key.** `/api/transcribe` calls
  OpenAI's Whisper. The key-free path is the in-browser Recorder, which uses
  the Web Speech API and works in Chromium browsers only.
- **Hobby plan is fine for personal use.** Its 300s function ceiling covers the
  longest route (180s). If you upload very large PDFs and see
  `FUNCTION_INVOCATION_TIMEOUT`, that's the ceiling being hit — split the
  source or upgrade.
- **Demo engine output is extractive.** It ranks terms by frequency and pulls
  definitions from sentences that look definitional. It's genuinely useful for
  structure and revision, but a real LLM key produces better prose. This is by
  design, not a deploy bug.
