import * as fs from 'fs';
import * as path from 'path';

// 轻量 .env 加载（避免额外依赖）。
// 依次尝试：当前工作目录、server 根目录（src/common 与 dist/common 均向上两级）
const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];

const envPath = candidates.find((p) => fs.existsSync(p));

if (envPath) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
