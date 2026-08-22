// 把 validation/ 的腳本複製到 public/validation/,讓網站可直接連結下載(研究與前端不分離)
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'validation');
const dst = join(root, 'public', 'validation');
mkdirSync(dst, { recursive: true });
for (const f of readdirSync(src)) {
  if (f.endsWith('.py') || f === 'requirements.txt') cpSync(join(src, f), join(dst, f));
}
console.log('copied validation/*.py -> public/validation/');
