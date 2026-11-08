// 계정 · 기기 연동 — 같은 계정으로 로그인하면 폰·컴퓨터에서 기록과 사진이 똑같이 보여요
(function (App) {
  const { t, esc, svg } = App;
  const ui = App.ui;
  ui.acctMode = 'login';
  App.syncState = '';      // '' | 'saving' | 'ok' | 'fail' | 'offline'

  const Sb = () => (App.Sb ? App.Sb() : null);
  const ready = () => { const s = Sb(); return !!(s && s.configured()); };
  function sessionEmail() {
    try { const s = JSON.parse(localStorage.getItem('myroom-sb') || 'null'); return (s && s.user && s.user.email) || ''; } catch (e) { return ''; }
  }
  const hasContent = (d) => d && ['todos', 'events', 'memos', 'diary', 'ddays', 'bookmarks', 'routines'].some((k) => (d[k] || []).length);
  const setState = (st) => {
    App.syncState = st;
    if (App.ui.view === 'settings') { const box = App.$('#acctStatus'); if (box) box.outerHTML = statusHTML(); }
    paintBadge();
  };

  /* ---------- 기록(JSON) 동기화 ---------- */
  async function startSync() {
    if (!Store.account() || !ready()) return;
    const sb = Sb();
    let pushing = false, again = false, timer = null;
    const push = async () => {
      if (pushing) { again = true; return; }
      pushing = true;
      setState('saving');
      const startedAt = new Date().toISOString();
      try {
        const at = await sb.pushData(Store.get());
        const m = Store.meta();
        Store.setMeta({ syncedAt: at, ...(m.changedAt && m.changedAt > startedAt ? {} : { dirty: false }) });
        setState('ok');
      } catch (e) { console.warn('동기화 실패', e); setState(navigator.onLine === false ? 'offline' : 'fail'); }
      pushing = false;
      if (again) { again = false; push(); }
    };
    App.syncNow = push;
    const pull = async (first) => {
      const row = await sb.pullData();
      const m = Store.meta();
      if (row) {
        const serverAt = row.updated_at;
        const serverNewer = !m.syncedAt || serverAt > m.syncedAt;
        const take = () => { Store.replace(row.data); Store.setMeta({ syncedAt: serverAt }); setState('ok'); };
        if (first && !Store.hadLocal()) { take(); App.toast(t('sync.loaded')); return; }
        if (!m.dirty) { if (serverNewer) { take(); if (first) App.toast(t('sync.loaded')); } else setState('ok'); return; }
        // 이 기기와 서버 둘 다 바뀌었으면 더 나중에 고친 쪽으로
        if (serverNewer && m.changedAt && serverAt > m.changedAt) { take(); return; }
        await push();
        return;
      }
      if (first && !Store.hadLocal()) {
        // 이 계정이 처음이면: 로그인 전에 이 기기에 쓴 기록을 가져올지 물어보기
        const guest = await Store.readSaved('');
        const claimed = localStorage.getItem('myroom-guest-claimed');
        if (hasContent(guest) && !claimed) {
          const n = (k) => (guest[k] || []).length;
          const ok = await App.confirmBox(t('sync.importGuest', { t: n('todos'), d: n('diary'), dd: n('ddays'), m: n('memos') }), t('sync.importYes'));
          try { localStorage.setItem('myroom-guest-claimed', Store.account()); } catch (e) { /* 무시 */ }
          if (ok) { const copy = JSON.parse(JSON.stringify(guest)); delete copy.social; Store.replace(copy, { dirty: true }); }
        }
      }
      await push();
    };
    startFiles(sb);
    try { await pull(true); } catch (e) { console.warn('불러오기 실패', e); setState(navigator.onLine === false ? 'offline' : 'fail'); }
    Store.setSyncer(() => { clearTimeout(timer); setState('saving'); timer = setTimeout(push, 1500); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pull(false).catch(() => {});
      else if (Store.meta().dirty) push();
    });
    window.addEventListener('online', () => { if (Store.meta().dirty) push(); else pull(false).catch(() => {}); });
    App.syncPull = () => pull(false);
  }

  /* ---------- 사진·스티커·글꼴 파일 동기화 ---------- */
  function startFiles(sb) {
    const key = `myroom-up:${Store.account()}`;
    let done;
    try { done = new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch (e) { done = new Set(); }
    const mark = (id, on) => { if (on) done.add(id); else done.delete(id); try { localStorage.setItem(key, JSON.stringify([...done])); } catch (e) { /* 무시 */ } };
    const queue = [];
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      while (queue.length) {
        const [id, blob] = queue.shift();
        try { await sb.fileUp(id, blob); mark(id, true); } catch (e) { console.warn('파일 올리기 실패', id, e); }
      }
      running = false;
    };
    Assets.setRemote({
      upload: (id, blob) => { queue.push([id, blob]); run(); },
      download: async (id) => { const b = await sb.fileDown(id); if (b) mark(id, true); return b; },
      remove: (id) => { mark(id, false); sb.fileDel(id).catch(() => {}); }
    });
    // 이 기기에만 있는 파일 올려두기
    setTimeout(async () => {
      const ids = await Assets.list();
      for (const id of ids) {
        if (!Assets.syncable(id) || done.has(id)) continue;
        const b = await Assets.localBlob(id);
        if (b) queue.push([id, b]);
      }
      run();
    }, 3000);
  }

  App.onReady = App.onReady || [];
  App.onReady.push(() => { startSync(); paintBadge(); });

  /* ---------- 왼쪽 아래 연동 표시 ---------- */
  function paintBadge() {
    const box = App.$('#counter');
    if (!box) return;
    let b = App.$('#syncBadge');
    if (!Store.account()) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.id = 'syncBadge'; b.type = 'button'; b.className = 'sync-badge'; b.dataset.act = 'nav'; b.dataset.view = 'settings'; box.parentNode.insertBefore(b, box); }
    const st = App.syncState || 'ok';
    b.className = `sync-badge ${st}`;
    b.textContent = t('acct.badge.' + st);
  }
  App.paintSyncBadge = paintBadge;

  /* ---------- 설정 화면 카드 ---------- */
  function statusHTML() {
    const m = Store.meta();
    const st = App.syncState || (m.dirty ? 'saving' : 'ok');
    const when = m.syncedAt ? new Date(m.syncedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="acct-status ${st}" id="acctStatus"><i></i>${t('acct.st.' + st)}${when && st === 'ok' ? ` <span class="muted small">· ${t('acct.lastSync', { w: when })}</span>` : ''}</div>`;
  }
  App.accountCard = function () {
    if (!ready()) return `<div class="card"><h3>${t('acct.title')}</h3><p class="hint" style="margin:0">${t('acct.noServer')}</p></div>`;
    if (Store.account()) {
      return `<div class="card acct-card">
        <h3>${t('acct.title')}</h3>
        <div class="acct-who">${svg('social')}<b>${esc(sessionEmail() || t('acct.loggedIn'))}</b></div>
        ${statusHTML()}
        <p class="hint" style="margin:0">${t('acct.onHint')}</p>
        <div class="row gap-xs wrap"><button class="btn small" data-act="acct-sync">${t('acct.syncNow')}</button><button class="btn small ghost" data-act="acct-logout">${t('acct.logout')}</button></div>
      </div>`;
    }
    const signup = ui.acctMode === 'signup';
    return `<div class="card acct-card">
      <h3>${t('acct.title')}</h3>
      <p class="hint" style="margin:0">${t('acct.offHint')}</p>
      <div class="seg small" style="align-self:flex-start">${[['login', t('acct.login')], ['signup', t('acct.signup')]].map(([k, l]) => `<button data-act="acct-mode" data-v="${k}" aria-pressed="${ui.acctMode === k}">${l}</button>`).join('')}</div>
      <input class="input" id="acctEmail" type="email" autocomplete="email" placeholder="${esc(t('so.email'))}">
      <input class="input" id="acctPw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${esc(t('so.password'))}" data-enter="acct-go">
      ${signup ? `<input class="input" id="acctPw2" type="password" autocomplete="new-password" placeholder="${esc(t('acct.pw2'))}" data-enter="acct-go">` : ''}
      <button class="btn primary" data-act="acct-go">${signup ? t('acct.signup') : t('acct.login')}</button>
      <p class="hint" style="margin:0">${t('acct.same')}</p>
    </div>`;
  };

  let busy = false;
  Object.assign(App.A, {
    'acct-mode': (el) => { ui.acctMode = el.dataset.v; App.renderMain(); },
    'acct-go': async () => {
      if (busy) return;
      const email = (App.$('#acctEmail').value || '').trim();
      const pw = App.$('#acctPw').value || '';
      if (!/^\S+@\S+\.\S+$/.test(email)) { App.toast(t('acct.badEmail')); return; }
      if (pw.length < 6) { App.toast(t('acct.badPw')); return; }
      const sb = Sb();
      busy = true;
      try {
        if (ui.acctMode === 'signup') {
          if (App.$('#acctPw2') && App.$('#acctPw2').value !== pw) { App.toast(t('acct.pwMismatch')); busy = false; return; }
          const hasSession = await sb.signUp(email, pw, '', '');
          if (!hasSession) { App.toast(t('acct.checkMail')); busy = false; return; }
        } else await sb.signIn(email, pw);
        await Store.flush();
        location.reload();
      } catch (e) {
        const msg = String((e && e.message) || e);
        App.toast(/Invalid login/i.test(msg) ? t('acct.wrong') : /already registered/i.test(msg) ? t('acct.exists') : /confirm/i.test(msg) ? t('acct.notConfirmed') : t('acct.err') + ' ' + msg);
      }
      busy = false;
    },
    'acct-sync': async () => { if (App.syncNow) { if (App.syncPull) await App.syncPull().catch(() => {}); if (Store.meta().dirty) await App.syncNow(); App.toast(t('acct.synced')); } },
    'acct-logout': async () => {
      if (!(await App.confirmBox(t('acct.logoutConfirm'), t('acct.logout')))) return;
      if (App.syncNow && Store.meta().dirty) await App.syncNow().catch(() => {});
      await Store.flush();
      await Sb().signOut();
      location.reload();
    }
  });
  App.K['acct-go'] = () => App.A['acct-go']();
})(window.App);
