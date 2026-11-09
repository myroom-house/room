// 이웃 — 소셜 페이지 (Supabase 서버 / 체험 모드)
(function (App) {
  const { t, esc, svg, uid, todayStr } = App;
  const ui = App.ui;
  ui.so = { tab: 'mine', visit: null, demo: false, place: null, selSt: null, selR: null };

  const PAGE_W = 600;
  const BANNER_W = 400, BANNER_H = 100; // 배너는 모두 가로 4 : 세로 1
  const SO_CLASSES = ['.so-page', '.so-head', '.so-av', '.so-who', '.so-bgm', '.so-box', '.so-box h4', '.so-todos', '.so-line', '.so-pair', '.so-custom', '.so-banners', '.so-banner'];

  // 이웃이 쓴 CSS가 이 페이지 밖(앱 화면)을 건드리지 못하게 모든 규칙 앞에 #soPage 붙이기
  function scopeCSS(css) {
    let src = String(css || '').replace(/<\/?style[^>]*>/gi, '').replace(/\/\*[\s\S]*?\*\//g, '');
    src = src.replace(/@import[^;]*;?/gi, '').replace(/expression\s*\(/gi, '(').replace(/javascript:/gi, '').replace(/behavior\s*:/gi, 'x:');
    src = src.replace(/position\s*:\s*fixed/gi, 'position:absolute');
    const out = [];
    let i = 0;
    const scopeSel = (sel) => sel.split(',').map((x) => {
      x = x.trim();
      if (!x) return '';
      if (/^(:root|html|body)$/i.test(x)) return '#soPage';
      x = x.replace(/^(:root|html|body)\s*/i, '');
      if (/^\.so-page\b/.test(x)) return '#soPage' + x.slice(8);
      return '#soPage ' + x;
    }).filter(Boolean).join(', ');
    function block(text) {
      const res = [];
      let k = 0;
      while (k < text.length) {
        const open = text.indexOf('{', k);
        if (open < 0) break;
        const head = text.slice(k, open).trim();
        let depth = 1, j = open + 1;
        while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
        const inner = text.slice(open + 1, j - 1);
        if (/^@(media|supports|container)/i.test(head)) res.push(`${head}{${block(inner)}}`);
        else if (/^@(-webkit-)?keyframes/i.test(head) || /^@font-face/i.test(head)) res.push(`${head}{${inner}}`);
        else if (head.startsWith('@')) { /* 다른 @규칙은 버려요 */ }
        else if (head) res.push(`${scopeSel(head)}{${inner}}`);
        k = j;
      }
      return res.join('\n');
    }
    out.push(block(src));
    void i;
    return out.join('').replace(/<\//g, '<\\/');
  }
  App.scopeSocialCSS = scopeCSS;
  App.Sb = () => Sb;
  // 이웃 HTML: 기본 정리 + <style>/<link>/폼은 빼기 (CSS는 CSS 칸에서만, 페이지 안으로 한정)
  function soHTML(html) {
    const doc = new DOMParser().parseFromString(`<div>${App.sanitizeHTML(html)}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return '';
    root.querySelectorAll('style, link, form, input, textarea, select, button').forEach((n) => n.remove());
    return root.innerHTML;
  }

  // 배너는 정해진 크기로 가운데를 잘라서 올려요 (움직이는 GIF는 그대로)
  function bannerBlob(file) {
    if (file.type === 'image/gif') return Promise.resolve(file);
    return new Promise((resolve) => {
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(src);
        const W = BANNER_W * 2, H = BANNER_H * 2;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const r = Math.max(W / img.width, H / img.height);
        const w = img.width * r, h = img.height * r;
        c.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        c.toBlob((b) => resolve(b || file), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(src); resolve(file); };
      img.src = src;
    });
  }
  const BG_COLORS = ['#ffffff', '#eef6fb', '#fff1f5', '#f0fbf5', '#fffbea', '#f4f0ff', '#1d2027'];
  const PATTERNS = ['none', 'dot', 'grid', 'check', 'heart'];
  const MOODS = ['😊', '🥰', '😌', '😆', '🥹', '😢', '😴', '🤒', '🔥', '✨'];
  const REACT_EMOJI = '💖 🥺 👍 🫶 😂 😭 ✨ 🌸 🎀 ⭐ 🍀 🔥 💯 👀 🫧 🍓'.split(' ');
  const STICKER_EMOJI = '✨ 💫 ⭐ 🌙 ☁️ 🌸 🌷 🎀 💌 💬 ❤️ 🤍 💙 🫧 🔖 📌 🍓 ☕ 🎧 📷 🐰 🐻 🐱 🐳'.split(' ');

  const S = () => {
    const D = App.D;
    if (!D.social) D.social = {};
    const s = D.social;
    if (!s.draft) s.draft = { bg: { color: '#ffffff', pattern: 'dot' }, todos: { auto: true, items: [] }, line: { mood: '😊', text: '' }, pair: { url: '', caption: '' }, stickers: [], banners: [] };
    if (!s.uploaded) s.uploaded = {};
    s.draft.banners = normBanners(s.draft.banners);
    if (!s.draft.bgm) s.draft.bgm = { url: '', title: '', artist: '', trackId: '' };
    if (!s.draft.custom) {
      // 예전 홈 위젯 HTML·CSS는 소셜 페이지 꾸미기로 옮겨요
      const st0 = D.settings || {};
      s.draft.custom = { html: st0.customHTML || '', css: st0.customCSS || '' };
      if (st0.customHTML || st0.customCSS) { st0.customHTML = ''; st0.customCSS = ''; s.dirty = true; }
    }
    return s;
  };
  const save = () => App.silent(() => {});
  const normBanners = (b) => (b || []).map((x) => (typeof x === 'string' ? { id: x, img: '' } : x)).filter((x) => x && x.id);

  /* =========================================================
     서버 연결 — Supabase
     ========================================================= */
  const Sb = {
    c: null,
    // 사이트에 서버가 들어 있으면 그것만 써요 (직접 입력한 서버 설정은 무시)
    builtin() { const c = window.MYROOM_CONFIG || {}; return !!((c.supabaseUrl || '').trim() && (c.supabaseAnonKey || '').trim()); },
    cfg() {
      const c = window.MYROOM_CONFIG || {};
      if (this.builtin()) return { url: c.supabaseUrl.trim(), key: c.supabaseAnonKey.trim() };
      return { url: (App.D.settings.sbUrl || '').trim(), key: (App.D.settings.sbKey || '').trim() };
    },
    configured() { const c = this.cfg(); return !!(c.url && c.key && window.supabase); },
    client() {
      if (!this.c && this.configured()) {
        const c = this.cfg();
        this.c = window.supabase.createClient(c.url, c.key, { auth: { persistSession: true, storageKey: 'myroom-sb' } });
      }
      return this.c;
    },
    reset() { this.c = null; },
    async me() { const { data } = await this.client().auth.getSession(); return data.session ? data.session.user : null; },
    async signUp(email, password, handle, name) {
      const { data, error } = await this.client().auth.signUp({ email, password, options: { data: { handle, name } } });
      if (error) throw error;
      return !!data.session;
    },
    async signIn(email, password) { const { error } = await this.client().auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signOut() { await this.client().auth.signOut(); },
    async myProfile() { const u = await this.me(); if (!u) return null; const { data } = await this.client().from('profiles').select('*').eq('id', u.id).maybeSingle(); return data ? data : { missing: true, meta: u.user_metadata || {} }; },
    async createProfile(handle, name) { const u = await this.me(); const { error } = await this.client().from('profiles').insert({ id: u.id, handle, name }); if (error) throw error; },
    async saveProfile(patch) { const u = await this.me(); const { error } = await this.client().from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', u.id); if (error) throw error; },
    async getPage(owner) { const { data, error } = await this.client().from('social_pages').select('data, updated_at').eq('owner', owner).maybeSingle(); if (error) throw error; return data; },
    async savePage(d) { const u = await this.me(); const { error } = await this.client().from('social_pages').upsert({ owner: u.id, data: d, updated_at: new Date().toISOString() }); if (error) throw error; },
    async upload(blob) {
      const u = await this.me();
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace(/^mpeg$/, 'mp3').replace('x-m4a', 'm4a');
      const path = `${u.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await this.client().storage.from('social').upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      return this.client().storage.from('social').getPublicUrl(path).data.publicUrl;
    },
    async findHandle(h) { const { data } = await this.client().from('profiles').select('*').eq('handle', h).maybeSingle(); return data; },
    async profiles(ids) { if (!ids.length) return []; const { data } = await this.client().from('profiles').select('*').in('id', ids); return data || []; },
    async friendships() { const { data, error } = await this.client().from('friendships').select('*'); if (error) throw error; return data || []; },
    async request(to) { const u = await this.me(); const { error } = await this.client().from('friendships').insert({ requester: u.id, addressee: to }); if (error) throw error; },
    async accept(id) { const { error } = await this.client().from('friendships').update({ status: 'accepted' }).eq('id', id); if (error) throw error; },
    async removeFriend(id) { const { error } = await this.client().from('friendships').delete().eq('id', id); if (error) throw error; },
    async comments(owner) { const { data } = await this.client().from('comments').select('*').eq('page_owner', owner).order('created_at', { ascending: false }).limit(100); return data || []; },
    async addComment(owner, body) { const u = await this.me(); const { error } = await this.client().from('comments').insert({ page_owner: owner, author: u.id, body }); if (error) throw error; },
    async delComment(id) { await this.client().from('comments').delete().eq('id', id); },
    async reactions(owner) { const { data } = await this.client().from('reactions').select('*').eq('page_owner', owner).order('created_at').limit(200); return data || []; },
    async addReaction(owner, r) { const u = await this.me(); const { error } = await this.client().from('reactions').insert({ page_owner: owner, author: u.id, ...r }); if (error) throw error; },
    async delReaction(id) { await this.client().from('reactions').delete().eq('id', id); },
    async updReaction(id, patch) {
      let { error } = await this.client().from('reactions').update(patch).eq('id', id);
      // 크기(w) 칸이 아직 없는 서버면 위치·각도만 저장
      if (error && 'w' in patch && /\bw\b|column/i.test(error.message || '')) { const p2 = { ...patch }; delete p2.w; ({ error } = await this.client().from('reactions').update(p2).eq('id', id)); }
      if (error) throw error;
    },
    // 내 기록(할 일·다이어리·디데이…) 계정에 저장
    async fileUp(id, blob) { const u = await this.me(); if (!u) return false; const { error } = await this.client().storage.from('userfiles').upload(`${u.id}/${id}`, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' }); if (error) throw error; return true; },
    async fileDown(id) { const u = await this.me(); if (!u) return null; const { data, error } = await this.client().storage.from('userfiles').download(`${u.id}/${id}`); if (error) return null; return data; },
    async fileDel(id) { const u = await this.me(); if (!u) return; await this.client().storage.from('userfiles').remove([`${u.id}/${id}`]); },
    async pullData() { const u = await this.me(); if (!u) return null; const { data, error } = await this.client().from('user_data').select('data, updated_at').eq('owner', u.id).maybeSingle(); if (error) throw error; return data; },
    async pushData(d) { const u = await this.me(); if (!u) return null; const at = new Date().toISOString(); const { error } = await this.client().from('user_data').upsert({ owner: u.id, data: d, updated_at: at }); if (error) throw error; return at; }
  };

  /* =========================================================
     체험 모드 — 이 기기 안에서만 돌아가는 예시 이웃
     ========================================================= */
  const DEMO_KEY = 'myroom-social-demo';
  const Demo = {
    db: null,
    load() {
      if (this.db) return this.db;
      try { this.db = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { this.db = null; }
      if (!this.db) this.db = this.seed();
      return this.db;
    },
    persist() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); } catch (e) { /* 용량 초과는 무시 */ } },
    seed() {
      const now = Date.now();
      const iso = (m) => new Date(now - m * 60000).toISOString();
      return {
        me: 'me',
        profiles: {
          me: { id: 'me', handle: 'me', name: App.D.profile.name || t('home.defaultName'), bio: '', avatar_url: '', banner_url: '' },
          haru: { id: 'haru', handle: 'haru', name: t('so.demo.haru'), bio: t('so.demo.haruBio'), avatar_url: '', banner_url: '' },
          somi: { id: 'somi', handle: 'somi', name: t('so.demo.somi'), bio: t('so.demo.somiBio'), avatar_url: '', banner_url: '' },
          jisu: { id: 'jisu', handle: 'jisu', name: t('so.demo.jisu'), bio: '', avatar_url: '', banner_url: '' }
        },
        pages: {
          haru: { bg: { color: '#fff1f5', pattern: 'heart' }, todos: { auto: false, items: [{ text: t('so.demo.t1'), done: true }, { text: t('so.demo.t2'), done: false }] }, line: { mood: '🥰', text: t('so.demo.line1') }, pair: { url: '', caption: '' }, stickers: [{ id: 's1', emoji: '🎀', x: 82, y: 6, w: 70, r: 12 }, { id: 's2', emoji: '🍓', x: 6, y: 72, w: 56, r: -10 }], banners: ['somi'] },
          somi: { bg: { color: '#eef6fb', pattern: 'dot' }, todos: { auto: false, items: [{ text: t('so.demo.t3'), done: false }] }, line: { mood: '😴', text: t('so.demo.line2') }, pair: { url: '', caption: '' }, stickers: [{ id: 's3', emoji: '☁️', x: 80, y: 8, w: 80, r: 0 }], banners: [] }
        },
        friendships: [
          { id: 'f1', requester: 'haru', addressee: 'me', status: 'accepted' },
          { id: 'f2', requester: 'somi', addressee: 'me', status: 'pending' }
        ],
        comments: [{ id: 'c1', page_owner: 'me', author: 'haru', body: t('so.demo.c1'), created_at: iso(30) }],
        reactions: [{ id: 'r1', page_owner: 'me', author: 'haru', emoji: '💖', image_url: '', x: 88, y: 12, r: 10, created_at: iso(29) }]
      };
    },
    configured: () => true,
    async me() { return { id: 'me' }; },
    async myProfile() { return this.load().profiles.me; },
    async saveProfile(p) { Object.assign(this.load().profiles.me, p); this.persist(); },
    async getPage(owner) { const d = this.load(); const ok = owner === 'me' || this.isFriend(owner); const p = d.pages[owner]; return ok && p ? { data: p, updated_at: (d.updated || {})[owner] || new Date().toISOString() } : null; },
    isFriend(x) { return this.load().friendships.some((f) => f.status === 'accepted' && ((f.requester === x && f.addressee === 'me') || (f.addressee === x && f.requester === 'me'))); },
    async savePage(data) { const d = this.load(); d.pages.me = JSON.parse(JSON.stringify(data)); d.updated = d.updated || {}; d.updated.me = new Date().toISOString(); this.persist(); },
    upload(blob) { return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); }); },
    async findHandle(h) { return Object.values(this.load().profiles).find((p) => p.handle === h) || null; },
    async profiles(ids) { const d = this.load(); return ids.map((i) => d.profiles[i]).filter(Boolean); },
    async friendships() { return this.load().friendships; },
    async request(to) {
      const d = this.load();
      if (d.friendships.some((f) => [f.requester, f.addressee].includes(to))) throw new Error('dup');
      d.friendships.push({ id: uid(), requester: 'me', addressee: to, status: 'pending' });
      this.persist();
    },
    async accept(id) { const f = this.load().friendships.find((x) => x.id === id); if (f) f.status = 'accepted'; this.persist(); },
    async removeFriend(id) { const d = this.load(); d.friendships = d.friendships.filter((x) => x.id !== id); this.persist(); },
    async comments(owner) { return this.load().comments.filter((c) => c.page_owner === owner).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async addComment(owner, body) { this.load().comments.push({ id: uid(), page_owner: owner, author: 'me', body, created_at: new Date().toISOString() }); this.persist(); },
    async delComment(id) { const d = this.load(); d.comments = d.comments.filter((c) => c.id !== id); this.persist(); },
    async reactions(owner) { return this.load().reactions.filter((r) => r.page_owner === owner); },
    async addReaction(owner, r) { this.load().reactions.push({ id: uid(), page_owner: owner, author: 'me', emoji: '', image_url: '', ...r, created_at: new Date().toISOString() }); this.persist(); },
    async delReaction(id) { const d = this.load(); d.reactions = d.reactions.filter((r) => r.id !== id); this.persist(); },
    async updReaction(id, patch) { const r = this.load().reactions.find((x) => x.id === id); if (r) Object.assign(r, patch); this.persist(); }
  };

  const api = () => (ui.so.demo ? Demo : Sb);

  /* =========================================================
     불러온 정보 (화면 그릴 때 씀)
     ========================================================= */
  const st = { status: 'idle', me: null, profile: null, friends: [], incoming: [], outgoing: [], myPage: null, visit: null, error: '' };
  App.socialState = st;

  async function refresh(opts = {}) {
    const A = api();
    st.error = '';
    try {
      if (!ui.so.demo && !Sb.configured()) { st.status = 'setup'; return render(); }
      const me = await A.me();
      if (!me) { st.status = 'login'; return render(); }
      st.me = me.id;
      const prof = await A.myProfile();
      if (!prof || prof.missing) { st.status = 'handle'; st.meta = prof ? prof.meta : {}; return render(); }
      st.profile = prof;
      if (!ui.so.demo) pullProfile(prof);
      const fs = await A.friendships();
      const others = [...new Set(fs.map((f) => (f.requester === me.id ? f.addressee : f.requester)))];
      const profs = await A.profiles(others);
      const byId = Object.fromEntries(profs.map((p) => [p.id, p]));
      st.friends = fs.filter((f) => f.status === 'accepted').map((f) => ({ f, p: byId[f.requester === me.id ? f.addressee : f.requester] })).filter((x) => x.p);
      st.incoming = fs.filter((f) => f.status === 'pending' && f.addressee === me.id).map((f) => ({ f, p: byId[f.requester] })).filter((x) => x.p);
      st.outgoing = fs.filter((f) => f.status === 'pending' && f.requester === me.id).map((f) => ({ f, p: byId[f.addressee] })).filter((x) => x.p);
      if (!opts.skipPage) {
        const owner = ui.so.tab === 'visit' && ui.so.visit ? ui.so.visit : me.id;
        const page = await A.getPage(owner);
        const ownerProf = owner === me.id ? prof : (byId[owner] || (await A.profiles([owner]))[0]);
        const isFriend = owner === me.id || st.friends.some((x) => x.p.id === owner);
        let comments = [], reactions = [];
        if (isFriend) { [comments, reactions] = await Promise.all([A.comments(owner), A.reactions(owner)]); }
        const authorIds = [...new Set([...comments.map((c) => c.author), ...reactions.map((r) => r.author)])];
        const bannerIds = normBanners(ui.so.tab === 'edit' ? S().draft.banners : ((page && page.data && page.data.banners) || [])).map((b) => b.id);
        const extra = await A.profiles([...new Set([...authorIds, ...bannerIds])].filter((i) => i !== me.id));
        const names = Object.fromEntries([...extra, prof, ...(ownerProf ? [ownerProf] : [])].map((p) => [p.id, p]));
        const data = ui.so.tab === 'edit' ? S().draft : (page ? page.data : null);
        st.view = { owner, prof: ownerProf, data, isFriend, comments, reactions, names, published: page ? page.updated_at : null };
        if (owner === me.id && page && !S().pulled) { // 다른 기기에서 쓴 내 페이지를 처음 한 번 가져오기
          S().draft = JSON.parse(JSON.stringify(page.data)); S().pulled = true; S(); if (ui.so.tab === 'edit') st.view.data = S().draft; save();
        }
      }
      st.status = 'ready';
    } catch (e) {
      console.error(e);
      st.status = 'error';
      st.error = (e && e.message) || String(e);
    }
    render();
  }

  function render() { if (App.ui.view === 'social') App.renderMain(); }

  /* =========================================================
     페이지 그리기
     ========================================================= */
  function patternCSS(bg) {
    const dark = bg.color === '#1d2027';
    const c = dark ? 'rgba(255,255,255,.08)' : 'rgba(47,164,222,.16)';
    if (bg.pattern === 'dot') return `background-image:radial-gradient(${c} 1.6px, transparent 2px);background-size:18px 18px;`;
    if (bg.pattern === 'grid') return `background-image:linear-gradient(${c} 1px, transparent 1px),linear-gradient(90deg, ${c} 1px, transparent 1px);background-size:20px 20px;`;
    if (bg.pattern === 'check') return `background-image:conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0);background-size:28px 28px;`;
    if (bg.pattern === 'heart') return `background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 24 24'%3E%3Cpath fill='%23f48fb1' fill-opacity='.22' d='M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z'/%3E%3C/svg%3E");background-size:26px 26px;`;
    return '';
  }
  const avatar = (p, cls = '') => `<span class="so-av ${cls}">${p && p.avatar_url ? `<img src="${esc(App.safeImg(p.avatar_url))}" alt="">` : esc(((p && p.name) || '?').charAt(0))}</span>`;
  const todayTodosForPage = (d) => (d.todos.auto ? App.todayTodos().map((x) => ({ text: x.text, done: !!x.done })) : d.todos.items);

  function pageHTML(v, opts = {}) {
    const d = v.data || {};
    const p = v.prof || {};
    const bg = d.bg || { color: '#ffffff', pattern: 'none' };
    const dark = bg.color === '#1d2027';
    const todos = opts.mine ? todayTodosForPage(d) : ((d.todos && d.todos.items) || []);
    const banners = normBanners(d.banners).map((b) => ({ ...b, p: v.names[b.id] })).filter((b) => b.p);
    const bgm = d.bgm && (d.bgm.url || d.bgm.yt) ? d.bgm : null;
    const custom = d.custom || { html: '', css: '' };
    const bgmKey = bgm ? (bgm.yt || bgm.url) : '';
    return `
    <div class="so-page ${dark ? 'dark' : ''} ${opts.placing ? 'placing' : ''}" id="soPage" style="width:${PAGE_W}px;background-color:${esc(bg.color)};${patternCSS(bg)}">
      ${custom.css ? `<style>${scopeCSS(custom.css)}</style>` : ''}
      <header class="so-head">
        ${avatar(p, 'big')}
        <div class="so-who"><b>${esc(p.name || '')}</b><span>@${esc(p.handle || '')}</span>${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</div>
      </header>
      ${bgm ? `<div class="so-bgm"><button type="button" class="so-bgm-btn" data-act="so-bgm-play" data-key="${esc(bgmKey)}" data-url="${esc(bgm.url || '')}" data-yt="${esc(bgm.yt || '')}" data-title="${esc(bgm.title)}" data-who="${esc(p.name || '')}" aria-label="BGM">${svg(App.player && App.player.isGuest(bgmKey) ? 'pause' : 'play')}</button><span class="so-bgm-text">♫ <b>${esc(bgm.title || 'BGM')}</b>${bgm.artist ? ` · ${esc(bgm.artist)}` : ''}</span></div>` : ''}
      <section class="so-box">
        <h4>${t('so.todo')}</h4>
        ${todos.length ? `<ul class="so-todos">${todos.map((x) => `<li class="${x.done ? 'done' : ''}"><span class="so-ck">${x.done ? '✓' : ''}</span>${esc(x.text)}</li>`).join('')}</ul>` : `<p class="so-empty">${t('so.noTodo')}</p>`}
      </section>
      <section class="so-box so-line">
        <h4>${t('so.line')}</h4>
        <p><span class="so-mood">${esc((d.line && d.line.mood) || '')}</span>${esc((d.line && d.line.text) || '') || `<span class="so-empty">${t('so.noLine')}</span>`}</p>
      </section>
      ${d.pair && d.pair.url ? `<section class="so-box so-pair"><img src="${esc(App.safeImg(d.pair.url))}" alt=""></section>` : ''}
      ${custom.html ? `<section class="so-custom">${soHTML(custom.html)}</section>` : ''}
      ${banners.length ? `<section class="so-box"><h4>${t('so.banners')}</h4><div class="so-banners">${banners.map((b) => { const img = App.safeImg(b.p.banner_url); return `<button type="button" class="so-banner ${img ? 'img' : ''}" data-act="so-visit" data-id="${esc(b.id)}" title="${esc(b.p.name)} @${esc(b.p.handle)}">${img ? `<img src="${esc(img)}" alt="${esc(b.p.name)}">` : `${avatar(b.p)}<span>${esc(b.p.name)}</span>`}</button>`; }).join('')}</div></section>` : ''}
      <div class="so-layer">
        ${(d.stickers || []).map((s) => `<div class="so-st ${opts.mine && ui.so.selSt === s.id ? 'sel' : ''} ${opts.mine ? 'mine' : ''}" data-sid="${esc(s.id)}" style="left:${s.x}%;top:${s.y}%;width:${s.w}px;transform:translate(-50%,-50%) rotate(${s.r || 0}deg)">${s.emoji ? `<span style="font-size:${Math.round(s.w * 0.86)}px">${esc(s.emoji)}</span>` : `<img src="${esc(App.safeImg(s.url))}" alt="">`}${opts.mine && ui.so.selSt === s.id ? '<span class="h h-size" data-h="size"></span><button type="button" class="h h-del" data-h="del">×</button>' : ''}</div>`).join('')}
        ${v.reactions.map((r) => {
          const who = v.names[r.author];
          const can = r.author === st.me || v.owner === st.me;
          const sel = can && ui.so.selR === r.id;
          const w = r.w || (r.image_url ? 90 : 46);
          return `<div class="so-react ${can ? 'can' : ''} ${sel ? 'sel' : ''}" data-rid="${esc(r.id)}" style="left:${r.x}%;top:${r.y}%;width:${w}px;transform:translate(-50%,-50%) rotate(${r.r || 0}deg)" title="${esc(who ? who.name : '')}">${r.image_url ? `<img src="${esc(App.safeImg(r.image_url))}" alt="" draggable="false">` : `<span style="font-size:${Math.round(w * 0.86)}px">${esc(r.emoji)}</span>`}${sel ? `<span class="h h-rot" data-h="rot"></span><span class="h h-size" data-h="size"></span><button type="button" class="h h-del" data-h="del" aria-label="${t('c.delete')}">×</button>` : ''}</div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function commentsHTML(v) {
    return `
      <div class="card so-comments">
        <h3>${t('so.guestbook')} <span class="muted small">${v.comments.length}</span></h3>
        <div class="add-row"><input class="input" id="soComment" maxlength="500" data-enter="so-comment" placeholder="${esc(t('so.commentPh'))}"><button class="btn primary" data-act="so-comment">${t('so.send')}</button></div>
        ${v.comments.length ? `<ul class="so-clist">${v.comments.map((c) => {
          const a = v.names[c.author] || {};
          return `<li>${avatar(a)}<div class="grow"><div class="so-cmeta"><b>${esc(a.name || '')}</b><span class="muted small">${new Date(c.created_at).toLocaleString(App.loc(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div><p>${esc(c.body)}</p></div>${c.author === st.me || v.owner === st.me ? `<button class="icon-btn" data-act="so-comment-del" data-id="${esc(c.id)}" aria-label="${t('c.delete')}">${svg('x')}</button>` : ''}</li>`;
        }).join('')}</ul>` : `<p class="empty">${t('so.noComment')}</p>`}
      </div>`;
  }

  function reactTools() {
    const mine = Object.values(S().uploaded || {});
    return `
      <div class="card so-react-tools">
        <h3>${t('so.react')}</h3>
        <p class="hint" style="margin-top:0">${ui.so.place ? t('so.placeNow') : t('so.reactHint')}</p>
        <div class="emoji-grid small">${REACT_EMOJI.map((e) => `<button type="button" data-act="so-pick" data-emoji="${e}" aria-pressed="${ui.so.place && ui.so.place.emoji === e}">${e}</button>`).join('')}</div>
        ${App.D.stickers.length ? `<div class="sticker-grid">${App.D.stickers.map((s) => `<div class="sticker-cell"><button type="button" class="sticker-btn" data-act="so-pick" data-asset="${esc(s.assetId)}" aria-pressed="${ui.so.place && ui.so.place.asset === s.assetId}"><img data-asset="${esc(s.assetId)}" alt=""></button></div>`).join('')}</div>` : ''}
        <button class="btn small" data-act="so-pick-photo">${svg('image')}${t('so.photoSticker')}</button>
        ${ui.so.place ? `<button class="btn small ghost" data-act="so-pick-cancel">${t('c.cancel')}</button>` : ''}
        ${mine.length ? '' : ''}
      </div>`;
  }

  /* ---------- 내 페이지 편집 패널 ---------- */
  function editPanel() {
    const d = S().draft, p = st.profile;
    const sec = (title, body) => `<section class="ed-sec"><h3>${title}</h3>${body}</section>`;
    return `
      ${sec(t('so.profile'), `
        <div class="row gap-s">
          <button class="so-av big btnlike" data-act="so-avatar" title="${t('cu.upload')}">${p.avatar_url ? `<img src="${esc(App.safeImg(p.avatar_url))}" alt="">` : esc((p.name || '?').charAt(0))}</button>
          <div class="grow stack-s" style="margin:0">
            <input class="input" id="soName" value="${esc(p.name)}" placeholder="${esc(t('cu.name'))}" data-change="so-profile" data-k="name">
            <span class="muted small">@${esc(p.handle)} <button class="link-btn" data-act="so-copy-handle">${t('c.copy')}</button></span>
          </div>
        </div>
        <input class="input" value="${esc(p.bio)}" maxlength="80" placeholder="${esc(t('so.bioPh'))}" data-change="so-profile" data-k="bio">
`)}
      ${sec(t('so.myBanner'), `
        <div class="so-banner-slot ${p.banner_url ? 'has' : ''}">${p.banner_url ? `<img src="${esc(App.safeImg(p.banner_url))}" alt="">` : `<span>${BANNER_W} × ${BANNER_H}</span>`}</div>
        <div class="row gap-xs wrap"><button class="btn small primary" data-act="so-banner-upload">${svg('upload')}${p.banner_url ? t('so.bannerChange') : t('so.bannerUpload')}</button>${p.banner_url ? `<button class="btn small ghost" data-act="so-banner-del">${t('c.delete')}</button>` : ''}</div>
        <div class="tip">${t('so.myBannerTip', { w: BANNER_W, h: BANNER_H })}</div>`)}
      ${sec(t('so.todo'), `
        <label class="switch"><input type="checkbox" data-change="so-todo-auto" ${d.todos.auto ? 'checked' : ''}><span class="sw-track"></span>${t('so.todoAuto')}</label>
        ${d.todos.auto ? `<div class="tip">${t('so.todoAutoTip')}</div>` : `
          <ul class="item-list">${d.todos.items.map((x, i) => `<li class="item ${x.done ? 'done' : ''}"><input type="checkbox" class="check" data-change="so-todo-toggle" data-i="${i}" ${x.done ? 'checked' : ''}><span class="txt">${esc(x.text)}</span><button class="icon-btn" data-act="so-todo-del" data-i="${i}" aria-label="${t('c.delete')}">${svg('x')}</button></li>`).join('')}</ul>
          <input class="input quick" data-enter="so-todo-add" placeholder="${esc(t('task.todoPh'))}">`}`)}
      ${sec(t('so.line'), `
        <div class="row gap-xs"><select class="input select emoji-select" data-change="so-set" data-k="line.mood">${MOODS.map((m) => `<option ${d.line.mood === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <input class="input grow" maxlength="80" value="${esc(d.line.text)}" placeholder="${esc(t('so.linePh'))}" data-input="so-set" data-k="line.text"></div>`)}
      ${sec(t('so.pair'), `
        ${d.pair.url ? `<img class="so-pair-prev" src="${esc(App.safeImg(d.pair.url))}" alt="">` : ''}
        <div class="row gap-xs"><button class="btn small" data-act="so-pair-upload">${svg('image')}${d.pair.url ? t('cc.bgChange') : t('so.pairUpload')}</button>${d.pair.url ? `<button class="btn small ghost" data-act="so-pair-del">${t('c.delete')}</button>` : ''}</div>`)}
      ${sec(t('so.stickers'), `
        <div class="emoji-grid small">${STICKER_EMOJI.map((e) => `<button type="button" data-act="so-st-emoji" data-v="${e}">${e}</button>`).join('')}</div>
        <div class="row gap-xs wrap"><button class="btn small" data-act="so-st-photo">${svg('image')}${t('so.photoSticker')}</button></div>
        <div class="tip">${t('so.stTip')}</div>
        ${ui.so.selSt ? (() => { const s = d.stickers.find((x) => x.id === ui.so.selSt); return s ? `<div class="sub-box"><b>${t('dk.selected')}</b><label><span class="label">${t('dk.rotate')}</span><div class="range-row"><input type="range" min="-180" max="180" value="${s.r || 0}" data-input="so-st-rot"><output>${s.r || 0}°</output></div></label></div>` : ''; })() : ''}`)}
      ${sec(t('so.bg'), `
        <div class="colors">${BG_COLORS.map((c) => `<button type="button" class="color-dot" style="background:${c}" data-act="so-set-btn" data-k="bg.color" data-v="${c}" aria-pressed="${d.bg.color === c}" aria-label="${c}"></button>`).join('')}</div>
        <div class="seg wrap-seg">${PATTERNS.map((x) => `<button data-act="so-set-btn" data-k="bg.pattern" data-v="${x}" aria-pressed="${d.bg.pattern === x}">${t('so.pt.' + x)}</button>`).join('')}</div>`)}
      ${sec(t('so.banners'), st.friends.length ? `
        <div class="tip">${t('so.bannersTip')}</div>
        ${st.friends.map(({ p: f }) => { const b = d.banners.find((x) => x.id === f.id); return `<div class="banner-edit">
          <label class="switch"><input type="checkbox" data-change="so-banner-toggle" data-id="${esc(f.id)}" ${b ? 'checked' : ''}><span class="sw-track"></span>${esc(f.name)} <span class="muted small">@${esc(f.handle)}</span></label>
          <div class="so-banner-slot mini ${f.banner_url ? 'has' : ''}">${f.banner_url ? `<img src="${esc(App.safeImg(f.banner_url))}" alt="">` : `<span>${t('so.noBannerYet')}</span>`}</div>
        </div>`; }).join('')}` : `<p class="hint" style="margin:0">${t('so.noFriendsYet')}</p>`)}
      ${sec(t('so.customTitle'), `
        <p class="hint" style="margin:0">${t('so.customHelp')}</p>
        <span class="label">HTML</span>
        <textarea class="input code" rows="6" spellcheck="false" data-input="so-custom" data-k="html" placeholder="&lt;div class=&quot;hello&quot;&gt;🌊 어서 와!&lt;/div&gt;">${esc(d.custom.html)}</textarea>
        <span class="label">CSS</span>
        <textarea class="input code" rows="8" spellcheck="false" data-input="so-custom" data-k="css" placeholder=".hello { font-size: 22px; color: #2fa4de; }&#10;.so-box { border-radius: 0; }">${esc(d.custom.css)}</textarea>
        <details class="ref"><summary>${t('so.customClasses')}</summary><div class="ref-cols"><div>${SO_CLASSES.map((c) => `<code>${c}</code>`).join(' ')}</div></div></details>`)}
      ${App.on('music') ? sec('BGM', `
        ${App.D.music.tracks.length ? `<select class="input select" data-change="so-bgm-pick"><option value="">${t('so.bgmNone')}</option>${App.D.music.tracks.map((x) => `<option value="${esc(x.id)}" ${d.bgm.trackId === x.id ? 'selected' : ''}>${esc(x.title)}${x.artist ? ' · ' + esc(x.artist) : ''}</option>`).join('')}</select>` : `<p class="hint" style="margin:0">${t('so.bgmEmpty')}</p><button class="btn small" data-act="nav" data-view="music">${t('so.bgmGo')}</button>`}
        ${d.bgm.url || d.bgm.yt ? `<div class="tip">♫ ${esc(d.bgm.title)} ${t('so.bgmSet')}</div>` : `<div class="tip">${t('so.bgmTip')}</div>`}`) : ''}`;
  }

  /* ---------- 화면 ---------- */
  App.VIEWS.social = function () {
    if (st.status === 'idle') { setTimeout(refresh, 0); return `<section class="view"><p class="empty center">${t('so.loading')}</p></section>`; }
    const demoBar = ui.so.demo ? `<div class="banner row wrap" style="justify-content:space-between">${t('so.demoNote')}<button class="btn small" data-act="so-demo-exit">${t('so.demoExit')}</button></div>` : '';
    if (st.status === 'setup') return setupView();
    if (st.status === 'login') return loginView();
    if (st.status === 'handle') return handleView();
    if (st.status === 'error') return `<section class="view narrow"><header class="view-head"><h2 class="view-title">${t('nav.social')}</h2></header><div class="card stack"><p>${t('so.error')}</p><code class="small">${esc(st.error)}</code><div class="row gap-xs"><button class="btn primary" data-act="so-retry">${t('so.retry')}</button>${Sb.builtin() ? '' : `<button class="btn" data-act="so-setup-open">${t('so.setupEdit')}</button>`}</div></div></section>`;
    if (st.status !== 'ready') return `<section class="view"><p class="empty center">${t('so.loading')}</p></section>`;

    const tabs = `<div class="seg">${[['mine', t('so.myPage')], ['edit', t('so.edit')], ['friends', `${t('so.friends')} ${st.friends.length}${st.incoming.length ? ` <span class="badge">${st.incoming.length}</span>` : ''}`]].map(([k, l]) => `<button data-act="so-tab" data-v="${k}" aria-pressed="${ui.so.tab === k}">${l}</button>`).join('')}</div>`;
    const head = `<header class="view-head"><h2 class="view-title">${t('nav.social')}</h2><div class="row gap-xs wrap">${tabs}<button class="icon-btn" data-act="so-refresh" title="${t('so.refresh')}">${svg('reset')}</button><button class="btn small ghost" data-act="so-logout">${ui.so.demo ? t('so.demoExit') : t('so.logout')}</button></div></header>`;

    if (ui.so.tab === 'friends') return `<section class="view narrow">${head}${demoBar}${friendsView()}</section>`;

    const v = st.view;
    if (!v) return `<section class="view">${head}<p class="empty center">${t('so.loading')}</p></section>`;
    if (ui.so.tab === 'visit') {
      const back = `<button class="btn small" data-act="so-tab" data-v="friends">${svg('left')}${t('so.back')}</button>`;
      if (!v.isFriend || !v.data) {
        const pending = st.outgoing.some((x) => x.p.id === v.owner);
        return `<section class="view narrow">${head}${demoBar}<div class="row gap-xs">${back}</div><div class="card empty-card">${avatar(v.prof || {}, 'big')}<p><b>${esc((v.prof && v.prof.name) || '')}</b> @${esc((v.prof && v.prof.handle) || '')}</p><p>${v.isFriend ? t('so.notPublished') : t('so.friendsOnly')}</p>${!v.isFriend ? `<button class="btn primary" data-act="so-request" data-id="${esc(v.owner)}" ${pending ? 'disabled' : ''}>${pending ? t('so.requested') : t('so.requestBtn')}</button>` : ''}</div></section>`;
      }
      return `<section class="view so-visit">${head}${demoBar}<div class="row gap-xs" style="margin-bottom:12px">${back}<span class="muted small">${v.published ? t('so.updated', { d: new Date(v.published).toLocaleString(App.loc(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) : ''}</span></div>
        <div class="so-wrap"><div class="so-stage" id="soStage"><div class="so-scale" id="soScale">${pageHTML(v, { placing: !!ui.so.place })}</div></div>
        <div class="stack">${reactTools()}${commentsHTML(v)}</div></div></section>`;
    }
    // 내 페이지 — 이웃에게 보이는 그대로
    if (ui.so.tab === 'mine') {
      if (!v.data) return `<section class="view narrow">${head}${demoBar}<div class="card empty-card"><p>${t('so.neverPublished')}</p><button class="btn primary" data-act="so-tab" data-v="edit">${t('so.goEdit')}</button></div></section>`;
      return `<section class="view so-visit">${head}${demoBar}
        <div class="row gap-xs wrap" style="margin-bottom:12px"><span class="muted small">${t('so.asOthers')}${v.published ? ' · ' + t('so.updated', { d: new Date(v.published).toLocaleString(App.loc(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) : ''}</span>${S().dirty ? `<span class="due soon">${t('so.unpublished')}</span>` : ''}<button class="btn small push-right" data-act="so-tab" data-v="edit">${svg('edit')}${t('so.edit')}</button></div>
        <div class="so-wrap"><div class="so-stage" id="soStage"><div class="so-scale" id="soScale">${pageHTML(v, {})}</div></div>
        <div class="stack">${commentsHTML(v)}</div></div></section>`;
    }
    // 꾸미기
    const dirty = S().dirty;
    return `<section class="view so-mine">${head}${demoBar}
      <div class="so-wrap edit">
        <aside class="ed-panel so-panel">${editPanel()}</aside>
        <div class="stack">
          <div class="row gap-xs wrap so-publish"><span class="muted small">${dirty ? t('so.unpublished') : (v.published ? t('so.updated', { d: new Date(v.published).toLocaleString(App.loc(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }) : t('so.neverPublished'))}</span><button class="btn primary" data-act="so-publish">${t('so.publish')}</button></div>
          <div class="so-stage" id="soStage"><div class="so-scale" id="soScale">${pageHTML(v, { mine: true })}</div></div>
        </div>
      </div></section>`;
  };

  function friendsView() {
    const fcard = (p, actions) => `<li class="so-friend">${avatar(p)}<div class="grow"><b>${esc(p.name)}</b> <span class="muted small">@${esc(p.handle)}</span>${p.bio ? `<p class="small muted">${esc(p.bio)}</p>` : ''}</div><div class="row gap-xs">${actions}</div></li>`;
    return `
      <div class="card stack">
        <div class="row wrap" style="justify-content:space-between"><h3 style="margin:0">${t('so.findFriend')}</h3><span class="muted small">${t('so.myHandle')} <b>@${esc(st.profile.handle)}</b> <button class="link-btn" data-act="so-copy-handle">${t('c.copy')}</button></span></div>
        <div class="add-row" style="margin:0"><input class="input" id="soFind" placeholder="${esc(t('so.findPh'))}" data-enter="so-find" autocapitalize="off"><button class="btn primary" data-act="so-find">${t('c.search')}</button></div>
        <div id="soFindResult"></div>
      </div>
      ${st.incoming.length ? `<h3 class="group-label">${t('so.incoming')}</h3><ul class="so-flist">${st.incoming.map(({ f, p }) => fcard(p, `<button class="btn small primary" data-act="so-accept" data-id="${esc(f.id)}">${t('so.accept')}</button><button class="btn small ghost" data-act="so-unfriend" data-id="${esc(f.id)}">${t('so.decline')}</button>`)).join('')}</ul>` : ''}
      <h3 class="group-label">${t('so.friends')} ${st.friends.length}</h3>
      ${st.friends.length ? `<ul class="so-flist">${st.friends.map(({ f, p }) => fcard(p, `<button class="btn small primary" data-act="so-visit" data-id="${esc(p.id)}">${t('so.visit')}</button><button class="icon-btn" data-act="so-unfriend" data-id="${esc(f.id)}" data-confirm="1" title="${t('so.unfriend')}">${svg('x')}</button>`)).join('')}</ul>` : `<p class="empty">${t('so.noFriends')}</p>`}
      ${st.outgoing.length ? `<h3 class="group-label">${t('so.outgoing')}</h3><ul class="so-flist">${st.outgoing.map(({ f, p }) => fcard(p, `<button class="btn small ghost" data-act="so-unfriend" data-id="${esc(f.id)}">${t('so.cancelReq')}</button>`)).join('')}</ul>` : ''}`;
  }

  function setupView() {
    const s = Sb.cfg();
    return `<section class="view narrow">
      <header class="view-head"><h2 class="view-title">${t('nav.social')}</h2></header>
      <div class="card stack">
        <h3 style="margin:0">${t('so.setupTitle')}</h3>
        <p class="hint" style="margin:0">${t('so.setupDesc')}</p>
        <ol class="so-steps">${t('so.setupSteps')}</ol>
        <label class="field"><span class="label">Project URL</span><input class="input" id="sbUrl" value="${esc(s.url)}" placeholder="https://xxxx.supabase.co"></label>
        <label class="field"><span class="label">anon public key</span><input class="input code" id="sbKey" value="${esc(s.key)}" placeholder="eyJhbGciOi…"></label>
        <div class="row gap-xs wrap"><button class="btn primary" data-act="so-setup-save">${t('so.connect')}</button><button class="btn" data-act="so-demo">${t('so.tryDemo')}</button></div>
      </div>
    </section>`;
  }
  function loginView() {
    const signup = ui.so.signup;
    return `<section class="view narrow">
      <header class="view-head"><h2 class="view-title">${t('nav.social')}</h2></header>
      <div class="card stack so-auth">
        <div class="seg"><button data-act="so-auth-mode" data-v="in" aria-pressed="${!signup}">${t('so.login')}</button><button data-act="so-auth-mode" data-v="up" aria-pressed="${!!signup}">${t('so.signup')}</button></div>
        <input class="input" id="soEmail" type="email" autocomplete="email" placeholder="${esc(t('so.email'))}">
        <input class="input" id="soPw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${esc(t('so.password'))}" data-enter="so-auth">
        ${signup ? `<input class="input" id="soHandle" placeholder="${esc(t('so.handlePh'))}" autocapitalize="off"><input class="input" id="soNameIn" placeholder="${esc(t('cu.name'))}" value="${esc(App.D.profile.name || '')}"><div class="tip">${t('so.handleTip')}</div>` : ''}
        <button class="btn primary block" data-act="so-auth">${signup ? t('so.signup') : t('so.login')}</button>
        <p class="error-text" id="soAuthErr"></p>
        ${Sb.builtin() ? '' : `<button class="link-btn" data-act="so-setup-open">${t('so.setupEdit')}</button>`}
      </div>
    </section>`;
  }
  function handleView() {
    const m = st.meta || {};
    return `<section class="view narrow"><header class="view-head"><h2 class="view-title">${t('nav.social')}</h2></header>
      <div class="card stack so-auth"><h3 style="margin:0">${t('so.handleTitle')}</h3>
        <input class="input" id="soHandle" value="${esc(m.handle || '')}" placeholder="${esc(t('so.handlePh'))}" autocapitalize="off">
        <input class="input" id="soNameIn" value="${esc(m.name || App.D.profile.name || '')}" placeholder="${esc(t('cu.name'))}">
        <div class="tip">${t('so.handleTip')}</div>
        <button class="btn primary" data-act="so-handle-save">${t('c.save')}</button><p class="error-text" id="soAuthErr"></p></div></section>`;
  }

  /* ---------- 크기 맞추기 ---------- */
  function fit() {
    const stage = App.$('#soStage'), scale = App.$('#soScale'), page = App.$('#soPage');
    if (!stage || !scale || !page) return;
    const s = Math.min(1, stage.clientWidth / PAGE_W);
    ui.so.scale = s;
    page.style.transform = `scale(${s})`;
    scale.style.width = PAGE_W * s + 'px';
    scale.style.height = page.offsetHeight * s + 'px';
  }
  App.after.social = () => { fit(); App.hydrateAssets(App.$('#main')); App.$$('#soPage img').forEach((i) => { if (!i.complete) i.addEventListener('load', fit, { once: true }); }); };
  window.addEventListener('resize', () => { if (App.ui.view === 'social') fit(); });
  App.onLeave = App.onLeave || {};
  App.onLeave.social = () => { ui.so.place = null; ui.so.selSt = null; ui.so.selR = null; };

  /* ---------- 내 페이지 스티커 끌기 / 반응 붙이기 ---------- */
  let drag = null;
  document.addEventListener('pointerdown', (ev) => {
    const page = ev.target.closest && ev.target.closest('#soPage');
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * 100, py = ((ev.clientY - rect.top) / rect.height) * 100;
    // 이웃 페이지에 반응 붙이기
    if (ui.so.place && ui.so.tab === 'visit') { ev.preventDefault(); placeReaction(px, py); return; }
    // 내가 붙인 스티커 / 내 페이지에 붙은 스티커는 눌러서 고르고 끌어서 고치기
    const rEl = ev.target.closest('.so-react.can');
    const v = st.view;
    if (rEl && v) {
      const r = v.reactions.find((x) => x.id === rEl.dataset.rid);
      if (!r) return;
      ev.preventDefault();
      if (ev.target.dataset.h === 'del') { ui.so.selR = null; busy(async () => { await api().delReaction(r.id); refresh(); })(); return; }
      if (ui.so.selR !== r.id) { ui.so.selR = r.id; ui.so.selSt = null; App.renderMain(); }
      const el = App.$(`.so-react[data-rid="${r.id}"]`) || rEl;
      const er = el.getBoundingClientRect();
      rdrag = { r, el, mode: ev.target.dataset.h || 'move', sx: ev.clientX, sy: ev.clientY, x: r.x, y: r.y, w: r.w || (r.image_url ? 90 : 46), rect, cx: er.left + er.width / 2, cy: er.top + er.height / 2, moved: false };
      return;
    }
    if (ui.so.selR) { ui.so.selR = null; App.renderMain(); }
    if (ui.so.tab !== 'edit') return;
    const el = ev.target.closest('.so-st.mine');
    const d = S().draft;
    if (!el) { if (ui.so.selSt) { ui.so.selSt = null; App.renderMain(); } return; }
    const s = d.stickers.find((x) => x.id === el.dataset.sid);
    if (!s) return;
    ev.preventDefault();
    if (ev.target.dataset.h === 'del') { d.stickers = d.stickers.filter((x) => x.id !== s.id); ui.so.selSt = null; dirty(); App.renderMain(); return; }
    if (ui.so.selSt !== s.id) { ui.so.selSt = s.id; App.renderMain(); }
    drag = { s, mode: ev.target.dataset.h || 'move', sx: ev.clientX, sy: ev.clientY, x: s.x, y: s.y, w: s.w, rect };
  });
  document.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const s = drag.s;
    if (drag.mode === 'size') s.w = Math.max(24, Math.round(drag.w + (ev.clientX - drag.sx) / (ui.so.scale || 1)));
    else {
      s.x = Math.max(0, Math.min(100, drag.x + ((ev.clientX - drag.sx) / drag.rect.width) * 100));
      s.y = Math.max(0, Math.min(100, drag.y + ((ev.clientY - drag.sy) / drag.rect.height) * 100));
    }
    const el = App.$(`.so-st[data-sid="${s.id}"]`);
    if (el) { el.style.left = s.x + '%'; el.style.top = s.y + '%'; el.style.width = s.w + 'px'; const sp = el.querySelector('span:not(.h)'); if (sp) sp.style.fontSize = Math.round(s.w * 0.86) + 'px'; }
  });
  document.addEventListener('pointerup', () => { if (drag) { drag = null; dirty(); } });

  let rdrag = null;
  document.addEventListener('pointermove', (ev) => {
    if (!rdrag) return;
    const d = rdrag, r = d.r;
    if (Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) > 2) d.moved = true;
    if (d.mode === 'size') {
      const d0 = Math.hypot(d.sx - d.cx, d.sy - d.cy) || 1;
      r.w = Math.round(Math.max(20, Math.min(400, d.w * (Math.hypot(ev.clientX - d.cx, ev.clientY - d.cy) / d0))));
    } else if (d.mode === 'rot') {
      r.r = Math.round((Math.atan2(ev.clientY - d.cy, ev.clientX - d.cx) * 180) / Math.PI + 90);
      if (Math.abs(r.r % 90) < 4) r.r = Math.round(r.r / 90) * 90;
    } else {
      r.x = Math.max(0, Math.min(100, d.x + ((ev.clientX - d.sx) / d.rect.width) * 100));
      r.y = Math.max(0, Math.min(100, d.y + ((ev.clientY - d.sy) / d.rect.height) * 100));
    }
    const el = App.$(`.so-react[data-rid="${r.id}"]`);
    if (!el) return;
    el.style.left = r.x + '%'; el.style.top = r.y + '%'; el.style.width = (r.w || d.w) + 'px';
    el.style.transform = `translate(-50%,-50%) rotate(${r.r || 0}deg)`;
    const sp = el.querySelector('span:not(.h)'); if (sp) sp.style.fontSize = Math.round((r.w || d.w) * 0.86) + 'px';
  });
  const rEnd = () => {
    if (!rdrag) return;
    const { r, moved } = rdrag; rdrag = null;
    if (!moved) return;
    const patch = { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, r: Math.round(r.r || 0) };
    if (r.w) patch.w = r.w;
    busy(async () => { await api().updReaction(r.id, patch); })();
  };
  document.addEventListener('pointerup', rEnd);
  document.addEventListener('pointercancel', rEnd);

  async function placeReaction(x, y) {
    const pl = ui.so.place;
    ui.so.place = null;
    try {
      let image_url = '';
      if (pl.asset) image_url = await uploadAsset(pl.asset);
      if (pl.blob) image_url = await api().upload(pl.blob);
      await api().addReaction(ui.so.visit, { emoji: pl.emoji || '', image_url, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round(Math.random() * 30 - 15) });
      App.toast(t('so.reacted'));
    } catch (e) { App.toast(t('so.failed')); console.error(e); }
    refresh();
  }
  async function uploadAsset(assetId) {
    const s = S();
    const key = (ui.so.demo ? 'demo:' : '') + assetId;
    if (s.uploaded[key]) return s.uploaded[key];
    const blob = await Assets.getBlob(assetId);
    const url = await api().upload(blob);
    s.uploaded[key] = url; save();
    return url;
  }

  /* ---------- 편집 저장 ---------- */
  function dirty() { S().dirty = true; save(); const b = App.$('.so-publish .muted'); if (b) b.textContent = t('so.unpublished'); }
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
  async function uploadImage(max, alpha) {
    const [f] = await App.pickFiles('image/*');
    if (!f) return '';
    const blob = await Assets.shrinkImage(f, max, alpha);
    App.toast(t('so.uploading'));
    return api().upload(blob);
  }
  const busy = (fn) => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); App.toast(t('so.failed')); } };

  Object.assign(App.A, {
    'so-go-edit': () => { ui.so.tab = 'edit'; App.go('social'); },
    'so-tab': (el) => { ui.so.tab = el.dataset.v; ui.so.place = null; refresh({ skipPage: ui.so.tab === 'friends' }); },
    'so-refresh': () => { st.status = st.status === 'ready' ? 'ready' : 'idle'; refresh(); },
    'so-retry': () => { Sb.reset(); refresh(); },
    'so-demo': () => { ui.so.demo = true; st.status = 'idle'; refresh(); },
    'so-demo-exit': () => { ui.so.demo = false; st.status = 'idle'; ui.so.tab = 'mine'; refresh(); },
    'so-setup-open': () => { if (Sb.builtin()) return; st.status = 'setup'; App.renderMain(); },
    'so-setup-save': () => {
      const url = App.$('#sbUrl').value.trim().replace(/\/+$/, ''), key = App.$('#sbKey').value.trim();
      if (!/^https:\/\/.+/.test(url) || key.length < 20) { App.toast(t('so.setupBad')); return; }
      App.silent((d) => { d.settings.sbUrl = url; d.settings.sbKey = key; });
      Sb.reset(); ui.so.demo = false; st.status = 'idle'; refresh();
    },
    'so-auth-mode': (el) => { ui.so.signup = el.dataset.v === 'up'; App.renderMain(); },
    'so-auth': busy(async () => {
      const email = App.$('#soEmail').value.trim(), pw = App.$('#soPw').value;
      const err = App.$('#soAuthErr');
      try {
        if (ui.so.signup) {
          const handle = App.$('#soHandle').value.trim().toLowerCase(), name = App.$('#soNameIn').value.trim();
          if (!/^[a-z0-9_]{3,20}$/.test(handle)) { err.textContent = t('so.handleBad'); return; }
          if (await Sb.findHandle(handle).catch(() => null)) { err.textContent = t('so.handleTaken'); return; }
          const hasSession = await Sb.signUp(email, pw, handle, name);
          if (!hasSession) { err.textContent = t('so.checkEmail'); return; }
          await Sb.createProfile(handle, name);
        } else await Sb.signIn(email, pw);
        // 계정이 바뀌었으니 그 계정의 기록으로 다시 열기
        await Store.flush();
        location.reload();
      } catch (e) { err.textContent = authMsg(e); }
    }),
    'so-handle-save': busy(async () => {
      const handle = App.$('#soHandle').value.trim().toLowerCase(), name = App.$('#soNameIn').value.trim();
      const err = App.$('#soAuthErr');
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) { err.textContent = t('so.handleBad'); return; }
      try { await Sb.createProfile(handle, name); refresh(); } catch (e) { err.textContent = /duplicate|unique/i.test(e.message) ? t('so.handleTaken') : e.message; }
    }),
    'so-logout': busy(async () => {
      if (ui.so.demo) return App.A['so-demo-exit']();
      if (!(await App.confirmBox(t('so.logoutConfirm'), t('so.logout')))) return;
      if (App.syncNow) await App.syncNow().catch(() => {});
      await Store.flush();
      await Sb.signOut();
      location.reload();
    }),
    'so-copy-handle': () => App.copyText('@' + st.profile.handle),
    'so-find': busy(async () => {
      const h = App.$('#soFind').value.trim().replace(/^@/, '').toLowerCase();
      const box = App.$('#soFindResult');
      if (!h) return;
      const p = await api().findHandle(h);
      if (!p) { box.innerHTML = `<p class="empty">${t('so.notFound')}</p>`; return; }
      const rel = p.id === st.me ? 'me' : st.friends.some((x) => x.p.id === p.id) ? 'friend' : st.outgoing.some((x) => x.p.id === p.id) ? 'sent' : st.incoming.some((x) => x.p.id === p.id) ? 'incoming' : '';
      const btn = rel === 'me' ? '' : rel === 'friend' ? `<button class="btn small primary" data-act="so-visit" data-id="${esc(p.id)}">${t('so.visit')}</button>` : rel === 'sent' ? `<button class="btn small" disabled>${t('so.requested')}</button>` : rel === 'incoming' ? `<span class="muted small">${t('so.seeIncoming')}</span>` : `<button class="btn small primary" data-act="so-request" data-id="${esc(p.id)}">${t('so.requestBtn')}</button>`;
      box.innerHTML = `<ul class="so-flist"><li class="so-friend">${avatar(p)}<div class="grow"><b>${esc(p.name)}</b> <span class="muted small">@${esc(p.handle)}</span></div>${btn}</li></ul>`;
    }),
    'so-request': busy(async (el) => { await api().request(el.dataset.id); App.toast(t('so.requestSent')); refresh({ skipPage: ui.so.tab !== 'visit' }); }),
    'so-accept': busy(async (el) => { await api().accept(el.dataset.id); App.toast(t('so.accepted')); refresh({ skipPage: true }); }),
    'so-unfriend': busy(async (el) => {
      if (el.dataset.confirm && !(await App.confirmBox(t('so.unfriendConfirm'), t('so.unfriend')))) return;
      await api().removeFriend(el.dataset.id);
      App.silent(() => { S().draft.banners = S().draft.banners.filter((b) => st.friends.some((x) => x.p.id === b.id && x.f.id !== el.dataset.id)); });
      refresh({ skipPage: true });
    }),
    'so-visit': (el) => {
      const id = el.dataset.id;
      if (id === st.me) { ui.so.tab = 'mine'; } else { ui.so.tab = 'visit'; ui.so.visit = id; }
      ui.so.place = null;
      if (App.ui.view !== 'social') App.go('social');
      refresh();
    },
    'so-comment': busy(async () => {
      const inp = App.$('#soComment');
      const body = inp.value.trim();
      if (!body) return;
      await api().addComment(st.view.owner, body);
      refresh();
    }),
    'so-comment-del': busy(async (el) => { if (await App.confirmBox(t('c.confirmDelete'))) { await api().delComment(el.dataset.id); refresh(); } }),
    'so-react-del': busy(async (el) => { await api().delReaction(el.dataset.id); refresh(); }),
    'so-pick': (el) => {
      ui.so.place = el.dataset.emoji ? { emoji: el.dataset.emoji } : { asset: el.dataset.asset };
      App.renderMain();
    },
    'so-pick-photo': async () => {
      const [f] = await App.pickFiles('image/*');
      if (!f) return;
      ui.so.place = { blob: await Assets.shrinkImage(f, 500, true) };
      App.renderMain();
    },
    'so-pick-cancel': () => { ui.so.place = null; App.renderMain(); },
    // 내 페이지 편집
    'so-avatar': busy(async () => { const url = await uploadImage(400, true); if (url) { await api().saveProfile({ avatar_url: url }); if (!ui.so.demo) pullProfile({ ...st.profile, avatar_url: url }); refresh(); } }),
    'so-banner-upload': busy(async () => {
      const [f] = await App.pickFiles('image/png,image/jpeg,image/gif,image/webp');
      if (!f) return;
      const blob = await bannerBlob(f);
      App.toast(t('so.uploading'));
      const url = await api().upload(blob);
      await api().saveProfile({ banner_url: url });
      st.profile.banner_url = url;
      App.toast(t('so.bannerSaved'));
      refresh();
    }),
    'so-banner-del': busy(async () => { await api().saveProfile({ banner_url: '' }); st.profile.banner_url = ''; refresh(); }),
    'so-pair-upload': busy(async () => { const url = await uploadImage(1200, false); if (url) { S().draft.pair.url = url; dirty(); App.renderMain(); } }),
    'so-pair-del': () => { S().draft.pair.url = ''; dirty(); App.renderMain(); },
    'so-todo-del': (el) => { S().draft.todos.items.splice(Number(el.dataset.i), 1); dirty(); App.renderMain(); },
    'so-st-emoji': (el) => { const s = { id: uid(), emoji: el.dataset.v, x: 50 + Math.random() * 30 - 15, y: 30 + Math.random() * 30, w: 64, r: Math.round(Math.random() * 24 - 12) }; S().draft.stickers.push(s); ui.so.selSt = s.id; dirty(); App.renderMain(); },
    'so-st-photo': busy(async () => {
      const url = await uploadImage(600, true);
      if (!url) return;
      const s = { id: uid(), url, x: 50, y: 40, w: 140, r: Math.round(Math.random() * 16 - 8) };
      S().draft.stickers.push(s); ui.so.selSt = s.id; dirty(); App.renderMain();
    }),
    'so-bgm-play': (el) => {
      const P = App.player;
      if (!P) return;
      if (P.isGuest(el.dataset.key)) { P.pause(); return; }
      P.playGuest({ url: el.dataset.url, yt: el.dataset.yt, title: el.dataset.title, who: el.dataset.who });
    },
    'so-set-btn': (el) => { setPath(S().draft, el.dataset.k, el.dataset.v); dirty(); App.renderMain(); },
    'so-publish': busy(async () => {
      const d = JSON.parse(JSON.stringify(S().draft));
      d.todos = { auto: d.todos.auto, items: todayTodosForPage(S().draft) };
      await api().savePage(d);
      S().dirty = false; save();
      App.toast(t('so.published'));
      refresh();
    })
  });
  /* ---------- 프로필 연동 (꾸미기 프로필 ↔ 이웃 프로필) ---------- */
  // 이웃 프로필(이름·상태 메시지·사진)이 기준이고, 꾸미기에서 고쳐도 이웃 프로필로 바로 올라가요
  function pullProfile(prof) {
    if (!prof || prof.missing) return;
    const p = App.D.profile || {};
    const next = { name: prof.name || '', status: prof.bio || '', avatar: prof.avatar_url || '' };
    if (p.name === next.name && p.status === next.status && p.avatar === next.avatar) return;
    App.silent((d) => { Object.assign(d.profile, next); });
    if (App.renderProfile) App.renderProfile();
    if (App.renderTitle) App.renderTitle();
    if (App.ui.view === 'custom' && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('.cu-grid'))) App.renderMain();
  }
  let myProfOk = null;
  async function canPush() {
    if (!Sb.configured() || !navigator.onLine) return false;
    const u = await Sb.me();
    if (!u) return false;
    if (myProfOk !== u.id) { const pr = await Sb.myProfile(); if (!pr || pr.missing) return false; myProfOk = u.id; }
    return true;
  }
  App.soProfile = {
    async push(patch) {
      try {
        if (!(await canPush())) return false;
        await Sb.saveProfile(patch);
        if (st.profile) Object.assign(st.profile, patch);
        return true;
      } catch (e) { console.error(e); return false; }
    },
    async uploadAvatar() {
      if (!(await canPush())) return null;
      const url = await uploadImage(400, true);
      if (!url) return '';
      await Sb.saveProfile({ avatar_url: url });
      if (st.profile) st.profile.avatar_url = url;
      return url;
    },
    async pull() {
      try { if (!(await canPush())) return; pullProfile(await Sb.myProfile()); } catch (e) { /* 무시 */ }
    }
  };
  // 앱을 켜면 이웃 프로필을 한 번 받아와요
  setTimeout(() => App.soProfile.pull(), 1500);

  /* ---------- 할 일 바로 연동 ---------- */
  // '할 일에서 자동으로' 가 켜져 있으면, 할 일을 고칠 때마다 게시된 페이지의 투두만 바로 바꿔요
  let todoSig = null, todoBusy = false;
  async function syncTodos() {
    if (todoBusy || ui.so.demo) return;
    const D = App.D;
    if (!D || (D.social && D.social.draft && D.social.draft.todos && !D.social.draft.todos.auto)) return;
    if (!navigator.onLine || !Sb.configured()) return;
    const items = App.todayTodos().map((x) => ({ text: x.text, done: !!x.done }));
    const sig = JSON.stringify(items);
    if (sig === todoSig) return;
    todoBusy = true;
    try {
      const u = await Sb.me();
      if (!u) return;
      const page = await Sb.getPage(u.id);
      if (!page || !page.data) { todoSig = sig; return; } // 아직 게시한 적 없으면 그대로
      if (JSON.stringify((page.data.todos || {}).items || []) === sig) { todoSig = sig; return; }
      page.data.todos = { auto: true, items };
      const { error } = await Sb.client().from('social_pages').upsert({ owner: u.id, data: page.data, updated_at: new Date().toISOString() });
      if (!error) todoSig = sig;
    } catch (e) { /* 다음에 다시 */ } finally { todoBusy = false; }
  }
  setInterval(syncTodos, 3000);
  window.addEventListener('online', syncTodos);

  Object.assign(App.C, {
    'so-bgm-pick': busy(async (el) => {
      const d = S().draft;
      const tr = App.D.music.tracks.find((x) => x.id === el.value);
      if (!tr) { d.bgm = { url: '', yt: '', title: '', artist: '', trackId: '' }; dirty(); App.renderMain(); return; }
      if (tr.kind === 'yt') {
        if (!tr.ytId) { App.toast(t('so.bgmNoList')); el.value = d.bgm.trackId || ''; return; }
        d.bgm = { url: '', yt: tr.ytId, title: tr.title, artist: tr.artist || '', trackId: tr.id };
        dirty(); App.renderMain(); return;
      }
      const key = (ui.so.demo ? 'demo:' : '') + tr.assetId;
      let url = S().uploaded[key];
      if (!url) {
        App.toast(t('so.bgmUploading'));
        const blob = await Assets.getBlob(tr.assetId);
        if (!blob) throw new Error('no file');
        url = ui.so.demo ? URL.createObjectURL(blob) : await api().upload(blob);
        if (!ui.so.demo) { S().uploaded[key] = url; }
      }
      d.bgm = { url, yt: '', title: tr.title, artist: tr.artist || '', trackId: tr.id };
      dirty(); App.renderMain();
    }),
    'so-profile': busy(async (el) => { await api().saveProfile({ [el.dataset.k]: el.value.trim() }); st.profile[el.dataset.k] = el.value.trim(); if (!ui.so.demo) pullProfile(st.profile); App.toast(t('c.saved')); }),
    'so-todo-auto': (el) => { S().draft.todos.auto = el.checked; dirty(); App.renderMain(); },
    'so-todo-toggle': (el) => { S().draft.todos.items[Number(el.dataset.i)].done = el.checked; dirty(); App.renderMain(); },
    'so-set': (el) => { setPath(S().draft, el.dataset.k, el.value); dirty(); App.renderMain(); },
    'so-banner-toggle': (el) => {
      const b = S().draft.banners;
      if (el.checked) { if (!b.some((x) => x.id === el.dataset.id)) b.push({ id: el.dataset.id, img: '' }); } else S().draft.banners = b.filter((x) => x.id !== el.dataset.id);
      dirty();
      // 배너 이름이 보이도록 정보 다시 받아오기
      refresh();
    }
  });
  let customTimer = null;
  Object.assign(App.I, {
    'so-custom': (el) => {
      S().draft.custom[el.dataset.k] = el.value; dirty();
      clearTimeout(customTimer);
      customTimer = setTimeout(() => {
        const sc = App.$('#soScale');
        if (!sc || !st.view) return;
        st.view.data = S().draft;
        sc.innerHTML = pageHTML(st.view, { mine: true });
        App.hydrateAssets(sc); fit();
      }, 250);
    },
    'so-set': (el) => {
      setPath(S().draft, el.dataset.k, el.value); dirty();
      const page = App.$('#soPage'); if (!page) return;
      if (el.dataset.k === 'line.text') { const p = page.querySelector('.so-line p'); if (p) p.innerHTML = `<span class="so-mood">${esc(S().draft.line.mood)}</span>${esc(el.value)}`; }
      if (el.dataset.k === 'pair.caption') { const p = page.querySelector('.so-pair p'); if (p) p.textContent = el.value; }
    },
    'so-st-rot': (el) => {
      const s = S().draft.stickers.find((x) => x.id === ui.so.selSt); if (!s) return;
      s.r = Number(el.value); dirty();
      const n = App.$(`.so-st[data-sid="${s.id}"]`); if (n) n.style.transform = `translate(-50%,-50%) rotate(${s.r}deg)`;
      const o = el.parentElement.querySelector('output'); if (o) o.textContent = s.r + '°';
    }
  });
  Object.assign(App.K, {
    'so-auth': () => App.A['so-auth'](),
    'so-find': () => App.A['so-find'](),
    'so-comment': () => App.A['so-comment'](),
    'so-todo-add': (el) => { const v = el.value.trim(); if (!v) return; S().draft.todos.items.push({ text: v, done: false }); dirty(); App.renderMain(); setTimeout(() => { const q = App.$('[data-enter="so-todo-add"]'); if (q) q.focus(); }, 0); }
  });

  function authMsg(e) {
    const m = (e && e.message) || '';
    if (/Invalid login/i.test(m)) return t('so.badLogin');
    if (/already registered|already been registered/i.test(m)) return t('so.emailTaken');
    if (/Password should be/i.test(m)) return t('so.pwShort');
    if (/Email not confirmed/i.test(m)) return t('so.checkEmail');
    return m;
  }

  // 이웃 메뉴에 들어올 때마다 새로 불러오기
  App.onEnter = App.onEnter || {};
  App.onEnter.social = () => refresh();
  App.socialRefresh = refresh;
  void todayStr;
})(window.App);
