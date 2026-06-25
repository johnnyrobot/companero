# Companero — Session Handoff

_Last updated: 2026-06-25 · `main` (HEAD `66f87d7`+, plus this update), pushed & in sync with `origin`. Repo is **public**, MIT-licensed._

This doc orients a fresh session with zero prior context. Read it first.

---

## 1. What this project is

`companero` is a **vanilla-JS static PWA** (no framework) — a course/class companion
app. It is served as static files by **nginx in Docker**. Core invariant: **local-only,
privacy-first** — all user data stays on-device (`localStorage`), no backend, no network
calls for user data.

- **Storage keys (do not rename — relied on for back-compat):**
  `student_planner.classes.v1`, `course_companion.profile.v1`
- **Container contract:** host port `6969 → 80`, `container_name: companero`, healthcheck in Dockerfile.

## 2. Current state — Phase 2 complete

The "Phase 2 Standards Remediation" effort is **done, reviewed, merged to `main`, and pushed**.
It closed 10 gaps from a prior gap analysis:

| Gap | Outcome |
|-----|---------|
| #1 broken install | generated `any` + `maskable` PWA icons |
| #2 immutable on un-hashed assets | content-hashing build; nginx `immutable` only on hashed files |
| #3 service-worker staleness | network-first navigations, cache-first immutable assets, build-derived `CACHE_NAME` |
| #4 combined `any maskable` | split icon purposes |
| #5 unpinned base image | multi-stage Dockerfile, both images pinned by tag **and** digest |
| #6 missing security headers | shared `nginx/security-headers.conf` (CSP, nosniff, Referrer-Policy, Permissions-Policy) |
| #7 outdated CI | `checkout@v5`, `setup-buildx-action@v4`, `build-push-action@v7` + test gate |
| #8 missing manifest `id` | added |
| #10 blocking `confirm()`/`alert()` | accessible modal dialogs (`src/dialogs.js`): focus trap, `aria-labelledby`, focus restore, Esc/backdrop cancel |
| #9 localStorage → IndexedDB | **CLOSED — consciously NOT implemented** (accepted as "localStorage sufficient for scope", YAGNI) |

All per-task reviews + a final whole-branch review (validated live against a real
`nginx:1.30-alpine` container) passed. The deferred Minor findings from those reviews
were **also swept** (commit `9db81d0`): CSP `worker-src`, dialog focus-restore,
`pathToFileURL` CLI guard, broader build-test coverage, CWD-independent test paths,
icon-ratio comments, CI/smoke readiness failure messages, trimmed `.dockerignore`.

**Status: there is no outstanding/blocking work. `main` is shippable.**

## 3. Repo & remotes (important, non-obvious)

- **`origin` → `https://github.com/johnnyrobot/companero.git` — now PUBLIC, MIT-licensed.**
  Canonical remote; `main` tracks `origin/main` and is in sync. Since it's public, treat
  everything committed (and all history) as world-readable — **no secrets, ever.**
- `gh` CLI active account is **`johnnyrobot`**. Two other keyring accounts
  (`johnnyphung-laccd`, `projectremedyai`) have **invalid tokens** — don't use them.
  The original `origin` pointed at `johnnyphung-laccd/companero`, which **does not exist**;
  it was repointed to `johnnyrobot/companero`.
- Branching: feature work is done on short-lived branches off `main`, fast-forward
  merged, then deleted. `main` is the only branch.
- **Internal tooling stays out of the repo:** `.claude/` is gitignored (the old
  `.claude/workflows/deep-research-retry.js` was removed before going public), and all
  SDD scratch under `.superpowers/` is gitignored. Keep internal/agent artifacts there.
- One early commit is authored by a local git identity (`LACCD <laccd@16-MacBook-Pro.local>`)
  and is visible in public history — harmless (no real email/secret), left as-is.

## 4. How to work here

```bash
npm install            # devDeps only: jsdom, sharp (no production deps)
npm test               # node:test runner — 22 tests, must stay green & pristine
npm run build          # build.mjs → dist/ (content-hash, rewrite refs, derive CACHE_NAME)
npm run icons          # regenerate PNG icons from the "Co" lettermark (rebrand only)
bash scripts/smoke-test.sh   # builds image, runs container, asserts cache + security headers (needs Docker)
```

