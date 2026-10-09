// 机械修复分片中的可自动处理问题，不改动内容事实：
// 1. links.* 指向模块名（如 film-stock）或全库不存在的 entry id → 剔除该链接
// 2. 正文 $entry-id 指向不存在的条目 → 去掉 $ 前缀保留文字（降级为普通文本）
// 3. 半角/全角感叹号 → 去掉（STE100 禁止感叹号）
// 4. 修正 "part_of" 误填模块名的情况
// 用法: node tools/repair.mjs [--write]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'shards');
const WRITE = process.argv.includes('--write');

const files = fs.readdirSync(DIR).filter(f => /^[a-z-]+\.\d+\.json$/.test(f));

// 先收集全部已知 id（含 pending 白名单）
const pendingFile = path.join(DIR, '00-meta', 'pending.json');
const pendingObj = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile, 'utf8')) : [];
const pendingList = Array.isArray(pendingObj) ? pendingObj : (pendingObj.planned || pendingObj.entries || pendingObj.ids || []);
const pendingIds = new Set(pendingList.flat(Infinity).map(String));

function collectIds(files) {
  const ids = new Set();
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    for (const e of d.entries || []) ids.add(e.id);
  }
  return ids;
}

function textOfBlock(b) {
  const parts = [];
  for (const k of ['text', 'title', 'caption', 'label', 'formula', 'note']) if (typeof b[k] === 'string') parts.push(b[k]);
  for (const k of ['items', 'rows', 'defs', 'steps', 'cells']) if (Array.isArray(b[k])) {
    for (const it of b[k]) {
      if (typeof it === 'string') parts.push(it);
      else if (it && typeof it === 'object') for (const v of Object.values(it)) if (typeof v === 'string') parts.push(v);
      else if (Array.isArray(it)) for (const v of it) if (typeof v === 'string') parts.push(v);
    }
  }
  return parts;
}
function fixBlock(b, known, drops) {
  for (const s of textOfBlock(b)) { /* noop, we mutate below */ }
  const fix = s => {
    let out = s;
    // 只在 $ 前不是字母数字时才当作 entry 引用，避免误伤货币 US$44.17
    out = out.replace(/(^|[^A-Za-z0-9])\$([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi, (m, pre, id) => {
      if (known.has(id) || pendingIds.has(id)) return m;
      drops.add(id);
      return pre + m.slice(pre.length + 1);
    });
    out = out.replace(/[!！]/g, '');
    return out;
  };
  for (const k of ['text', 'title', 'caption', 'label', 'formula', 'note']) if (typeof b[k] === 'string') b[k] = fix(b[k]);
  for (const k of ['items', 'rows', 'defs', 'steps', 'cells']) if (Array.isArray(b[k])) {
    b[k] = b[k].map(it => {
      if (typeof it === 'string') return fix(it);
      if (it && typeof it === 'object') { for (const [kk, vv] of Object.entries(it)) if (typeof vv === 'string') it[kk] = fix(vv); }
      return it;
    });
  }
}

const known = collectIds(files);
const modules = new Set(JSON.parse(fs.readFileSync(path.join(DIR, '00-meta', 'modules.json'), 'utf8')).modules.map(m => m.id));
const report = [];

for (const f of files) {
  const p = path.join(DIR, f);
  const raw = fs.readFileSync(p, 'utf8');
  const d = JSON.parse(raw);
  const drops = new Set();
  const removedLinks = [];
  for (const e of d.entries || []) {
    // links：剔除模块名与未知 id
    if (e.links) {
      for (const rel of Object.keys(e.links)) {
        const arr = e.links[rel];
        if (!Array.isArray(arr)) continue;
        const keep = arr.filter(t => {
          if (typeof t !== 'string') return true;
          if (modules.has(t)) { removedLinks.push(`${e.id}.${rel} → ${t} (模块名)`); return false; }
          if (!known.has(t) && !pendingIds.has(t)) { removedLinks.push(`${e.id}.${rel} → ${t} (未知)`); return false; }
          return true;
        });
        e.links[rel] = keep;
        // part_of 清空后删键
        if (rel === 'part_of' && keep.length === 0) delete e.links.part_of;
      }
    }
    for (const b of e.blocks || []) fixBlock(b, known, drops);
    // quiz 里也可能有 $
    if (e.quiz) for (const q of e.quiz) {
      if (typeof q.q === 'string') q.q = q.q.replace(/(^|[^A-Za-z0-9])\$([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi, (m, pre, id) => (known.has(id) || pendingIds.has(id)) ? m : pre + m.slice(pre.length + 1));
      if (Array.isArray(q.options)) q.options = q.options.map(o => typeof o === 'string' ? o.replace(/[!！]/g, '') : o);
    }
  }
  const out = JSON.stringify(d, null, 2) + '\n';
  const changed = out !== raw;
  if (changed && WRITE) fs.writeFileSync(p, out);
  if (changed || drops.size || removedLinks.length) {
    report.push({ file: f, wrote: WRITE && changed, refs: [...drops], links: removedLinks });
  }
}

for (const r of report) {
  console.log(`\n${r.file} ${r.wrote ? '(已写回)' : '(试运行)'}`);
  if (r.links.length) { console.log(`  剔除链接 ${r.links.length} 条:`); for (const l of r.links) console.log(`    ${l}`); }
  if (r.refs.length) console.log(`  降级为纯文本的 $ref: ${r.refs.join(', ')}`);
}
if (!report.length) console.log('无需修复。');