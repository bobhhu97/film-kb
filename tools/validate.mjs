#!/usr/bin/env node
// 校验 shards/*.json：结构、字段、引用完整性、STE100 常见违规。
// 用法: node tools/validate.mjs [--quiet]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARDS = path.join(ROOT, 'shards');
const QUIET = process.argv.includes('--quiet');

const ENTRY_TYPES = ['concept','process','equipment','chemical','film','setting','timeline','technique','pitfall','comparison','table'];
const BLOCK_KINDS = ['h2','p','ul','ol','steps','note','warn','tip','table','defs','calc','formula','compare','timeline','troubleshoot','settings','glossary','image'];
const LINK_KINDS = ['prereq','next','related','contrast','part_of'];
const MODULES = ['film-stock','capture','bw-process','color-process','process-equipment','printing','scanning','archive'];
const REF_KINDS = ['manufacturer','standard','book','manual','forum','video','article','archive','measurement'];

const errors = [], warnings = [], stats = { shards: 0, entries: 0, blocks: 0, refs: 0, links: 0, quiz: 0 };

function E(file, id, msg) { errors.push(`${file}${id ? ' :: ' + id : ''} :: ${msg}`); }
function W(file, id, msg) { warnings.push(`${file}${id ? ' :: ' + id : ''} :: ${msg}`); }

const shardFiles = fs.readdirSync(SHARDS).filter(f => f.endsWith('.json') && !f.startsWith('00-')).sort();
const allIds = new Map();
const metaModules = JSON.parse(fs.readFileSync(path.join(SHARDS, '00-meta/modules.json'), 'utf8'));
stats.modules = metaModules.modules.length;

// 规划中、尚未撰写的 entry id。指向它们的链接不算悬空。
let PENDING = new Set();
try {
  const pj = JSON.parse(fs.readFileSync(path.join(SHARDS, '00-meta/pending.json'), 'utf8'));
  PENDING = new Set(pj.planned || []);
} catch { /* 可选文件 */ }
const dangling = id => !allIds.has(id) && !PENDING.has(id);

