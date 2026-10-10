// 给 web/index.html 的资源引用加内容哈希查询串。
// 目的：部署后浏览器必然取到新资源，避免「改了代码但用户还在跑旧 app.js / styles.css」。
// 幂等：同样的文件内容得到同样的版本号，重复运行不会产生漂移。
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const WEB = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'web');
const INDEX = path.join(WEB, 'index.html');
const ASSETS = ['styles.css', 'app.js', 'data/bundle.js', 'data/guide.js'];

const h = crypto.createHash('sha1');
for (const a of ASSETS) {
  const p = path.join(WEB, a);
  if (fs.existsSync(p)) h.update(fs.readFileSync(p));
}
const v = h.digest('hex').slice(0, 8);

let s = fs.readFileSync(INDEX, 'utf8');
const re = /(href|src)="(styles\.css|app\.js|data\/bundle\.js|data\/guide\.js)(\?v=[0-9a-f]+)?"/g;
const before = s;
s = s.replace(re, (_m, attr, file) => `${attr}="${file}?v=${v}"`);

if (s === before) {
  console.log(`✓ index.html 资源版本已是最新：${v}`);
} else {
  fs.writeFileSync(INDEX, s);
  console.log(`✓ index.html 资源版本 ${v}`);
}
