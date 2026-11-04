# ---------- 构建阶段 ----------
FROM node:22-alpine AS builder

WORKDIR /app

# 锁文件必须一起复制，才能用 npm ci 复现依赖树
COPY packages/web/package.json packages/web/package-lock.json ./

# 不能加 --omit=optional：rollup / esbuild 的平台二进制在 optionalDependencies 里，
# 跳过会导致 vite build 报 "Cannot find module @rollup/rollup-linux-x64-musl"
RUN npm ci --no-audit --no-fund

COPY packages/web/ ./
RUN npm run build

# ---------- 运行阶段 ----------
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