const shards = [];
for (const f of shardFiles) {
  stats.shards++;
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(SHARDS, f), 'utf8')); }
  catch (e) { E(f, '', `JSON 解析失败: ${e.message}`); continue; }
  shards.push({ f, data });

  if (!MODULES.includes(data.module)) E(f, '', `module "${data.module}" 不在 modules.json 中`);
  if (!Array.isArray(data.entries) || data.entries.length === 0) { E(f, '', 'entries 缺失或为空'); continue; }
  if (data.shard !== f.replace(/\.json$/, '')) E(f, '', `shard 字段 "${data.shard}" 与文件名 "${f}" 不一致`);

  const localIds = new Set();
  for (const en of data.entries) {
    stats.entries++;
    const tag = `${f}#${en?.id ?? '?'}`;

    // --- 必填字段
    for (const k of ['id','title','title_en','type','level','summary','blocks','refs']) {
      if (en[k] === undefined || en[k] === null || en[k] === '') E(f, en.id, `缺少必填字段 ${k}`);
    }
    if (!Array.isArray(en.aliases)) E(f, en.id, 'aliases 必须是数组');
    if (!Array.isArray(en.tags) || en.tags.length < 1) E(f, en.id, 'tags 至少 1 个');
    if (Array.isArray(en.tags) && en.tags.length < 2) W(f, en.id, 'tags 少于 2 个，检索面偏窄');
    if (!ENTRY_TYPES.includes(en.type)) E(f, en.id, `type "${en.type}" 非法`);
    if (!(Number.isInteger(en.level) && en.level >= 1 && en.level <= 5)) E(f, en.id, `level "${en.level}" 必须是 1–5 整数`);

    // --- id 规范与唯一性
    if (!/^[a-z0-9][a-z0-9.\-]*$/.test(en.id || '')) E(f, en.id, 'id 只允许小写字母、数字、点、连字符');
    if ((en.id || '').split('.').length < 2) E(f, en.id, 'id 必须是 <module>.<name> 形式');
    if (localIds.has(en.id)) E(f, en.id, '同一分片内 id 重复');
    localIds.add(en.id);
    if (allIds.has(en.id)) E(f, en.id, `id 与 ${allIds.get(en.id)} 重复`);
    allIds.set(en.id, f);

    // --- summary 体例
    if (typeof en.summary === 'string') {
      if (en.summary.length > 220) W(f, en.id, 'summary 超过 220 字，建议拆块');
      if (/[！!]/.test(en.summary)) E(f, en.id, 'summary 含感叹号，违反 STE100');
      if (/(我们|你们|大家|其实|基本上|非常牛|nb)/.test(en.summary)) W(f, en.id, 'summary 有口语表达');
      if (/[a-zA-Z]/.test(en.summary) && !/（[A-Za-z]/.test(en.summary) && (en.summary.match(/[A-Za-z]{3,}/g) || []).length > 0) {
        W(f, en.id, 'summary 含英文但未给中文对照');
      }
    }

    // --- blocks
    if (Array.isArray(en.blocks)) {
      if (en.blocks.length < 3) E(f, en.id, `blocks 少于 3 块（实际 ${en.blocks.length}）`);
      for (const [bi, b] of en.blocks.entries()) {
        stats.blocks++;
        const bt = `${tag} block#${bi}(${b?.kind})`;
        if (!BLOCK_KINDS.includes(b?.kind)) { E(f, en.id, `block#${bi} kind "${b.kind}" 非法`); continue; }
        const rowKinds = ['table','compare','timeline','settings','troubleshoot','steps'];
        if (![...rowKinds, 'image'].includes(b.kind) && typeof b.text !== 'string') E(f, en.id, `${bt} 缺少 text`);
        if (rowKinds.includes(b.kind) && !Array.isArray(b.items) && !Array.isArray(b.rows)) E(f, en.id, `${bt} 缺少 items 或 rows`);
        if (b.kind === 'compare' && Array.isArray(b.rows) && b.rows.length < 2) E(f, en.id, `${bt} compare 至少需要 2 行`);
        if (['table','compare','timeline'].includes(b.kind) && Array.isArray(b.rows)) {
          for (const r of b.rows) if (!r || typeof r.c1 !== 'string') E(f, en.id, `${bt} 行缺少 c1`);
        }
        if (['defs','glossary'].includes(b.kind) && !b.term) E(f, en.id, `${bt} 缺少 term`);
        if (['table','compare','timeline','formula','calc','troubleshoot','settings'].includes(b.kind) && !b.caption) W(f, en.id, `${bt} 缺少 caption`);
        if (b.kind === 'image') {
          if (typeof b.src !== 'string' || !b.src) E(f, en.id, `${bt} 缺少 src`);
          else if (!/^img\/[A-Za-z0-9._-]+$/.test(b.src)) E(f, en.id, `${bt} src "${b.src}" 必须是 img/<文件名>`);
          else if (!fs.existsSync(path.join(ROOT, 'web', b.src))) E(f, en.id, `${bt} src 文件不存在: web/${b.src}`);
          if (typeof b.alt !== 'string' || !b.alt) E(f, en.id, `${bt} 缺少 alt（无障碍替代文本）`);
          if (!b.caption) W(f, en.id, `${bt} 缺少 caption`);
          if (!b.license) W(f, en.id, `${bt} 缺少 license（图片许可）`);
          if (!b.source) W(f, en.id, `${bt} 缺少 source（图片来源页）`);
        }
        // 文本体例
        const txt = b.text || (Array.isArray(b.items) ? b.items.map(i => `${i.t || ''} ${i.d || ''}`).join(' ') : (Array.isArray(b.rows) ? b.rows.map(r => Object.values(r).join(' ')).join(' ') : ''));
        if (typeof txt === 'string') {
          if (/[！!]/.test(txt)) E(f, en.id, `${bt} 含感叹号，违反 STE100`);
          if (/(不|没有|无法|不能|不要|不可|不等于)/.test(txt)) W(f, en.id, `${bt} 含否定表达，STE100 建议正说`);
          if (/(我们|你们|大家|其实|基本上)/.test(txt)) W(f, en.id, `${bt} 含口语表达`);
          if (/(可能|也许|大概)/.test(txt)) W(f, en.id, `${bt} 含不确定词，改为明确陈述或标 draft`);
        }
      }
    }

    // --- refs
    if (Array.isArray(en.refs)) {
      if (en.refs.length < 1) E(f, en.id, 'refs 至少 1 条');
      for (const r of en.refs) {
        stats.refs++;
        if (!r?.name || !r?.url) { E(f, en.id, 'ref 缺少 name 或 url'); continue; }
        if (!/^https?:\/\//.test(r.url)) E(f, en.id, `ref url 非 http(s): ${r.url}`);
        if (r.kind && !REF_KINDS.includes(r.kind)) E(f, en.id, `ref kind "${r.kind}" 非法`);
        if (r.url.includes('example.com')) E(f, en.id, 'ref 使用占位 URL');
      }
      const numeric = /配方|药液|显影|定影|时间|温度|°C|ISO|dpi|ml|秒|f\//i;
      const body = JSON.stringify(en.blocks || []);
      if (numeric.test(body) && en.refs.length < 2) W(f, en.id, '含具体数值的条目建议 2 条以上来源');
    }

    // --- links
    if (en.links && typeof en.links === 'object') {
      for (const [k, v] of Object.entries(en.links)) {
        if (!LINK_KINDS.includes(k)) { E(f, en.id, `links 字段 "${k}" 非法`); continue; }
        if (!Array.isArray(v)) { E(f, en.id, `links.${k} 必须是数组`); continue; }
        for (const t of v) {
          stats.links++;
          if (typeof t !== 'string' || !/^[a-z0-9][a-z0-9.\-]*$/.test(t)) E(f, en.id, `links.${k} 含非法 id "${t}"`);
        }
      }
    }

    // --- quiz
    if (en.quiz !== undefined) {
      if (!Array.isArray(en.quiz)) E(f, en.id, 'quiz 必须是数组');
      else for (const [qi, q] of en.quiz.entries()) {
        stats.quiz++;
        if (!q?.q) E(f, en.id, `quiz#${qi} 缺少 q`);
        if (!['single','multi','bool','cloze'].includes(q?.type)) E(f, en.id, `quiz#${qi} type "${q?.type}" 非法`);
        if (q.type === 'single' && (!Array.isArray(q.options) || q.options.length < 2)) E(f, en.id, `quiz#${qi} single 需要至少 2 个选项`);
        if (!Array.isArray(q.answer) || q.answer.length === 0) E(f, en.id, `quiz#${qi} 缺少 answer`);
        else for (const a of q.answer) {
          if (!Number.isInteger(a) || a < 0) E(f, en.id, `quiz#${qi} answer 下标非负整数`);
          if (q.options && a >= q.options.length) E(f, en.id, `quiz#${qi} answer 下标 ${a} 越界`);
        }
        if (q.type === 'single' && Array.isArray(q.answer) && q.answer.length !== 1) E(f, en.id, `quiz#${qi} single 只能 1 个答案`);
        if (!q.why) W(f, en.id, `quiz#${qi} 缺少 why`);
      }
    }

    if (en.status && !['draft','reviewed','stable'].includes(en.status)) E(f, en.id, `status "${en.status}" 非法`);
    if (en.updated && !/^\d{4}-\d{2}-\d{2}$/.test(en.updated)) E(f, en.id, 'updated 必须是 YYYY-MM-DD');
    if (en.level === 5 && en.status === 'reviewed') W(f, en.id, 'level 5 考据条目建议 status=stable');
  }
}

