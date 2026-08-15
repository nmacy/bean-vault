# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Build deps for native modules (better-sqlite3) in case prebuilds are missing.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci \
  # better-sqlite3 bundles prebuilds for every platform; keep only the target's
  # (linux-x64) so the standalone trace ships just the one it needs.
  && rm -rf node_modules/better-sqlite3/prebuilds/{darwin-arm64,darwin-x64,linux-arm64,linuxmusl-arm64,linuxmusl-x64,win32-arm64,win32-x64}

COPY . .
RUN npm run build

# ---- runtime stage ----
# Standalone output: only the traced server code + its direct dependencies.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle

# Writable data dir (SQLite DB + uploaded photos); migrations apply on first start.
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]