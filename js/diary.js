// 다이어리 — 사이버 다꾸 (스티커·사진·글상자·마스킹테이프·종이·글꼴)
(function (App) {
  const { t, esc, svg, uid, todayStr, nowISO, fmt } = App;
  const ui = App.ui;

  const PAGE_W = 720, PAGE_H = 1000;
  const MOODS = ['😊', '😆', '🥰', '😌', '😐', '😢', '😠', '😴', '🤒'];
  const WEATHERS = ['☀️', '⛅', '☁️', '🌧️', '⛈️', '❄️', '🌫️', '🌈'];
  const PAPERS = ['lined', 'grid', 'dot', 'plain'];
  const PAPER_COLORS = ['#ffffff', '#fffaf0', '#fff3f6', '#f1f7ff', '#f2faf4', '#f6f2ff', '#f4efe6', '#26282e'];
  const INK_COLORS = ['#2b2b2b', '#5a6170', '#2fa4de', '#d0527a', '#2f8f6f', '#8a5a2b', '#ffffff'];
  const TAPE_COLORS = ['#ffd6e0', '#ffe9a8', '#cfe8ff', '#d6f2dc', '#e5dcff', '#ffd9bf', '#e9e4dc', '#bfc8d6'];
  const TAPES = ['solid', 'stripe', 'dot', 'check', 'grid'];
  const FRAMES = ['none', 'polaroid', 'round', 'tape'];
  const TEXT_STYLES = ['plain', 'marker', 'under', 'caption', 'quote', 'index', 'labeler', 'cut', 'washi', 'ticket', 'receipt'];
  // 예전 글상자 종류는 비슷한 새 종류로 바꿔 보여줘요
  const LEGACY_STYLE = { label: 'cut', box: 'index', dash: 'index', note: 'cut', bubble: 'quote', tag: 'index', round: 'labeler', stamp: 'caption' };
  // 꾸밈 색 기본값 (차분한 색)
  const DECO_DEFAULT = { marker: '#f5e27a', under: '#7aa6c2', caption: '#9a8f80', quote: '#c7b9a6', index: '#8fb3a2', labeler: '#2b2b2b', cut: '#ffffff', washi: '#e8cfc4', ticket: '#efe3c8', receipt: '#f1ece2' };
  const DECO_COLORS = ['#f5e27a', '#f2c6c2', '#cfe0c3', '#c9dbe8', '#ddd3ea', '#efe3c8', '#ffffff', '#2b2b2b', '#9a8f80', '#7aa6c2'];
  const INKED = ['labeler', 'cut', 'washi', 'ticket', 'receipt'];
  const styleOf = (it) => { const st = LEGACY_STYLE[it.style] || it.style; return TEXT_STYLES.includes(st) ? st : 'plain'; };
  const inkFor = (hex) => { const n = parseInt(hex.slice(1), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? '#2b2b2b' : '#ffffff'; };
  const decoOf = (it) => (isHex(it.deco) && !LEGACY_STYLE[it.style] ? it.deco : DECO_DEFAULT[styleOf(it)] || '#f5e27a');

  ui.diaryId = null;
  ui.dkMode = 'write';      // write: 글쓰기 / deco: 꾸미기
  ui.dkTab = 'sticker';
  ui.dkSel = null;
  ui.dkScale = 1;

  const D = () => App.D;
  const cur = () => D().diary.find((x) => x.id === ui.diaryId);
  const sorted = () => [...D().diary].sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const selItem = () => { const e = cur(); return e && e.items ? e.items.find((i) => i.id === ui.dkSel) : null; };
  const rand = (a, b) => Math.round(a + Math.random() * (b - a));
  const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
  // 자유 서식은 항상 바로 꾸미고 쓰기, 일기장 서식은 글쓰기/꾸미기 전환
  const free = () => { const e = cur(); return !!e && e.layout === 'free'; };
  const mode = () => (free() ? 'deco' : ui.dkMode);

  function ensureShape(e) {
    if (!e.items) e.items = [];
    if (!e.paper) e.paper = 'lined';
    if (!e.paperColor) e.paperColor = '#ffffff';
    if (!e.size) e.size = 18;
    if (!e.lineH) e.lineH = 32;
    if (e.letter == null) e.letter = 0;
    if (!e.align) e.align = 'left';
    if (!e.titleSize) e.titleSize = 28;
    if (e.bgAlpha == null) e.bgAlpha = 100;
    if (!e.layout) e.layout = ((e.title || '').trim() || (e.body || '').trim()) ? 'note' : 'free';
    return e;
  }

  /* ---------- 실행 취소 / 다시 실행 ---------- */
  const hist = { id: null, last: null, past: [], future: [] };
  const SNAP_KEYS = ['items', 'font', 'size', 'color', 'paper', 'paperColor', 'lineH', 'letter', 'align', 'bold', 'titleSize', 'bgImage', 'bgAlpha', 'mood', 'weather'];
  const snap = (e) => JSON.stringify(Object.fromEntries(SNAP_KEYS.map((k) => [k, e[k]])));
  let histTimer = null;
  function histCommit(now) {
    clearTimeout(histTimer);
    const run = () => {
      const e = cur();
      if (!e) return;
      if (hist.id !== e.id) { hist.id = e.id; hist.last = snap(e); hist.past = []; hist.future = []; return; }
      const s = snap(e);
      if (s !== hist.last) {
        hist.past.push(hist.last);
        if (hist.past.length > 80) hist.past.shift();
        hist.future = [];
        hist.last = s;
      }
      undoBtns();
    };
    if (now) run(); else histTimer = setTimeout(run, 250);
  }
  function histApply(s) {
    Object.assign(cur(), JSON.parse(s));
    hist.last = s;
    ui.dkSel = null;
    App.silent(() => {});
    App.renderMain();
  }
  function undo() { histCommit(true); if (hist.past.length) { hist.future.push(hist.last); histApply(hist.past.pop()); } }
  function redo() { histCommit(true); if (hist.future.length) { hist.past.push(hist.last); histApply(hist.future.pop()); } }
  function undoBtns() {
    const u = App.$('[data-act="dk-undo"]'), r = App.$('[data-act="dk-redo"]');
    if (u) u.disabled = !hist.past.length;
    if (r) r.disabled = !hist.future.length;
  }
  const touch = () => { App.silent(() => { const e = cur(); if (e) e.updatedAt = nowISO(); }); histCommit(); };

  /* ---------- 항목 그리기 ---------- */
  function itemInner(it) {
    if (it.type === 'emoji') return `<span class="dk-emoji" style="font-size:${Math.round(it.w * 0.86)}px">${esc(it.emoji)}</span>`;
    if (it.type === 'sticker') return `<img data-asset="${esc(it.assetId)}" alt="" draggable="false">`;
    if (it.type === 'photo') return `<div class="dk-photo frame-${FRAMES.includes(it.frame) ? it.frame : 'none'}"><img data-asset="${esc(it.assetId)}" alt="" draggable="false"></div>`;
    if (it.type === 'tape') return `<div class="dk-tape tape-${TAPES.includes(it.pattern) ? it.pattern : 'solid'}" style="--tc:${esc(it.color)};height:${Math.max(16, Math.round(it.w * 0.16))}px"></div>`;
    if (it.type === 'text') { const st = styleOf(it), dc = decoOf(it); return `<div class="dk-text ts-${st}" style="--deco:${dc};font-family:${App.fontFamily(it.font)};font-size:${it.size || 22}px;color:${esc(it.color || (INKED.includes(st) ? inkFor(dc) : 'inherit'))};text-align:${esc(it.align || 'left')};letter-spacing:${it.letter || 0}px;font-weight:${it.bold ? 700 : 400};line-height:${it.lh || 1.4}">${esc(it.text)}</div>`; }
    return '';
  }
  function itemHTML(it) {
    const sel = it.id === ui.dkSel;
    const fx = [it.flip ? 'transform:scaleX(-1)' : '', it.shadow ? 'filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))' : ''].filter(Boolean).join(';');
    const size = it.type === 'text' ? `max-width:${it.w}px;` : `width:${it.w}px;`;
    return `<div class="dk-item ${sel ? 'sel' : ''} ${it.lock ? 'locked' : ''} t-${it.type}" data-iid="${it.id}" style="left:${it.x}px;top:${it.y}px;${size}transform:rotate(${it.r || 0}deg);z-index:${it.z || 1};opacity:${it.op == null ? 1 : it.op}">
      <div class="dk-inner" style="${fx}">${itemInner(it)}</div>
      ${sel && !it.lock ? `<span class="h h-rot" data-h="rot" title="${t('dk.rotate')}"></span><span class="h h-size" data-h="size" title="${t('dk.resize')}"></span><button type="button" class="h h-del" data-h="del" title="${t('c.delete')}">×</button>` : ''}
      ${sel && it.lock ? `<span class="h-lock" aria-hidden="true">🔒</span>` : ''}
    </div>`;
  }
  function renderItems() {
    const e = cur();
    if (!e) return;
    const under = App.$('#dkUnder'), over = App.$('#dkOver');
    if (!under || !over) return;
    under.innerHTML = e.items.filter((i) => i.under).map(itemHTML).join('');
    over.innerHTML = e.items.filter((i) => !i.under).map(itemHTML).join('');
    App.hydrateAssets(App.$('#dkPage'));
    renderSelPanel();
  }
  function updateItemDom(it) {
    const el = App.$(`[data-iid="${it.id}"]`);
    if (!el) return;
    el.style.left = it.x + 'px';
    el.style.top = it.y + 'px';
    if (it.type === 'text') el.style.maxWidth = it.w + 'px'; else el.style.width = it.w + 'px';
    el.style.transform = `rotate(${it.r || 0}deg)`;
    el.style.opacity = it.op == null ? 1 : it.op;
    const em = el.querySelector('.dk-emoji');
    if (em) em.style.fontSize = Math.round(it.w * 0.86) + 'px';
    const tp = el.querySelector('.dk-tape');
    if (tp) tp.style.height = Math.max(16, Math.round(it.w * 0.16)) + 'px';
  }

  /* ---------- 선택한 항목 패널 ---------- */
  const colorRow = (act, key, val, list) => `<div class="colors">${list.map((c) => `<button type="button" class="color-dot ${c ? '' : 'auto'}" style="background:${c || 'transparent'}" data-act="${act}" data-k="${key}" data-v="${c}" aria-pressed="${(val || '') === c}" aria-label="${c || 'auto'}"></button>`).join('')}<label class="color-pick" title="${t('cc.pickColor')}"><input type="color" value="${isHex(val) ? val : '#2b2b2b'}" data-input="${act === 'dk-set' ? 'dk-color' : 'dk-item-color'}" data-k="${key}"><span>${t('cc.custom')}</span></label></div>`;
  function tsPreview(s, deco, act, pressed) {
    const dc = deco || DECO_DEFAULT[s] || '#f5e27a';
    const attrs = act === 'dk-item-set' ? `data-act="dk-item-set" data-k="style" data-v="${s}" aria-pressed="${pressed}"` : `data-act="dk-add-text" data-v="${s}"`;
    return `<button type="button" class="ts-btn" ${attrs} title="${t('dk.ts.' + s)}"><span class="dk-text ts-${s} preview" style="--deco:${dc};${INKED.includes(s) ? `color:${inkFor(dc)};` : ''}">${t('dk.tsSample.' + s)}</span><small>${t('dk.ts.' + s)}</small></button>`;
  }
  const decoRow = (val) => `<div class="colors">${DECO_COLORS.map((c) => `<button type="button" class="color-dot" style="background:${c}" data-act="dk-item-set" data-k="deco" data-v="${c}" aria-pressed="${val === c}" aria-label="${c}"></button>`).join('')}<label class="color-pick ${DECO_COLORS.includes(val) ? '' : 'on'}" title="${t('cc.pickColor')}"><input type="color" value="${val}" data-input="dk-item-color" data-k="deco"><span>${t('cc.custom')}</span></label></div>`;
  const rangeRow = (input, key, min, max, step, val, unit) => `<div class="range-row"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-input="${input}" data-k="${key}"><output>${val}${unit || ''}</output></div>`;

  function renderSelPanel() {
    const box = App.$('#dkSelPanel');
    if (!box) return;
    const it = selItem();
    if (!it) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    let extra = '';
    if (it.type === 'text') {
      extra = `
        <label class="field"><span class="label">${t('dk.font')}</span><select class="input select" data-change="dk-item-sel" data-k="font">${App.fontOptions(it.font)}</select></label>
        <div class="grid-2">
          <label><span class="label">${t('dk.size')}</span>${rangeRow('dk-item-num', 'size', 10, 96, 1, it.size || 22, 'px')}</label>
          <label><span class="label">${t('dk.letter')}</span>${rangeRow('dk-item-num', 'letter', -3, 12, 0.5, it.letter || 0, 'px')}</label>
          <label><span class="label">${t('dk.lineH')}</span>${rangeRow('dk-item-num', 'lh', 1, 2.6, 0.05, it.lh || 1.4, '')}</label>
          <label><span class="label">${t('dk.boxW')}</span>${rangeRow('dk-item-num', 'w', 60, 680, 10, it.w, 'px')}</label>
        </div>
        ${colorRow('dk-item-set', 'color', it.color, ['', ...INK_COLORS])}
        <div class="row wrap gap-xs">
          <div class="seg small">${['left', 'center', 'right'].map((a) => `<button data-act="dk-item-set" data-k="align" data-v="${a}" aria-pressed="${(it.align || 'left') === a}">${t('dk.al.' + a)}</button>`).join('')}</div>
          <button class="btn small" data-act="dk-item-toggle" data-k="bold" aria-pressed="${!!it.bold}"><b>B</b></button>
        </div>
        <span class="label">${t('dk.boxType')}</span>
        <div class="ts-grid">${TEXT_STYLES.map((s) => tsPreview(s, s === styleOf(it) ? decoOf(it) : null, 'dk-item-set', s === styleOf(it))).join('')}</div>
        ${styleOf(it) !== 'plain' ? `<span class="label">${styleOf(it) === 'marker' ? t('dk.markerColor') : t('dk.decoColor')}</span>${decoRow(decoOf(it))}` : ''}
        <p class="hint">${t('dk.textEditHint')}</p>`;
    } else if (it.type === 'photo') {
      extra = `<div class="seg small">${FRAMES.map((f) => `<button data-act="dk-item-set" data-k="frame" data-v="${f}" aria-pressed="${(it.frame || 'none') === f}">${t('dk.frame.' + f)}</button>`).join('')}</div>`;
    } else if (it.type === 'tape') {
      extra = `<div class="tape-picks">${TAPES.map((p) => `<button type="button" class="tape-pick" data-act="dk-item-set" data-k="pattern" data-v="${p}" aria-pressed="${it.pattern === p}"><span class="dk-tape tape-${p}" style="--tc:${esc(it.color)}"></span></button>`).join('')}</div>
        ${colorRow('dk-item-set', 'color', it.color, TAPE_COLORS)}`;
    }
    box.innerHTML = `
      <div class="sel-head"><b>${t('dk.selected')}</b><span class="muted small">${t('dk.type.' + it.type)}</span></div>
      <div class="sel-tools">
        <button class="btn small" data-act="dk-item-toggle" data-k="lock" aria-pressed="${!!it.lock}">${it.lock ? '🔒 ' + t('dk.unlock') : '🔓 ' + t('dk.lock')}</button>
        <button class="btn small" data-act="dk-order" data-v="front">${svg('up')}${t('dk.front')}</button>
        <button class="btn small" data-act="dk-order" data-v="back">${svg('down')}${t('dk.back')}</button>
        <button class="btn small" data-act="dk-item-toggle" data-k="under" aria-pressed="${!!it.under}">${t('dk.underText')}</button>
        <button class="btn small" data-act="dk-item-toggle" data-k="flip" aria-pressed="${!!it.flip}">${t('dk.flip')}</button>
        <button class="btn small" data-act="dk-item-toggle" data-k="shadow" aria-pressed="${!!it.shadow}">${t('dk.shadow')}</button>
        <button class="btn small" data-act="dk-dup">${t('dk.duplicate')}</button>
        <button class="btn small danger" data-act="dk-del-item">${t('c.delete')}</button>
      </div>
      <label><span class="label">${t('dk.opacity')}</span>${rangeRow('dk-item-num', 'op', 0.1, 1, 0.05, it.op == null ? 1 : it.op, '')}</label>
      ${extra}`;
  }

  /* ---------- 도구 상자 ---------- */
  function toolbox(e) {
    const tabs = ['sticker', 'photo', 'text', 'tape', 'body', 'paper'];
    let body = '';
    if (ui.dkTab === 'sticker') {
      body = `
        <div class="tb-sec">
          <div class="row" style="justify-content:space-between"><span class="label">${t('dk.myStickers')}</span><button class="btn small" data-act="dk-upload-sticker">${svg('upload')}${t('dk.upload')}</button></div>
          ${D().stickers.length ? `<div class="sticker-grid">${D().stickers.map((s) => `<div class="sticker-cell"><button type="button" class="sticker-btn" data-act="dk-add-sticker" data-id="${s.id}" title="${esc(s.name || '')}"><img data-asset="${esc(s.assetId)}" alt=""></button><button type="button" class="sticker-x" data-act="dk-del-sticker" data-id="${s.id}" aria-label="${t('c.delete')}">×</button></div>`).join('')}</div>` : `<p class="hint">${t('dk.myStickersHint')}</p>`}
        </div>`;
    } else if (ui.dkTab === 'photo') {
      body = `<div class="tb-sec"><button class="btn primary block" data-act="dk-upload-photo">${svg('image')}${t('dk.addPhoto')}</button><p class="hint">${t('dk.photoHint')}</p></div>`;
    } else if (ui.dkTab === 'text') {
      body = `<div class="tb-sec">
        <div class="ts-grid big">${TEXT_STYLES.map((s) => tsPreview(s, null, 'dk-add-text', false)).join('')}</div>
        <p class="hint">${t('dk.textHint')}</p></div>`;
    } else if (ui.dkTab === 'tape') {
      body = `<div class="tb-sec"><div class="tape-list">${TAPE_COLORS.flatMap((c, ci) => TAPES.filter((_, pi) => (ci + pi) % 2 === 0 || pi === 0).map((p) => `<button type="button" class="tape-pick wide" data-act="dk-add-tape" data-p="${p}" data-c="${c}"><span class="dk-tape tape-${p}" style="--tc:${c}"></span></button>`)).join('')}</div></div>`;
    } else if (ui.dkTab === 'body') {
      body = `
        ${e.layout === 'free' ? `<p class="hint" style="margin:0">${t('dk.freeDefaults')}</p>` : ''}
        <div class="tb-sec">
          <span class="label">${t('dk.bodyFont')}</span>
          <div class="row gap-xs"><select class="input select grow" data-change="dk-set-sel" data-k="font">${App.fontOptions(e.font)}</select><button class="btn small" data-act="font-add-file" title="${t('cu.fontFile')}">${svg('plus')}</button></div>
          <div class="grid-2">
            <label><span class="label">${t('dk.size')}</span>${rangeRow('dk-num', 'size', 12, 40, 1, e.size, 'px')}</label>
            <label><span class="label">${t('dk.lineH')}</span>${rangeRow('dk-num', 'lineH', 22, 56, 2, e.lineH, 'px')}</label>
            <label><span class="label">${t('dk.letter')}</span>${rangeRow('dk-num', 'letter', -2, 8, 0.5, e.letter, 'px')}</label>
            ${e.layout === 'free' ? '' : `<label><span class="label">${t('dk.titleSize')}</span>${rangeRow('dk-num', 'titleSize', 18, 44, 1, e.titleSize, 'px')}</label>`}
          </div>
          <div class="row wrap gap-xs">
            <div class="seg small">${['left', 'center', 'right'].map((a) => `<button data-act="dk-set" data-k="align" data-v="${a}" aria-pressed="${e.align === a}">${t('dk.al.' + a)}</button>`).join('')}</div>
            <button class="btn small" data-act="dk-set-toggle" data-k="bold" aria-pressed="${!!e.bold}"><b>B</b> ${t('dk.bold')}</button>
          </div>
          <span class="label">${t('dk.inkColor')}</span>
          ${colorRow('dk-set', 'color', e.color, ['', ...INK_COLORS])}
          <p class="hint">${t('dk.fontHint')}</p>
        </div>`;
    } else if (ui.dkTab === 'paper') {
      body = `
        <div class="tb-sec"><span class="label">${t('dk.layout')}</span>
          <div class="seg block">${['free', 'note'].map((l) => `<button data-act="dk-set" data-k="layout" data-v="${l}" aria-pressed="${e.layout === l}">${t('dk.layout.' + l)}</button>`).join('')}</div>
          <p class="hint" style="margin:0">${t('dk.layoutHint')}</p></div>
        <div class="tb-sec"><span class="label">${t('dk.paperStyle')}</span>
          <div class="paper-picks">${PAPERS.map((p) => `<button type="button" class="paper-pick paper-${p}" style="--pc:${esc(e.paperColor)}" data-act="dk-set" data-k="paper" data-v="${p}" aria-pressed="${e.paper === p}"><span>${t('dk.paper.' + p)}</span></button>`).join('')}</div></div>
        <div class="tb-sec"><span class="label">${t('dk.paperColor')}</span>
          ${colorRow('dk-set', 'paperColor', e.paperColor, PAPER_COLORS)}</div>
        <div class="tb-sec"><span class="label">${t('dk.paperImage')}</span>
          <div class="row gap-xs"><button class="btn small" data-act="dk-bg-img">${svg('image')}${e.bgImage ? t('cc.bgChange') : t('cc.bgPick')}</button>${e.bgImage ? `<button class="btn small ghost" data-act="dk-bg-del">${t('c.delete')}</button>` : ''}</div>
          ${e.bgImage ? `<label><span class="label">${t('dk.opacity')}</span>${rangeRow('dk-num', 'bgAlpha', 5, 100, 5, e.bgAlpha, '%')}</label>` : ''}
        </div>`;
    }
    return `
      ${e.layout === 'free' ? `<div class="tip">${t('dk.freeTip')}</div>` : `<div class="mode-switch">${['write', 'deco'].map((m) => `<button data-act="dk-mode" data-v="${m}" aria-pressed="${ui.dkMode === m}">${t('dk.mode.' + m)}</button>`).join('')}</div>`}
      <div class="sel-panel" id="dkSelPanel" hidden></div>
      <div class="tb-tabs">${tabs.map((k) => `<button data-act="dk-tab" data-v="${k}" aria-pressed="${ui.dkTab === k}">${t('dk.tab.' + k)}</button>`).join('')}</div>
      <section class="ed-sec">${body}</section>`;
  }

  /* ---------- 화면 ---------- */
  App.VIEWS.diary = function () {
    const list = sorted();
    if (!ui.diaryId || !cur()) ui.diaryId = list[0] ? list[0].id : null;
    const e = cur();
    if (!e) {
      return `<section class="view"><header class="view-head"><h2 class="view-title">${t('nav.diary')}</h2></header>
        <div class="card empty-card"><p>${t('diary.empty')}</p><button class="btn primary" data-act="diary-write" data-date="${todayStr()}">${t('home.writeDiary')}</button></div></section>`;
    }
    ensureShape(e);
    if (hist.id !== e.id) histCommit(true);
    const idx = list.findIndex((x) => x.id === e.id);
    const older = list[idx + 1], newer = list[idx - 1];
    const dark = e.paperColor === '#26282e';
    const ink = e.color || (dark ? '#eceef3' : '#2b2b2b');
    return `
    <section class="view diary-view">
      <header class="view-head dk-bar">
        <div class="row gap-xs wrap">
          <button class="icon-btn" data-act="diary-open" data-id="${older ? older.id : ''}" ${older ? '' : 'disabled'} aria-label="${t('c.prev')}">${svg('left')}</button>
          <input type="date" class="input date-input" data-change="diary-date" value="${e.date}" aria-label="${t('c.date')}">
          <button class="icon-btn" data-act="diary-open" data-id="${newer ? newer.id : ''}" ${newer ? '' : 'disabled'} aria-label="${t('c.next')}">${svg('right')}</button>
          <select class="input select emoji-select" data-change="diary-mood" aria-label="${t('diary.mood')}"><option value="">${t('diary.mood')}</option>${MOODS.map((m) => `<option ${e.mood === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <select class="input select emoji-select" data-change="diary-weather" aria-label="${t('diary.weather')}"><option value="">${t('diary.weather')}</option>${WEATHERS.map((m) => `<option ${e.weather === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
          <span class="bar-sep"></span>
          <button class="icon-btn" data-act="dk-undo" title="${t('dk.undo')}" ${hist.past.length ? '' : 'disabled'}>${svg('undo')}</button>
          <button class="icon-btn" data-act="dk-redo" title="${t('dk.redo')}" ${hist.future.length ? '' : 'disabled'}>${svg('redo')}</button>
        </div>
        <div class="row gap-xs wrap">
          <button class="btn small" data-act="diary-list">${t('diary.list')} <span class="muted">${list.length}</span></button>
          <button class="btn small" data-act="dk-export" data-how="copy" title="${t('dk.copyImg')}">${svg('copy')}</button>
          <button class="btn small" data-act="dk-export" data-how="save">${svg('down')}${t('dk.saveImg')}</button>
          <button class="btn small" data-act="diary-save">${svg('check')}${t('c.save')}</button>
          <button class="btn small primary" data-act="diary-new">${svg('plus')}${t('diary.new')}</button>
          <button class="icon-btn" data-act="diary-del" title="${t('c.delete')}">${svg('trash')}</button>
        </div>
      </header>
      <div class="dk-wrap mode-${mode()} layout-${e.layout}">
        <div class="dk-stage" id="dkStage">
          <div class="dk-scale" id="dkScale">
            <div class="dk-page paper-${e.paper} ${dark ? 'dark' : ''}" id="dkPage" style="--pc:${esc(e.paperColor)};--ink:${esc(ink)};--line-h:${e.lineH}px;font-family:${App.fontFamily(e.font)}">
              ${e.bgImage ? `<div class="dk-bgimg" style="opacity:${e.bgAlpha / 100}"><img data-asset="${esc(e.bgImage)}" alt=""></div>` : ''}
              <div class="dk-layer" id="dkUnder"></div>
              <div class="dk-head"><span>${fmt(e.date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span><span class="dk-mw">${esc(e.mood || '')} ${esc(e.weather || '')}</span></div>
              ${e.layout === 'free' ? (e.items.length ? '' : `<div class="dk-free-ph">${t('dk.freePh')}</div>`) : `<input class="dk-title" data-input="diary-title" value="${esc(e.title)}" placeholder="${esc(t('diary.titlePh'))}" style="font-size:${e.titleSize}px;text-align:${esc(e.align)};font-weight:${e.bold ? 700 : 400}">
              <textarea class="dk-body" data-input="diary-body" style="font-size:${e.size}px;letter-spacing:${e.letter}px;text-align:${esc(e.align)};font-weight:${e.bold ? 700 : 400}" placeholder="${esc(t('diary.bodyPh'))}">${esc(e.body)}</textarea>`}
              <div class="dk-layer" id="dkOver"></div>
            </div>
          </div>
          <p class="hint center">${e.layout === 'free' ? t('dk.freeHint') : ui.dkMode === 'write' ? t('dk.writeHint') : t('dk.decoHint')}</p>
        </div>
        <aside class="dk-tools">${toolbox(e)}</aside>
      </div>
    </section>`;
  };

  function fitPage() {
    const stage = App.$('#dkStage'), scale = App.$('#dkScale'), page = App.$('#dkPage');
    if (!stage || !scale || !page) return;
    const s = Math.min(1, stage.clientWidth / PAGE_W);
    ui.dkScale = s;
    page.style.transform = `scale(${s})`;
    scale.style.height = PAGE_H * s + 'px';
    scale.style.width = PAGE_W * s + 'px';
  }
  App.after.diary = function () {
    if (!cur()) return;
    fitPage();
    renderItems();
    undoBtns();
  };
  window.addEventListener('resize', () => { if (App.ui.view === 'diary') fitPage(); });

  /* ---------- 끌기·크기·회전 ---------- */
  let drag = null;
  document.addEventListener('pointerdown', (ev) => {
    const page = ev.target.closest && ev.target.closest('#dkPage');
    if (!page || mode() !== 'deco') return;
    const ae = document.activeElement;
    const wasEditing = !!(ae && ae.isContentEditable && page.contains(ae));
    if (wasEditing && !ae.contains(ev.target)) ae.blur();
    const itemEl = ev.target.closest('.dk-item');
    if (!itemEl) {
      if (ui.dkSel) { ui.dkSel = null; renderItems(); return; }
      // 자유 서식: 빈 곳을 누르면 그 자리에 바로 글쓰기
      if (free() && !wasEditing) {
        ev.preventDefault();
        const rect = page.getBoundingClientRect(), s = ui.dkScale || 1;
        const e = cur();
        const it = addItem({ type: 'text', text: '', style: 'plain', font: e.font || '', size: e.size || 22, color: e.color || '', bold: !!e.bold, align: e.align || 'left', letter: e.letter || 0, w: 420, r: 0, x: Math.round((ev.clientX - rect.left) / s), y: Math.round((ev.clientY - rect.top) / s - (e.size || 22) * 0.7) }, { quiet: true });
        setTimeout(() => startEdit(it), 0);
      }
      return;
    }
    if (ev.target.isContentEditable) return;
    const it = cur().items.find((i) => i.id === itemEl.dataset.iid);
    if (!it) return;
    const h = ev.target.dataset && ev.target.dataset.h;
    if (h === 'del') { ev.preventDefault(); removeItem(it.id); return; }
    ev.preventDefault();
    const wasSel = ui.dkSel === it.id;
    if (!wasSel) { ui.dkSel = it.id; renderItems(); }
    if (it.lock) return;
    const el = App.$(`[data-iid="${it.id}"]`);
    const r = el.getBoundingClientRect();
    drag = { it, mode: h || 'move', sx: ev.clientX, sy: ev.clientY, x: it.x, y: it.y, w: it.w, cx: r.left + r.width / 2, cy: r.top + r.height / 2, moved: false, wasSel };
    page.setPointerCapture(ev.pointerId);
  });
  document.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const s = ui.dkScale || 1;
    const dx = (ev.clientX - drag.sx) / s, dy = (ev.clientY - drag.sy) / s;
    const it = drag.it;
    if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
    if (drag.mode === 'move') {
      it.x = Math.round(Math.max(-it.w / 2, Math.min(PAGE_W - it.w / 2, drag.x + dx)));
      it.y = Math.round(Math.max(-40, Math.min(PAGE_H - 30, drag.y + dy)));
    } else if (drag.mode === 'size') {
      const rad = ((it.r || 0) * Math.PI) / 180;
      const along = dx * Math.cos(rad) + dy * Math.sin(rad);
      it.w = Math.round(Math.max(24, Math.min(PAGE_W, drag.w + along)));
    } else if (drag.mode === 'rot') {
      let a = (Math.atan2(ev.clientY - drag.cy, ev.clientX - drag.cx) * 180) / Math.PI + 90;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      it.r = Math.round(a);
    }
    updateItemDom(it);
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) touch();
    // 이미 선택된 글상자를 한 번 더 누르면 바로 고치기
    else if (d.wasSel && d.mode === 'move' && d.it.type === 'text') startEdit(d.it);
  });

  // 글상자 고치기 (글자 그대로만 붙여넣기)
  function startEdit(it) {
    if (!it || it.lock) return;
    const node = App.$(`[data-iid="${it.id}"]`);
    const box = node && node.querySelector('.dk-text');
    if (!box) return;
    ui.dkSel = it.id;
    node.classList.add('editing');
    try { box.contentEditable = 'plaintext-only'; } catch (e) { box.contentEditable = 'true'; }
    if (box.contentEditable !== 'plaintext-only') box.contentEditable = 'true';
    box.focus();
    const range = document.createRange(); range.selectNodeContents(box);
    if (it.text) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(range); }
    else { range.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(range); }
    const save = () => { it.text = box.innerText.replace(/\n$/, ''); touch(); };
    box.addEventListener('input', save);
    box.addEventListener('blur', () => {
      box.contentEditable = 'false';
      node.classList.remove('editing');
      save();
      if (!it.text.trim()) removeItem(it.id);
    }, { once: true });
  }
  document.addEventListener('dblclick', (ev) => {
    if (mode() !== 'deco') return;
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const itemEl = hit && hit.closest && hit.closest('.dk-item.t-text');
    if (!itemEl) return;
    startEdit(cur().items.find((i) => i.id === itemEl.dataset.iid));
  });

  // 붙여넣기: 글은 글상자로, 사진은 사진으로
  document.addEventListener('paste', async (ev) => {
    if (App.ui.view !== 'diary' || !cur()) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if (!App.$('#modalLayer').hidden) return;
    const cd = ev.clipboardData;
    if (!cd) return;
    const file = [...cd.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      ev.preventDefault();
      const blob = await Assets.shrinkImage(file, 1400, file.type === 'image/png');
      const id = 'p_' + uid();
      await Assets.put(id, blob);
      addItem({ type: 'photo', assetId: id, frame: 'none', w: 300, r: 0 });
      return;
    }
    const text = cd.getData('text/plain');
    if (text && text.trim()) {
      ev.preventDefault();
      const e = cur();
      addItem({ type: 'text', text: text.trim(), style: 'plain', font: e.font || '', size: e.size || 20, color: e.color || '', bold: !!e.bold, align: e.align || 'left', letter: e.letter || 0, w: 520, r: 0 });
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (App.ui.view !== 'diary') return;
    const a = document.activeElement;
    const typing = a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    if (!App.$('#modalLayer').hidden) return;
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && !typing && (ev.key === 'z' || ev.key === 'Z' || ev.key === 'y')) {
      ev.preventDefault();
      if (ev.key === 'y' || ev.shiftKey) redo(); else undo();
      return;
    }
    if (mode() !== 'deco' || !ui.dkSel || typing) return;
    const it = selItem();
    if (!it) return;
    if (ev.key === 'Escape') { ui.dkSel = null; renderItems(); return; }
    if (it.lock) return;
    const step = ev.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeItem(it.id); }
    else if (moves[ev.key]) { ev.preventDefault(); it.x += moves[ev.key][0]; it.y += moves[ev.key][1]; updateItemDom(it); touch(); }
  });

  /* ---------- 항목 추가·삭제 ---------- */
  function spawnPos(w) {
    const main = App.$('#main'), page = App.$('#dkPage');
    const s = ui.dkScale || 1;
    let y = 200;
    if (main && page) {
      const pr = page.getBoundingClientRect(), mr = main.getBoundingClientRect();
      y = ((mr.top + mr.height / 2) - pr.top) / s - w / 2;
    }
    return { x: Math.round((PAGE_W - w) / 2 + rand(-60, 60)), y: Math.round(Math.max(20, Math.min(PAGE_H - w - 20, y + rand(-40, 40)))) };
  }
  function addItem(partial, opts = {}) {
    const e = cur();
    if (!e) return;
    ensureShape(e);
    const z = e.items.reduce((m, i) => Math.max(m, i.z || 1), 0) + 1;
    const it = { id: uid(), r: 0, z, ...partial };
    Object.assign(it, spawnPos(it.w), partial.x != null ? { x: partial.x, y: partial.y } : {});
    e.items.push(it);
    ui.dkSel = it.id;
    if (mode() !== 'deco') { ui.dkMode = 'deco'; touch(); App.renderMain(); return it; }
    if (opts.quiet) { const ph = App.$('.dk-free-ph'); if (ph) ph.remove(); }
    touch();
    renderItems();
    return it;
  }
  function removeItem(id) {
    const e = cur();
    const it = e.items.find((i) => i.id === id);
    e.items = e.items.filter((i) => i.id !== id);
    if (ui.dkSel === id) ui.dkSel = null;
    touch();
    renderItems();
    // 사진 파일은 실행 취소할 수 있게 남겨두고, 다이어리를 지울 때 정리
    void it;
  }

  function newEntry(date) {
    const e = ensureShape({ id: uid(), date, layout: 'free', title: '', body: '', mood: '', weather: '', font: '', size: 22, color: '', paper: 'lined', paperColor: '#ffffff', items: [], updatedAt: nowISO() });
    App.silent((d) => d.diary.push(e));
    return e;
  }
  App.writeDiary = function (date) {
    // 그 날짜에 쓴 게 있으면 가장 최근 것을 열고, 없으면 새로
    let e = D().diary.filter((x) => x.date === date).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    if (!e) e = newEntry(date);
    cleanup(e.id);
    ui.diaryId = e.id;
    ui.dkSel = null;
    App.go('diary');
    setTimeout(() => { const b = App.$('.dk-body'); if (b && !b.value && ui.dkMode === 'write') b.focus(); }, 0);
  };
  function cleanup(exceptId) {
    App.silent((d) => {
      d.diary = d.diary.filter((x) => x.id === exceptId || (x.title || '').trim() || (x.body || '').trim() || x.mood || x.weather || (x.items && x.items.length) || x.bgImage);
    });
  }
  App.onLeave = App.onLeave || {};
  App.onLeave.diary = () => { ui.dkSel = null; cleanup(null); };

  async function exportPage(how) {
    const page = App.$('#dkPage');
    if (!page) return;
    ui.dkSel = null; renderItems();
    const fields = App.$$('.dk-title, .dk-body', page);
    const ph = fields.map((f) => f.getAttribute('placeholder'));
    fields.forEach((f) => f.removeAttribute('placeholder'));
    const e = cur();
    try {
      await App.exportNode(page, how, `${t('nav.diary')}-${e.date}.png`, { pixelRatio: 2, width: PAGE_W, height: PAGE_H });
    } finally {
      fields.forEach((f, i) => ph[i] && f.setAttribute('placeholder', ph[i]));
    }
  }

  /* ---------- 행동 ---------- */
  const set = (k, v) => { const e = cur(); e[k] = v; touch(); App.renderMain(); };
  Object.assign(App.A, {
    'diary-write': (el) => App.writeDiary(el.dataset.date),
    'diary-save': () => { touch(); histCommit(true); App.toast(t('diary.saved')); },
    'diary-new': (el) => {
      const prev = cur();
      if (prev) touch();
      const e = newEntry((el && el.dataset.date) || todayStr());
      cleanup(e.id);
      ui.diaryId = e.id; ui.dkSel = null;
      App.ui.view === 'diary' ? App.renderMain() : App.go('diary');
      App.toast(t('diary.newMade'));
    },
    'diary-open': (el) => {
      if (!el.dataset.id) return;
      cleanup(el.dataset.id);
      ui.diaryId = el.dataset.id; ui.dkSel = null;
      App.closeModal({ noRender: true });
      App.ui.view === 'diary' ? App.renderMain() : App.go('diary');
    },
    'diary-del': async () => {
      const e = cur();
      if (!e) return;
      if (await App.confirmBox(t('c.confirmDelete'))) {
        const files = [...(e.items || []).filter((i) => i.type === 'photo').map((i) => i.assetId), e.bgImage].filter(Boolean);
        App.update((d) => { d.diary = d.diary.filter((x) => x.id !== e.id); });
        files.forEach((id) => { if (!D().diary.some((d) => d.bgImage === id || (d.items || []).some((i) => i.assetId === id))) Assets.del(id); });
        ui.diaryId = null;
        App.renderMain();
        App.toast(t('c.deleted'));
      }
    },
    'diary-list': () => {
      const list = sorted();
      let last = '';
      App.openModal(`<h3 class="modal-title">${t('diary.list')}</h3>
        <ul class="diary-list">${list.map((x) => {
          const mon = x.date.slice(0, 7);
          const head = mon !== last ? `<li class="group-label">${fmt(x.date, { year: 'numeric', month: 'long' })}</li>` : '';
          last = mon;
          return head + `<li><button type="button" data-act="diary-open" data-id="${x.id}" aria-current="${x.id === ui.diaryId}"><span class="dd">${App.parse(x.date).getDate()}</span><span>${esc(x.mood || '·')}</span><span class="tt">${esc(x.title || (x.body || '').slice(0, 30) || t('c.untitled'))}</span></button></li>`;
        }).join('')}</ul>
        <div class="modal-actions"><span></span><button class="btn" data-act="modal-close">${t('c.close')}</button></div>`, null, 'small');
    },
    'dk-undo': undo,
    'dk-redo': redo,
    'dk-export': (el) => exportPage(el.dataset.how),
    'dk-mode': (el) => { ui.dkMode = el.dataset.v; if (ui.dkMode === 'write') ui.dkSel = null; App.renderMain(); },
    'dk-tab': (el) => { ui.dkTab = el.dataset.v; App.renderMain(); },
    'dk-add-sticker': (el) => { const s = D().stickers.find((x) => x.id === el.dataset.id); if (s) addItem({ type: 'sticker', assetId: s.assetId, w: 140, r: rand(-8, 8) }); },
    'dk-add-tape': (el) => addItem({ type: 'tape', pattern: el.dataset.p, color: el.dataset.c, w: 220, r: rand(-10, 10) }),
    'dk-add-text': (el) => {
      const e = cur();
      addItem({ type: 'text', text: t('dk.sampleText'), style: el.dataset.v, font: e.font || '', size: 26, color: '', w: 240, r: 0 });
    },
    'dk-upload-photo': async () => {
      const files = await App.pickFiles('image/*', true);
      for (const f of files) {
        const blob = await Assets.shrinkImage(f, 1400, false);
        const id = 'p_' + uid();
        await Assets.put(id, blob);
        addItem({ type: 'photo', assetId: id, frame: 'polaroid', w: 260, r: rand(-6, 6) });
      }
    },
    'dk-upload-sticker': async () => {
      const picked = await App.pickFiles('image/png,image/gif', true);
      const files = picked.filter((f) => f.type === 'image/png' || f.type === 'image/gif' || /\.(png|gif)$/i.test(f.name));
      if (picked.length > files.length) App.toast(t('dk.stickerOnly'));
      for (const f of files) {
        const blob = f.type === 'image/gif' ? f : await Assets.shrinkImage(f, 800, true);
        const id = 's_' + uid();
        await Assets.put(id, blob);
        App.silent((d) => d.stickers.push({ id: uid(), assetId: id, name: f.name }));
      }
      if (files.length) { App.renderMain(); App.toast(t('dk.stickersAdded', { n: files.length })); }
    },
    'dk-del-sticker': async (el) => {
      const s = D().stickers.find((x) => x.id === el.dataset.id);
      if (!s || !(await App.confirmBox(t('dk.delSticker')))) return;
      App.silent((d) => { d.stickers = d.stickers.filter((x) => x.id !== s.id); });
      const used = D().diary.some((d) => (d.items || []).some((i) => i.assetId === s.assetId)) || ((D().chat && D().chat.draft && D().chat.draft.stickers) || []).some((x) => x.assetId === s.assetId);
      if (!used) Assets.del(s.assetId);
      App.renderMain();
    },
    'dk-bg-img': async () => {
      const [f] = await App.pickFiles('image/*');
      if (!f) return;
      const blob = await Assets.shrinkImage(f, 1600, false);
      const id = 'b_' + uid();
      await Assets.put(id, blob);
      set('bgImage', id);
    },
    'dk-bg-del': () => set('bgImage', ''),
    'dk-set': (el) => set(el.dataset.k, el.dataset.v),
    'dk-set-toggle': (el) => { const e = cur(); set(el.dataset.k, !e[el.dataset.k]); },
    'dk-item-set': (el) => {
      const it = selItem();
      if (!it) return;
      if (el.dataset.k === 'style' && styleOf(it) !== el.dataset.v) delete it.deco;
      it[el.dataset.k] = el.dataset.v;
      touch();
      renderItems();
    },
    'dk-item-toggle': (el) => {
      const it = selItem();
      if (!it) return;
      it[el.dataset.k] = !it[el.dataset.k];
      touch();
      renderItems();
    },
    'dk-order': (el) => {
      const e = cur(), it = selItem();
      if (!it) return;
      const zs = e.items.map((i) => i.z || 1);
      it.z = el.dataset.v === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
      touch(); renderItems();
    },
    'dk-dup': () => {
      const it = selItem();
      if (!it) return;
      const copy = JSON.parse(JSON.stringify(it));
      delete copy.id; copy.lock = false;
      addItem({ ...copy, x: it.x + 24, y: it.y + 24 });
    },
    'dk-del-item': () => { if (ui.dkSel) removeItem(ui.dkSel); }
  });

  Object.assign(App.C, {
    'diary-date': (el) => { if (el.value) { cur().date = el.value; touch(); App.renderMain(); } },
    'diary-mood': (el) => { cur().mood = el.value; touch(); App.renderMain(); },
    'diary-weather': (el) => { cur().weather = el.value; touch(); App.renderMain(); },
    'dk-set-sel': (el) => set(el.dataset.k, el.value),
    'dk-item-sel': (el) => { const it = selItem(); if (!it) return; it[el.dataset.k] = el.value; touch(); renderItems(); }
  });

  const showOut = (el, v) => { const o = el.parentElement && el.parentElement.querySelector('output'); if (o) o.textContent = v + ((o.textContent.match(/[a-z%°]+$/i) || [''])[0]); };
  Object.assign(App.I, {
    'diary-title': (el) => { cur().title = el.value; touch(); },
    'diary-body': (el) => { cur().body = el.value; touch(); },
    'dk-num': (el) => {
      const e = cur(); const k = el.dataset.k; const v = Number(el.value);
      e[k] = v; touch(); showOut(el, v);
      const page = App.$('#dkPage'), body = App.$('.dk-body'), title = App.$('.dk-title'), bg = App.$('.dk-bgimg');
      if (k === 'size' && body) body.style.fontSize = v + 'px';
      if (k === 'letter' && body) body.style.letterSpacing = v + 'px';
      if (k === 'lineH' && page) page.style.setProperty('--line-h', v + 'px');
      if (k === 'titleSize' && title) title.style.fontSize = v + 'px';
      if (k === 'bgAlpha' && bg) bg.style.opacity = v / 100;
    },
    'dk-color': (el) => { const e = cur(); e[el.dataset.k] = el.value; touch(); const page = App.$('#dkPage'); if (page) { if (el.dataset.k === 'color') page.style.setProperty('--ink', el.value); else page.style.setProperty('--pc', el.value); } },
    'dk-item-num': (el) => {
      const it = selItem(); if (!it) return;
      const v = Number(el.value); it[el.dataset.k] = v; touch(); showOut(el, v);
      const node = App.$(`[data-iid="${it.id}"]`);
      if (!node) return;
      if (el.dataset.k === 'op') node.style.opacity = v;
      const box = node.querySelector('.dk-text');
      if (box && el.dataset.k === 'size') box.style.fontSize = v + 'px';
      if (box && el.dataset.k === 'letter') box.style.letterSpacing = v + 'px';
      if (box && el.dataset.k === 'lh') box.style.lineHeight = v;
      if (el.dataset.k === 'w') updateItemDom(it);
    },
    'dk-item-color': (el) => {
      const it = selItem(); if (!it) return;
      it[el.dataset.k] = el.value; touch();
      const node = App.$(`[data-iid="${it.id}"]`); if (!node) return;
      const box = node.querySelector('.dk-text'); if (box && el.dataset.k !== 'deco') box.style.color = el.value;
      if (el.dataset.k === 'deco') { if (box) box.style.setProperty('--deco', el.value); return; }
      const tp = node.querySelector('.dk-tape'); if (tp) tp.style.setProperty('--tc', el.value);
    }
  });
})(window.App);
