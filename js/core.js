// MyRoom — 공통 도구, 화면 껍데기, 이벤트 연결
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayStr = () => ymd(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const nowISO = () => new Date().toISOString();

  const App = window.App = {
    D: null,
    VIEWS: {}, A: {}, I: {}, C: {}, K: {}, after: {},
    ui: { view: 'home', modalClose: null },
    $, $$, esc, uid, pad, ymd, parse, todayStr, addDays, daysBetween, hash, nowISO
  };

  /* ---------- 언어 ---------- */
  App.t = function (key, vars) {
    const row = I18N[key];
    let s = row == null ? key : (typeof row === 'string' ? row : row[0]);
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  };
  const t = App.t;
  App.loc = () => t('locale');
  App.fmt = (s, opts) => new Intl.DateTimeFormat(App.loc(), opts).format(typeof s === 'string' ? parse(s) : s);
  App.wdName = (i, style = 'short') => new Intl.DateTimeFormat(App.loc(), { weekday: style }).format(new Date(2023, 0, 1 + i));
  App.dayOrder = () => (App.D.settings.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]);

  /* ---------- 아이콘 ---------- */
  const ICON = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    tasks: '<path d="M4 7l2 2 3-3M4 15l2 2 3-3M13 8h7M13 16h7"/>',
    memo: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    diary: '<path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2z"/><path d="M6 17a2 2 0 0 1 2-2h11"/>',
    excerpt: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    dday: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
    social: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c2.8.3 5 2.6 5 5.8"/>',
    focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2h5"/>',
    custom: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9 0-1-.9-1.4-.9-2.4 0-1 .9-1.7 2-1.7h1.9a4 4 0 0 0 4-4C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9L7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    edit: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    reset: '<path d="M4 4v6h6"/><path d="M4.5 15a8 8 0 1 0 1.9-8.3L4 10"/>',
    skip: '<path d="M5 4l10 8-10 8zM19 5v14"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    prev: '<path d="M19 20L9 12l10-8zM5 5v14"/>',
    next: '<path d="M5 4l10 8-10 8zM19 5v14"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'
  };
  ICON.help = '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17h.01"/>';
  App.ICON = ICON;
  App.svg = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ''}</svg>`;

  App.NAV = [
    ['main', ['home', 'calendar', 'tasks', 'diary', 'memo', 'excerpt', 'bookmark', 'dday', 'focus', 'music']],
    ['people', ['social']],
    ['room', ['custom', 'settings']]
  ];
  App.THEMES = {
    editor: { bg: '#eef6fb', paper: '#ffffff', ink: '#0e0f12', accent: '#2fa4de' },
    basic: { bg: '#f5f6f8', paper: '#ffffff', ink: '#24272e', accent: '#5b7cfa' },
    sky: { bg: '#eef5fc', paper: '#ffffff', ink: '#1f3550', accent: '#3a86e0' },
    strawberry: { bg: '#fcf1f4', paper: '#ffffff', ink: '#4a2b36', accent: '#e46b92' },
    mint: { bg: '#eff8f4', paper: '#ffffff', ink: '#1f3a33', accent: '#2a9d7f' },
    paper: { bg: '#f3efe6', paper: '#fffdf8', ink: '#2e2b26', accent: '#7a6a52' },
    night: { bg: '#15171c', paper: '#1d2027', ink: '#e8eaf0', accent: '#8ea8ff' },
    christmas: { bg: '#f6efe4', paper: '#fffdf8', ink: '#1e3a2b', accent: '#c8323c' }
  };
  App.EVENT_COLORS = ['#5b7cfa', '#e46b92', '#2a9d7f', '#e89a1c', '#9467d8', '#7d8594'];
  App.safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : App.EVENT_COLORS[0]);
  // 설정에서 끌 수 있는 메뉴
  App.MODULES = ['calendar', 'tasks', 'diary', 'memo', 'excerpt', 'bookmark', 'dday', 'focus', 'music', 'social'];
  App.on = (m) => !App.MODULES.includes(m) || !App.D || !App.D.settings.modules || App.D.settings.modules[m] !== false;
  App.safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  App.safeImg = (u) => (/^(https?:\/\/|data:image\/)/i.test(u || '') ? u : '');

  /* ---------- 글꼴 ---------- */
  const BUILTIN_FONTS = [
    ['b:pretendard', 'Pretendard', "'Pretendard'"],
    ['b:kyobo2023', '교보손글씨 2023 우선아', "'Kyobo Handwriting 2023'"],
    ['b:omyu', '오뮤 다예쁨체', "'Omyu Pretty'"],
    ['b:parkdahyun', '온글잎 박다현체', "'Ownglyph ParkDaHyun'"],
    ['b:leeseoyun', '이서윤체', "'LeeSeoyun'"],
    ['b:danjunghae', '카페24 단정해', "'Cafe24 Danjunghae'"],
    ['b:dovemayo', '둘기마요', "'Dovemayo'"],
    ['b:dunggeunmiso', '학교안심 둥근미소', "'Hakgyoansim Dunggeunmiso'"],
    ['b:ssurroundair', '카페24 써라운드 에어', "'Cafe24 Ssurround Air'"],
    ['b:maruburi', '마루부리', "'MaruBuri'"],
    ['b:ridibatang', '리디바탕', "'RIDIBatang'"],
    ['b:chosunmyungjo', '조선일보명조', "'Chosunilbo Myungjo'"],
    ['b:bookk', '부크크 명조', "'Bookk Myungjo'"],
    ['b:scoredream', '에스코어드림', "'S-Core Dream'"],
    ['b:gmarket', '지마켓 산스', "'Gmarket Sans'"],
    ['b:paperlogy', '페이퍼로지', "'Paperlogy'"],
    ['b:suit', 'SUIT', "'SUIT'"]
  ];
  App.allFonts = function () {
    const list = [{ id: '', name: t('font.default'), family: 'var(--font)' }];
    BUILTIN_FONTS.forEach(([id, name, fam]) => list.push({ id, name, family: fam }));
    (App.D.fonts || []).forEach((f) => list.push({ id: f.id, name: f.name, family: `'${String(f.family).replace(/'/g, '')}'`, user: true }));
    return list;
  };
  App.fontFamily = function (id) {
    const f = App.allFonts().find((x) => x.id === (id || ''));
    return f && f.id ? `${f.family}, var(--font)` : 'var(--font)';
  };
  App.fontOptions = (selected) => App.allFonts().map((f) => `<option value="${esc(f.id)}" ${f.id === (selected || '') ? 'selected' : ''}>${esc(f.name)}</option>`).join('');

  const loadedFonts = new Set();
  App.registerFonts = async function () {
    for (const f of App.D.fonts || []) {
      if (loadedFonts.has(f.id)) continue;
      loadedFonts.add(f.id);
      try {
        if (f.kind === 'file' && f.assetId) {
          const blob = await Assets.getBlob(f.assetId);
          if (blob) {
            const face = new FontFace(f.family, await blob.arrayBuffer());
            await face.load();
            document.fonts.add(face);
          }
        } else if (f.kind === 'css' && f.css) {
          const st = document.createElement('style');
          st.dataset.font = f.id;
          st.textContent = f.css;
          document.head.insertBefore(st, $('#custom-css'));
        }
      } catch (e) { console.warn('글꼴을 불러오지 못했어요', f.name, e); }
    }
  };

  /* ---------- 테마 ---------- */
  App.applyTheme = function () {
    const D = App.D;
    const root = document.documentElement;
    root.dataset.theme = D.settings.theme in App.THEMES ? D.settings.theme : 'editor';
    root.lang = D.settings.lang;
    root.style.setProperty('--font-app', D.settings.appFont ? App.fontFamily(D.settings.appFont) : 'var(--font)');
    $('#custom-css').textContent = '';
  };

  /* ---------- HTML 위젯 안전하게 ---------- */
  App.sanitizeHTML = function (html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return '';
    root.querySelectorAll('script, object, embed, base, meta, frame, frameset').forEach((n) => n.remove());
    root.querySelectorAll('*').forEach((el) => {
      for (const a of Array.from(el.attributes)) {
        const n = a.name.toLowerCase();
        const v = a.value.replace(/\s+/g, '').toLowerCase();
        if (n.startsWith('on') || n === 'srcdoc') el.removeAttribute(a.name);
        else if (/^(href|src|xlink:href|action|formaction|data|poster)$/.test(n) && /^(javascript|vbscript):/.test(v)) el.removeAttribute(a.name);
      }
      if (el.tagName === 'IFRAME') {
        if (!/^https:\/\//i.test(el.getAttribute('src') || '')) el.removeAttribute('src');
        el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
      }
      if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
    });
    return root.innerHTML;
  };

  /* ---------- 껍데기 그리기 ---------- */
  function renderTitle() {
    const D = App.D;
    const title = t('home.room', { name: D.profile.name || t('home.defaultName') });
    $('#roomTitle').textContent = title;
    document.title = title + ' · MyRoom';
    $('#counter').innerHTML = '';
    $('#quickMemoBtn').innerHTML = `${App.svg('plus')}<span>${t('memo.quick')}</span>`;
  }
  App.renderTitle = renderTitle;

  function renderProfile() {
    const p = App.D.profile;
    const img = App.safeImg(p.avatar);
    $('#profile').innerHTML = `
      <div class="profile-row">
        <div class="avatar">${img ? `<img src="${esc(img)}" alt="">` : esc(p.emoji || '🌱')}</div>
        <div class="profile-text">
          <p class="profile-name">${esc(p.name || t('home.defaultName'))}</p>
          <p class="profile-status">${esc(p.status)}</p>
        </div>
      </div>
      `;
  }
  App.renderProfile = renderProfile;

  function renderNav() {
    $('#nav').innerHTML = App.NAV.map(([sec, items]) => items.filter(App.on)).filter((items) => items.length).map((items) =>
      `<div class="nav-group">` + items.map((v) => `<button type="button" data-act="nav" data-view="${v}" ${App.ui.view === v ? 'aria-current="page"' : ''}>${App.svg(v)}<span>${t('nav.' + v)}</span></button>`).join('') + `</div>`
    ).join('');
    // 사용 가이드 (새 창)
    const g = document.createElement('a');
    g.className = 'nav-guide'; g.href = 'https://myroom-house.github.io/room/guide/'; g.target = '_blank'; g.rel = 'noopener';
    g.innerHTML = `${App.svg('help')}<span>${t('nav.guide')}</span>`;
    const last = $('#nav .nav-group:last-child'); if (last) last.appendChild(g);
  }

  App.renderMain = function () {
    const main = $('#main');
    const ae = document.activeElement;
    const keep = ae && ae.dataset ? ae.dataset.keep : null;
    const selStart = keep && 'selectionStart' in ae ? ae.selectionStart : null;
    const scroll = main.scrollTop;
    if (!App.on(App.ui.view)) App.ui.view = 'home';
    const view = App.VIEWS[App.ui.view] ? App.ui.view : 'home';
    main.innerHTML = App.VIEWS[view]();
    main.scrollTop = scroll;
    if (keep) {
      const el = $(`[data-keep="${keep}"]`, main);
      if (el) { el.focus(); if (selStart != null && el.setSelectionRange) try { el.setSelectionRange(selStart, selStart); } catch (e) { /* 무시 */ } }
    }
    if (App.after[view]) App.after[view]();
    App.hydrateAssets(main);
  };

  // data-asset="id" 가 붙은 이미지에 실제 주소 넣기
  App.hydrateAssets = function (root) {
    $$('img[data-asset]', root || document).forEach((img) => {
      const id = img.dataset.asset;
      const u = Assets.cachedUrl(id);
      if (u) { img.src = u; return; }
      Assets.url(id).then((x) => { if (x) img.src = x; });
    });
  };

  App.renderAll = function () {
    renderTitle();
    renderProfile();
    renderNav();
    App.renderMain();
  };

  App.go = function (view) {
    if (App.onLeave && App.onLeave[App.ui.view] && view !== App.ui.view) App.onLeave[App.ui.view]();
    App.ui.view = view;
    $('#main').scrollTop = 0;
    App.renderAll();
    if (App.onEnter && App.onEnter[view]) App.onEnter[view]();
  };

  /* ---------- 저장 ---------- */
  App.update = (fn, opts) => Store.update(fn, opts);
  App.silent = (fn) => Store.update(fn, { silent: true });

  /* ---------- 알림·모달 ---------- */
  let toastTimer;
  App.toast = function (msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  };

  App.openModal = function (html, onClose, cls) {
    const layer = $('#modalLayer');
    layer.innerHTML = `<div class="modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    layer.hidden = false;
    App.ui.modalClose = onClose || null;
    const f = layer.querySelector('[autofocus]') || layer.querySelector('input, textarea, select, button');
    if (f) f.focus();
    App.hydrateAssets(layer);
  };
  App.closeModal = function (opts = {}) {
    const layer = $('#modalLayer');
    if (layer.hidden) return;
    layer.hidden = true;
    layer.innerHTML = '';
    const cb = App.ui.modalClose; App.ui.modalClose = null;
    if (cb) cb();
    if (!opts.noRender) App.renderAll();
  };
  App.confirmBox = function (msg, okLabel) {
    return new Promise((resolve) => {
      let answer = false;
      App.A['confirm-yes'] = () => { answer = true; App.closeModal({ noRender: true }); };
      App.openModal(`<p class="confirm-msg">${esc(msg)}</p>
        <div class="modal-actions"><span></span><div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn danger-solid" data-act="confirm-yes" autofocus>${esc(okLabel || t('c.delete'))}</button></div></div>`,
      () => resolve(answer), 'small');
    });
  };

  App.copyText = async function (text) {
    try { await navigator.clipboard.writeText(text); App.toast(t('c.copied')); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); App.toast(t('c.copied')); } catch (er) { /* 무시 */ }
      ta.remove();
    }
  };
  App.openUrl = function (url) {
    if (!App.safeUrl(url)) return;
    if (window.myroom && window.myroom.openUrl) window.myroom.openUrl(url);
    else window.open(url, '_blank', 'noopener');
  };

  App.pickFiles = function (accept, multiple) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = !!multiple;
      input.onchange = () => resolve(Array.from(input.files || []));
      input.click();
    });
  };

  /* ---------- 이벤트 연결 ---------- */
  const A = App.A, I = App.I, C = App.C, K = App.K;
  A.nav = (el) => App.go(el.dataset.view);
  A['modal-close'] = () => App.closeModal();
  A['open-url'] = (el) => App.openUrl(el.dataset.url);

  // 불러오지 못한 아이콘 이미지는 숨기기 (글자 아이콘이 대신 보임)
  document.addEventListener('error', (e) => {
    if (e.target && e.target.matches && e.target.matches('img[data-fallback]')) e.target.remove();
  }, true);

  document.addEventListener('click', (e) => {
    const layer = $('#modalLayer');
    if (e.target === layer) { App.closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && I[el.dataset.input]) I[el.dataset.input](el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && C[el.dataset.change]) C[el.dataset.change](el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modalLayer').hidden) { App.closeModal(); return; }
    if (e.key === 'Enter' && !e.isComposing) {
      const el = e.target.closest('[data-enter]');
      if (el && K[el.dataset.enter]) {
        // 여러 줄 입력칸은 Shift+Enter 로 줄바꿈
        if (el.tagName === 'TEXTAREA' && e.shiftKey) return;
        e.preventDefault();
        K[el.dataset.enter](el, e);
      }
    }
  });
})();
