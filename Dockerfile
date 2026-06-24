# syntax=docker/dockerfile:1

# --- build stage: content-hash assets into dist/ ---
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build
WORKDIR /app
COPY package.json package-lock.json ./
# build.mjs uses only Node built-ins; sharp/jsdom are dev-only (icon-gen/tests).
# --omit=dev avoids compiling native sharp in the Alpine build stage.
RUN npm ci --omit=dev
COPY . .
RUN npm run build

# --- runtime stage: serve dist/ via pinned nginx ---
FROM nginx:1.30-alpine@sha256:9f00a7a92624975cdd964ec71fbb86bf91dc117e86436a9a91fa7b5cdb9615d1
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/conf.d/security-headers.conf
RUN apk add --no-cache curl
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -fsS http://localhost/ || exit 1
