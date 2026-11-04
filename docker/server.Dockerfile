# ---------- 构建阶段 ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY packages/server/package.json ./
RUN npm install --omit=optional

COPY packages/server/prisma ./prisma
RUN npx prisma generate

COPY packages/server/tsconfig.json packages/server/nest-cli.json ./
COPY packages/server/src ./src
RUN npm run build

# ---------- 运行阶段 ----------
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY packages/server/package.json ./
COPY packages/server/scripts ./scripts

EXPOSE 3001

HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -fsS http://localhost:3001/api/health || exit 1

CMD ["node", "dist/main"]
