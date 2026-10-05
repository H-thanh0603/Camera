# LUMINA Optics — production image (multi-stage).
# Build:  docker build -t lumina:latest .
# Chạy:   xem docker-compose.prod.yml (app + postgres + worker).
# Deploy lần đầu: migrate baseline bằng scripts/db-pg-init.mjs TRƯỚC khi
# start app (xem docs/runbook.md), rồi mới `docker compose up`.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 (dev DB) cần biên dịch native — toolchain chỉ ở stage build,
# không vào image prod cuối (prod chạy Postgres).
# --ignore-scripts: postinstall `prisma generate` chạy ở stage build (đủ source)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* && npm ci --ignore-scripts

FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Rebuild native module cho đúng ABI của image build (tránh .node biên dịch
# từ layer cache/base khác nhau gây ERR_DLOPEN_FAILED lúc prerender).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* && npm rebuild better-sqlite3
# Prisma client generate lúc build (postinstall cũng chạy lại, giữ idempotent)
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs
# tsx chạy worker/cron *.ts trong image prod (runtime duy nhất ngoài standalone)
RUN npm i -g tsx@4 --no-audit --no-fund
# Standalone server + static + prisma engine cần cho migrate/seed runtime
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
# Health: /api/health trả 503 khi DB down → container unhealthy
# (node:20-slim không có wget/curl — dùng fetch có sẵn của Node 20)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>{if(j.status!=='ok')process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
