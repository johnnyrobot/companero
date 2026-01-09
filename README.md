# Course Companion (PWA)

Minimal, accessible Progressive Web App for students to store class info locally on their device. No accounts. No cloud. Works offline.

## Features
- Local-only storage (browser `localStorage`)
- Add/edit/delete classes with name, section, days/times, location, notes
- Reorder classes
- Search/filter
- Export/Import backup (JSON)
- Installable PWA with offline support
- Minimal, high-contrast, accessible UI

## Run locally
1. From the project root, start a static server (service workers require http/https):
   - Node: `npx serve -s .` or `npx http-server .`
   - Python: `python3 -m http.server 8080`
2. Open the URL printed by your server (e.g., http://localhost:8080).
3. Add your classes. Data persists in your browser storage on this device.

## Run with Docker Compose
Prereq: Docker Desktop (with Compose v2) installed.

```bash
# From project root
docker compose up -d --build

# Open the app
# http://localhost:6969

# Stop
docker compose down
```

## PWA install
- In Chrome/Edge: look for the install icon in the address bar or use browser menu > Install App.
- The app works offline after first load.

## Icons
- For full install quality, add PNG icons at:
  - `icons/icon-192.png`
  - `icons/icon-512.png`
- You can generate simple icons with:
  - https://favicon.io or https://realfavicongenerator.net

## Privacy
- All data stays on your device in `localStorage` under the key `student_planner.classes.v1`.
- Clearing site data or using a different browser/profile/device will not carry data over.

## GitHub & CI
This repo includes:
- `Dockerfile` to serve the static PWA via `nginx:alpine`.
- `docker-compose.yml` mapping host `6969 -> 80` in the container.
- GitHub Actions workflow at `.github/workflows/ci.yml` that builds the image and runs a smoke test.

Quick start to publish to GitHub:
```bash
git init
git add .
git commit -m "Initial commit: PWA + Docker + CI"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Actions will run automatically on pushes/PRs.

## Next steps (optional)
- Field-level validation messages
- Calendar export (iCal)
- Reminders via Notifications API (local-only)
