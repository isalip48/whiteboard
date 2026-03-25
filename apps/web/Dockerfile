# ── Web Dockerfile (two-stage build) ──────────────────────────────────────────
# Stage 1: BUILD — installs all deps and compiles Next.js
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: RUN — only copies the compiled output, not node_modules
# This makes the final image much smaller
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]