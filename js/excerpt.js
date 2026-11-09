// 발췌기 — AI 채팅 로그를 카드 이미지로 (줄글 / 대화)
(function (App) {
  const { t, esc, svg, uid, nowISO } = App;
  const ui = App.ui;
  ui.ccTab = 0;          // 대화 상대 탭
  ui.ccPane = 'text';    // 오른쪽 설정 탭
  ui.ccZoom = 'fit';     // fit | 숫자(%)
  ui.ccHi = false;       // 2배 크기로 저장

  const CARD_W = 1080;
  const RATIOS = { '1:1': 1, '4:5': 1.25, '3:4': 4 / 3, '9:16': 16 / 9, '16:9': 9 / 16, '3:1': 1 / 3 };
  const THEMES = ['bubble', 'line', 'novel', 'card'];
  const OLD_THEME = { messenger: 'bubble', timeline: 'line', terminal: 'novel', script: 'card' };
  const PATTERNS = ['dot', 'check', 'diagonal', 'grid', 'heart'];
  const BUBBLES = ['#ffffff', '#f1efe9', '#fff1b8', '#d6ecfb', '#ffdfe8', '#dcf3e1', '#ebe2ff', '#33363d', '#3c8dbc'];
  const INKS = ['#26282d', '#3d4451', '#7a7f89', '#ffffff', '#8a5a2b', '#3c6e9c'];

  const defaultProfile = (i) => ({
    name: [t('cc.p1'), t('cc.p2'), 'P3', 'P4', 'P5', 'P6'][i],
    side: i === 1 ? 'right' : 'left',
    avatar: '',
    bubble: ['#f1efe9', '#d6ecfb', '#ffdfe8', '#dcf3e1', '#fff1b8', '#ebe2ff'][i],
    ink: '#26282d'
  });
  const DEFAULT = () => ({
    mode: 'plain', text: '',
    theme: 'bubble', profiles: [0, 1, 2, 3, 4, 5].map(defaultProfile), showName: true, showAvatar: true,
    font: 'b:pretendard', size: 32, letter: 0, lineH: 1.75, ink: '#26282d', align: 'left', vAlign: 'center',
    ratio: '4:5', fit: 'auto', pad: 90,
    bg: { type: 'solid', color: '#faf8f4', c1: '#fdf6ec', c2: '#e4eefb', angle: 160, radial: false, pattern: 'dot', pColor: '#c9bfae', pSize: 28, pAlpha: 30, image: '', blur: 0, overlay: '#000000', overlayA: 0, zoom: 100, html: '' },
    photos: []
  });
  const DROP = ['title', 'subtitle', 'credit', 'creditAlign', 'border', 'corner', 'stickers', 'dlgBold', 'dlgColor', 'narItalic', 'narColor', 'narStars'];

  function cc() {
    const D = App.D;
    if (!D.chat) D.chat = { draft: null, presets: [], saved: [] };
    if (!D.chat.draft) D.chat.draft = DEFAULT();
    const d = D.chat.draft, base = DEFAULT();
    DROP.forEach((k) => { delete d[k]; });
    if (OLD_THEME[d.theme]) d.theme = OLD_THEME[d.theme];
    for (const k of Object.keys(base)) if (d[k] == null) d[k] = base[k];
    for (const k of Object.keys(base.bg)) if (d.bg[k] == null) d.bg[k] = base.bg[k];
    while (d.profiles.length < 6) d.profiles.push(defaultProfile(d.profiles.length));
    return d;
  }
  const save = () => App.silent(() => {});
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const tgt = ks.reduce((a, k) => a[k], o); tgt[last] = v; };

  /* ---------- 본문 그리기 (글자는 쓴 그대로) ---------- */
  const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function inline(s, d) {
    return escText(s)
      .replace(/\*([^*\n]+)\*/g, '<span class="cc-nar">$1</span>') // 지문 (별표는 카드에 안 보여요)
      .replace(/\[사진(\d+)\]/g, (_, n) => photoTag(d, Number(n)));
  }
  function photoTag(d, n) {
    const id = d.photos[n - 1];
    return id ? `<img class="cc-photo" data-asset="${esc(id)}" alt="">` : `<span class="cc-missing">[${t('cc.photo')}${n}]</span>`;
  }

  function renderPlain(d) {
    let html = '', para = [];
    const flush = () => { if (para.length) { html += `<p>${para.join('<br>')}</p>`; para = []; } };
    for (const raw of d.text.split('\n')) {
      const line = raw.trimEnd();
      if (!line.trim()) { flush(); continue; }
      para.push(inline(line, d));
    }
    flush();
    return html;
  }

  function speakerOf(line, d) {
    let m = line.match(/^\[([1-6])\]\s*/);
    if (m) return { p: Number(m[1]) - 1, rest: line.slice(m[0].length) };
    m = line.match(/^([^:：\s][^:：]{0,20}?)\s*[:：]\s?/);
    if (m) {
      const name = m[1].trim();
      const i = d.profiles.findIndex((p) => p.name && p.name.trim() === name);
      if (i >= 0) return { p: i, rest: line.slice(m[0].length) };
    }
    return null;
  }

  function renderChat(d) {
    const items = [];
    let last = null, prevBlank = true;
    for (const raw of d.text.split('\n')) {
      const line = raw.trim();
      if (!line) { prevBlank = true; last = null; continue; }
      const sp = speakerOf(line, d);
      if (sp) { last = { k: 'msg', p: sp.p, lines: [sp.rest] }; items.push(last); }
      else if (last && !prevBlank) last.lines.push(line);
      else { items.push({ k: 'aside', text: line }); last = null; }
      prevBlank = false;
    }
    let prevP = -1;
    return items.map((it) => {
      if (it.k === 'aside') { prevP = -1; return `<div class="cc-aside">${inline(it.text, d)}</div>`; }
      const p = d.profiles[it.p];
      const cont = prevP === it.p;
      prevP = it.p;
      const body = it.lines.map((l) => inline(l, d)).join('<br>');
      const onlyPhoto = it.lines.length === 1 && /^\[사진\d+\]$/.test(it.lines[0].trim());
      const useAv = d.showAvatar && (d.theme === 'bubble' || d.theme === 'card');
      const av = useAv ? (cont ? '<div class="cc-av spacer"></div>' : `<div class="cc-av" style="background:${esc(p.bubble)}">${p.avatar ? `<img data-asset="${esc(p.avatar)}" alt="">` : esc((p.name || '?').charAt(0))}</div>`) : '';
      const name = d.showName && (!cont || d.theme === 'novel') ? `<div class="cc-name">${esc(p.name)}</div>` : '';
      return `<div class="cc-msg side-${p.side} ${cont ? 'cont' : ''} ${onlyPhoto ? 'photo-only' : ''}" style="--bc:${esc(p.bubble)};--bi:${esc(p.ink)}">
        ${av}<div class="cc-col">${name}<div class="cc-bubble">${body}</div></div></div>`;
    }).join('');
  }

  /* ---------- 카드 ---------- */
  function patternCSS(b) {
    const c = `color-mix(in srgb, ${b.pColor} ${b.pAlpha}%, transparent)`;
    const s = b.pSize;
    if (b.pattern === 'dot') return `background-image:radial-gradient(${c} ${s * 0.12}px, transparent ${s * 0.12 + 0.6}px);background-size:${s}px ${s}px;`;
    if (b.pattern === 'check') return `background-image:conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0);background-size:${s * 2}px ${s * 2}px;`;
    if (b.pattern === 'diagonal') return `background-image:repeating-linear-gradient(45deg, ${c} 0 ${s * 0.25}px, transparent ${s * 0.25}px ${s * 0.6}px);`;
    if (b.pattern === 'grid') return `background-image:linear-gradient(${c} 1.5px, transparent 1.5px),linear-gradient(90deg, ${c} 1.5px, transparent 1.5px);background-size:${s}px ${s}px;`;
    if (b.pattern === 'heart') {
      // style="..." 안에 들어가니 따옴표·괄호까지 전부 인코딩해야 하트가 떠요
      const col = /^#[0-9a-f]{3,8}$/i.test(b.pColor || '') ? b.pColor : '#e58fa8';
      const svgH = `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 24 24'><path fill='${col}' fill-opacity='${b.pAlpha / 100}' d='M12 20.5s-7.5-4.8-7.5-10.2A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.7c0 5.4-7.5 10.2-7.5 10.2z'/></svg>`;
      const enc = encodeURIComponent(svgH).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
      return `background-image:url(data:image/svg+xml,${enc});background-size:${s}px ${s}px;`;
    }
    return '';
  }

  function cardHTML() {
    const d = cc();
    const h = d.fit === 'fixed' ? Math.round(CARD_W * (RATIOS[d.ratio] || 1)) : null;
    const minH = d.fit === 'auto' ? Math.round(CARD_W * Math.min(RATIOS[d.ratio] || 1, 1.25)) : null;
    const b = d.bg;
    const body = d.mode === 'chat' ? renderChat(d) : renderPlain(d);
    const bgc = b.type === 'gradient' ? (b.radial ? `radial-gradient(circle at center, ${b.c1}, ${b.c2})` : `linear-gradient(${b.angle}deg, ${b.c1}, ${b.c2})`) : b.color;
    return `
    <div class="cc-card th-${esc(d.theme)} mode-${esc(d.mode)}" id="ccCard"
      style="width:${CARD_W}px;${h ? `height:${h}px;` : `min-height:${minH}px;`}--pad:${d.pad}px;font-family:${App.fontFamily(d.font)};font-size:${d.size}px;letter-spacing:${d.letter}px;line-height:${d.lineH};color:${esc(d.ink)};text-align:${esc(d.align)};background:${esc(bgc)}">
      ${b.type === 'pattern' ? `<div class="cc-layer" style="${patternCSS(b)}"></div>` : ''}
      ${b.type === 'image' && b.image ? `<div class="cc-layer cc-bgimg" style="filter:blur(${b.blur}px);transform:scale(${b.zoom / 100 + (b.blur ? 0.06 : 0)})"><img data-asset="${esc(b.image)}" alt=""></div><div class="cc-layer" style="background:${esc(b.overlay)};opacity:${b.overlayA / 100}"></div>` : ''}
      ${b.type === 'html' && b.html ? `<div class="cc-layer cc-html">${App.sanitizeHTML(b.html)}</div>` : ''}
      <div class="cc-inner v-${esc(d.vAlign)}">
        <div class="cc-body">${body || `<p class="cc-placeholder">${t('cc.placeholder')}</p>`}</div>
      </div>
    </div>`;
  }

  function fitStage() {
    const stage = App.$('#ccStage .clip-scroll'), wrap = App.$('#ccScale'), card = App.$('#ccCard');
    if (!stage || !wrap || !card) return;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const aw = stage.clientWidth - 56, ah = stage.clientHeight - 56;
    let s = ui.ccZoom === 'fit' ? Math.min(aw / cw, ah / ch, 1) : ui.ccZoom / 100;
    s = Math.max(0.1, s);
    ui.ccScale = s;
    card.style.transform = `scale(${s})`;
    wrap.style.width = cw * s + 'px';
    wrap.style.height = ch * s + 'px';
    const z = App.$('#ccZoomVal'); if (z) z.textContent = Math.round(s * 100) + '%';
    const warn = App.$('#ccOverflow');
    if (warn) { const inner = card.querySelector('.cc-inner'); warn.hidden = !(cc().fit === 'fixed' && inner && inner.scrollHeight > inner.clientHeight + 2); }
    const sz = App.$('#ccSize'); if (sz) sz.textContent = `${cw} × ${ch}`;
  }
  function renderCard() {
    const wrap = App.$('#ccScale');
    if (!wrap) return;
    wrap.innerHTML = cardHTML();
    App.hydrateAssets(wrap);
    fitStage();
    App.$$('img', wrap).forEach((img) => { if (!img.complete) img.addEventListener('load', fitStage, { once: true }); });
  }
  App.ccRefresh = renderCard;

  /* ---------- 설정 ---------- */
  const group = (title, body) => `<div class="clip-group">${title ? `<div class="clip-gt">${title}</div>` : ''}${body}</div>`;
  const range = (k, min, max, step, val, unit = '') => `<div class="range-row"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-input="cc" data-k="${k}"><output>${val}${unit}</output></div>`;
  const colorRow = (k, val, presets) => `<div class="colors">${presets.map((c) => `<button type="button" class="color-dot" style="background:${c}" data-act="cc-set" data-k="${k}" data-v="${c}" aria-pressed="${val === c}" aria-label="${c}"></button>`).join('')}<label class="color-pick ${presets.includes(val) ? '' : 'on'}" title="${t('cc.pickColor')}"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(val) ? val : '#000000'}" data-input="cc" data-k="${k}"><span>${t('cc.custom')}</span></label></div>`;
  const chips = (k, val, opts) => `<div class="clip-chips">${opts.map(([v, label]) => `<button type="button" data-act="cc-set" data-k="${k}" data-v="${v}" aria-pressed="${String(val) === String(v)}">${label}</button>`).join('')}</div>`;
  const toggle = (k, val, label) => `<label class="switch small"><input type="checkbox" data-change="cc" data-k="${k}" ${val ? 'checked' : ''}><span class="sw-track"></span>${label}</label>`;

  function panes(d) {
    const list = [['text', t('cc.body')]];
    if (d.mode === 'chat') list.push(['chat', t('cc.chatSet')]);
    list.push(['photo', t('cc.photos')], ['card', t('cc.cardSec')], ['bg', t('cc.bgSec')], ['preset', t('cc.presets')]);
    if (!list.some(([k]) => k === ui.ccPane)) ui.ccPane = 'text';
    return list;
  }

  function paneBody(d) {
    const p = d.profiles[ui.ccTab] || d.profiles[0];
    if (ui.ccPane === 'text') return `
      ${group('', `<textarea class="input clip-text" id="ccText" rows="10" data-input="cc" data-k="text" spellcheck="false" placeholder="${esc(d.mode === 'chat' ? t('cc.textPhChat') : t('cc.textPh'))}">${esc(d.text)}</textarea>
        <div class="clip-fmt"><button type="button" class="btn small" data-act="cc-nar" title="${t('cc.narHint')}"><i>${t('cc.narMark')}</i></button><button type="button" class="btn small ghost" data-act="cc-nar-off">${t('cc.narOff')}</button><span class="muted small">${t('cc.narHint')}</span></div>
        <div class="row gap-xs wrap"><button class="btn small ghost" data-act="cc-clear">${t('cc.clearText')}</button></div>`)}
      ${group(t('cc.font'), `<div class="row gap-xs"><select class="input select grow" data-change="cc" data-k="font">${App.fontOptions(d.font)}</select><button class="btn small" data-act="font-add-file" title="${t('cu.fontFile')}">${svg('plus')}${t('cc.myFont')}</button></div>
        <div class="grid-2">
          <label><span class="label">${t('cc.size')}</span>${range('size', 16, 72, 1, d.size, 'px')}</label>
          <label><span class="label">${t('cc.letter')}</span>${range('letter', -3, 8, 0.5, d.letter, 'px')}</label>
          <label><span class="label">${t('cc.lineH')}</span>${range('lineH', 1, 2.6, 0.05, d.lineH)}</label>
        </div>`)}
      ${group(t('cc.ink'), colorRow('ink', d.ink, INKS))}
      ${group(t('cc.align'), chips('align', d.align, [['left', t('cc.alignL')], ['center', t('cc.alignC')], ['justify', t('cc.alignJ')]]))}`;
    if (ui.ccPane === 'chat') return `
      ${group(t('cc.theme'), `<div class="clip-themes">${THEMES.map((x) => `<button type="button" data-act="cc-set" data-k="theme" data-v="${x}" aria-pressed="${d.theme === x}"><span class="th-mini th-mini-${x}"><i></i><i></i></span>${t('cc.th.' + x)}</button>`).join('')}</div>`)}
      ${group(t('cc.people'), `<div class="p-tabs">${d.profiles.map((x, i) => `<button data-act="cc-tab" data-i="${i}" aria-pressed="${ui.ccTab === i}"><span class="p-dot" style="background:${esc(x.bubble)}"></span>${esc(x.name || 'P' + (i + 1))}</button>`).join('')}</div>
        <div class="p-edit">
          <div class="row gap-s">
            <button class="cc-av big" style="background:${esc(p.bubble)}" data-act="cc-avatar" title="${t('cc.avatar')}">${p.avatar ? `<img data-asset="${esc(p.avatar)}" alt="">` : esc((p.name || '?').charAt(0))}</button>
            <div class="grow stack-s" style="margin:0">
              <input class="input" data-input="cc" data-k="profiles.${ui.ccTab}.name" value="${esc(p.name)}" placeholder="${esc(t('cc.pname'))}">
              <div class="row gap-xs">${chips(`profiles.${ui.ccTab}.side`, p.side, [['left', t('cc.left')], ['right', t('cc.right')]])}${p.avatar ? `<button class="btn small ghost" data-act="cc-avatar-del">${t('cc.avatarDel')}</button>` : ''}</div>
            </div>
          </div>
          <span class="label">${t('cc.bubble')}</span>${colorRow(`profiles.${ui.ccTab}.bubble`, p.bubble, BUBBLES)}
          <span class="label">${t('cc.bubbleInk')}</span>${colorRow(`profiles.${ui.ccTab}.ink`, p.ink, INKS)}
        </div>
        <p class="hint" style="margin:0">${t('cc.chatHow')}</p>`)}
      ${group('', `<div class="row wrap gap-m">${toggle('showName', d.showName, t('cc.showName'))}${toggle('showAvatar', d.showAvatar, t('cc.showAvatar'))}</div>`)}`;
    if (ui.ccPane === 'photo') return group('', `
        <button class="btn block" data-act="cc-photo-add">${svg('image')}${t('cc.photoAdd')}</button>
        ${d.photos.length ? `<div class="thumbs">${d.photos.map((id, i) => `<div class="thumb"><button type="button" data-act="cc-photo-ins" data-n="${i + 1}" title="${t('cc.photoIns')}"><img data-asset="${esc(id)}" alt=""><span>${i + 1}</span></button><button type="button" class="thumb-x" data-act="cc-photo-del" data-n="${i}" aria-label="${t('c.delete')}">×</button></div>`).join('')}</div>` : ''}
        <p class="hint" style="margin:0">${t('cc.photoTip')}</p>`);
    if (ui.ccPane === 'card') return `
      ${group(t('cc.ratio'), chips('ratio', d.ratio, Object.keys(RATIOS).map((r) => [r, r])))}
      ${group(t('cc.height'), chips('fit', d.fit, [['auto', t('cc.fitAuto')], ['fixed', t('cc.fitFixed')]]))}
      ${group(t('cc.vAlign'), chips('vAlign', d.vAlign, [['top', t('cc.vTop')], ['center', t('cc.vCenter')], ['bottom', t('cc.vBottom')]]))}
      ${group(t('cc.pad'), range('pad', 30, 200, 5, d.pad, 'px'))}`;
    if (ui.ccPane === 'bg') return `
      ${group('', chips('bg.type', d.bg.type, [['solid', t('cc.bg.solid')], ['gradient', t('cc.bg.gradient')], ['pattern', t('cc.bg.pattern')], ['image', t('cc.bg.image')], ['html', 'HTML']]))}
      ${group('', bgFields(d.bg))}`;
    if (ui.ccPane === 'preset') return `
      ${group(t('cc.presetSave'), `<div class="row gap-xs"><input class="input grow" id="ccPresetName" placeholder="${esc(t('cc.presetName'))}" data-enter="cc-preset-save"><button class="btn small primary" data-act="cc-preset-save">${t('c.save')}</button></div>
        ${(App.D.chat.presets || []).length ? `<ul class="mini-list">${App.D.chat.presets.map((x) => `<li><button class="link-like" data-act="cc-preset-load" data-id="${x.id}">${esc(x.name)}</button><button class="icon-btn" data-act="cc-preset-del" data-id="${x.id}" aria-label="${t('c.delete')}">${svg('x')}</button></li>`).join('')}</ul>` : `<p class="hint" style="margin:0">${t('cc.presetTip')}</p>`}`)}
      ${group('', `<div class="row gap-xs wrap"><button class="btn small" data-act="cc-preset-export">${t('cc.presetExport')}</button><button class="btn small" data-act="cc-preset-import">${t('cc.presetImport')}</button><button class="btn small ghost" data-act="cc-reset-style">${t('cc.resetStyle')}</button></div>`)}`;
    return '';
  }

  function bgFields(b) {
    if (b.type === 'solid') return colorRow('bg.color', b.color, ['#ffffff', '#faf8f4', '#f3f6fa', '#fdf1f4', '#eef7f0', '#1f2126']);
    if (b.type === 'gradient') return `
      <div class="grid-2"><label><span class="label">${t('cc.c1')}</span><input type="color" class="color-input" value="${b.c1}" data-input="cc" data-k="bg.c1"></label><label><span class="label">${t('cc.c2')}</span><input type="color" class="color-input" value="${b.c2}" data-input="cc" data-k="bg.c2"></label></div>
      ${chips('bg.radial', b.radial, [[false, t('cc.linear')], [true, t('cc.radial')]])}
      ${b.radial ? '' : `<label><span class="label">${t('cc.angle')}</span>${range('bg.angle', 0, 360, 5, b.angle, '°')}</label>`}`;
    if (b.type === 'pattern') return `
      ${chips('bg.pattern', b.pattern, PATTERNS.map((x) => [x, t('cc.pt.' + x)]))}
      <div class="grid-2"><label><span class="label">${t('cc.baseColor')}</span><input type="color" class="color-input" value="${b.color}" data-input="cc" data-k="bg.color"></label><label><span class="label">${t('cc.patColor')}</span><input type="color" class="color-input" value="${b.pColor}" data-input="cc" data-k="bg.pColor"></label></div>
      <div class="grid-2"><label><span class="label">${t('cc.patSize')}</span>${range('bg.pSize', 10, 80, 1, b.pSize, 'px')}</label><label><span class="label">${t('cc.patAlpha')}</span>${range('bg.pAlpha', 5, 100, 5, b.pAlpha, '%')}</label></div>`;
    if (b.type === 'image') return `
      <button class="btn block" data-act="cc-bg-img">${svg('image')}${b.image ? t('cc.bgChange') : t('cc.bgPick')}</button>
      <div class="grid-2"><label><span class="label">${t('cc.blur')}</span>${range('bg.blur', 0, 30, 1, b.blur, 'px')}</label><label><span class="label">${t('cc.zoom')}</span>${range('bg.zoom', 100, 200, 5, b.zoom, '%')}</label></div>
      <div class="grid-2"><label><span class="label">${t('cc.overlay')}</span><input type="color" class="color-input" value="${b.overlay}" data-input="cc" data-k="bg.overlay"></label><label><span class="label">${t('cc.overlayA')}</span>${range('bg.overlayA', 0, 90, 5, b.overlayA, '%')}</label></div>`;
    if (b.type === 'html') return `
      <textarea class="input code" rows="6" spellcheck="false" data-input="cc" data-k="bg.html" placeholder="&lt;div style=&quot;position:absolute;inset:0;background:…&quot;&gt;&lt;/div&gt;">${esc(b.html)}</textarea>
      <p class="hint" style="margin:0">${t('cc.htmlTip')}</p>
      ${colorRow('bg.color', b.color, ['#ffffff', '#faf8f4', '#1f2126'])}`;
    return '';
  }

  function sideHTML() {
    const d = cc();
    return `<nav class="clip-tabs" role="tablist">${panes(d).map(([k, l]) => `<button role="tab" data-act="cc-pane" data-v="${k}" aria-selected="${ui.ccPane === k}">${l}</button>`).join('')}</nav>
      <div class="clip-pane">${paneBody(d)}</div>`;
  }

  App.VIEWS.excerpt = function () {
    const d = cc();
    return `
    <section class="view clip-view">
      <header class="clip-top">
        <div class="clip-mode" role="group">
          ${[['plain', t('cc.mode.plain')], ['chat', t('cc.mode.chat')]].map(([v, l]) => `<button data-act="cc-set" data-k="mode" data-v="${v}" aria-pressed="${d.mode === v}">${l}</button>`).join('')}
        </div>
        <div class="clip-actions">
          <label class="switch small"><input type="checkbox" ${ui.ccHi ? 'checked' : ''} data-change="cc-hi"><span class="sw-track"></span>${t('cc.hi')}</label>
          <button class="btn small" data-act="cc-vault">${t('cc.vault')} <span class="muted">${(App.D.chat.saved || []).length}</span></button>
          <button class="btn small" data-act="cc-export" data-how="copy">${svg('copy')}${t('cc.copy')}</button>
          <button class="btn small primary" data-act="cc-export" data-how="save">${svg('down')}${t('cc.save')}</button>
        </div>
      </header>
      <div class="clip-wrap">
        <div class="clip-stage" id="ccStage">
          <div class="clip-scroll"><div class="cc-scale" id="ccScale"></div></div>
          <div class="clip-foot">
            <span class="muted small" id="ccSize"></span>
            <span class="warn-chip" id="ccOverflow" hidden>${t('cc.overflow')}</span>
            <div class="clip-zoom">
              <button data-act="cc-zoom" data-v="-" aria-label="${t('cc.zoomOut')}">−</button>
              <button data-act="cc-zoom" data-v="fit" id="ccZoomVal" title="${t('cc.zoomFit')}">100%</button>
              <button data-act="cc-zoom" data-v="+" aria-label="${t('cc.zoomIn')}">+</button>
            </div>
          </div>
        </div>
        <aside class="clip-side" id="ccPanel">${sideHTML()}</aside>
      </div>
    </section>`;
  };
  App.after.excerpt = () => { renderCard(); App.hydrateAssets(App.$('#ccPanel')); };
  window.addEventListener('resize', () => { if (App.ui.view === 'excerpt') fitStage(); });

  function rerenderPanel() {
    const pnl = App.$('#ccPanel');
    if (!pnl) return;
    const pane = pnl.querySelector('.clip-pane');
    const st = pane ? pane.scrollTop : 0;
    pnl.innerHTML = sideHTML();
    const np = pnl.querySelector('.clip-pane'); if (np) np.scrollTop = st;
    App.hydrateAssets(pnl);
  }

  function narWrap(on) {
    const ta = App.$('#ccText');
    if (!ta) return;
    let a = ta.selectionStart, b = ta.selectionEnd;
    const v = ta.value;
    if (on) {
      if (a === b) { App.toast(t('cc.narSelect')); ta.focus(); return; }
      // 줄마다 따로 감싸기 (여러 줄을 골라도 줄바꿈이 깨지지 않게), 이미 있는 별표는 정리
      const sel = v.slice(a, b).replace(/\*/g, '');
      const wrapped = sel.split('\n').map((l) => { const m = l.match(/^(\s*)(.*?)(\s*)$/); return m[2] ? `${m[1]}*${m[2]}*${m[3]}` : l; }).join('\n');
      ta.value = v.slice(0, a) + wrapped + v.slice(b);
      ta.setSelectionRange(a, a + wrapped.length);
    } else {
      // 고른 부분(없으면 커서가 있는 줄)의 지문 표시 지우기
      if (a === b) { a = v.lastIndexOf('\n', a - 1) + 1; b = v.indexOf('\n', b); if (b < 0) b = v.length; }
      const plain = v.slice(a, b).replace(/\*/g, '');
      ta.value = v.slice(0, a) + plain + v.slice(b);
      ta.setSelectionRange(a, a + plain.length);
    }
    ta.focus();
    cc().text = ta.value;
    save(); renderCard();
  }
  // 버튼을 눌러도 본문 칸의 선택이 풀리지 않게
  document.addEventListener('pointerdown', (ev) => { if (ev.target.closest && ev.target.closest('[data-act="cc-nar"], [data-act="cc-nar-off"]')) ev.preventDefault(); }, true);

  /* ---------- 행동 ---------- */
  const STYLE_KEYS = ['theme', 'profiles', 'showName', 'showAvatar', 'font', 'size', 'letter', 'lineH', 'ink', 'align', 'vAlign', 'ratio', 'fit', 'pad', 'bg'];
  const styleOf = (d) => JSON.parse(JSON.stringify(Object.fromEntries(STYLE_KEYS.map((k) => [k, d[k]]))));
  const applyStyle = (st) => {
    const d = cc();
    STYLE_KEYS.forEach((k) => { if (st[k] != null) d[k] = JSON.parse(JSON.stringify(st[k])); });
    if (OLD_THEME[d.theme]) d.theme = OLD_THEME[d.theme];
  };

  Object.assign(App.A, {
    'cc-set': (el) => {
      const d = cc();
      let v = el.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false;
      const k = el.dataset.k;
      setPath(d, k, v);
      save();
      if (k === 'mode') { App.renderMain(); return; }
      renderCard();
      rerenderPanel();
    },
    // 고른 부분을 지문으로 / 지문 풀기
    'cc-nar': () => narWrap(true),
    'cc-nar-off': () => narWrap(false),
    'cc-pane': (el) => { ui.ccPane = el.dataset.v; rerenderPanel(); },
    'cc-tab': (el) => { ui.ccTab = Number(el.dataset.i); rerenderPanel(); },
    'cc-zoom': (el) => {
      const v = el.dataset.v;
      if (v === '+' || v === '-') ui.ccZoom = Math.max(10, Math.min(200, Math.round((ui.ccScale || 1) * 100) + (v === '+' ? 10 : -10)));
      else ui.ccZoom = 'fit';
      fitStage();
    },
    'cc-sample': () => { const d = cc(); d.text = t(d.mode === 'chat' ? 'cc.sampleChat' : 'cc.samplePlain'); if (d.mode === 'chat') { d.profiles[0].name = t('cc.p1'); d.profiles[1].name = t('cc.p2'); } save(); App.renderMain(); },
    'cc-clear': async () => { if (await App.confirmBox(t('cc.clearConfirm'), t('cc.clearText'))) { cc().text = ''; save(); App.renderMain(); } },
    'cc-avatar': async () => {
      const [f] = await App.pickFiles('image/*');
      if (!f) return;
      const blob = await Assets.shrinkImage(f, 300, true);
      const id = 'a_' + uid();
      await Assets.put(id, blob);
      const p = cc().profiles[ui.ccTab];
      if (p.avatar) Assets.del(p.avatar);
      p.avatar = id; save(); renderCard(); rerenderPanel();
    },
    'cc-avatar-del': () => { const p = cc().profiles[ui.ccTab]; if (p.avatar) Assets.del(p.avatar); p.avatar = ''; save(); renderCard(); rerenderPanel(); },
    'cc-photo-add': async () => {
      const files = await App.pickFiles('image/*', true);
      for (const f of files) {
        const blob = await Assets.shrinkImage(f, 1400, false);
        const id = 'c_' + uid();
        await Assets.put(id, blob);
        cc().photos.push(id);
      }
      if (files.length) { save(); rerenderPanel(); renderCard(); }
    },
    'cc-photo-ins': (el) => {
      const d = cc();
      const tok = (d.mode === 'chat' ? '[1] ' : '') + `[${t('cc.photo')}${el.dataset.n}]`;
      d.text = (d.text ? d.text.replace(/\n*$/, '\n') : '') + tok;
      save(); renderCard(); App.toast(t('cc.photoInserted'));
    },
    'cc-photo-del': (el) => { const d = cc(); const [id] = d.photos.splice(Number(el.dataset.n), 1); save(); rerenderPanel(); renderCard(); if (id) Assets.del(id); },
    'cc-bg-img': async () => {
      const [f] = await App.pickFiles('image/*');
      if (!f) return;
      const blob = await Assets.shrinkImage(f, 2200, false);
      const id = 'g_' + uid();
      await Assets.put(id, blob);
      const b = cc().bg;
      if (b.image) Assets.del(b.image);
      b.image = id; save(); renderCard(); rerenderPanel();
    },
    'cc-preset-save': () => {
      const name = (App.$('#ccPresetName').value || '').trim() || t('cc.preset') + ' ' + ((App.D.chat.presets || []).length + 1);
      App.D.chat.presets.push({ id: uid(), name, style: styleOf(cc()) });
      save(); rerenderPanel(); App.toast(t('c.saved'));
    },
    'cc-preset-load': (el) => {
      const pr = App.D.chat.presets.find((x) => x.id === el.dataset.id);
      if (!pr) return;
      applyStyle(pr.style);
      save(); App.renderMain(); App.toast(t('cc.presetApplied', { n: pr.name }));
    },
    'cc-preset-del': async (el) => {
      if (!(await App.confirmBox(t('c.confirmDelete')))) return;
      App.D.chat.presets = App.D.chat.presets.filter((x) => x.id !== el.dataset.id); save(); App.renderMain();
    },
    'cc-preset-export': () => {
      const code = JSON.stringify({ myroomPreset: 2, style: styleOf(cc()) });
      App.openModal(`<h3 class="modal-title">${t('cc.presetExport')}</h3><p class="hint">${t('cc.presetExportTip')}</p><textarea class="input code" rows="6" readonly id="ccPresetCode">${esc(code)}</textarea>
        <div class="modal-actions"><span></span><div class="row"><button class="btn" data-act="modal-close">${t('c.close')}</button><button class="btn primary" data-act="cc-preset-copy">${t('c.copy')}</button></div></div>`);
    },
    'cc-preset-copy': () => App.copyText(App.$('#ccPresetCode').value),
    'cc-preset-import': () => {
      App.openModal(`<h3 class="modal-title">${t('cc.presetImport')}</h3><p class="hint">${t('cc.presetImportTip')}</p><textarea class="input code" rows="6" id="ccPresetIn" autofocus></textarea>
        <div class="modal-actions"><span></span><div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn primary" data-act="cc-preset-apply">${t('c.apply')}</button></div></div>`);
    },
    'cc-preset-apply': () => {
      try {
        const o = JSON.parse(App.$('#ccPresetIn').value);
        if (!o || !o.style) throw new Error('bad');
        const st = o.style;
        (st.profiles || []).forEach((p) => { p.avatar = ''; });
        if (st.bg) st.bg.image = '';
        applyStyle(st);
        save(); App.closeModal(); App.toast(t('c.apply'));
      } catch (e) { App.toast(t('cc.presetBad')); }
    },
    'cc-reset-style': async () => {
      if (!(await App.confirmBox(t('cc.resetConfirm'), t('cc.resetStyle')))) return;
      const d = cc(), base = DEFAULT();
      STYLE_KEYS.forEach((k) => { if (k !== 'profiles') d[k] = base[k]; });
      save(); App.renderMain();
    },
    'cc-export': async (el) => {
      const card = App.$('#ccCard');
      const first = (cc().text || '').split('\n').find((l) => l.trim()) || t('nav.excerpt');
      const name = first.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 30) + '.png';
      await App.exportNode(card, el.dataset.how, name, { pixelRatio: ui.ccHi ? 2 : 1 });
    },
    'cc-vault': () => {
      const list = App.D.chat.saved || [];
      App.openModal(`<h3 class="modal-title">${t('cc.vault')}</h3>
        <div class="row gap-xs"><input class="input grow" id="ccVaultName" placeholder="${esc(t('cc.vaultName'))}"><button class="btn primary" data-act="cc-vault-save">${t('cc.vaultSave')}</button></div>
        ${list.length ? `<ul class="mini-list">${list.slice().reverse().map((x) => `<li><button class="link-like" data-act="cc-vault-load" data-id="${x.id}">${esc(x.name)}<span class="muted small"> · ${new Date(x.savedAt).toLocaleDateString(App.loc())}</span></button><button class="icon-btn" data-act="cc-vault-del" data-id="${x.id}" aria-label="${t('c.delete')}">${svg('x')}</button></li>`).join('')}</ul>` : `<p class="hint">${t('cc.vaultEmpty')}</p>`}
        <div class="modal-actions"><span></span><button class="btn" data-act="modal-close">${t('c.close')}</button></div>`, null, 'small');
    },
    'cc-vault-save': () => {
      const name = (App.$('#ccVaultName').value || '').trim() || new Date().toLocaleString(App.loc());
      App.D.chat.saved.push({ id: uid(), name, savedAt: nowISO(), draft: JSON.parse(JSON.stringify(cc())) });
      save(); App.closeModal(); App.toast(t('c.saved'));
    },
    'cc-vault-load': (el) => {
      const x = App.D.chat.saved.find((y) => y.id === el.dataset.id);
      if (!x) return;
      App.D.chat.draft = JSON.parse(JSON.stringify(x.draft));
      save(); App.closeModal(); App.toast(t('cc.loaded', { n: x.name }));
    },
    'cc-vault-del': async (el) => {
      const id = el.dataset.id;
      App.closeModal({ noRender: true });
      if (await App.confirmBox(t('c.confirmDelete'))) { App.D.chat.saved = App.D.chat.saved.filter((x) => x.id !== id); save(); }
      App.renderMain();
    }
  });
  App.K['cc-preset-save'] = () => App.A['cc-preset-save']();

  App.I.cc = (el) => {
    const d = cc();
    const k = el.dataset.k;
    const v = el.type === 'range' || el.type === 'number' ? Number(el.value) : el.value;
    setPath(d, k, v);
    const out = el.parentElement && el.parentElement.querySelector('output');
    if (out) out.textContent = v + (out.textContent.match(/[a-z%°]+$/i) || [''])[0];
    if (k.startsWith('profiles.') && k.endsWith('.name')) { const tab = App.$(`[data-act="cc-tab"][data-i="${ui.ccTab}"]`); if (tab) tab.lastChild.textContent = v || 'P' + (ui.ccTab + 1); }
    save();
    renderCard();
  };
  App.C.cc = (el) => {
    const d = cc();
    setPath(d, el.dataset.k, el.type === 'checkbox' ? el.checked : el.value);
    save(); renderCard();
    if (el.tagName === 'SELECT') rerenderPanel();
  };
  App.C['cc-hi'] = (el) => { ui.ccHi = el.checked; };
})(window.App);
