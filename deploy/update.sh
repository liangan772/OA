#!/usr/bin/env bash
# CROA 更新脚本：备份 → 拉代码 → 重建镜像 → 重启 → 补齐数据 → 健康检查
# 用法：bash deploy/update.sh
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml"
STAMP="$(date +%F-%H%M)"

echo "==> 1/6 备份数据库"
$COMPOSE exec -T postgres pg_dump -U croa -d croa --clean --if-exists > "backup-${STAMP}.sql"
echo "    已备份到 backup-${STAMP}.sql"

echo "==> 2/6 拉取代码"
git pull

echo "==> 3/6 重建镜像（web + server）"
$COMPOSE build web server

echo "==> 4/6 重启服务"
$COMPOSE up -d

echo "==> 5/6 等待后端就绪"
for i in $(seq 1 30); do
  if $COMPOSE exec -T server node -e "process.exit(0)" >/dev/null 2>&1; then
    sleep 2
    break
  fi
  sleep 2
done

echo "==> 6/6 初始化组织类型（幂等，可重复执行）"
$COMPOSE exec -T server node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();(async()=>{const t=[{code:"UNIT",name:"单位",isUnit:true,builtin:true,sort:1},{code:"DEPARTMENT",name:"部门",isUnit:false,builtin:true,sort:2},{code:"SECTION",name:"科室",isUnit:false,builtin:true,sort:3}];for(const x of t)await p.orgType.upsert({where:{code:x.code},create:x,update:{name:x.name,isUnit:x.isUnit,builtin:true,sort:x.sort}});console.log("  组织类型已就绪");await p.$disconnect()})().catch(e=>{console.error(e.message);process.exit(1)})'

echo "==> 健康检查"
PORT="$(grep -E '^WEB_PORT=' .env 2>/dev/null | cut -d= -f2 || echo 8080)"
curl -sf "http://localhost:${PORT:-8080}/api/health" && echo
echo "更新完成。如有异常：docker compose -f docker-compose.prod.yml logs -f server"
