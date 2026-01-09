# Dockerfile
FROM nginx:alpine

# Copy app to default Nginx web root
COPY . /usr/share/nginx/html

# Use production nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install curl for healthcheck
RUN apk add --no-cache curl

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -fsS http://localhost/ || exit 1
