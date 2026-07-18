# CLAUDE.md

Course Companion (`companero`) is a minimal, accessible, **local-only** Progressive Web App:
students store their class info in the browser (`localStorage`) with no accounts, no backend, and
no network calls for user data. Vanilla JS, no framework; served as static files by nginx in Docker.

## Architecture
- `index.html` — app shell. Loads `app.js` as `type="module"`; `translations.js` stays a **classic
  script** (runs at parse time so `t()` is a global before the deferred module runs). No inline
  `on*=` handlers anywhere — keep it that way.
- `app.js` — all UI logic and state. Persists to two `localStorage` keys (see Gotchas). Registers
  the service worker as a **module worker**: `register('./service-worker.js', { type: 'module' })`.
- `src/dialogs.js` — accessible modal dialogs (focus trap, `aria-labelledby`, focus restore,
  Esc/backdrop cancel). A stable-named ES module imported by `app.js`.
- `service-worker.js` — offline/caching. Exports pure helpers `routeFor(req)` / `isCacheable(res)`
  for unit tests; real handlers sit behind an `isSW` guard. Network-first for navigations,
  cache-first for immutable hashed assets, caches **2xx only**.
- `build.mjs` — pure-Node (built-ins only) content-hashing build → `dist/`. Fingerprints
  `app.js`/`styles.css`/`translations.js` + icons, rewrites refs in `index.html`/
  `manifest.webmanifest`, injects the SW `CACHE_NAME` (`companero-<buildHash>`) and `APP_SHELL`.
  `src/` modules in `COPIED_MODULES` are copied verbatim but their bytes fold into `buildHash`.
- `nginx.conf` + `nginx/security-headers.conf` — hashed assets served `immutable`;
  `index.html`/SW/manifest/`/src/` served `no-cache`; CSP + security headers `include`d per-location.
- `Dockerfile` — multi-stage: `node:22-alpine` builds `dist/`, `nginx:1.30-alpine` serves it. Base
  images pinned by tag **and** digest.
- `tests/*.test.mjs` — `node:test` suite (build, dialogs, icons, manifest, smoke, sw-routing).
- `scripts/generate-icons.mjs` — regenerates PNG app icons (sharp).

## Commands
```bash
npm install                  # devDeps only: jsdom, sharp (no production deps)
npm test                     # node --test — must stay green and pristine (no stray warnings)
npm run build                # build.mjs → dist/ (content-hash, rewrite refs, derive CACHE_NAME)
npm run icons                # regenerate PNG icons from the "Co" lettermark (rebrand only)

# Run locally (service workers need http/https, not file://)
npx serve -s .               # serve source, or: python3 -m http.server 8080
npx serve -s dist            # production fidelity: serve the build

# Docker (host 6969 → container 80)
docker compose up -d --build
bash scripts/smoke-test.sh   # builds image, runs container, asserts cache + security headers
```

## Conventions
- TDD; frequent commits. Tests must be pristine.
- End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Feature work on short-lived branches off `main`, fast-forward merged, then deleted. `main` is the
  only branch and tracks `origin/main`.
- Node ≥ 20 (uses the built-in `node:test` runner). Repo is **public** and MIT-licensed.
- Internal/agent artifacts stay out of git: `.claude/` and `.superpowers/` are gitignored.

## Gotchas & Constraints
- **Local-only invariant:** all user data stays on-device. Never add a backend or network call for
  user data. Storage keys `student_planner.classes.v1` and `course_companion.profile.v1` are
  **relied on for back-compat — never rename them.**
- **The SW must stay a module worker.** `service-worker.js` uses ES `export` (shared with its
  tests); reverting to a classic worker makes it silently fail to register (offline/caching dead).
  A regression test pins this, but **verify SW registration in a real browser** — Node unit tests
  and the Docker header-curl smoke do not exercise it. (This exact bug shipped once, caught only by
  a browser smoke.)
- **Any new `src/` module must be added to `COPIED_MODULES` in `build.mjs`** or it serves stale.
- **Don't unquote the nginx hashed-asset regex** (`"\.[0-9a-f]{8}\.(...)$"`). An unquoted `{8}` is
  mis-parsed by nginx's PCRE.
- Public repo — never commit secrets, internal notes, or customer data.
- IndexedDB migration is deliberately **not** implemented (YAGNI for current scope).
