// 음악 — 내 음악 목록(파일·유튜브 링크) + 어느 화면에서나 들리는 플레이어
(function (App) {
  const { t, esc, svg, uid } = App;

  const P = App.player = { guest: null, playing: false };
  const M = () => App.D.music;
  const tracks = () => M().tracks;
  const cur = () => tracks()[M().current] || null;
  const mmss = (s) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

  /* ---------- 유튜브 링크 읽기 ---------- */
  App.parseYouTube = function (raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    if (/^[\w-]{11}$/.test(s)) return { v: s };
    let u;
    try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let v = '', list = u.searchParams.get('list') || '';
    if (host === 'youtu.be') v = u.pathname.slice(1, 12);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      v = u.searchParams.get('v') || '';
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (!v && m) v = m[1];
    } else return null;
    if (v && !/^[\w-]{11}$/.test(v)) v = '';
    if (!v && !list) return null;
    return { v, list };
  };
  const ytThumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
  App.ytThumb = ytThumb;

  /* ---------- 재생 엔진 1: 파일 ---------- */
  const audio = new Audio();
  audio.preload = 'metadata';

  /* ---------- 재생 엔진 2: 유튜브 (외부 스크립트 없이 iframe + postMessage) ---------- */
  const YT_ORIGINS = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'];
  let ytFrame = null, ytState = -1, ytWant = null, ytTime = 0, ytDur = 0, ytInfo = null, ytWatch = null;
  const ytHost = () => App.$('#ytHost');
  function ytSend(func, args = []) {
    if (!ytFrame || !ytFrame.contentWindow) return;
    try { ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch (e) { /* 무시 */ }
  }
  function ytListen() {
    if (!ytFrame || !ytFrame.contentWindow) return;
    try { ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'myroom', channel: 'widget' }), '*'); } catch (e) { /* 무시 */ }
  }
  function ytOpen(src, play) {
    const host = ytHost();
    if (!host) return;
    ytState = -1; ytTime = 0; ytDur = 0; ytInfo = null;
    const q = new URLSearchParams({ enablejsapi: '1', autoplay: play ? '1' : '0', playsinline: '1', rel: '0', modestbranding: '1' });
    if (/^https?:$/.test(location.protocol)) q.set('origin', location.origin);
    if (src.list) q.set('list', src.list);
    const path = src.yt ? src.yt : 'videoseries';
    host.innerHTML = `<iframe title="YouTube" src="https://www.youtube.com/embed/${encodeURIComponent(path)}?${q}" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <div class="yt-bar"><a href="https://www.youtube.com/${src.yt ? 'watch?v=' + encodeURIComponent(src.yt) : 'playlist?list=' + encodeURIComponent(src.list)}" target="_blank" rel="noopener" data-act="mu-yt-open">${t('mu.ytOpen')}</a><button type="button" class="link-btn" data-act="mu-yt-hide">${t(M().ytHidden ? 'mu.ytShow' : 'mu.ytHide')}</button></div>`;
    host.hidden = false;
    host.classList.toggle('mini', !!M().ytHidden);
    ytFrame = host.querySelector('iframe');
    ytFrame.addEventListener('load', () => { ytListen(); setTimeout(ytListen, 600); setTimeout(() => { ytSend('setVolume', [Math.round(M().volume * 100)]); }, 700); });
    clearTimeout(ytWatch);
    // 10초 안에 아무 신호가 없으면 막힌 것: 유튜브에서 열기 안내
    if (play) ytWatch = setTimeout(() => { if (ytState === -1 && engine === 'yt') App.toast(t('mu.ytStuck')); }, 10000);
  }
  function ytClose() { const h = ytHost(); if (h) { h.innerHTML = ''; h.hidden = true; } ytFrame = null; ytState = -1; }
  window.addEventListener('message', (ev) => {
    if (!YT_ORIGINS.includes(ev.origin) || !ytFrame || ev.source !== ytFrame.contentWindow) return;
    let m; try { m = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (e) { return; }
    if (!m || !m.event) return;
    if (m.event === 'onReady') { ytSend('setVolume', [Math.round(M().volume * 100)]); if (ytState === -1) ytState = 5; }
    if (m.event === 'infoDelivery' && m.info) {
      const i = m.info;
      if (typeof i.currentTime === 'number') ytTime = i.currentTime;
      if (typeof i.duration === 'number' && i.duration) ytDur = i.duration;
      if (i.videoData) ytInfo = i.videoData;
      if (typeof i.playerState === 'number' && i.playerState !== ytState) { ytState = i.playerState; onYTState(ytState); }
      else if (engine === 'yt') progress();
    }
    if (m.event === 'onStateChange') { ytState = Number(m.info); onYTState(ytState); }
    if (m.event === 'onError') {
      App.toast(t(m.info === 101 || m.info === 150 || m.info === 153 ? 'mu.ytBlocked' : 'mu.ytError'));
      if (!P.guest && tracks().length > 1) setTimeout(() => P.next(true), 1500);
    }
  });
  function onYTState(st) {
    // 0 끝 · 1 재생 · 2 멈춤 · 3 불러오는 중
    if (engine !== 'yt') return;
    clearTimeout(ytWatch);
    if (st === 1) {
      const c = cur();
      if (!P.guest && c && c.kind === 'yt' && c.titleAuto && ytInfo && ytInfo.title) {
        App.silent(() => { c.title = ytInfo.title; if (!c.artist && ytInfo.author) c.artist = ytInfo.author; c.titleAuto = false; });
        if (App.ui.view === 'music') App.renderMain();
      }
    }
    if (st === 0) ended();
    P.playing = st === 1;
    paint();
  }

  // 지금 어느 엔진이 소리를 내는지
  let engine = 'audio';
  const eng = () => engine;
  const E = {
    paused: () => (engine === 'yt' ? !(ytState === 1 || ytState === 3) : audio.paused),
    time: () => (engine === 'yt' ? ytTime : audio.currentTime),
    dur: () => (engine === 'yt' ? ytDur : audio.duration),
    seek: (s) => { if (engine === 'yt') { ytTime = s; ytSend('seekTo', [s, true]); } else audio.currentTime = s; },
    vol: (v) => { audio.volume = v; ytSend('setVolume', [Math.round(v * 100)]); },
    pause: () => { if (engine === 'yt') { ytSend('pauseVideo'); ytState = 2; paint(); } else audio.pause(); },
    resume: async () => { if (engine === 'yt') { if (ytFrame) ytSend('playVideo'); else if (ytWant) ytOpen(ytWant, true); } else { try { await audio.play(); } catch (e) { /* 사용자가 눌러야 재생 */ } } },
    stopOther: (next) => {
      if (next !== 'audio') { audio.pause(); }
      if (next !== 'yt') { ytSend('pauseVideo'); ytClose(); }
      engine = next;
    },
    loaded: () => (engine === 'yt' ? !!ytFrame : !!audio.src)
  };

  async function playSource(src, play) {
    if (src.yt || src.list) {
      E.stopOther('yt');
      ytWant = src;
      ytOpen(src, play);
    } else {
      E.stopOther('audio');
      ytWant = null;
      audio.src = src.url;
      audio.volume = M().volume;
      if (play) await E.resume();
    }
    paint();
  }

  async function load(i, play) {
    const list = tracks();
    if (!list.length) return;
    M().current = Math.max(0, Math.min(list.length - 1, i));
    App.silent(() => {});
    P.guest = null;
    const c = cur();
    if (c.kind === 'yt') return playSource({ yt: c.ytId, list: c.ytList || '' }, play);
    const url = await Assets.url(c.assetId);
    if (!url) { App.toast(t('mu.missing')); return; }
    return playSource({ url }, play);
  }
  P.play = async (i) => { if (i != null && (i !== M().current || P.guest || !E.loaded())) await load(i, true); else await E.resume(); };
  P.toggle = async () => {
    if (!E.loaded()) { if (P.guest) return; return load(M().current, true); }
    if (E.paused()) await E.resume(); else E.pause();
  };
  P.next = (auto) => {
    const n = tracks().length;
    if (!n || P.guest) return;
    let i = M().current;
    if (M().shuffle && n > 1) { do { i = Math.floor(Math.random() * n); } while (i === M().current); }
    else i = i + 1;
    if (i >= n) { if (auto && M().repeat === 'off') { E.pause(); return; } i = 0; }
    load(i, true);
  };
  P.prev = () => {
    if (E.time() > 3) { E.seek(0); return; }
    const n = tracks().length;
    if (!n || P.guest) return;
    load((M().current - 1 + n) % n, true);
  };
  // 이웃 페이지 BGM 듣기 (파일 주소 또는 유튜브)
  P.playGuest = async (src) => {
    P.guest = { key: src.yt || src.url, title: src.title, who: src.who };
    await playSource(src.yt ? { yt: src.yt } : { url: src.url }, true);
  };
  P.playUrl = (url, title, who) => P.playGuest({ url, title, who });
  P.isGuest = (key) => !!(P.guest && P.guest.key === key && !E.paused());
  P.pause = () => E.pause();

  function ended() {
    if (P.guest) { paint(); return; }
    if (M().repeat === 'one') { E.seek(0); E.resume(); return; }
    P.next(true);
  }
  audio.addEventListener('ended', () => { if (engine === 'audio') ended(); });
  ['play', 'pause', 'loadedmetadata'].forEach((ev) => audio.addEventListener(ev, () => { if (engine === 'audio') { P.playing = !audio.paused; paint(); } }));

  function progress() {
    const d = E.dur(), c = E.time();
    const bar = App.$('#mpBar');
    if (bar) bar.style.width = (d ? (c / d) * 100 : 0) + '%';
    const tm = App.$('#muTime');
    if (tm) tm.textContent = `${mmss(c)} / ${mmss(d)}`;
    const seek = App.$('#muSeek');
    if (seek && !seek.matches(':active')) seek.value = d ? Math.round((c / d) * 1000) : 0;
  }
  audio.addEventListener('timeupdate', () => { if (engine === 'audio') progress(); });
  setInterval(() => { if (engine === 'yt' && ytState === 1) { ytTime += 0.5; progress(); } }, 500);

  // 앱을 켜고 처음 누를 때 자동 재생 (브라우저는 누르기 전엔 소리를 못 내요)
  const kick = (ev) => {
    window.removeEventListener('pointerdown', kick, true);
    window.removeEventListener('keydown', kick, true);
    if (ev && ev.target && ev.target.closest && ev.target.closest('[data-act^="mu-"], [data-act="so-bgm-play"], #alarmLayer')) return;
    if (App.on('music') && M().autoplay && tracks().length && !P.guest && (E.paused() || !E.loaded())) setTimeout(() => { if (E.paused()) P.play(M().current); }, 50);
  };
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('keydown', kick, true);

  /* ---------- 왼쪽 아래 작은 플레이어 ---------- */
  function title() {
    if (P.guest) return `${P.guest.title || t('mu.untitled')}`;
    const c = cur();
    return c ? c.title : '';
  }
  function paint() {
    const box = App.$('#miniPlayer');
    if (!box) return;
    const show = App.on('music') && (tracks().length || P.guest);
    box.hidden = !show;
    if (show) {
      const c = cur();
      const paused = E.paused();
      box.innerHTML = `
        <div class="mp-top">
          <button type="button" class="mp-title" data-act="nav" data-view="music" title="${esc(title())}">${svg('music')}<span class="mp-marquee"><span>${esc(title())}${P.guest ? ` · ${esc(P.guest.who || '')}` : c && c.artist ? ` · ${esc(c.artist)}` : ''}</span></span></button>
        </div>
        <div class="mp-ctrl">
          <button type="button" class="icon-btn" data-act="mu-prev" aria-label="${t('mu.prev')}" ${P.guest ? 'disabled' : ''}>${svg('prev')}</button>
          <button type="button" class="icon-btn mp-play" data-act="mu-toggle" aria-label="${paused ? t('focus.start') : t('focus.pause')}">${svg(paused ? 'play' : 'pause')}</button>
          <button type="button" class="icon-btn" data-act="mu-next" aria-label="${t('mu.next')}" ${P.guest ? 'disabled' : ''}>${svg('next')}</button>
        </div>
        <div class="mp-prog"><i id="mpBar"></i></div>`;
    }
    const paused = E.paused();
    if (App.ui.view === 'music') {
      App.$$('[data-act="mu-play"]').forEach((b) => {
        const on = !P.guest && Number(b.dataset.i) === M().current && !paused;
        b.innerHTML = svg(on ? 'pause' : 'play');
        b.closest('li') && b.closest('li').classList.toggle('now', !P.guest && Number(b.dataset.i) === M().current);
      });
      const big = App.$('#muBig'); if (big) big.innerHTML = svg(paused ? 'play' : 'pause');
      const nt = App.$('#muNowTitle'); if (nt) nt.textContent = title() || t('mu.empty');
    }
    App.$$('.home-music [data-act="mu-toggle"]').forEach((b) => { b.innerHTML = svg(paused ? 'play' : 'pause'); });
    App.$$('[data-act="so-bgm-play"]').forEach((b) => { b.innerHTML = `${svg(P.isGuest(b.dataset.key) ? 'pause' : 'play')}`; });
    progress();
  }
  App.paintPlayer = paint;

  App.musicCard = function () {
    const c = cur();
    return `<div class="card music-card home-music">
      <div class="card-head"><h3>${t('nav.music')}</h3><button class="link-btn" data-act="nav" data-view="music">${t('c.more')}</button></div>
      <div class="row gap-s">${c && c.kind === 'yt' && c.ytId ? `<img class="mu-thumb" src="${ytThumb(c.ytId)}" alt="">` : ''}<button class="icon-btn big mp-play" data-act="mu-toggle">${svg(E.paused() ? 'play' : 'pause')}</button><div class="grow" style="min-width:0"><b class="clamp-1">${esc(c ? c.title : '')}</b><div class="muted small">${esc(c && c.artist ? c.artist : '')}</div></div></div>
    </div>`;
  };

  /* ---------- 음악 화면 ---------- */
  App.VIEWS.music = function () {
    const list = tracks();
    const m = M();
    const paused = E.paused();
    return `
    <section class="view narrow">
      <header class="view-head"><h2 class="view-title">${t('nav.music')} <span class="count">${list.length}</span></h2></header>
      <div class="card mu-add">
        <div class="seg small">${[['yt', t('mu.srcYt')], ['file', t('mu.srcFile')]].map(([k, l]) => `<button data-act="mu-src" data-v="${k}" aria-pressed="${addSrc === k}">${l}</button>`).join('')}</div>
        ${addSrc === 'yt'
          ? `<label class="field"><span class="label">${t('mu.ytLabel')}</span><input class="input" id="muYt" inputmode="url" placeholder="${esc(t('mu.ytPh'))}" data-enter="mu-add-go"></label>`
          : `<div class="field"><span class="label">${t('mu.fileLabel')}</span><div class="row gap-xs"><button class="btn small" data-act="mu-file-pick">${svg('upload')}${t('mu.filePick')}</button><span class="muted small clamp-1" id="muFileName">${esc(pendingFile ? pendingFile.name : t('mu.fileNone'))}</span></div></div>`}
        <div class="form-grid">
          <label class="field grow"><span class="label">${t('mu.title')}</span><input class="input" id="muTitle" maxlength="80" placeholder="${esc(addSrc === 'yt' ? t('mu.titlePhYt') : t('mu.titlePhFile'))}" value="${esc(pendingFile ? pendingFile.guessTitle : '')}" data-enter="mu-add-go"></label>
          <label class="field grow"><span class="label">${t('mu.artist')}</span><input class="input" id="muArtist" maxlength="60" value="${esc(pendingFile ? pendingFile.guessArtist : '')}" data-enter="mu-add-go"></label>
        </div>
        <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><p class="hint" style="margin:0">${addSrc === 'yt' ? t('mu.ytHint') : t('mu.fileHint')}</p><button class="btn primary" data-act="mu-add-go">${t('mu.addPlay')}</button></div>
      </div>
      <div class="card music-now">
        <div class="row gap-m">
          <button class="icon-btn big mp-play" id="muBig" data-act="mu-toggle">${svg(paused ? 'play' : 'pause')}</button>
          <div class="grow" style="min-width:0">
            <b id="muNowTitle" class="clamp-1">${esc(title() || t('mu.empty'))}</b>
            <input type="range" id="muSeek" min="0" max="1000" value="0" data-input="mu-seek" aria-label="${t('mu.seek')}">
            <div class="row" style="justify-content:space-between"><span class="muted small" id="muTime">0:00 / 0:00</span>
              <div class="row gap-xs">
                <button class="icon-btn ${m.shuffle ? 'on' : ''}" data-act="mu-shuffle" title="${t('mu.shuffle')}" aria-pressed="${m.shuffle}">${svg('shuffle')}</button>
                <button class="icon-btn" data-act="mu-prev" title="${t('mu.prev')}">${svg('prev')}</button>
                <button class="icon-btn" data-act="mu-next" title="${t('mu.next')}">${svg('next')}</button>
                <button class="btn small ${m.repeat !== 'off' ? '' : 'ghost'}" data-act="mu-repeat" title="${t('mu.repeat')}">${svg('repeat')}${t('mu.rep.' + m.repeat)}</button>
              </div></div>
          </div>
        </div>
        <div class="row wrap gap-m" style="margin-top:10px">
          <label class="row gap-s"><span class="muted small" style="white-space:nowrap">${t('mu.volume')}</span><input type="range" min="0" max="1" step="0.05" value="${m.volume}" data-input="mu-vol" style="max-width:200px"></label>
          <label class="switch small push-right"><input type="checkbox" data-change="mu-autoplay" ${m.autoplay ? 'checked' : ''}><span class="sw-track"></span>${t('mu.autoplay')}</label>
        </div>
      </div>
      ${list.length ? `<ul class="track-list">${list.map((x, i) => `
        <li class="${i === m.current && !P.guest ? 'now' : ''}">
          <button class="icon-btn" data-act="mu-play" data-i="${i}" aria-label="${t('focus.start')}">${svg(i === m.current && !paused && !P.guest ? 'pause' : 'play')}</button>
          ${x.kind === 'yt' ? (x.ytId ? `<img class="mu-thumb" src="${ytThumb(x.ytId)}" alt="">` : '<span class="mu-thumb yt">▶</span>') : ''}
          <div class="grow tl-text"><input class="tl-title" value="${esc(x.title)}" data-change="mu-rename" data-i="${i}" data-k="title" aria-label="${t('mu.title')}"><input class="tl-artist" value="${esc(x.artist || '')}" placeholder="${esc(t('mu.artist'))}" data-change="mu-rename" data-i="${i}" data-k="artist" aria-label="${t('mu.artist')}"></div>
          <span class="muted small">${x.kind === 'yt' ? (x.ytList && !x.ytId ? t('mu.ytListTag') : 'YouTube') : esc(x.size ? (x.size / 1048576).toFixed(1) + 'MB' : '')}</span>
          <button class="icon-btn" data-act="mu-move" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="${t('mu.up')}">${svg('up')}</button>
          <button class="icon-btn" data-act="mu-move" data-i="${i}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="${t('mu.down')}">${svg('down')}</button>
          <button class="icon-btn" data-act="mu-del" data-i="${i}" aria-label="${t('c.delete')}">${svg('trash')}</button>
        </li>`).join('')}</ul>` : `<div class="card empty-card"><p>${t('mu.emptyHint')}</p></div>`}
      <p class="hint">${t('mu.hint')}</p>
    </section>`;
  };
  App.after.music = () => paint();

  let addSrc = 'yt', pendingFile = null;
  async function fetchTitle(x) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + x.ytId)}`);
      if (!res.ok) return;
      const j = await res.json();
      if (!x.titleAuto) return;
      App.silent(() => { x.title = j.title || x.title; if (!x.artist) x.artist = j.author_name || ''; x.titleAuto = false; });
      if (App.ui.view === 'music') App.renderMain();
      paint();
    } catch (e) { /* 재생할 때 다시 채워요 */ }
  }
  async function addGo() {
    const title = (App.$('#muTitle').value || '').trim();
    const artist = (App.$('#muArtist').value || '').trim();
    if (addSrc === 'yt') {
      const r = App.parseYouTube(App.$('#muYt').value);
      if (!r) { App.toast(t('mu.ytBad')); App.$('#muYt').focus(); return; }
      const x = { id: uid(), kind: 'yt', ytId: r.v, ytList: r.list || '', title: title || (r.v ? t('mu.ytDefault') : t('mu.ytList')), artist, titleAuto: !title };
      App.silent((d) => d.music.tracks.push(x));
      App.renderMain();
      P.play(tracks().length - 1);
      App.toast(t('mu.added', { n: 1 }));
      if (x.titleAuto && x.ytId) fetchTitle(x);
    } else {
      if (!pendingFile) { App.toast(t('mu.fileFirst')); return; }
      const f = pendingFile.file;
      const id = 'm_' + uid();
      await Assets.put(id, f);
      App.silent((d) => d.music.tracks.push({ id: uid(), kind: 'file', assetId: id, title: title || pendingFile.guessTitle, artist, size: f.size }));
      pendingFile = null;
      App.renderMain();
      P.play(tracks().length - 1);
      App.toast(t('mu.added', { n: 1 }));
    }
  }

  Object.assign(App.A, {
    'mu-src': (el) => { addSrc = el.dataset.v; App.renderMain(); },
    'mu-file-pick': async () => {
      const [f] = await App.pickFiles('audio/*,.mp3,.m4a,.ogg,.wav,.flac');
      if (!f) return;
      const name = f.name.replace(/\.[^.]+$/, '');
      const [artist, ttl] = name.includes(' - ') ? name.split(' - ', 2) : ['', name];
      pendingFile = { file: f, name: f.name, guessTitle: ttl.trim(), guessArtist: artist.trim() };
      App.renderMain();
      const ti = App.$('#muTitle'); if (ti) { ti.focus(); ti.select(); }
    },
    'mu-add-go': addGo,
    'mu-yt-open': (el, ev) => { if (ev) ev.preventDefault(); ytSend('pauseVideo'); App.openUrl(el.getAttribute('href')); },
    'mu-yt-hide': () => { App.silent((d) => { d.music.ytHidden = !d.music.ytHidden; }); const h = ytHost(); if (h) { h.classList.toggle('mini', !!M().ytHidden); const b = h.querySelector('[data-act="mu-yt-hide"]'); if (b) b.textContent = t(M().ytHidden ? 'mu.ytShow' : 'mu.ytHide'); } },
    'mu-play': (el) => { const i = Number(el.dataset.i); if (i === M().current && !P.guest && E.loaded() && !E.paused()) E.pause(); else P.play(i); },
    'mu-toggle': () => P.toggle(),
    'mu-next': () => P.next(),
    'mu-prev': () => P.prev(),
    'mu-shuffle': () => { App.update((d) => { d.music.shuffle = !d.music.shuffle; }); },
    'mu-repeat': () => { App.update((d) => { d.music.repeat = { all: 'one', one: 'off', off: 'all' }[d.music.repeat] || 'all'; }); },
    'mu-move': (el) => {
      const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
      App.update((d) => {
        const l = d.music.tracks; [l[i], l[j]] = [l[j], l[i]];
        if (d.music.current === i) d.music.current = j; else if (d.music.current === j) d.music.current = i;
      });
    },
    'mu-del': async (el) => {
      const i = Number(el.dataset.i);
      const x = tracks()[i];
      if (!x || !(await App.confirmBox(t('mu.delConfirm', { n: x.title })))) return;
      if (i === M().current && !P.guest) { E.pause(); if (engine === 'audio') audio.removeAttribute('src'); else { ytWant = null; ytClose(); } }
      App.update((d) => { d.music.tracks.splice(i, 1); if (d.music.current >= d.music.tracks.length) d.music.current = 0; else if (i < d.music.current) d.music.current -= 1; });
      if (x.assetId) Assets.del(x.assetId);
      paint();
    }
  });
  App.K['mu-add-go'] = addGo;
  Object.assign(App.I, {
    'mu-vol': (el) => { E.vol(Number(el.value)); App.silent((d) => { d.music.volume = Number(el.value); }); },
    'mu-seek': (el) => { const d = E.dur(); if (d) E.seek((Number(el.value) / 1000) * d); }
  });
  App.C['mu-rename'] = (el) => App.silent((d) => { const x = d.music.tracks[Number(el.dataset.i)]; if (x) x[el.dataset.k] = el.value.trim(); paint(); });
  App.C['mu-autoplay'] = (el) => App.silent((d) => { d.music.autoplay = el.checked; });

  App.onReady = App.onReady || [];
  App.onReady.push(() => paint());
})(window.App);
