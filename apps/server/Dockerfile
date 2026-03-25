# ── Server Dockerfile ──────────────────────────────────────────────────────────
# node:18-alpine is small (~50MB) vs node:18 (~300MB)
FROM node:20-alpine

WORKDIR /app

# Copy package files first — Docker caches this layer
# so npm install only re-runs when dependencies change
COPY package.json ./

RUN npm install --omit=dev

# Copy source code AFTER install (layer cache optimization)
COPY src/ ./src/

EXPOSE 4000

CMD ["node", "src/index.js"]