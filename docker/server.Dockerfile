# ---------- 构建阶段 ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 锁文件必须一起复制，才能用 npm ci 复现依赖树
COPY packages/server/package.json packages/server/package-lock.json ./

# 先放 prisma schema，@prisma/client 的 postinstall 才能正确生成
COPY packages/server/prisma ./prisma

# 不能加 --omit=optional：平台相关的引擎包在 optionalDependencies 里
RUN npm ci --no-audit --no-fund && npx prisma generate

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
