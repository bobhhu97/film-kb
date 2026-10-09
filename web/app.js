/* 胶片摄影知识库 · 应用层
   数据: window.FILMKB (tools/build.mjs 生成)  指南: window.FILMKB_GUIDE
   进度: localStorage 'filmkb:v1'  */
'use strict';

const KB = window.FILMKB;
const GUIDE = window.FILMKB_GUIDE || '';
const ENT = new Map(KB.entries.map(e => [e.id, e]));
const DOC = KB.docs;
const MOD = new Map(KB.modules.map(m => [m.id, m]));
const TY = new Map(KB.meta.entryTypes.map(t => [t.id, t]));
const LV = new Map(KB.meta.levels.map(l => [l.n, l.name]));
const REL = { prereq: '先学', next: '后学', related: '相关', contrast: '对比', part_of: '属于' };
const EDGE_COLOR = { prereq: '#e8a33d', next: '#6d9fbe', related: '#7b7266', contrast: '#c9695c', part_of: '#84a470' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const mdDate = d => { const x = new Date(d); return Number.isNaN(+x) ? d : x.toISOString().slice(0, 10); };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ================= 进度存储 ================= */
const SKEY = 'filmkb:v1';
const blank = { entries: {}, quiz: {}, checklist: {}, notes: {}, daily: {}, created: today(), streak: 0 };
let S = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (!raw || typeof raw !== 'object') return structuredClone(blank);
    return { ...structuredClone(blank), ...raw };
  } catch { return structuredClone(blank); }
}
function save() { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { toast('保存失败：浏览器存储不可用'); } }
function todayStat() {
  const k = today();
  S.daily[k] = S.daily[k] || { read: [], quiz: [] };
  return S.daily[k];
}

/* 学习状态: new -> learning -> review -> mastered
   srs: { box:0-5, due:'YYYY-MM-DD', last, reps, lapses } */
function recOf(id) { return S.entries[id] || (S.entries[id] = { srs: { box: 0, due: null, last: null, reps: 0, lapses: 0 }, n: 0 }); }
function statusOf(id) {
  const r = S.entries[id]; if (!r) return 'new';
  const b = r.srs.box;
  return b >= 4 ? 'mastered' : b >= 1 ? 'review' : 'learning';
}
const STATUS_CN = { new: '未学', learning: '学习中', review: '复习中', mastered: '已掌握' };
function dueList() {
  const k = today();
  return KB.entries.filter(e => { const r = S.entries[e.id]; return r && r.srs.due && r.srs.due <= k; });
}

/* Leitner: box 0..5, 间隔 0/1/2/4/8/16 天 */
function grade(id, ok) {
  const r = recOf(id), d = today();
  r.srs.reps++;
  if (ok) { r.srs.box = Math.min(5, r.srs.box + 1); r.srs.due = mdDate(Date.now() + [0, 1, 2, 4, 8, 16][r.srs.box] * 864e5); }
  else { r.srs.box = 0; r.srs.lapses++; r.srs.due = todayStat().read.includes(id) ? d : mdDate(Date.now() * 1); r.srs.due = d; }
  r.srs.last = d;
  if (!todayStat().read.includes(id)) todayStat().read.push(id);
  save();
}
function markRead(id, ok = true) { grade(id, ok); }

