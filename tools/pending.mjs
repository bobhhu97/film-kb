// 重建 shards/00-meta/pending.json：收集全库中被 links 或正文 $ref 引用、但尚未存在的 entry id。
// 这些 id 是「已规划未撰写」，validate.mjs 对它们放行。
// 用法: node tools/pending.mjs [--write]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'shards');
const WRITE = process.argv.includes('--write');
const P = path.join(DIR, '00-meta', 'pending.json');

const files = fs.readdirSync(DIR).filter(f => /^[a-z-]+\.\d+\.json$/.test(f));
const shards = files.map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));

const known = new Set();
for (const d of shards) for (const e of d.entries || []) known.add(e.id);

const modules = new Set(JSON.parse(fs.readFileSync(path.join(DIR, '00-meta', 'modules.json'), 'utf8')).modules.map(m => m.id));
const wanted = new Set();

function scanText(s) {
  // $ 前不是字母数字才算 entry 引用，避免把货币 US$44.17 当成 id
  for (const m of String(s).matchAll(/(^|[^A-Za-z0-9])\$([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) wanted.add(m[2]);
}
function scanBlock(b) {
  for (const k of ['text', 'title', 'caption', 'label', 'formula', 'note']) if (typeof b[k] === 'string') scanText(b[k]);
  for (const k of ['items', 'rows', 'defs', 'steps', 'cells']) if (Array.isArray(b[k])) {
    for (const it of b[k]) {
      if (typeof it === 'string') scanText(it);
      else if (Array.isArray(it)) it.forEach(v => { if (typeof v === 'string') scanText(v); });
      else if (it && typeof it === 'object') for (const v of Object.values(it)) if (typeof v === 'string') scanText(v);
    }
  }
}
for (const d of shards) for (const e of d.entries || []) {
  for (const b of e.blocks || []) scanBlock(b);
  if (e.quiz) for (const q of e.quiz) { scanText(q.q || ''); (q.options || []).forEach(o => scanText(o)); }
  if (e.links) for (const arr of Object.values(e.links)) if (Array.isArray(arr)) arr.forEach(t => { if (typeof t === 'string') wanted.add(t); });
}

const missing = [...wanted].filter(id => !known.has(id) && !modules.has(id)).sort();
const out = {
  note: '已规划但尚未撰写的 entry id：全库中被 links 或正文 $ref 引用、但目前不存在的条目。validate.mjs 对指向本清单的链接放行。本文件由 tools/pending.mjs 自动生成，分片收齐后应清空为 []。',
  planned: missing
};
const json = JSON.stringify(out, null, 2) + '\n';
if (WRITE) { fs.writeFileSync(P, json); console.log(`✓ pending.json 已更新：${missing.length} 个待撰写 id`); }
else console.log(JSON.stringify(out, null, 2));