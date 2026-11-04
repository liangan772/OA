# ---------- 构建阶段 ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY packages/web/package.json ./
RUN npm install --omit=optional

COPY packages/web/ ./
RUN npm run build

# ---------- 运行阶段 ----------
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