/* ================= 渲染工具 ================= */
function inline(text, ctx = '') {
  let h = esc(text);
  h = h.replace(/\$([a-z0-9][a-z0-9.\-]*)/gi, (m, id) => {
    const e = ENT.get(id);
    return e ? `<span class="xref" data-go="${id}">${esc(e.title)}</span>` : `<span style="color:var(--red)" title="引用不存在的条目">${m}</span>`;
  });
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[\s(（])`([^`]+)`/g, '$1<code>$2</code>');
  h = h.replace(/(^|[\s(（])([A-Za-z]+(?:-[A-Za-z]+)*) (\d+(?:\.\d+)?\s*(?:°C|°F|min|s|sec|秒|分|小时|g|L|ml|mL|%))(?=[\s,.;，。)\s]|$)/g,
    '$1<code>$2 $3</code>');
  if (ctx === 'md') h = h.replace(/\n/g, '<br>');
  return h;
}
function mdLite(src) {
  const lines = String(src).replace(/\r/g, '').split('\n');
  const out = [];
  let list = null;           // 'ul' | 'ol'
  let fence = null;          // 当前代码块的语言标记
  let tbl = null;            // 累积的表格行

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => {
    if (!tbl || !tbl.rows.length) { tbl = null; return; }
    const head = tbl.rows[0].map((c, i) => `<th>${inline(c, 'md')}</th>`).join('');
    const body = tbl.rows.slice(1).map(r => `<tr>${r.map(c => `<td>${inline(c, 'md')}</td>`).join('')}</tr>`).join('');
    out.push(`<div class="tw"><table><tr>${head}</tr>${body}</table></div>`);
    tbl = null;
  };
  const closeAll = () => { closeList(); closeTable(); };

  for (let raw of lines) {
    const l = raw.replace(/\s+$/, '');

    // 代码块：整段原样保留，不做任何行内处理
    const f = l.match(/^\s*```(\w*)\s*$/);
    if (f) {
      if (fence === null) { closeAll(); fence = f[1] || ''; out.push(`<pre data-lang="${esc(fence)}"><code>`); }
      else { out.push('</code></pre>'); fence = null; }
      continue;
    }
    if (fence !== null) { out.push(esc(l) || '&nbsp;'); continue; }

    if (!l.trim()) { closeAll(); continue; }

    // 表格
    if (/^\s*\|/.test(l)) {
      closeList();
      const cells = l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue;   // 分隔行
      if (!tbl) tbl = { rows: [] };
      tbl.rows.push(cells);
      continue;
    }
    closeTable();

    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { closeList(); out.push(`<h${m[1].length}>${inline(m[2], 'md')}</h${m[1].length}>`); }
    else if (/^\s*>\s?/.test(l)) { closeList(); out.push(`<blockquote>${inline(l.replace(/^\s*>\s?/, ''), 'md')}</blockquote>`); }
    else if ((m = l.match(/^\s*[-*+]\s+(.*)$/))) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(m[1], 'md')}</li>`);
    }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(m[1], 'md')}</li>`);
    }
    else if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { closeList(); out.push('<hr>'); }
    else { closeList(); out.push(`<p>${inline(l, 'md')}</p>`); }
  }
  if (fence !== null) { out.push('</code></pre>'); }   // 未闭合的代码块也要收尾
  closeAll();
  return out.join('\n');
}
function cmp2(b, a, c) {
  return `<div class="blk"><div class="cap">${esc(b.caption || '对比')}</div><div class="compare">
    ${[a, c].filter(Boolean).map(r => `<div><div class="ch">${esc(r.c1)}</div><dl>
      ${['c2', 'c3', 'c4', 'c5'].filter(k => r[k]).map(k => `<dt>${esc({ c2: '原理', c3: '优点', c4: '缺点', c5: '适用' }[k])}</dt><dd>${inline(r[k])}</dd>`).join('')}
    </dl></div>`).join('')}</div></div>`;
}
function tableFromRows(rows, caption) {
  if (!rows?.length) return '';
  const cols = Math.max(...rows.map(r => Object.keys(r).filter(k => /^c\d$/.test(k)).length));
  let head = '';
  const hasHead = rows.some(r => Array.isArray(r.head));
  if (hasHead) { const r0 = rows.find(r => r.head); head = `<tr>${r0.head.map(h => `<th>${inline(h)}</th>`).join('')}</tr>`; }
  const keys = [];
  for (let i = 1; i <= cols; i++) keys.push('c' + i);
  const body = rows.filter(r => !r.head).map(r =>
    `<tr>${keys.map(k => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('');
  return `${caption ? `<div class="cap">${inline(caption)}</div>` : ''}<div class="tw"><table>${head}${body}</table></div>`;
}
function listFromItems(items) {
  return (items || []).map(i => `<li><span style="color:var(--ink)">${inline(i.t || '')}</span>${i.d ? `<div class="muted" style="font-size:13px">${inline(i.d)}</div>` : ''}</li>`).join('');
}

/* ================= 视图 ================= */
let V = { view: 'home', entry: null, module: null, filters: {}, search: '' };

function render() {
  const v = $('#view');
  if (V.view === 'home') v.innerHTML = viewHome();
  else if (V.view === 'browse') v.innerHTML = viewBrowse();
  else if (V.view === 'entry') v.innerHTML = viewEntry();
  else if (V.view === 'graph') v.innerHTML = viewGraph();
  else if (V.view === 'progress') v.innerHTML = viewProgress();
  else if (V.view === 'guide') v.innerHTML = viewGuide();
  $('#built').textContent = KB.meta.built;
  $$('nav.tabs button').forEach(b => b.classList.toggle('on',
    b.dataset.v === (V.view === 'entry' ? 'browse' : V.view)));
  bind();
  if (G && V.view !== 'graph') { G.cleanup(); G = null; }
  // 动态标题：区分收藏/分享/多标签页
  {
    let t = '胶片摄影知识库';
    if (V.view === 'entry') { const e = ENT.get(V.entry); if (e) t = `${e.title} · ${MOD.get(e.id.split('.')[0]).name}`; }
    else if (V.view === 'browse') t = V.module ? `${MOD.get(V.module)?.name || ''} · 浏览` : '浏览 · 全部条目';
    else t = { home: '首页', graph: '知识图谱', progress: '学习进度', guide: '增补指南' }[V.view] || '';
    document.title = t ? `${t} · 胶片摄影知识库` : '胶片摄影知识库';
  }
  window.scrollTo(0, 0);
}

function moduleProgress(mid) {
  const list = KB.entries.filter(e => e.id.split('.')[0] === mid);
  const m = list.filter(e => statusOf(e.id) === 'mastered').length;
  return { total: list.length, mastered: m, pct: list.length ? Math.round(m / list.length * 100) : 0 };
}

function viewHome() {
  const st = { m: KB.meta.entryCount, r: KB.meta.refCount, g: KB.meta.linkCount, s: KB.meta.shardCount };
  const totalMastered = KB.entries.filter(e => statusOf(e.id) === 'mastered').length;
  const overall = Math.round(totalMastered / KB.meta.entryCount * 100);
  const due = dueList();
  const metrics = [[st.m, '知识条目'], [st.s, '内容分片'], [st.r, '权威来源'], [st.g, '知识关联'], [overall + '%', '已掌握']];

  return `
  <div class="hero">
    <div class="eyebrow">DARKROOM ARCHIVE · 暗房档案</div>
    <h1>胶片摄影 · 冲洗 · <em>放大</em> · 扫描</h1>
    <p>从感光原理到混合式冲洗机，从放大配方到各型号扫描仪设置。每条知识按 80% ASD-STE100 技术英语体例写成，附权威来源，可检索、可关联、可追踪进度。</p>
    <div class="stats">
      ${metrics.map(([v, l], i) => `<div style="--d:${240 + i * 55}ms"><b>${v}</b><span>${l}</span></div>`).join('')}
    </div>
  </div>

  ${due.length ? `<div class="card" style="border-color:rgba(232,163,61,.42);margin-bottom:20px">
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:200px"><strong style="color:var(--amber)">今天有 ${due.length} 条到期复习</strong>
      <div class="muted" style="font-size:12.5px">间隔重复按 Leitner 盒推进。掌握后间隔依次为 1、2、4、8、16 天。</div></div>
      <button class="pri" data-act="due">开始复习</button>
    </div></div>` : ''}

  <h2 class="rd">八个模块</h2>
  <div class="mods">
  ${KB.modules.map((m, i) => { const p = moduleProgress(m.id); return `
    <div class="mod" style="--mc:${m.color};--d:${300 + i * 55}ms" data-mod="${m.id}">
      <div class="ic">${esc(m.icon)}</div>
      <div class="nm">${esc(m.name)}</div>
      <div class="en">${esc(m.name_en)}</div>
      <div class="ds">${esc(m.desc)}</div>
      <div class="ft"><span>${p.total} 条 · 掌握 ${p.mastered}</span><span>${p.pct}%</span></div>
      <div class="bar"><i style="width:${p.pct}%;background:${m.color}"></i></div>
    </div>`; }).join('')}
  </div>

  <h2 class="rd" style="margin-top:32px">从哪里开始</h2>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">
    ${[['没接触过胶片', 'film-stock', 2], ['准备自己冲洗', 'bw-process', 2], ['已经有底片想放大', 'printing', 2], ['想把底片数字化', 'scanning', 2]]
      .map(([t, m, lv], i) => `<div class="card" data-act="path" data-m="${m}" data-lv="${lv}" style="--d:${580 + i * 55}ms">
        <div class="t">${esc(t)}</div>
        <div class="d">${esc(MOD.get(m).name)} · level ${lv} 入门起步</div></div>`).join('')}
  </div>`;
}

function viewBrowse() {
  const mid = V.module, f = V.filters;
  let list = mid ? KB.entries.filter(e => e.id.split('.')[0] === mid) : KB.entries.slice();
  if (f.type) list = list.filter(e => e.type === f.type);
  if (f.level) list = list.filter(e => String(e.level) === String(f.level));
  if (f.status) list = list.filter(e => (e.status || 'reviewed') === f.status);
  if (f.tag) list = list.filter(e => e.tags.includes(f.tag));
  if (f.q) list = searchIds(f.q).map(id => ENT.get(id)).filter(Boolean);
  list.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));

  const m = mid ? MOD.get(mid) : null;
  const p = mid ? moduleProgress(mid) : null;
  const tagPool = [...new Set(KB.entries.filter(e => !mid || e.id.split('.')[0] === mid).flatMap(e => e.tags))].sort();

  return `
  <div class="crumb">${mid ? `<a data-view="browse">全部模块</a><span class="sep">/</span><span style="color:${m.color}">${esc(m.icon)} ${esc(m.name)}</span>` : '全部模块'} ${f.q ? `<span class="sep">/</span>搜索「${esc(f.q)}」` : ''}</div>
  <h1>${mid ? esc(m.name) : '浏览全部知识条目'}</h1>
  ${m ? `<p class="muted" style="max-width:70ch">${esc(m.desc)}</p>
  <div class="progbar" style="max-width:420px"><span class="dim">本模块进度</span><div class="bar"><i style="width:${p.pct}%;background:${m.color}"></i></div><span class="dim">${p.mastered}/${p.total}</span></div>` : ''}

  <div class="filters">
    <select id="ftype"><option value="">全部类型</option>${KB.meta.entryTypes.map(t => `<option value="${t.id}" ${f.type === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
    <select id="flevel"><option value="">全部难度</option>${KB.meta.levels.map(l => `<option value="${l.n}" ${String(f.level) === String(l.n) ? 'selected' : ''}>${l.n} ${l.name}</option>`).join('')}</select>
    <select id="fstatus"><option value="">全部状态</option><option value="draft" ${f.status === 'draft' ? 'selected' : ''}>待考证</option><option value="reviewed" ${f.status === 'reviewed' ? 'selected' : ''}>已核实</option><option value="stable" ${f.status === 'stable' ? 'selected' : ''}>稳定</option></select>
    <input type="text" id="fq" placeholder="在此筛选…" value="${esc(f.q || '')}">
    <span class="dim">${list.length} 条</span>
    ${(f.type || f.level || f.status || f.tag || f.q) ? '<button class="sm" data-act="clearf">清除筛选</button>' : ''}
  </div>
  <div style="margin-bottom:14px">${tagPool.slice(0, 40).map(t => `<span class="tag ${f.tag === t ? 'on' : ''}" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>

  ${mid && m.count ? `<h3>按难度分层</h3>${[1, 2, 3, 4, 5].map(lv => {
      const ids = m.levels[lv] || [];
      if (!ids.length) return '';
      return `<div style="margin-bottom:11px"><div class="dim" style="font-size:12px;margin-bottom:6px">level ${lv} · ${LV.get(lv)} · ${ids.length} 条</div>
      <div>${ids.map(id => { const e = ENT.get(id); const s = statusOf(id);
        return `<span class="tag ${s === 'mastered' ? 'on' : ''}" data-go="${id}" title="${esc(e.title_en)}">${esc(e.title)}</span>`; }).join('')}</div></div>`;
    }).join('')}` : ''}

  <div class="list">${list.length ? list.map(entryItem).join('') : '<div class="empty"><div class="ic"></div>没有匹配的条目</div>'}</div>`;
}

function entryItem(e, i) {
  const s = statusOf(e.id), m = MOD.get(e.id.split('.')[0]);
  return `<div class="item" data-go="${e.id}" style="--mc:${m.color};--d:${Math.min(i || 0, 14) * 34}ms">
    <div class="ih">
      <span class="it">${esc(e.title)}</span>
      <span class="ie">${esc(e.title_en)}</span>
      <span class="iend" style="${s === 'mastered' ? 'color:var(--green)' : ''}">${STATUS_CN[s]}</span>
    </div>
    <div class="is">${esc(e.summary)}</div>
    <div class="im"><span class="badge" style="border-color:${m.color}55;color:${m.color}">${esc(m.icon)} ${esc(m.name)}</span>
      <span class="badge">${esc(TY.get(e.type)?.name || e.type)}</span>
      <span class="badge">L${e.level} ${LV.get(e.level)}</span>
      ${e.era ? `<span class="badge prose">${esc(e.era)}</span>` : ''}
      ${e.status === 'draft' ? '<span class="badge draft">待考证</span>' : ''}
      ${e.tags.slice(0, 5).map(t => `<span class="tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>
  </div>`;
}

function viewEntry() {
  const e = ENT.get(V.entry);
  if (!e) return '<div class="empty">条目不存在</div>';
  const m = MOD.get(e.id.split('.')[0]);
  const s = statusOf(e.id);
  const docs = KB.docs.find(d => d.id === e.id);

  const body = e.blocks.map(b => {
    switch (b.kind) {
      case 'h2': return `<h2>${esc(b.text)}</h2>`;
      case 'p': return `<p>${inline(b.text)}</p>`;
      case 'ul': case 'ol': {
        const items = b.text.split('\n').filter(Boolean);
        const tag = b.kind;
        return `<${tag}>${items.map(l => `<li>${inline(l.replace(/^\s*([-*\d.]+)\s*/, ''))}</li>`).join('')}</${tag}>`;
      }
      case 'note': return `<div class="note">${inline(b.text)}</div>`;
      case 'warn': return `<div class="warn">${inline(b.text)}</div>`;
      case 'tip': return `<div class="tip">${inline(b.text)}</div>`;
      case 'defs': case 'glossary': return `<div class="defs"><div class="term">${esc(b.term || '')}</div><div>${inline(b.text)}</div></div>`;
      case 'formula': case 'calc': return `<div class="blk"><div class="cap">${esc(b.caption || '')}</div><div class="card" style="font-family:var(--mono);font-size:13px;white-space:pre-wrap;line-height:1.9">${esc(b.text)}</div></div>`;
      case 'table': return `<div class="blk">${tableFromRows(b.rows, b.caption)}</div>`;
      case 'compare': {
        // rows 是「每行一个被比较对象，列为对比维度」。多于 2 行时转成表格，避免信息丢失。
        const rows = b.rows || [];
        if (rows.length === 2) return cmp2(b, rows[0], rows[1]);
        const cols = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => /^c[1-9]$/.test(k)).sort();
        const LBL = { c1: '项目', c2: 'A', c3: 'B', c4: 'C', c5: 'D', c6: 'E', c7: 'F' };
        return `<div class="blk"><div class="cap">${esc(b.caption || '对比')}</div><div class="tw"><table>
          <tr>${cols.map(k => `<th>${esc(LBL[k] || k)}</th>`).join('')}</tr>
          ${rows.map(r => `<tr>${cols.map(k => `<td>${inline(r[k])}</td>`).join('')}</tr>`).join('')}
        </table></div></div>`;
      }
      case 'timeline':
        return `<div class="blk"><div class="cap">${esc(b.caption || '年代沿革')}</div><div class="tl">
          ${(b.rows || []).map(r => `<div class="ev"><div class="yr">${esc(r.c1)}</div><div class="wt">${esc(r.c2 || '')}</div>${r.c3 ? `<div class="wy">${inline(r.c3)}</div>` : ''}</div>`).join('')}</div></div>`;
      case 'steps':
        return `<div class="blk"><div class="cap">${esc(b.caption || '步骤')}</div><div class="steps">
          ${(b.items || []).map(i => `<div class="step"><div class="st">${esc(i.t || '')}</div><div class="sd">${inline(i.d || '')}</div></div>`).join('')}</div></div>`;
      case 'settings':
        return `<div class="blk settings"><div class="cap">${esc(b.caption || '设置')}</div>
          ${(b.items || []).map(i => `<div class="row"><span class="k">${esc(i.t || '')}</span><span class="v">${inline(i.d || '')}</span></div>`).join('')}</div>`;
      case 'troubleshoot':
        return `<div class="blk"><div class="cap">${esc(b.caption || '故障排查')}</div>
          ${(b.items || []).map(i => `<div class="trouble"><span class="sy">${esc(i.t || '')}</span><span class="fx">${inline(i.d || '')}</span></div>`).join('')}</div>`;
      case 'image': {
        const cap = b.caption ? `<figcaption class="icap">${inline(b.caption)}</figcaption>` : '';
        const cred = [b.credit, b.license].filter(Boolean).map(esc).join(' · ');
        const srcline = b.source ? ` · <a href="${esc(b.source)}" target="_blank" rel="noopener">来源</a>` : '';
        const foot = (cred || srcline) ? `<div class="imeta">${cred}${srcline}</div>` : '';
        return `<div class="blk imgblk"><figure>
          <img src="${esc(b.src)}" alt="${esc(b.alt || '')}"${b.width ? ` width="${esc(String(b.width))}"` : ''}${b.height ? ` height="${esc(String(b.height))}"` : ''} loading="lazy">
          ${cap}${foot}</figure></div>`;
      }
      default: return `<p>${inline(b.text || '')}</p>`;
    }
  }).join('');

  const links = Object.entries(e.links || {}).filter(([, v]) => v?.length).map(([k, arr]) => {
    const items = arr.map(id => { const t = ENT.get(id); return t ? `<span class="tag" data-go="${id}">${esc(t.title)}</span>` : ''; }).join('');
    return items ? `<div class="lkgrp"><span class="lb">${REL[k]}</span>${items}</div>` : '';
  }).join('');

  const relatedEntries = KB.graph.edges.filter(x => x.t === e.id).slice(0, 10).map(x => {
    const t = ENT.get(x.s); if (!t) return '';
    const tm = MOD.get(t.id.split('.')[0]);
    return `<div class="item" data-go="${t.id}" style="--mc:${tm ? tm.color : 'var(--amber)'}">
      <div class="ih"><span class="it">${esc(t.title)}</span><span class="ie">${esc(t.title_en)}</span></div>
      <div class="is">${REL[x.r]}：${esc(t.summary.slice(0, 80))}…</div></div>`;
  }).join('');

  return `
  <div class="crumb"><a data-view="browse">全部模块</a><span class="sep">/</span><a data-view="browse" data-mod="${m.id}">${esc(m.icon)} ${esc(m.name)}</a><span class="sep">/</span><span>${esc(e.title)}</span></div>
  <h1>${esc(e.title)}</h1>
  <div class="title-en">${esc(e.title_en)}</div>
  <div class="badges">
    <span class="badge" style="border-color:${m.color}55;color:${m.color}">${esc(m.icon)} ${esc(m.name)}</span>
    <span class="badge">${esc(TY.get(e.type)?.name || e.type)}</span>
    <span class="badge">level ${e.level} · ${LV.get(e.level)}</span>
    ${e.era ? `<span class="badge prose">适用年代 ${esc(e.era)}</span>` : ''}
    <span class="badge ${e.status || 'reviewed'}">${({ draft: '待考证', reviewed: '已核实', stable: '稳定' })[e.status || 'reviewed']}</span>
    <span class="badge" style="color:${s === 'mastered' ? 'var(--green)' : 'var(--ink2)'}">${STATUS_CN[s]}</span>
    ${(e.aliases || []).length ? `<span class="badge">别名 ${e.aliases.slice(0, 4).map(esc).join(' / ')}</span>` : ''}
  </div>
  <div class="summary">${esc(e.summary)}</div>

  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 8px">
    <button class="pri" data-act="read" data-id="${e.id}">${s === 'new' ? '标记已学' : '复习一次（答对）'}</button>
    <button data-act="again" data-id="${e.id}">需要重学</button>
    <button data-act="note" data-id="${e.id}">我的笔记</button>
    <button data-act="copy" data-id="${e.id}">复制 Markdown</button>
  </div>
  <div class="dim" style="font-size:12px;margin-bottom:16px" id="srsinfo"></div>
  <div id="notebox"></div>

  <div class="doc">${body}</div>

  ${(e.checklist || []).length ? `<h3>操作检查清单</h3><ul class="chk" data-chk="${e.id}">
    ${e.checklist.map((c, i) => { const done = (S.checklist[e.id] || [])[i]; return `<li class="${done ? 'done' : ''}" data-i="${i}">${esc(c)}</li>`; }).join('')}</ul>` : ''}

  ${e.quiz?.length ? renderQuiz(e) : ''}

  <div class="refs"><h3>来源</h3>
    <ol>${e.refs.map(r => `<li>${/^https?:\/\//.test(r.url) ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}
      <span class="k">${esc(r.kind || '')}</span>${r.note ? `<div class="dim" style="font-size:12px">${esc(r.note)}</div>` : ''}</li>`).join('')}</ol>
    <div class="doc-ref">修订于 ${esc(e.updated || '—')} · 来源分片 <code>${esc(e._file)}</code></div>
  </div>

  ${links ? `<div class="links-row">${links}</div>` : ''}
  ${relatedEntries ? `<h3>其他条目指向这里</h3><div class="list">${relatedEntries}</div>` : ''}

  <div id="navbtns"></div>`;
}

function renderQuiz(e) {
  return `<div class="quiz" data-quiz="${e.id}"><h3>自测 · ${e.quiz.length} 题</h3>
  <div class="muted" style="font-size:12.5px">全部答对记为「已掌握」。答错则回到第 1 盒，明天再现。</div>
  ${e.quiz.map((q, i) => `<div class="q" data-q="${i}"><div class="qt">${esc(q.q)}</div>
    <div class="opts">${(q.options || []).map((o, oi) => `<div class="opt" data-o="${oi}">${esc(o)}</div>`).join('')}</div>
    <div class="why" style="display:none"></div></div>`).join('')}
  <div class="qres"><div class="sc" data-score>—</div><div class="dim" style="font-size:12.5px" data-verdict>选择答案后点「提交并记录」判定</div></div></div>`;
}

function viewProgress() {
  const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
  KB.entries.forEach(e => counts[statusOf(e.id)]++);
  const pct = n => KB.meta.entryCount ? Math.round(counts[n] / KB.meta.entryCount * 100) : 0;
  const done = counts.mastered + counts.review;
  const quizLog = Object.entries(S.quiz).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 12);

  const days = Object.entries(S.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    if (S.daily[d] && (S.daily[d].read.length || S.daily[d].quiz.length)) streak++;
    else if (i > 0) break;
  }
  const due = dueList();

  return `
  <h1>学习进度</h1>
  <div class="kv">
    <div class="k" style="--d:60ms"><div class="n">${counts.mastered}</div><div class="l">已掌握</div></div>
    <div class="k" style="--d:100ms"><div class="n">${counts.review}</div><div class="l">复习中</div></div>
    <div class="k" style="--d:140ms"><div class="n">${counts.learning}</div><div class="l">学习中</div></div>
    <div class="k" style="--d:180ms"><div class="n">${counts.new}</div><div class="l">未学</div></div>
    <div class="k" style="--d:220ms"><div class="n">${streak}</div><div class="l">连续天数</div></div>
    <div class="k" style="--d:260ms"><div class="n">${due.length}</div><div class="l">今日到期</div></div>
  </div>
  <div class="progbar"><span class="dim">总进度</span><div class="bar"><i style="width:${Math.round(done / KB.meta.entryCount * 100)}%"></i></div><span class="dim">${done}/${KB.meta.entryCount}</span></div>

  <h3>模块进度</h3>
  <table class="progtab"><tr><th>模块</th><th>条目</th><th>已掌握</th><th>掌握率</th><th></th></tr>
  ${KB.modules.map(m => { const p = moduleProgress(m.id); return `<tr>
    <td><span style="color:${m.color};font-family:var(--mono);font-size:11px">${esc(m.icon)}</span> ${esc(m.name)}</td><td>${p.total}</td><td>${p.mastered}</td>
    <td style="width:180px"><div class="bar"><i style="width:${p.pct}%;background:${m.color}"></i></div></td>
    <td><button class="sm" data-act="modpath" data-m="${m.id}">学习路径</button></td></tr>`; }).join('')}</table>

  <h3>最近 14 天活动</h3>
  ${days.length ? days.map(([d, v]) => `<div class="daygrp"><div class="dh">${d} · 学 ${v.read.length} 条 · 测验 ${v.quiz.length} 次</div>
    <div class="bar"><i style="width:${Math.min(100, (v.read.length + v.quiz.length) / Math.max(1, days[0][1].read.length + days[0][1].quiz.length) * 100)}%"></i></div></div>`).join('')
    : '<div class="muted">还没有学习记录。打开任意条目并点「标记已学」开始。</div>'}

  ${quizLog.length ? `<h3>测验记录</h3><table class="progtab"><tr><th>条目</th><th>日期</th><th>得分</th><th>判定</th></tr>
    ${quizLog.map(([id, v]) => { const e = ENT.get(id); return `<tr><td><a data-go="${id}">${esc(e?.title || id)}</a></td><td class="dim">${esc(v.at)}</td><td>${v.score[0]}/${v.score[1]}</td><td>${STATUS_CN[v.verdict]}</td></tr>`; }).join('')}</table>` : ''}

  <h3>数据管理</h3>
  <div class="card">
    <div class="muted" style="font-size:13px;margin-bottom:9px">进度只存在本机浏览器。清理浏览器数据会丢失进度。</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button data-act="exp">导出进度 JSON</button>
      <button data-act="imp">导入进度 JSON</button>
      <button data-act="due">复习到期条目</button>
      <button data-act="reset" style="color:var(--red)">清空全部进度</button>
      <input type="file" id="impfile" accept=".json,application/json" style="display:none">
    </div>
    <div style="margin-top:12px"><label class="dim" style="font-size:12px">搜索历史</label>
    <div style="margin-top:5px">${(S.history || []).slice(0, 12).map(h => `<span class="tag" data-search="${esc(h)}">${esc(h)}</span>`).join('') || '<span class="dim">无</span>'}</div></div>
  </div>`;
}

function viewGuide() {
  return `<h1>增补指南</h1>
  <p class="muted" style="max-width:74ch">知识库的格式、写作体例与增补流程。数据以分片文件为唯一真源，网页由脚本生成，不直接编辑网页。</p>
  <div class="card" style="margin:18px 0">
    <div class="t" style="font-family:var(--serif);font-weight:600;color:var(--amber)">日常增补三步</div>
    <div class="steps" style="margin-top:8px">
      <div class="step"><div class="st">编辑 <code>shards/&lt;module&gt;.&lt;nn&gt;.json</code></div><div class="sd">新条目追加到对应分片的 entries 数组，按 id 字母序。跨模块内容用新分片，不要塞进别的模块。</div></div>
      <div class="step"><div class="st">运行 <code>node tools/validate.mjs</code></div><div class="sd">必须 0 错误。警告逐条看，尤其引用不存在的 id 与含否定表达的句子。</div></div>
      <div class="step"><div class="st">运行 <code>node tools/build.mjs</code> 并刷新网页</div><div class="sd">重新生成 bundle。确认新条目可搜索、可打开、图谱出现连线。</div></div>
    </div>
  </div>
  <div class="md">${mdLite(GUIDE)}</div>`;
}

/* ================= 搜索 ================= */
const IDX = DOC.map(d => ({ ...d, hay: (d.t + ' ' + d.te + ' ' + d.al.join(' ') + ' ' + d.tg.join(' ') + ' ' + d.sm + ' ' + d.tx).toLowerCase() }));

function searchIds(q, limit = 400) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const res = [];
  for (const d of IDX) {
    let sc = 0;
    for (const t of terms) {
      const ti = d.t.toLowerCase(), hay = d.hay;
      if (ti === t) sc += 120;
      else if (ti.includes(t)) sc += 60;
      if ((d.te || '').toLowerCase().includes(t)) sc += 40;
      if ((d.al || []).some(a => a.toLowerCase().includes(t))) sc += 30;
      if ((d.tg || []).some(g => g.toLowerCase().includes(t))) sc += 12;
      if (hay.includes(t)) sc += 4;
    }
    if (sc > 0) res.push({ d, sc: sc + d.lv * 2 });
  }
  return res.sort((a, b) => b.sc - a.sc).slice(0, limit).map(x => x.d.id);
}

function searchAll(q) {
  return IDX.map(d => {
    const t = q.toLowerCase();
    let score = 0, inTitle = false, inBody = false;
    if (d.t.toLowerCase() === t) score += 200;
    if (d.t.toLowerCase().includes(t)) { score += 80; inTitle = true; }
    if ((d.te || '').toLowerCase().includes(t)) { score += 50; inTitle = true; }
    if ((d.al || []).some(a => a.toLowerCase().includes(t))) score += 40;
    if ((d.tg || []).some(g => g.toLowerCase().includes(t))) score += 15;
    if (d.hay.includes(t)) { score += 6; inBody = true; }
    return { d, score, inTitle, inBody };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
}

function hl(text, q) {
  const terms = q.split(/\s+/).filter(t => t.length > 1);
  let h = esc(text);
  for (const t of terms) {
    const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    h = h.replace(re, '<span class="hl">$1</span>');
  }
  return h;
}

let sugIdx = -1, sugItems = [];
function pushHistory(q) {
  S.history = [q, ...(S.history || []).filter(h => h !== q)].filter(Boolean).slice(0, 12);
  save();
}
function showSuggest(q) {
  const box = $('#sug');
  if (!q.trim()) {
    const hist = (S.history || []).slice(0, 8);
    if (!hist.length) { box.classList.remove('on'); return; }
    box.innerHTML = `<div class="sug-head">最近搜索</div>` + hist.map(h =>
      `<div class="s hist" data-search="${esc(h)}"><b>${esc(h)}</b>
       <svg viewBox="0 0 14 14" width="12" height="12" fill="none" aria-hidden="true">
         <circle cx="7" cy="7" r="5.4" stroke="currentColor" stroke-width="1.3"/>
         <path d="M7 4.1V7l2 1.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
       </svg></div>`).join('');
    box.classList.add('on');
    return;
  }
  const res = searchAll(q).slice(0, 9);
  sugItems = res.map(x => x.d.id); sugIdx = -1;
  if (!res.length) {
    box.innerHTML = `<div class="empty" style="padding:16px">没有匹配「${esc(q)}」的条目</div>`;
  } else {
    box.innerHTML = res.map((x, i) => {
      const m = MOD.get(x.d.m);
      const snippet = x.inTitle ? x.d.sm : (x.d.sm.length > 90 ? x.d.sm.slice(0, 90) + '…' : x.d.sm);
      return `<div class="s" data-i="${i}"><b>${hl(x.d.t, q)}</b><i style="color:${m.color}">${esc(m.icon)}</i><i>${esc(x.d.te || '')}</i>
        <div class="dim" style="font-size:12px;margin-top:1px">${hl(snippet, q)}</div></div>`;
    }).join('') + `<div class="s dim" style="cursor:pointer" data-i="all">在结果页查看全部匹配 →</div>`;
  }
  box.classList.add('on');
}

/* ================= 知识图谱 ================= */
let G = null;
function viewGraph() {
  return `<h1>知识图谱</h1>
  <p class="muted" style="max-width:74ch">节点是知识条目，连线是语义关系。点击节点打开条目。滚轮缩放，拖拽平移。可按模块与难度过滤。</p>
  <div class="filters">
    <select id="gmod"><option value="">全部模块</option>${KB.modules.map(m => `<option value="${m.id}">${esc(m.icon)} · ${esc(m.name)}</option>`).join('')}</select>
    <select id="glv"><option value="">全部难度</option>${KB.meta.levels.map(l => `<option value="${l.n}">level ${l.n} ${l.name}</option>`).join('')}</select>
    <select id="grel"><option value="">全部关系</option>${Object.entries(REL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <button class="sm" data-act="greload">重新布局</button>
    <span class="dim" id="gstat"></span>
  </div>
  <div id="graphwrap">
    <canvas id="graph"></canvas>
    <div class="gctl">
      <button class="sm" data-act="gzoom" data-d="1">＋</button>
      <button class="sm" data-act="gzoom" data-d="-1">－</button>
      <button class="sm" data-act="greset">复位</button>
    </div>
    <div class="glegend">${KB.modules.map(m => `<div><i style="background:${m.color}"></i>${esc(m.name)}</div>`).join('')}</div>
    <div class="gtip" id="gtip"></div>
  </div>`;
}

function initGraph() {
  const cv = $('#graph'); if (!cv) return;
  const modSel = $('#gmod'), lvSel = $('#glv'), relSel = $('#grel');
  const fm = modSel.value, flv = lvSel.value, fr = relSel.value;
  const keep = modSel.value; modSel.value = fm;

  const nodes = KB.graph.nodes.filter(n =>
    (!fm || n.m === fm) && (!flv || String(n.lv) === String(flv))).map(n => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 }));
  const ids = new Set(nodes.map(n => n.id));
  const edges = KB.graph.edges.filter(e => ids.has(e.s) && ids.has(e.t) && (!fr || e.r === fr));
  $('#gstat').textContent = `${nodes.length} 节点 / ${edges.length} 连线`;

  const ctx = cv.getContext('2d');
  const wrap = $('#graphwrap');
  let W = wrap.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let sc = 1, ox = 0, oy = 0, drag = null, panning = false, hover = null, raf = null;

  // 力导向布局
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const E = edges.map(e => [idx.get(e.s), idx.get(e.t), e]);
  const R0 = Math.min(Math.max(W, H) * 0.32, 150 + nodes.length * 26);
  nodes.forEach((n, i) => { const a = i / nodes.length * Math.PI * 2; n.x = W / 2 + Math.cos(a) * R0; n.y = H / 2 + Math.sin(a) * R0; });
  let alpha = 1, iter = 0, fitted = false;
  function fit() {
    if (!nodes.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
    const pad = 78, bw = Math.max(x1 - x0, 1) + pad * 2, bh = Math.max(y1 - y0, 1) + pad * 2;
    sc = Math.max(0.2, Math.min(3, Math.min(W / bw, H / bh)));
    ox = W / 2 - (x0 + x1) / 2 * sc; oy = H / 2 - (y0 + y1) / 2 * sc;
  }
  function step() {
    if (alpha < 0.004) { if (!fitted) { fitted = true; fit(); draw(); } return; }
    for (const n of nodes) { n.vx = (n.vx || 0) * 0.82; n.vy = (n.vy || 0) * 0.82; }
    const near = 13 + 1.6 * Math.sqrt(nodes.length);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx * dx + dy * dy || 0.01;
      const min = 70 + 16 * Math.sqrt(nodes.length), f = (min * min) / d2 * 0.06;
      const d = Math.sqrt(d2), ux = dx / d, uy = dy / d;
      a.vx -= ux * f; a.vy -= uy * f; b.vx += ux * f; b.vy += uy * f;
    }
    for (const [i, j, e] of E) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      const t0 = e.r === 'part_of' ? 46 : e.r === 'prereq' || e.r === 'next' ? 82 : 66;
      const target = t0 * (1 + 0.12 * Math.sqrt(nodes.length) / 4);
      const f = (d - target) / d * 0.045;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.006; n.vy += (H / 2 - n.y) * 0.006;
      n.x += Math.max(-14, Math.min(14, n.vx)) * alpha;
      n.y += Math.max(-14, Math.min(14, n.vy)) * alpha;
    }
    alpha *= 0.975; iter++;
    if (iter > 200) alpha = 0;
    if (alpha > 0.004 || !fitted) draw();
  }
  function toScreen(n) { return { x: n.x * sc + ox, y: n.y * sc + oy }; }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    for (const [i, j, e] of E) {
      const a = nodes[i], b = nodes[j];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = EDGE_COLOR[e.r] || '#555'; ctx.globalAlpha = hover ? (hover === a || hover === b ? 0.95 : 0.13) : 0.36;
      ctx.lineWidth = (hover === a || hover === b ? 1.9 : 1) / sc; ctx.stroke();
      if (e.r === 'prereq' || e.r === 'part_of') {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(ang - .42) * 7, b.y - Math.sin(ang - .42) * 7);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(b.x - Math.cos(ang + .42) * 7, b.y - Math.sin(ang + .42) * 7);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // 标签避让：只有不与已画标签重叠时才画；节点少时全画，节点多时仅悬停或高倍缩放
    const labels = [];
    function fits(n, r) {
      const tx = n.x + r + 3 / sc, ty = n.y + 3 / sc;
      ctx.font = `${11 / sc}px 'IBM Plex Mono',ui-monospace,Menlo,monospace`;
      const w = ctx.measureText(n.t).width / sc;
      const box = { x: tx, y: ty - 11 / sc, w, h: 15 / sc };
      for (const b2 of labels) if (!(box.x > b2.x + b2.w || box.x + box.w < b2.x || box.y > b2.y + b2.h || box.y + box.h < b2.y)) return false;
      labels.push(box); return true;
    }
    for (const n of nodes) {
      const m = MOD.get(n.m), r = 3.4 + n.lv * 1.15;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7);
      ctx.fillStyle = n.st === 'draft' ? '#6b5c3a' : m.color; ctx.fill();
      if (n.st === 'draft') { ctx.strokeStyle = '#e8a33d'; ctx.lineWidth = 0.8 / sc; ctx.stroke(); }
      if (n.st === 'mastered') { ctx.beginPath(); ctx.arc(n.x, n.y, r + 2.4, 0, 7); ctx.strokeStyle = '#84a470'; ctx.lineWidth = 1.1 / sc; ctx.stroke(); }
      const force = nodes.length > 40 || (nodes.length > 14 && sc < 1.8);
      const show = hover === n || (n.lv >= 4 && sc > 1.2) || (!force && nodes.length <= 14) || (nodes.length <= 60 && sc > 0.9);
      if (show && fits(n, r)) {
        ctx.fillStyle = hover === n ? '#f7c366' : '#e8e2d9';
        ctx.fillText(n.t, n.x + r + 3 / sc, n.y + 3 / sc);
      }
    }
    ctx.restore();
  }
  const loop = () => { raf = requestAnimationFrame(loop); if (alpha > 0.004) step(); };
  // 先跑满预算再绘制，避免打开图谱时空帧
  while (alpha > 0.004) step();
  fit(); draw();

  if (G && G.cleanup) G.cleanup();
  const gcanvas = $('#graph');
  if (!gcanvas) G = null;
  function nodeAt(ev) {
    const r = cv.getBoundingClientRect();
    const mx = (ev.clientX - r.left - ox) / sc, my = (ev.clientY - r.top - oy) / sc;
    let best = null, bd = 1e9;
    for (const n of nodes) { const d = Math.hypot(n.x - mx, n.y - my); if (d < bd) { bd = d; best = n; } }
    return bd < 22 ? best : null;
  }
  function onDown(ev) { drag = { x: ev.clientX, y: ev.clientY, ox, oy }; panning = true; cv.classList.add('drag'); }
  function onUp(ev) {
    panning = false; cv.classList.remove('drag');
    if (drag && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 4) {
      const n = nodeAt(ev); if (n) go(n.id);
    }
    drag = null;
  }
  function onMove(ev) {
    if (drag && panning) { ox = drag.ox + (ev.clientX - drag.x); oy = drag.oy + (ev.clientY - drag.y); draw(); return; }
    const tip = $('#gtip');
    if (!tip || !cv.isConnected) return;
    const r = cv.getBoundingClientRect();
    const best = nodeAt(ev);
    if (best) {
      hover = best;
      tip.style.display = 'block';
      tip.style.left = (ev.clientX - r.left + 12) + 'px';
      tip.style.top = (ev.clientY - r.top + 12) + 'px';
      const inc = E.filter(([i]) => nodes[i] === best).length + E.filter(([, j]) => nodes[j] === best).length;
      tip.innerHTML = `<strong style="color:var(--amber)">${esc(best.t)}</strong><br><span class="dim">${LV.get(best.lv)} · ${inc} 条关联</span>`;
      cv.style.cursor = 'pointer';
    } else { hover = null; tip.style.display = 'none'; cv.style.cursor = panning ? 'grabbing' : 'grab'; }
    draw();
  }
  function onWheel(ev) {
    ev.preventDefault();
    const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    const ns = Math.max(0.2, Math.min(6, sc * f));
    ox = mx - (mx - ox) * (ns / sc); oy = my - (my - oy) * (ns / sc); sc = ns; draw();
  }
  // 触屏：单指拖拽平移 + 点按选中，双指捏合缩放
  let pinch = null;
  function touchDist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  cv.addEventListener('touchstart', ev => {
    if (ev.touches.length === 1) {
      const t = ev.touches[0];
      drag = { x: t.clientX, y: t.clientY, ox, oy }; panning = true;
    } else if (ev.touches.length === 2) {
      panning = false;
      pinch = { d: touchDist(ev.touches), sc, mx: (ev.touches[0].clientX + ev.touches[1].clientX) / 2, my: (ev.touches[0].clientY + ev.touches[1].clientY) / 2 };
    }
  }, { passive: true });
  cv.addEventListener('touchmove', ev => {
    ev.preventDefault();
    if (ev.touches.length === 1 && drag && panning) {
      const t = ev.touches[0];
      ox = drag.ox + (t.clientX - drag.x); oy = drag.oy + (t.clientY - drag.y); draw();
    } else if (ev.touches.length === 2 && pinch) {
      const r = cv.getBoundingClientRect();
      const ns = Math.max(0.2, Math.min(6, pinch.sc * touchDist(ev.touches) / pinch.d));
      const mx = pinch.mx - r.left, my = pinch.my - r.top;
      ox = mx - (mx - ox) * (ns / sc); oy = my - (my - oy) * (ns / sc); sc = ns; draw();
    }
  }, { passive: false });
  cv.addEventListener('touchend', ev => {
    if (pinch && ev.touches.length < 2) pinch = null;
    if (!panning) return;
    panning = false;
    const t = ev.changedTouches[0];
    if (drag && Math.hypot(t.clientX - drag.x, t.clientY - drag.y) < 6) {
      const n = nodeAt(t); if (n) go(n.id);
    }
    drag = null;
  });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('mousemove', onMove);
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('mousedown', onDown);
  G = {
    cleanup() {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('mousedown', onDown);
      cancelAnimationFrame(raf);
    },
    zoom(dir) {
      // data-d 是方向（+1/-1），放大倍率固定，围绕画布中心缩放
      const f = dir > 0 ? 1.3 : 1 / 1.3;
      const ns = Math.max(0.2, Math.min(6, sc * f));
      if (ns === sc) return;
      const cx = W / 2, cy = H / 2;
      ox = cx - (cx - ox) * (ns / sc); oy = cy - (cy - oy) * (ns / sc); sc = ns; draw();
    },
    reset() { fitted = false; alpha = 1; iter = 0; relayoutNodes(); loop(); },
    relayout() { fitted = false; alpha = 1; iter = 0; relayoutNodes(); loop(); }
  };
  function relayoutNodes() {
    const R = Math.min(Math.max(W, H) * 0.32, 150 + nodes.length * 26);
    nodes.forEach((n, i) => {
      const a = i / nodes.length * Math.PI * 2 + Math.random() * .5;
      n.x = W / 2 + Math.cos(a) * R; n.y = H / 2 + Math.sin(a) * R; n.vx = n.vy = 0;
    });
  }
}

/* ================= 导航 ================= */
function go(id) {
  if (!ENT.has(id)) { toast('条目不存在：' + id); return; }
  location.hash = '#/e/' + id;
}
function route() {
  const h = decodeURI(location.hash.replace(/^#/, ''));
  const pending = V.pendingFilters; // 由「先设筛选再跳页」的入口预置，route 消费一次
  if (h.startsWith('/e/')) { V.view = 'entry'; V.entry = h.slice(3); if (!ENT.has(V.entry)) { V.view = 'browse'; toast('条目不存在：' + V.entry); } }
  else if (h.startsWith('/guide')) { V.view = 'guide'; }
  else if (h.startsWith('/g')) { V.view = 'graph'; }
  else if (h.startsWith('/b')) { V.view = 'browse'; V.module = null; V.filters = pending || {}; }
  else if (h.startsWith('/m/')) { V.view = 'browse'; V.module = h.slice(3); V.filters = pending || {}; }
  else if (h.startsWith('/p')) { V.view = 'progress'; }
  else { V.view = 'home'; }
  V.pendingFilters = null;
  render();
}
function setView(v) {
  if (v === 'home') location.hash = '#/';
  else if (v === 'browse') location.hash = '#/b';
  else if (v === 'graph') location.hash = '#/g';
  else if (v === 'progress') location.hash = '#/p';
  else if (v === 'guide') location.hash = '#/guide';
}

/* ================= 交互绑定 ================= */
function bind() {
  const e = V.view === 'entry' ? ENT.get(V.entry) : null;
  if (e) {
    const r = S.entries[e.id];
    $('#srsinfo').textContent = r
      ? `复习状态：${STATUS_CN[statusOf(e.id)]} · 第 ${r.srs.box} 盒 · 已复习 ${r.srs.reps} 次 · 下次 ${r.srs.due || '未安排'}`
      : '尚未学习。读完后点「标记已学」。';
    renderNote(e);
    renderNavBtns(e);
    bindQuiz(e);
    const chk = $(`.chk[data-chk="${e.id}"]`);
    if (chk) chk.addEventListener('click', ev => {
      const li = ev.target.closest('li[data-i]'); if (!li) return;
      const arr = S.checklist[e.id] = S.checklist[e.id] || [];
      const i = +li.dataset.i;
      arr[i] = !arr[i]; li.classList.toggle('done', !!arr[i]); save();
    });
  }
  if (V.view === 'graph') {
    initGraph();
    ['gmod', 'glv', 'grel'].forEach(id => { const el = $('#' + id); if (el) el.onchange = () => initGraph(); });
  }
  const fq = $('#fq');
  if (fq) {
    let t; fq.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { V.filters.q = fq.value.trim(); rerenderBrowse(); }, 220); });
  }
  ['ftype', 'flevel', 'fstatus'].forEach(id => { const el = $('#' + id); if (el) el.onchange = () => { V.filters[id.slice(1)] = el.value; rerenderBrowse(); }; });
}
function rerenderBrowse() {
  const scroll = window.scrollY;
  render(); window.scrollTo(0, scroll);
}