**Architecture pointers:**
- `build.mjs` — pure-Node (built-ins only) content-hashing build. Hashes
  `app.js`/`styles.css`/`translations.js` + icons into `dist/`, rewrites refs in
  `index.html`/`manifest.webmanifest`, injects the SW `CACHE_NAME`/`APP_SHELL`.
  `src/dialogs.js` is a **stable-named** ES module: copied verbatim, but its bytes are
  **folded into `buildHash`** (so changes bust `CACHE_NAME`), it's **precached** in
  `APP_SHELL`, and nginx serves `/src/` **`no-cache`**. New `src/` modules must follow
  this same pattern (see `COPIED_MODULES` in `build.mjs`).
- `service-worker.js` — exports pure helpers `routeFor(req)` and `isCacheable(res)` for
  unit testing; the real handlers live behind an `isSW` guard. Network-first for
  navigations, cache-first for immutable assets, and **only caches 2xx responses**.
  Because it uses ES `export`, `app.js` registers it as a **module worker**
  (`register('./service-worker.js', { type: 'module' })`) — a classic worker would
  reject `export` and silently fail to register.
- `nginx.conf` + `nginx/security-headers.conf` — hashed assets → `immutable`;
  `index.html`/SW/manifest/`/src/` → `no-cache`; security headers `include`d per-location.
  (The hashed-asset `location` regex is quoted — `"\.[0-9a-f]{8}\.(...)$"` — because an
  unquoted `{8}` is mis-parsed by nginx's PCRE; don't unquote it.)
- `Dockerfile` — multi-stage: `node:22-alpine` builds `dist/`, `nginx:1.30-alpine` serves it.

## 5. Conventions (follow these)

- **TDD** + frequent commits. Tests must be pristine (no stray warnings).
- **Commit trailer (required):** end every commit message with
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- The implementation **plan of record** is
  `docs/superpowers/plans/2026-06-23-companero-phase-2-standards-remediation.md`.
- A durable SDD progress ledger lives at `.superpowers/sdd/progress.md`
  (**gitignored** — present in this working dir, absent from a fresh clone). It records
  every task's commit range and review outcome.
- **Licensing & visibility:** MIT (`LICENSE` at root). `README.md` is current as of the
  public release. The repo is **public** — never commit secrets, internal notes, or
  customer data.

## 6. Candidate future work (none urgent)

- **Localize dialog buttons.** `src/dialogs.js` hardcodes English `'OK'`/`'Cancel'`
  defaults, but the app is i18n via `t()`. If i18n matters, pass localized labels at the
  call sites in `app.js`. (Known minor gap, never formally logged.)
- **Gap #9 (IndexedDB).** Still deliberately closed. Revisit only if data grows or
  cross-tab/resilience needs emerge — the plan's Task 11 has a full (unexecuted) recipe.
- **Enable HSTS** in `nginx/security-headers.conf` (currently commented) once served
  over TLS / behind a TLS-terminating proxy.
- **CD → GHCR.** On push to `main` (after `test` + `build-and-smoke-test` pass), CI builds
  and pushes the image to `ghcr.io/johnnyrobot/companero` (`:latest` + `:<sha>`) using
  `GITHUB_TOKEN` — no external secrets. PRs do not deploy (guarded by an `if` on
  push-to-main). There's **no running-host deploy / live URL** yet — a host must pull the
  image. The GHCR package may default to private; set it public to match the repo if
  wanted. For a live host later, swap in a Cloud Run / Fly.io / VPS step (needs provider creds).

## 7. Gotchas

- Don't unquote the nginx hashed-asset regex (PCRE `{8}` parsing — see §4).
- When converting more script files to ES modules: `index.html` loads `app.js` as
  `type="module"` while `translations.js` stays a classic script (runs at parse time,
  before the deferred module, keeping `t()` global). There are **no inline `on*=`
  handlers** — keep it that way so module scope doesn't break wiring.
- Any new `src/` module: add it to `COPIED_MODULES` in `build.mjs` (or it'll serve stale).
- **The SW must stay a module worker.** `service-worker.js` uses ES `export` (shared with
  its tests); `app.js` registers it with `{ type: 'module' }`. Revert to a classic worker
  and the SW silently fails to register (offline/caching dead). A regression test in
  `tests/sw-routing.test.mjs` pins this — but **verify SW registration in a real browser**;
  Node unit tests and the Docker header-curl smoke do not exercise it. (This exact bug
  shipped through Phase 2 and was only caught by a browser smoke.)
