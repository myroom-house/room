// 데이터 저장소 — 데스크탑 앱에서는 파일로, 브라우저 미리보기에서는 localStorage로 저장
(function () {
  const LS_KEY = 'myroom-data-v1';

  const DEFAULTS = () => ({
    version: 3,
    settings: {
      lang: 'ko',
      theme: 'editor',
      appFont: '',          // 앱 전체 글꼴 (폰트 id 또는 내장 글꼴 키)
      customCSS: '',
      customHTML: '',
      useCustomHTML: true,
      weekStart: 0,
      modules: { social: false }  // 메뉴 켜기/끄기 {calendar:false …} — 이웃은 기본으로 꺼둠
    },
    profile: { name: '', status: '', avatar: '', emoji: '🌱', links: [] },
    visits: { total: 0, today: 0, lastDate: '' },
    todos: [],      // {id, text, done, date, createdAt, doneAt}
    routines: [],   // {id, text, days:[0..6], done:{date:true}, createdAt}
    events: [],     // {id, date, title, color}
    memos: [],      // {id, title, body, pinned, createdAt, updatedAt}
    diary: [],      // {id, date, title, body, mood, weather, font, size, color, paper, paperColor, items:[], updatedAt}
    excerpts: [],   // {id, text, source, author, page, note, tags:[], createdAt}
    bookmarks: [],  // {id, url, title, note, tags:[], createdAt}
    ddays: [],      // {id, title, date, yearly, countFirst, color, pinned}
    fonts: [],      // {id, name, family, kind:'file'|'css'|'local', assetId?, css?}
    stickers: [],   // {id, assetId, name}
    homeStickers: [], // 홈에 붙인 스티커 {id, assetId, x(%), y(px), w, r}
    focus: { focus: 25, short: 5, long: 15, rounds: 4, sound: true, autoNext: true },
    focusLog: {},   // {date: {sessions, minutes}}
    chat: { draft: null, presets: [], saved: [] },  // 채팅 발췌기
    eventCats: [          // 일정 종류
      { id: 'c1', name: '일정', color: '#5b7cfa' },
      { id: 'c2', name: '약속', color: '#e46b92' },
      { id: 'c3', name: '과제', color: '#2a9d7f' },
      { id: 'c4', name: '마감', color: '#e89a1c' }
    ],
    music: { tracks: [], current: 0, volume: 0.8, repeat: 'all', shuffle: false, autoplay: true }
  });

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    const out = { ...base };
    for (const k of Object.keys(saved)) {
      const b = base[k], s = saved[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)) out[k] = merge(b, s);
      else out[k] = s;
    }
    return out;
  }

  const desktop = !!(window.myroom && window.myroom.isDesktop);
  let data = DEFAULTS();
  let saveTimer = null;
  const listeners = new Set();

  /* ---------- 계정마다 따로 저장 ----------
     이웃(서버)에 로그인돼 있으면 그 계정 칸에, 아니면 기본(로그인 전) 칸에 저장해요. */
  function sessionUser() {
    try {
      const s = JSON.parse(localStorage.getItem('myroom-sb') || 'null');
      const u = s && (s.user || (s.currentSession && s.currentSession.user));
      return u && u.id ? String(u.id) : '';
    } catch (e) { return ''; }
  }
  const acct = sessionUser();
  const lsKey = acct ? `${LS_KEY}:${acct}` : LS_KEY;
  const metaKey = `myroom-sync:${acct}`;
  let hadLocal = false;
  let syncer = null;
  const meta = () => { try { return JSON.parse(localStorage.getItem(metaKey) || '{}'); } catch (e) { return {}; } };
  const setMeta = (m) => { try { localStorage.setItem(metaKey, JSON.stringify({ ...meta(), ...m })); } catch (e) { /* 무시 */ } };

  async function readSaved(key) {
    if (desktop) { try { return await window.myroom.load(key); } catch (e) { console.error(e); return null; } }
    try { return JSON.parse(localStorage.getItem(key ? `${LS_KEY}:${key}` : LS_KEY) || 'null'); } catch (e) { return null; }
  }

  async function load() {
    const saved = await readSaved(acct);
    hadLocal = !!saved;
    data = merge(DEFAULTS(), saved);
    data.settings.lang = 'ko';
    // v3: 새 기본 테마(에디터)로 바꾸기 — 직접 고른 테마는 그대로
    if (saved && (saved.version || 1) < 3) {
      if (!saved.settings || !saved.settings.theme || ['basic', 'sky'].includes(saved.settings.theme)) data.settings.theme = 'editor';
      data.version = 3;
    }
    return data;
  }

  function writeLocal() {
    if (desktop) return window.myroom.save(data, acct);
    localStorage.setItem(lsKey, JSON.stringify(data));
  }
  function persist() {
    clearTimeout(saveTimer);
    if (acct) setMeta({ dirty: true, changedAt: new Date().toISOString() });
    saveTimer = setTimeout(async () => {
      try { await writeLocal(); } catch (e) { console.error('저장 실패', e); }
      if (acct && syncer) syncer(data);
    }, 250);
  }
  async function flush() {
    clearTimeout(saveTimer);
    try { await writeLocal(); } catch (e) { console.error('저장 실패', e); }
  }
  // 서버에서 받은 기록으로 바꾸기
  // 서버 기록으로 바꾸기 전에 지금 상태를 자동 백업 (최근 3개)
  const bakKey = `myroom-bak:${acct}`;
  function backups() { try { return JSON.parse(localStorage.getItem(bakKey) || '[]'); } catch (e) { return []; } }
  function backupNow() {
    const has = ['todos', 'events', 'memos', 'diary', 'ddays', 'bookmarks'].some((k) => (data[k] || []).length);
    if (!has) return;
    let list = backups();
    list.unshift({ at: new Date().toISOString(), data: JSON.parse(JSON.stringify(data)) });
    while (list.length) {
      try { localStorage.setItem(bakKey, JSON.stringify(list.slice(0, 3))); break; } catch (e) { list = list.slice(0, Math.max(0, Math.min(3, list.length) - 1)); if (!list.length) break; }
    }
  }
  function replace(next, opts = {}) {
    backupNow();
    data = merge(DEFAULTS(), next);
    data.settings.lang = 'ko';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { writeLocal(); }, 50);
    if (!opts.dirty) setMeta({ dirty: false });
    listeners.forEach((l) => l(data));
  }

  const get = () => data;
  function update(fn, opts = {}) {
    fn(data);
    persist();
    if (!opts.silent) listeners.forEach((l) => l(data));
  }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  async function exportData() {
    if (desktop) return window.myroom.exportData(data);
    const bundle = { myroomBackup: 2, data, assets: await window.Assets.exportAll() };
    const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `myroom-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  }

  async function importData() {
    let incoming = null;
    if (desktop) {
      incoming = await window.myroom.importData();
    } else {
      const parsed = await new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = () => {
          const f = input.files[0];
          if (!f) return resolve(null);
          f.text().then((t) => { try { resolve(JSON.parse(t)); } catch (e) { resolve(null); } });
        };
        input.click();
      });
      if (parsed && parsed.myroomBackup) { await window.Assets.importAll(parsed.assets); incoming = parsed.data; }
      else incoming = parsed;
    }
    if (!incoming || typeof incoming !== 'object') return false;
    data = merge(DEFAULTS(), incoming);
    persist();
    listeners.forEach((l) => l(data));
    return true;
  }

  function reset() {
    const lang = data.settings.lang;
    data = DEFAULTS();
    data.settings.lang = lang;
    persist();
    listeners.forEach((l) => l(data));
  }

  window.Store = {
    load, get, update, subscribe, exportData, importData, reset, desktop, DEFAULTS, flush, replace, readSaved,
    account: () => acct,
    backups,
    hadLocal: () => hadLocal,
    meta, setMeta,
    setSyncer: (fn) => { syncer = fn; }
  };
})();