// --- 跨分片引用完整性
const { shards: shardData } = { shards };
for (const { f, data } of shards) {
  const txt = JSON.stringify(data);
  const found = txt.match(/\$([a-z0-9][a-z0-9.\-]*)/g) || [];
  for (const raw of new Set(found)) {
    const id = raw.slice(1);
    if (dangling(id)) E(f, '', `正文引用 $${id} 指向不存在的条目`);
  }
  for (const en of data.entries) {
    for (const [k, arr] of Object.entries(en.links || {})) {
      for (const t of arr || []) if (dangling(t)) E(f, en.id, `links.${k} 指向不存在的条目 "${t}"`);
    }
  }
}

// --- 孤儿条目：既无入链也无出链
const inDeg = new Map();
for (const { data } of shards) for (const en of data.entries) {
  for (const arr of Object.values(en.links || {})) for (const t of arr || []) inDeg.set(t, (inDeg.get(t) || 0) + 1);
}
for (const [id] of allIds) {
  if (!inDeg.has(id)) {
    const { data } = shards.find(s => s.data.entries.some(e => e.id === id));
    const out = Object.values(data.entries.find(e => e.id === id).links || {}).reduce((a, b) => a + (b?.length || 0), 0);
    if (out === 0) W('*', id, '孤立条目：无入链且无出链');
  }
}

