#!/usr/bin/env node
// 把 shards/*.json 打包成 web/data/bundle.js（window.FILMKB）+ web/data/bundle.json。
// 生成物不要手改。用法: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARDS = path.join(ROOT, 'shards');
const OUT = path.join(ROOT, 'web', 'data');

const meta = JSON.parse(fs.readFileSync(path.join(SHARDS, '00-meta/modules.json'), 'utf8'));
const files = fs.readdirSync(SHARDS).filter(f => f.endsWith('.json') && !f.startsWith('00-')).sort();

const entries = [];
const seen = new Set();
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(SHARDS, f), 'utf8'));
  for (const en of data.entries) {
    if (seen.has(en.id)) { console.error(`跳过重复 id: ${en.id} (${f})`); continue; }
    seen.add(en.id);
    entries.push({ ...en, _shard: data.shard, _shard_zh: data.shard_zh, _file: f });
  }
}
entries.sort((a, b) => a.id.localeCompare(b.id));

// --- 全文检索文档
function plainText(en) {
  const out = [];
  const push = (s) => { if (typeof s === 'string' && s) out.push(s.replace(/\$([a-z0-9][a-z0-9.\-]*)/gi, (_, id) => id.split('.').pop())); };
  push(en.title); push(en.title_en); push(en.era);
  for (const a of en.aliases) push(a);
  for (const t of en.tags) push(t);
  push(en.summary);
  for (const b of en.blocks || []) {
    push(b.text); push(b.caption); push(b.term);
    push(b.alt); push(b.credit);
    for (const i of b.items || []) { push(i.t); push(i.d); }
    for (const r of b.rows || []) {
      push(r.c1); push(r.c2); push(r.c3); push(r.c4); push(r.c5);
      push(r.param); push(r.recommend); push(r.why); push(r.alt);
      if (Array.isArray(r.head)) for (const h of r.head) push(h);
    }
  }
  for (const r of en.refs || []) push(r.name);
  for (const l of (en.checklist || [])) push(l);
  return out.join('  ');
}

const docs = entries.map((en, i) => {
  const id = en.id;
  const m = id.split('.')[0];
  return {
    i,
    id,
    m,
    t: en.title,
    te: en.title_en,
    al: en.aliases,
    ty: en.type,
    lv: en.level,
    er: en.era || '',
    tg: en.tags,
    sm: en.summary,
    tx: plainText(en)
  };
});

// --- 知识图谱
const graph = { nodes: [], edges: [] };
for (const en of entries) {
  graph.nodes.push({
    id: en.id, m: en.id.split('.')[0], t: en.title, lv: en.level,
    ty: en.type, st: en.status || 'reviewed'
  });
}
const relLabel = { prereq: '先学', next: '后学', related: '相关', contrast: '对比', part_of: '属于' };
for (const en of entries) {
  for (const [rel, arr] of Object.entries(en.links || {})) {
    for (const t of arr || []) {
      if (seen.has(t)) graph.edges.push({ s: en.id, t, r: rel, l: relLabel[rel] || rel });
    }
  }
}

// --- 学习路径：按模块 + level 分层，prereq 优先排序
const modules = meta.modules.map((m) => {
  const list = entries.filter(e => e.id.split('.')[0] === m.id);
  const byLevel = {};
  for (const lv of [1, 2, 3, 4, 5]) byLevel[lv] = list.filter(e => e.level === lv).map(e => e.id);
  return { ...m, count: list.length, levels: byLevel };
});

const bundle = {
  meta: {
    title: '胶片摄影知识库',
    version: meta.version,
    built: new Date().toISOString().slice(0, 10),
    language: meta.language,
    entryTypes: meta.entry_types,
    levels: meta.levels,
    shardCount: files.length,
    entryCount: entries.length,
    refCount: entries.reduce((a, e) => a + (e.refs?.length || 0), 0),
    linkCount: graph.edges.length
  },
  modules,
  entries,
  docs,
  graph
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'bundle.json'), JSON.stringify(bundle, null, 0));
fs.writeFileSync(
  path.join(OUT, 'bundle.js'),
  '/* 由 tools/build.mjs 生成，请勿手改。数据源：shards/*.json */\nwindow.FILMKB = ' + JSON.stringify(bundle) + ';\n'
);

// 作者指南也内联进 bundle，站点离线可读
const guide = fs.readFileSync(path.join(SHARDS, 'AUTHORING.md'), 'utf8');
fs.writeFileSync(path.join(OUT, 'guide.js'), '/* 由 tools/build.mjs 生成 */\nwindow.FILMKB_GUIDE = ' + JSON.stringify(guide) + ';\n');
fs.copyFileSync(path.join(SHARDS, 'SCHEMA.md'), path.join(OUT, 'SCHEMA.md'));

const kb = (fs.statSync(path.join(OUT, 'bundle.js')).size / 1024).toFixed(0);
console.log(`✓ bundle 生成：${entries.length} 词条 / ${graph.edges.length} 图谱连线 / ${bundle.meta.refCount} 来源 / bundle.js ${kb} KB`);
console.log('  web/data/bundle.js  web/data/bundle.json  web/data/guide.js  web/data/SCHEMA.md');