// 跳转到浏览页并应用一组筛选。若目标 hash 与当前完全一致（例如已经在浏览页上点标签、
// 或再次提交同一个搜索词），赋 location.hash 不会触发 hashchange，pendingFilters 就
// 永远不会被 route() 消费 —— 旧版「在浏览页点标签没反应」正是这个原因。
function gotoBrowse(filters, moduleId) {
  const target = moduleId ? '#/m/' + moduleId : '#/b';
  V.pendingFilters = filters || {};
  if (location.hash === target) {
    const y = window.scrollY;
    route(); window.scrollTo(0, y);
  } else {
    V.module = moduleId || null;
    location.hash = target;
  }
}

function renderNavBtns(e) {
  const box = $('#navbtns'); if (!box) return;
  const out = [], seen = new Set();
  const push = (id, label) => { if (ENT.has(id) && !seen.has(id)) { seen.add(id); out.push(`<button data-go="${id}">${label}：${esc(ENT.get(id).title)}</button>`); } };
  (e.links?.prereq || []).forEach(id => push(id, '← 先学'));
  (e.links?.next || []).slice(0, 3).forEach(id => push(id, '后学 →'));
  const rest = (e.links?.related || []).concat(e.links?.contrast || []).filter(id => !seen.has(id)).slice(0, 4);
  rest.forEach(id => push(id, '相关'));
  const sibs = KB.entries.filter(x => x.id !== e.id && x.level === e.level && x.id.split('.')[0] === e.id.split('.')[0] && !seen.has(x.id)).slice(0, 2);
  sibs.forEach(x => push(x.id, `同难度 L${x.level}`));
  box.innerHTML = out.join('') || '<span class="dim">这是末端条目。</span>';
}