// --- Lint A：同分片重复 title（克隆条目检测，如 vebra 抄 ra4）
{
  const titleMap = new Map();
  for (const { f, data } of shards) for (const en of data.entries) {
    const key = (en.title || '').trim();
    if (!key) continue;
    if (titleMap.has(key)) W(f, en.id, `title 与 ${titleMap.get(key)} 完全相同「${key}」，疑似克隆条目`);
    else titleMap.set(key, `${titleMap.get(key) ? titleMap.get(key) + ',' : ''}${f}#${en.id}`);
  }
  const sumMap = new Map();
  for (const { f, data } of shards) for (const en of data.entries) {
    const key = (en.summary || '').trim();
    if (!key) continue;
    if (sumMap.has(key)) W(f, en.id, `summary 与 ${sumMap.get(key)} 完全相同，疑似克隆条目`);
    else sumMap.set(key, `${f}#${en.id}`);
  }
}

// --- Lint B：同一 URL 被多条 ref 重复（提示而非错误）
{
  const urlMap = new Map();
  for (const { f, data } of shards) for (const en of data.entries) {
    for (const [ri, r] of (en.refs || []).entries()) {
      if (!r?.url) continue;
      if (urlMap.has(r.url)) W(f, en.id, `ref#${ri} URL 与 ${urlMap.get(r.url)} 重复：${r.url}`);
      else urlMap.set(r.url, `${f}#${en.id}`);
    }
  }
}

// --- Lint C：draft 条目被 reviewed/stable 条目以 links 引用且未标注
{
  const statusOf = new Map();
  for (const { data } of shards) for (const en of data.entries) statusOf.set(en.id, en.status || 'reviewed');
  for (const { f, data } of shards) for (const en of data.entries) {
    const self = statusOf.get(en.id);
    if (self !== 'reviewed' && self !== 'stable') continue;
    for (const [k, arr] of Object.entries(en.links || {})) {
      for (const t of arr || []) {
        if (statusOf.get(t) === 'draft' && allIds.has(t)) {
          W(f, en.id, `${self} 条目引用 draft 条目 "${t}"（links.${k}），结论依赖未核实内容`);
        }
      }
    }
  }
}

// --- Lint D：multi 题至少 2 个答案；cloze 需要答案文本
{
  for (const { f, data } of shards) for (const en of data.entries) {
    for (const [qi, q] of (en.quiz || []).entries()) {
      if (q?.type === 'multi' && Array.isArray(q.answer) && q.answer.length < 2) {
        W(f, en.id, `quiz#${qi} multi 类型只有 ${q.answer.length} 个答案，应改 single 或补全`);
      }
      if (q?.type === 'cloze' && !q.answer_text && !q.text) {
        W(f, en.id, `quiz#${qi} cloze 缺少 answer_text`);
      }
    }
  }
}

// --- 模块覆盖
const perModule = {};
for (const [id] of allIds) {
  const m = id.split('.')[0];
  perModule[m] = (perModule[m] || 0) + 1;
}
for (const m of metaModules.modules) {
  const n = perModule[m.id] || 0;
  if (n === 0) W('*', m.id, `模块 "${m.name}" 尚无条目`);
}

// --- 输出
console.log('─'.repeat(64));
console.log(`分片 ${stats.shards} · 词条 ${stats.entries} · 块 ${stats.blocks} · 来源 ${stats.refs} · 链接 ${stats.links} · 题目 ${stats.quiz}`);
console.log('模块分布: ' + Object.entries(perModule).map(([k, v]) => `${k}=${v}`).join('  '));
console.log('─'.repeat(64));
if (errors.length) {
  console.log(`✗ ${errors.length} 个错误`);
  errors.forEach(e => console.log('  ERROR  ' + e));
} else console.log('✓ 0 错误');
if (warnings.length && !QUIET) {
  console.log(`\n⚠ ${warnings.length} 个警告`);
  warnings.slice(0, 60).forEach(w => console.log('  WARN   ' + w));
  if (warnings.length > 60) console.log(`  ... 另有 ${warnings.length - 60} 条`);
}
process.exit(errors.length ? 1 : 0);