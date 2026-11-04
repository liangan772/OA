// 本地开发数据库：内嵌 PostgreSQL（端口 55432），无需 Docker。
// 生产环境由 docker-compose 提供 postgres 服务，此脚本不参与。
import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DEV_PG_PORT || 55432);
const dataDir = path.resolve(__dirname, '../.pgdata');
const firstRun = !fs.existsSync(dataDir);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'oooa',
  password: 'oooa',
  port: PORT,
  persistent: true,
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
});

if (firstRun) {
  console.log('初始化内嵌 PostgreSQL 数据目录（首次约 20 秒）…');
  await pg.initialise();
}

await pg.start();
console.log(`PostgreSQL 已启动: postgresql://oooa:oooa@localhost:${PORT}/oooa`);

if (firstRun) {
  try {
    await pg.createDatabase('oooa');
    console.log('已创建数据库 oooa');
  } catch (e) {
    console.log('创建数据库跳过:', e.message);
  }
}

console.log('PG_READY');

const shutdown = async () => {
  console.log('正在关闭 PostgreSQL…');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