function openNoteModal(id) {
  const cur = S.notes[id] || '';
  const ov = document.createElement('div');
  ov.className = 'modal-ov';
  ov.innerHTML = `<div class="modal">
    <div class="modal-h"><strong>我的笔记${ENT.get(id) ? ' · ' + esc(ENT.get(id).title) : ''}</strong>
      <button class="sm" data-act="closemodal">关闭</button></div>
    <textarea id="note-ta" rows="8" placeholder="支持 Markdown：**粗体**、列表、代码…">${esc(cur)}</textarea>
    <div class="modal-f">
      <span class="dim" style="font-size:12px">仅保存在本机浏览器。</span>
      <button class="pri" data-act="savenote" data-id="${esc(id)}">保存</button>
    </div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', ev => { if (ev.target === ov) closeModal(); });
  const ta = $('#note-ta');
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); doSaveNote(id); }
    if (ev.key === 'Escape') closeModal();
  });
}
function doSaveNote(id) {
  const ta = $('#note-ta'); if (!ta) return;
  const v = ta.value.trim();
  if (v) S.notes[id] = v; else delete S.notes[id];
  save(); closeModal(); if (V.view === 'entry') { render(); toast(v ? '笔记已保存' : '笔记已删除'); }
}
function closeModal() {
  $('.modal-ov')?.remove();
}
function renderNote(e) {  const box = $('#notebox'); if (!box) return;
  const v = S.notes[e.id];
  box.innerHTML = v
    ? `<div class="card" style="margin:12px 0;border-color:rgba(232,163,61,.35)"><strong style="font-size:13px;color:var(--amber)">我的笔记</strong>
       <div class="md" style="margin-top:6px">${mdLite(v)}</div>
       <div style="margin-top:8px"><button class="sm" data-act="editnote" data-id="${e.id}">编辑</button>
       <button class="sm" data-act="delnote" data-id="${e.id}">删除</button></div></div>`
    : '';
}

function bindQuiz(e) {
  const box = $(`.quiz[data-quiz="${e.id}"]`); if (!box) return;
  const saved = S.quiz[e.id];
  $$('.q', box).forEach(qEl => {
    qEl.addEventListener('click', ev => {
      const opt = ev.target.closest('.opt'); if (!opt) return;
      const qi = +qEl.dataset.q, q = e.quiz[qi];
      $$('.opt', qEl).forEach(o => o.classList.remove('ok', 'no'));
      const oi = +opt.dataset.o;
      const ok = q.answer.includes(oi);
      opt.classList.add(ok ? 'ok' : 'no');
      if (!ok) q.options.forEach((_, k) => { if (q.answer.includes(k)) $$('.opt', qEl)[k]?.classList.add('ok'); });
      const w = $('.why', qEl); w.style.display = 'block';
      w.innerHTML = `<strong>${ok ? '正确' : '错误'}</strong> · ${esc(q.why || '')}`;
    });
  });
  const doScore = () => {
    if (!$$('.opt.ok:not(.no)', box).length) { toast('先回答题目'); return; }
    let got = 0;
    e.quiz.forEach((q, qi) => {
      const sel = $$(`.opt.ok:not(.no)`, $(`.q[data-q="${qi}"]`, box));
      if (sel.some(s => q.answer.includes(+s.dataset.o)) && !$(`.q[data-q="${qi}"] .opt.no`, box)) got++;
    });
    const total = e.quiz.length;
    const verdict = got === total ? 'mastered' : got >= total - 1 ? 'review' : 'learning';
    $('[data-score]', box).textContent = `${got}/${total}`;
    $('[data-verdict]', box).innerHTML = got === total
      ? '全部答对。本条标记为已掌握。'
      : got >= total - 1 ? '接近掌握。本条进入复习队列。' : '需要重学。本条回到第 1 盒。';
    S.quiz[e.id] = { at: today(), score: [got, total], verdict };
    todayStat().quiz.push(e.id);
    grade(e.id, got === total);
    save();
  };
  const bar = document.createElement('div');
  bar.className = 'progbar';
  bar.innerHTML = `<button class="pri" data-act="score" data-id="${e.id}">提交并记录</button>
    <span class="dim">${saved ? `上次 ${saved.at} · ${saved.score[0]}/${saved.score[1]}` : '尚未测验'}</span>`;
  bar.querySelector('[data-act="score"]').addEventListener('click', doScore);
  box.appendChild(bar);
}

function entryToMarkdown(e) {
  const out = [`# ${e.title} · ${e.title_en}`, '',
    `- ID: \`${e.id}\``,
    `- 模块: ${MOD.get(e.id.split('.')[0]).name}`,
    `- 类型: ${TY.get(e.type)?.name || e.type} · level ${e.level} ${LV.get(e.level)}`,
    e.era ? `- 适用年代: ${e.era}` : '',
    `- 状态: ${e.status || 'reviewed'} · 修订 ${e.updated || ''}`, '',
    `> ${e.summary}`, ''];
  for (const b of e.blocks) {
    switch (b.kind) {
      case 'h2': out.push(`## ${b.text}`); break;
      case 'p': case 'note': case 'warn': case 'tip': out.push(b.text); break;
      case 'ul': out.push(b.text.split('\n').map(l => l.replace(/^\s*[-*]\s*/, '- ')).join('\n')); break;
      case 'ol': out.push(b.text); break;
      case 'defs': case 'glossary': out.push(`**${b.term}**：${b.text}`); break;
      case 'formula': case 'calc': out.push('```', b.text, '```'); break;
      case 'image':
        out.push(`![${b.alt || b.caption || ''}](${b.src})`);
        if (b.caption) out.push(`*${b.caption}*`);
        if (b.credit || b.license || b.source) out.push([b.credit, b.license, b.source].filter(Boolean).join(' · '));
        break;
      case 'steps': case 'troubleshoot': case 'settings':
        out.push('', `### ${b.caption || ''}`, '');
        (b.items || []).forEach(i => out.push(`- **${i.t}**：${i.d}`)); break;
      case 'timeline':
        out.push('', `### ${b.caption || '年代沿革'}`, '', '| 年代 | 事件 | 说明 |', '| --- | --- | --- |');
        (b.rows || []).forEach(r => out.push(`| ${r.c1} | ${r.c2} | ${r.c3 || ''} |`)); break;
      default:
        out.push('', `### ${b.caption || ''}`, '',
          '| ' + (b.rows[0] ? Object.keys(b.rows[0]).filter(k => /^c\d$/.test(k)).map(k => k === 'c1' ? '项目' : k).join(' | ') : '项目') + ' |',
          '| --- | --- | --- | --- |');
        (b.rows || []).forEach(r => out.push(`| ${r.c1} | ${r.c2 || ''} | ${r.c3 || ''} | ${r.c4 || ''} | ${r.c5 || ''} |`));
    }
    out.push('');
  }
  if (e.checklist?.length) { out.push('', '## 检查清单'); e.checklist.forEach(c => out.push(`- [ ] ${c}`)); }
  out.push('', '## 来源');
  e.refs.forEach(r => out.push(`- [${r.name}](${r.url})${r.kind ? ` _${r.kind}_` : ''}`));
  if (Object.values(e.links || {}).some(v => v?.length)) {
    out.push('', '## 关联');
    for (const [k, v] of Object.entries(e.links)) if (v?.length) out.push(`- ${REL[k]}: ${v.map(i => ENT.get(i) ? `[${ENT.get(i).title}](#${i})` : i).join('、')}`);
  }
  return out.filter(l => l !== '').join('\n');
}

function doExport() {
  const blob = new Blob([JSON.stringify({ _format: 'filmkb-progress-v1', _exported: new Date().toISOString(), ...S }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `filmkb-progress-${today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('进度已导出');
}
function doImport(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || typeof d !== 'object' || !('entries' in d)) throw new Error('格式不符');
      S = { ...structuredClone(blank), ...d };
      save(); render(); toast('进度已导入');
    } catch (err) { toast('导入失败：' + err.message); }
  };
  fr.readAsText(file);
}

/* ================= 全局事件 ================= */
document.addEventListener('click', ev => {
  const t = ev.target;

  const goEl = t.closest('[data-go]');
  if (goEl) { ev.preventDefault(); go(goEl.dataset.go); return; }

  const mv = t.closest('[data-view]');
  if (mv) { setView(mv.dataset.view); return; }

  const md = t.closest('[data-mod]');
  if (md) { gotoBrowse({}, md.dataset.mod); return; }

  const tab = t.closest('nav.tabs button');
  if (tab) { setView(tab.dataset.v); return; }

  const tag = t.closest('[data-tag]');
  if (tag) { ev.stopPropagation(); gotoBrowse({ tag: tag.dataset.tag }, null); return; }

  const sq = t.closest('[data-search]');
  if (sq) { $('#q').value = sq.dataset.search; showSuggest(sq.dataset.search); $('#q').focus(); return; }

  const sg = t.closest('.suggest .s');
  if (sg) {
    $('#q').blur(); $('#sug').classList.remove('on');
    if (sg.dataset.i === 'all') { gotoBrowse({ q: $('#q').value.trim() }, null); }
    else if (sugItems[+sg.dataset.i]) go(sugItems[+sg.dataset.i]);
    return;
  }

  const act = t.closest('[data-act]');
  if (act) { doAct(act.dataset.act, act.dataset, ev); return; }
});

function doAct(act, d) {
  const e = d.id ? ENT.get(d.id) : null;
  switch (act) {
    case 'read': if (e) { grade(e.id, true); render(); toast(statusOf(e.id) === 'mastered' ? '已掌握' : '下次复习 ' + S.entries[e.id].srs.due); } break;
    case 'again': if (e) { grade(e.id, false); render(); toast('已回到第 1 盒'); } break;
    case 'score': break; // 由 bindQuiz 直接绑定 doScore
    case 'note': case 'editnote': if (e) openNoteModal(e.id); break;
    case 'savenote': {
      const ta = $('#note-ta'); if (!ta) break;
      const v = ta.value.trim();
      if (v) S.notes[d.id] = v; else delete S.notes[d.id];
      save(); closeModal(); if (V.view === 'entry') { render(); toast(v ? '笔记已保存' : '笔记已删除'); }
      break;
    }
    case 'closemodal': closeModal(); break;
    case 'delnote': if (e) { delete S.notes[e.id]; save(); render(); toast('笔记已删除'); } break;
    case 'copy': if (e) { navigator.clipboard?.writeText(entryToMarkdown(e)).then(() => toast('Markdown 已复制'), () => toast('复制失败')); } break;
    case 'clearf': V.filters = {}; rerenderBrowse(); break;
    case 'path': { gotoBrowse({ level: d.lv }, d.m); break; }
    case 'modpath': { gotoBrowse({}, d.m); break; }
    case 'due': {
      const due = dueList();
      if (!due.length) { toast('今天没有到期条目'); break; }
      const ids = due.map(x => x.id);
      const i = ids.indexOf(V.entry);
      go(ids[(i + 1) % ids.length]);
      toast(`复习队列 ${((i + 1) % ids.length) + 1}/${ids.length}`);
      break;
    }
    case 'exp': doExport(); break;
    case 'imp': $('#impfile')?.click(); break;
    case 'reset': if (confirm('清空全部学习进度？此操作不可撤销。')) { localStorage.removeItem(SKEY); S = structuredClone(blank); render(); toast('进度已清空'); } break;
    case 'gzoom': G?.zoom(+d.d); break;
    case 'greset': G?.reset(); break;
    case 'greload': G?.relayout(); break;
  }
}

document.addEventListener('change', ev => {
  if (ev.target.id === 'impfile' && ev.target.files[0]) doImport(ev.target.files[0]);
});

const qin = $('#q');
qin.addEventListener('input', () => {
  showSuggest(qin.value);
});
qin.addEventListener('focus', () => { showSuggest(qin.value); });
qin.addEventListener('blur', () => setTimeout(() => $('#sug').classList.remove('on'), 160));
qin.addEventListener('keydown', ev => {
  const items = $$('#sug .s[data-i]'); const all = $$('#sug .s');
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!all.length) return;
    let i = all.findIndex(x => x.classList.contains('sel'));
    i = ev.key === 'ArrowDown' ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1);
    all.forEach(x => x.classList.remove('sel')); all[i].classList.add('sel');
    all[i].scrollIntoView({ block: 'nearest' });
  } else if (ev.key === 'Enter') {
    const sel = $('#sug .s.sel');
    if (sel) { sel.click(); return; }
    const q = qin.value.trim();
    if (q) {
      pushHistory(q);
      gotoBrowse({ q }, null); $('#sug').classList.remove('on'); qin.blur();
    }
  } else if (ev.key === 'Escape') { $('#sug').classList.remove('on'); qin.blur(); }
});
document.addEventListener('click', ev => { if (!ev.target.closest('.searchbox')) $('#sug').classList.remove('on'); });
document.addEventListener('keydown', ev => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'k') { ev.preventDefault(); qin.focus(); qin.select(); }
  if (ev.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { ev.preventDefault(); qin.focus(); }
});
window.addEventListener('hashchange', route);
window.addEventListener('resize', () => {
  if (V.view === 'graph') { if (G) G.cleanup(); G = null; initGraph(); }
});
route();