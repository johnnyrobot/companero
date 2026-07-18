# AGENTS.md

`companero` (Course Companion) is a vanilla-JavaScript, no-framework **Progressive Web App** that
lets students store class info entirely on their own device. Stack: plain ES modules + a service
worker, a pure-Node content-hashing build (`build.mjs`), a `node:test` unit suite, and an
nginx-in-Docker static server. There is **no backend and no runtime network call for user data** —
this is the core product invariant.

## Setup
- Requires **Node ≥ 20** (the test suite uses the built-in `node:test` runner).
- Install dev dependencies (there are no production dependencies): `npm install`
  - devDeps: `jsdom` (tests), `sharp` (icon generation).
- Docker path additionally needs Docker Desktop (Compose v2).

## Build & Run
```bash
# Dev — serve source over http (service workers won't run from file://)
npx serve -s .            # or: python3 -m http.server 8080

# Production build — content-hash assets into dist/
npm run build            # runs build.mjs: fingerprints app.js/styles.css/translations.js + icons,
                         # rewrites HTML/manifest/SW refs, derives SW CACHE_NAME from the build hash
npx serve -s dist        # serve the build (this is what the Docker image ships)

# Icons (only on a rebrand)
npm run icons

# Docker (multi-stage build → nginx serves dist/; host 6969 → container 80)
docker compose up -d --build   # open http://localhost:6969
docker compose down
```

## Testing
- Unit tests live in `tests/*.test.mjs` and run with `npm test` (`node --test`).
- Coverage spans the build, dialogs, icons, manifest, an nginx cache/header smoke, and
  service-worker routing.
- **Must pass before a change is done:** `npm test` (green and pristine — no stray warnings) and
  `npm run build` (must succeed).
- Header/cache + security-header integration smoke against a real container:
  `bash scripts/smoke-test.sh` (needs Docker).
- **Not covered by any of the above:** live service-worker registration. After touching
  `service-worker.js`, `app.js`'s SW registration, or the module/classic-script split, **manually
  verify SW registration in a real browser** (Chrome DevTools → Application → Service Workers).
- CI (`.github/workflows/ci.yml`) runs test + build on Node 22, a Docker build-and-smoke job, and
  publishes the image to GHCR on push to `main` using the built-in `GITHUB_TOKEN`.

## Code Style
- Vanilla ES modules; no framework, no bundler beyond `build.mjs`.
- `app.js` is loaded as `type="module"`; `translations.js` is intentionally a **classic script**
  (parses first so `t()` is global before the deferred module). Preserve this ordering.
- **No inline `on*=` event handlers** — wire events in JS so module scope doesn't break.
- Service worker code shares pure helpers (`routeFor`, `isCacheable`) with its tests via ES
  `export`; keep it a **module worker** (`register(..., { type: 'module' })`).
- Any new `src/` module must be registered in `COPIED_MODULES` in `build.mjs`, or the build serves
  a stale copy.
- Follow TDD and commit frequently.

## Commit & PR Conventions
- Git repo; `main` is the only long-lived branch and tracks `origin/main`. Do feature work on
  short-lived branches off `main`, then fast-forward merge and delete.
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Only commit or push when the user asks.

## Security & Data
- **Privacy-first, local-only:** all user data stays in the browser under `localStorage` keys
  `student_planner.classes.v1` and `course_companion.profile.v1`. Never introduce a backend,
  telemetry, or any network request that carries user data. Never rename those keys (back-compat).
- The repo is **public** and MIT-licensed — never commit secrets, credentials, internal notes, or
  customer data. Keep agent/internal scratch in the gitignored `.claude/` and `.superpowers/` dirs.
- nginx serves fingerprinted assets `immutable` and HTML/SW/manifest/`/src/` `no-cache`, with CSP
  and security headers applied per-location. Don't unquote the hashed-asset location regex
  (nginx PCRE mis-parses an unquoted `{8}` quantifier). HSTS is present but commented until served
  over TLS.
