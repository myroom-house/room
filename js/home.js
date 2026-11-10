// 홈
(function (App) {
  const { t, esc, svg, todayStr, fmt } = App;

  App.VIEWS.home = function () {
    const D = App.D;
    const on = App.on;
    const td = todayStr();
    const h = new Date().getHours();
    const g = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night';
    const name = D.profile.name;
    const now = new Date();

    const left = [], right = [];

    if (on('tasks')) {
      const todos = App.todayTodos();
      const routines = App.todayRoutines();
      const total = todos.length + routines.length;
      const done = todos.filter((x) => x.done).length + routines.filter((r) => r.done[td]).length;
      left.push(`<div class="card">
        <div class="card-head"><h3>${t('home.today')}</h3>${total ? `<span class="muted small">${t('home.progress', { done, total })}</span>` : ''}</div>
        ${total ? `<div class="progress"><i style="width:${Math.round((done / total) * 100)}%"></i></div>` : ''}
        ${todos.length ? `<ul class="item-list">${todos.map(App.todoItem).join('')}</ul>` : ''}
        <input class="input quick" data-enter="todo-add-today" data-keep="home-todo" placeholder="${esc(t('task.todoPh'))}">
        ${routines.length ? `<div class="sub-head">${t('home.todayRoutines')}</div><ul class="item-list">${routines.map(App.routineCheck).join('')}</ul>` : ''}
      </div>`);
    }
    if (on('memo')) {
      const memos = [...D.memos].sort((a, b) => (b.pinned - a.pinned) || (b.createdAt || b.updatedAt || '').localeCompare(a.createdAt || a.updatedAt || '')).slice(0, 4);
      const preview = (m) => m.kind === 'check' ? `☑ ${esc((m.items || []).map((i) => i.text).join(', '))}` : esc((m.title ? m.title + ' ' : '') + m.body);
      left.push(`<div class="card">
        <div class="card-head"><h3>${t('nav.memo')}</h3><button class="link-btn" data-act="nav" data-view="memo">${t('c.more')}</button></div>
        <textarea class="input quick home-capture" rows="1" data-enter="memo-add-home" data-keep="home-memo" placeholder="${esc(t('memo.capturePh'))}"></textarea>
        ${memos.length ? `<ul class="memo-mini">${memos.map((m) => `<li>${m.pinned ? '<span class="pin-dot" aria-hidden="true"></span>' : ''}<span class="mm-text">${preview(m)}</span>${App.dueBadge(m)}</li>`).join('')}</ul>` : ''}
      </div>`);
    }
    if (on('diary')) {
      const lastDiary = [...D.diary].sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
      const peek = lastDiary ? (lastDiary.title || (lastDiary.items || []).filter((i) => i.type === 'text').map((i) => i.text).join(' ') || lastDiary.body || '') : '';
      left.push(`<div class="card">
        <div class="card-head"><h3>${t('home.recentDiary')}</h3><button class="link-btn" data-act="diary-new" data-date="${td}">${t('diary.new')}</button></div>
        ${lastDiary ? `<button class="diary-peek" data-act="diary-open" data-id="${lastDiary.id}">
            <span class="muted small">${fmt(lastDiary.date, { month: 'long', day: 'numeric', weekday: 'short' })} ${esc(lastDiary.mood || '')} ${esc(lastDiary.weather || '')}</span>
            <span class="clamp-3">${esc(peek)}</span></button>` : `<p class="empty">${t('home.noDiary')}</p>`}
      </div>`);
    }

    if (on('dday')) {
      const ddays = App.sortedDdays().filter(({ x }) => x.pinned);
      if (ddays.length) right.push(`<div class="card">
        <div class="card-head"><h3>${t('nav.dday')}</h3><button class="link-btn" data-act="nav" data-view="dday">${t('c.more')}</button></div>
        <div class="dday-home">${ddays.map(({ x, info }) => `
          <button type="button" class="dh-card sz-${x.img || x.size !== 'fit' ? (x.size || 'm') : 'm'} ${x.img ? 'has-img' : ''}" style="--c:${App.safeColor(x.color)}" data-act="nav" data-view="dday">
            ${x.img ? `<img data-asset="${esc(x.img)}" alt="">` : ''}
            <span class="dh-title">${esc(x.title)}</span><b>${esc(info.label)}</b>
          </button>`).join('')}</div>
      </div>`);
    }
    if (on('focus')) {
      const focus = App.focusToday();
      right.push(`<div class="card focus-mini">
        <div class="card-head"><h3>${t('nav.focus')}</h3><span class="muted small">${t('focus.todayShort', { n: focus.sessions, m: focus.minutes })}</span></div>
        <button class="btn primary block" data-act="home-pomo">${svg('play')}${t('focus.startPomo')}</button>
      </div>`);
    }
    if (on('calendar')) {
      const upcoming = D.events.filter((e) => (e.end && e.end > e.date ? e.end : e.date) >= td).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
      right.push(`<div class="card">
        <div class="card-head"><h3>${fmt(td, { year: 'numeric', month: 'long' })}</h3></div>
        ${App.miniCal(now.getFullYear(), now.getMonth())}
        ${upcoming.length ? `<ul class="up-list">${upcoming.map((e) => `<li><span class="when">${App.evRange(e) ? App.evRange(e) : e.date === td ? t('c.today') : fmt(e.date, { month: 'short', day: 'numeric' })}</span><span class="dot" style="background:${App.eventColor(e)}"></span><span>${esc(e.title)}</span></li>`).join('')}</ul>` : ''}
      </div>`);
    }

    return `
    <section class="view home">
      ${App.homeStickerBar ? App.homeStickerBar() : ''}
      <div class="home-body">
      <header class="hello">
        <p class="muted">${fmt(td, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
      </header>
      <div class="home-grid">
        <div class="stack">${left.join('')}</div>
        <div class="stack">${right.join('')}</div>
      </div>
      ${App.homeStickerLayer ? App.homeStickerLayer() : ''}
      </div>
    </section>`;
  };

  App.after.home = function () { const l = App.$('#homeStk'); if (l) App.hydrateAssets(l); };

  App.A['home-pomo'] = () => {
    App.focusState.tab = 'pomo';
    App.go('focus');
    if (!App.focusState.pomo.running) App.A['focus-toggle']();
  };
  App.K['memo-add-home'] = (el) => { if (App.addMemo(el.value)) App.toast(t('c.saved')); };
})(window.App);
