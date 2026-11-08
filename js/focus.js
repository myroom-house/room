// 집중 — 뽀모도로, 타이머, 스톱워치
(function (App) {
  const { t, esc, svg, todayStr, addDays, fmt } = App;

  const F = App.focusState = {
    tab: 'pomo',
    pomo: { mode: 'focus', round: 1, running: false, endAt: 0, remaining: null },
    timer: { duration: 5 * 60, remaining: 5 * 60, running: false, endAt: 0 },
    sw: { elapsed: 0, running: false, startAt: 0, laps: [] }
  };
  let tickId = null;

  const cfg = () => App.D.focus;
  const pomoDur = (mode) => Math.max(1, Number(cfg()[mode]) || 1) * 60;
  const mmss = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
  };
  const swText = (ms) => { const cs = Math.floor(ms / 10) % 100; return mmss(Math.floor(ms / 1000)) + '.' + String(cs).padStart(2, '0'); };

  function pomoLeft() {
    const p = F.pomo;
    if (p.remaining == null) p.remaining = pomoDur(p.mode);
    return p.running ? Math.max(0, (p.endAt - Date.now()) / 1000) : p.remaining;
  }
  const timerLeft = () => (F.timer.running ? Math.max(0, (F.timer.endAt - Date.now()) / 1000) : F.timer.remaining);
  const swElapsed = () => F.sw.elapsed + (F.sw.running ? Date.now() - F.sw.startAt : 0);

  App.focusToday = () => App.D.focusLog[todayStr()] || { sessions: 0, minutes: 0 };

  /* ---- 알림음·알림 ---- */
  let actx = null;
  function chime() {
    if (!cfg().sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22, 0.44].forEach((d, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine';
        o.frequency.value = [880, 1046.5, 1318.5][i];
        g.gain.setValueAtTime(0.0001, actx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d + 0.6);
        o.connect(g).connect(actx.destination);
        o.start(actx.currentTime + d);
        o.stop(actx.currentTime + d + 0.65);
      });
    } catch (e) { /* 소리 없음 */ }
  }
  function notify(title, body) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        const n = new Notification(title, { body, silent: true, requireInteraction: true, tag: 'myroom-focus' });
        n.onclick = () => { window.focus(); n.close(); };
      } else if (Notification.permission === 'default') Notification.requestPermission();
    } catch (e) { /* 무시 */ }
  }

  /* ---- 끝났을 때 크게 알리기: 화면 가득 알림 + 계속 울리는 소리 + 창 깜빡임 ---- */
  let alarm = null;
  function alarmOn(kind, title, sub) {
    alarmOff();
    let layer = document.getElementById('alarmLayer');
    if (!layer) { layer = document.createElement('div'); layer.id = 'alarmLayer'; document.body.appendChild(layer); }
    const icon = kind === 'break' ? '☕' : kind === 'focus' ? '🍅' : '⏰';
    const next = kind !== 'timer' && !cfg().autoNext;
    layer.innerHTML = `<div class="alarm-card" role="alertdialog" aria-live="assertive" aria-label="${esc(title)}">
        <div class="alarm-icon">${icon}</div>
        <div class="alarm-title">${esc(title)}</div>
        ${sub ? `<div class="alarm-sub">${esc(sub)}</div>` : ''}
        <div class="alarm-btns">
          ${next ? `<button class="btn primary big" data-act="alarm-next">${t('focus.startNext')}</button>` : ''}
          <button class="btn big ${next ? '' : 'primary'}" data-act="alarm-ok">${t('c.ok')}</button>
        </div>
      </div>`;
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add('on'));
    const okBtn = layer.querySelector('[data-act]'); if (okBtn) okBtn.focus();
    const startTitle = document.title;
    let n = 0;
    alarm = {
      sound: setInterval(() => { if (++n < 30) chime(); else clearInterval(alarm.sound); }, 2000),
      blink: setInterval(() => { document.title = document.title.startsWith('🔔') ? title + ' · MyRoom' : '🔔 ' + title; }, 900),
      startTitle
    };
    chime();
    try { if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) { /* 무시 */ }
    try { if (window.myroom && window.myroom.attention) window.myroom.attention(); } catch (e) { /* 무시 */ }
    notify(title, sub || '');
  }
  function alarmOff() {
    if (alarm) { clearInterval(alarm.sound); clearInterval(alarm.blink); alarm = null; App.renderTitle(); }
    const layer = document.getElementById('alarmLayer');
    if (layer) { layer.classList.remove('on'); layer.hidden = true; layer.innerHTML = ''; }
  }
  App.alarmOff = alarmOff;
  document.addEventListener('keydown', (ev) => { if (alarm && (ev.key === 'Escape' || ev.key === 'Enter')) { ev.preventDefault(); alarmOff(); } }, true);

  /* ---- 진행 ---- */
  function ensureTick() {
    if (tickId) return;
    tickId = setInterval(tick, 200);
  }
  function tick() {
    const p = F.pomo, tm = F.timer;
    if (p.running && Date.now() >= p.endAt) finishPomo(true);
    if (tm.running && Date.now() >= tm.endAt) {
      tm.running = false; tm.remaining = 0;
      refresh();
      alarmOn('timer', t('focus.timerDone'), mmss(tm.duration) + ' ' + t('focus.passed'));
    }
    paint();
    if (!p.running && !tm.running && !F.sw.running) { clearInterval(tickId); tickId = null; }
  }

  function finishPomo(completed) {
    const p = F.pomo;
    const wasFocus = p.mode === 'focus';
    if (wasFocus && completed) {
      const mins = Number(cfg().focus) || 25;
      App.silent((d) => {
        const k = todayStr();
        const e = d.focusLog[k] || { sessions: 0, minutes: 0 };
        e.sessions += 1; e.minutes += mins;
        d.focusLog[k] = e;
      });
    }
    if (wasFocus) p.mode = p.round % (Number(cfg().rounds) || 4) === 0 ? 'long' : 'short';
    else { p.mode = 'focus'; p.round += 1; }
    p.remaining = pomoDur(p.mode);
    p.running = false;
    if (completed && cfg().autoNext) { p.endAt = Date.now() + p.remaining * 1000; p.running = true; ensureTick(); }
    refresh();
    if (completed) {
      const mins = Math.round(p.remaining / 60);
      alarmOn(wasFocus ? 'break' : 'focus', wasFocus ? t('focus.breakTime') : t('focus.focusTime'),
        wasFocus ? t('focus.doneSub', { n: Number(cfg().focus) || 25, m: mins }) : t('focus.breakDoneSub', { m: mins }));
    }
  }

  // 화면 전체를 다시 그리지 않고 숫자만 바꾸기
  function paint() {
    const mini = App.$('#miniTimer');
    if (mini) {
      let txt = '';
      if (F.pomo.running) txt = `${F.pomo.mode === 'focus' ? '🍅' : '☕'} ${mmss(pomoLeft())}`;
      else if (F.timer.running) txt = `⏱ ${mmss(timerLeft())}`;
      else if (F.sw.running) txt = `⏱ ${mmss(swElapsed() / 1000)}`;
      mini.hidden = !txt;
      mini.textContent = txt;
    }
    if (App.ui.view !== 'focus') return;
    const timeEl = App.$('#fTime');
    if (!timeEl) return;
    let left, total;
    if (F.tab === 'pomo') { left = pomoLeft(); total = pomoDur(F.pomo.mode); timeEl.textContent = mmss(left); }
    else if (F.tab === 'timer') { left = timerLeft(); total = F.timer.duration || 1; timeEl.textContent = mmss(left); }
    else { timeEl.textContent = swText(swElapsed()); left = 0; total = 1; }
    const ring = App.$('#fRing');
    if (ring) {
      const c = 2 * Math.PI * 108;
      const prog = F.tab === 'sw' ? ((swElapsed() / 1000) % 60) / 60 : 1 - left / total;
      ring.style.strokeDashoffset = String(c * (1 - prog));
    }
    if (F.tab !== 'sw') document.title = `${mmss(left)} · MyRoom`;
  }
  function refresh() {
    if (App.ui.view === 'focus') App.renderMain();
    paint();
    if (!F.pomo.running && !F.timer.running && !F.sw.running) App.renderTitle();
  }
  App.paintFocus = paint;

  /* ---- 화면 ---- */
  App.VIEWS.focus = function () {
    const c = cfg();
    const p = F.pomo;
    const running = F.tab === 'pomo' ? p.running : F.tab === 'timer' ? F.timer.running : F.sw.running;
    const circ = 2 * Math.PI * 108;
    const modeLabel = F.tab === 'pomo' ? t('focus.mode.' + p.mode) : F.tab === 'timer' ? t('focus.timer') : t('focus.stopwatch');

    let below = '';
    if (F.tab === 'pomo') {
      below = `<div class="pomo-dots">${Array.from({ length: Number(c.rounds) || 4 }, (_, i) => `<i class="${i < ((p.round - 1) % (Number(c.rounds) || 4)) + (p.mode === 'focus' ? 0 : 1) ? 'on' : ''}"></i>`).join('')}</div>`;
    } else if (F.tab === 'timer') {
      const d = F.timer.duration;
      below = `
        <div class="timer-set">
          <input class="input num" type="number" min="0" max="23" id="tmH" value="${Math.floor(d / 3600)}" aria-label="h"><span>${t('focus.h')}</span>
          <input class="input num" type="number" min="0" max="59" id="tmM" value="${Math.floor((d % 3600) / 60)}" aria-label="m"><span>${t('focus.m')}</span>
          <input class="input num" type="number" min="0" max="59" id="tmS" value="${d % 60}" aria-label="s"><span>${t('focus.s')}</span>
          <button class="btn small" data-act="timer-set">${t('c.apply')}</button>
        </div>
        <div class="chips">${[1, 3, 5, 10, 15, 30, 60].map((m) => `<button class="tag" data-act="timer-preset" data-m="${m}">${m}${t('focus.minShort')}</button>`).join('')}</div>`;
    } else {
      below = F.sw.laps.length ? `<ol class="laps">${F.sw.laps.map((l, i) => `<li><span class="muted">#${F.sw.laps.length - i}</span><span>${swText(l)}</span></li>`).join('')}</ol>` : '';
    }

    const today = App.focusToday();
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = addDays(todayStr(), -i); days.push({ d, m: (App.D.focusLog[d] || {}).minutes || 0 }); }
    const maxM = Math.max(25, ...days.map((x) => x.m));

    return `
    <section class="view">
      <header class="view-head"><h2 class="view-title">${t('nav.focus')}</h2>
        <div class="seg">${['pomo', 'timer', 'sw'].map((k) => `<button data-act="focus-tab" data-tab="${k}" aria-pressed="${F.tab === k}">${t(k === 'pomo' ? 'focus.pomodoro' : k === 'timer' ? 'focus.timer' : 'focus.stopwatch')}</button>`).join('')}</div>
      </header>
      <div class="focus-wrap">
        <div class="card focus-main ${F.tab === 'pomo' ? 'mode-' + p.mode : ''}">
          <div class="focus-mode">${esc(modeLabel)}${F.tab === 'pomo' ? ` · ${t('focus.round', { n: p.round })}` : ''}</div>
          <div class="ring-box">
            <svg viewBox="0 0 240 240" class="ring" aria-hidden="true">
              <circle cx="120" cy="120" r="108" class="ring-bg"/>
              <circle cx="120" cy="120" r="108" class="ring-fg" id="fRing" style="stroke-dasharray:${circ};stroke-dashoffset:${circ}"/>
            </svg>
            <div class="ring-time" id="fTime">00:00</div>
          </div>
          <div class="focus-ctrl">
            <button class="icon-btn big" data-act="focus-reset" title="${t('focus.reset')}">${svg('reset')}</button>
            <button class="btn primary play" data-act="focus-toggle">${svg(running ? 'pause' : 'play')}<span>${running ? t('focus.pause') : t('focus.start')}</span></button>
            ${F.tab === 'pomo' ? `<button class="icon-btn big" data-act="focus-skip" title="${t('focus.skip')}">${svg('skip')}</button>` : F.tab === 'sw' ? `<button class="icon-btn big" data-act="sw-lap" title="${t('focus.lap')}" ${F.sw.running ? '' : 'disabled'}>${svg('plus')}</button>` : '<span class="icon-btn big" aria-hidden="true"></span>'}
          </div>
          ${below}
        </div>
        <div class="stack">
          <div class="card">
            <h3>${t('focus.today')}</h3>
            <div class="stat-row"><div><b class="stat">${today.sessions}</b><span class="muted small">${t('focus.sessions')}</span></div><div><b class="stat">${today.minutes}</b><span class="muted small">${t('focus.minutes')}</span></div></div>
            <div class="bars">${days.map((x) => `<div class="bar" title="${x.m}${t('focus.minShort')}"><i style="height:${Math.round((x.m / maxM) * 100)}%"></i><span>${esc(App.wdName(App.parse(x.d).getDay(), 'narrow'))}</span></div>`).join('')}</div>
          </div>
          <div class="card">
            <h3>${t('focus.settings')}</h3>
            <div class="set-grid">
              ${['focus', 'short', 'long'].map((k) => `<label><span class="label">${t('focus.mode.' + k)}</span><span class="row gap-xs"><input class="input num" type="number" min="1" max="180" data-change="focus-cfg" data-k="${k}" value="${esc(c[k])}">${t('focus.minShort')}</span></label>`).join('')}
              <label><span class="label">${t('focus.rounds')}</span><input class="input num" type="number" min="1" max="12" data-change="focus-cfg" data-k="rounds" value="${esc(c.rounds)}"></label>
            </div>
            <label class="toggle"><input type="checkbox" class="check" data-change="focus-cfg" data-k="sound" ${c.sound ? 'checked' : ''}>${t('focus.sound')}</label>
            <label class="toggle"><input type="checkbox" class="check" data-change="focus-cfg" data-k="autoNext" ${c.autoNext ? 'checked' : ''}>${t('focus.autoNext')}</label>
          </div>
        </div>
      </div>
    </section>`;
  };
  App.after.focus = () => paint();
  App.onLeave = App.onLeave || {};
  App.onLeave.focus = () => setTimeout(() => App.renderTitle(), 0);

  Object.assign(App.A, {
    'focus-tab': (el) => { F.tab = el.dataset.tab; App.renderMain(); },
    'focus-toggle': () => {
      if (actx && actx.state === 'suspended') actx.resume();
      try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* 무시 */ }
      if (F.tab === 'pomo') {
        const p = F.pomo;
        if (p.running) { p.remaining = pomoLeft(); p.running = false; }
        else { p.endAt = Date.now() + pomoLeft() * 1000; p.running = true; ensureTick(); }
      } else if (F.tab === 'timer') {
        const tm = F.timer;
        if (tm.running) { tm.remaining = timerLeft(); tm.running = false; }
        else { if (tm.remaining <= 0) tm.remaining = tm.duration; if (tm.remaining <= 0) return; tm.endAt = Date.now() + tm.remaining * 1000; tm.running = true; ensureTick(); }
      } else {
        const sw = F.sw;
        if (sw.running) { sw.elapsed = swElapsed(); sw.running = false; }
        else { sw.startAt = Date.now(); sw.running = true; ensureTick(); }
      }
      refresh();
    },
    'focus-reset': () => {
      if (F.tab === 'pomo') { F.pomo.running = false; F.pomo.remaining = pomoDur(F.pomo.mode); }
      else if (F.tab === 'timer') { F.timer.running = false; F.timer.remaining = F.timer.duration; }
      else { F.sw = { elapsed: 0, running: false, startAt: 0, laps: [] }; }
      refresh();
    },
    'focus-skip': () => finishPomo(false),
    'alarm-ok': () => alarmOff(),
    'alarm-next': () => {
      alarmOff();
      const p = F.pomo;
      if (!p.running) { p.endAt = Date.now() + pomoLeft() * 1000; p.running = true; ensureTick(); refresh(); }
    },
    'sw-lap': () => { F.sw.laps.unshift(swElapsed()); App.renderMain(); },
    'timer-preset': (el) => { const s = Number(el.dataset.m) * 60; F.timer = { duration: s, remaining: s, running: false, endAt: 0 }; refresh(); },
    'timer-set': () => {
      const v = (id) => Math.max(0, Number(App.$('#' + id).value) || 0);
      const s = v('tmH') * 3600 + v('tmM') * 60 + v('tmS');
      if (!s) return;
      F.timer = { duration: s, remaining: s, running: false, endAt: 0 };
      refresh();
    }
  });
  App.C['focus-cfg'] = (el) => {
    const k = el.dataset.k;
    App.silent((d) => { d.focus[k] = el.type === 'checkbox' ? el.checked : Math.max(1, Number(el.value) || 1); });
    if (!F.pomo.running && ['focus', 'short', 'long'].includes(k)) { F.pomo.remaining = pomoDur(F.pomo.mode); paint(); }
  };
})(window.App);
