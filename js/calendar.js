// 캘린더 — 일정 종류별 색, 디데이·메모 기한 함께 보기
(function (App) {
  const { t, esc, svg, uid, todayStr, ymd, parse, fmt } = App;
  const ui = App.ui;
  const now = new Date();
  ui.calY = now.getFullYear(); ui.calM = now.getMonth(); ui.calSel = todayStr();
  ui.calCat = null;
  const PALETTE = ['#5b7cfa', '#2fa4de', '#e46b92', '#f28b82', '#2a9d7f', '#8bc34a', '#e89a1c', '#fbbc04', '#9467d8', '#7d8594'];

  const cats = () => App.D.eventCats || [];
  const catOf = (e) => cats().find((c) => c.id === e.cat) || null;
  App.eventColor = (e) => App.safeColor((catOf(e) || {}).color || e.color);

  function monthCells(y, m) {
    const first = new Date(y, m, 1);
    const offset = (first.getDay() - App.D.settings.weekStart + 7) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const rows = Math.ceil((offset + days) / 7);
    const out = [];
    for (let i = 0; i < rows * 7; i++) out.push(new Date(y, m, 1 - offset + i));
    return out;
  }
  // 그 날짜에 걸리는 디데이
  App.ddaysOn = function (s) {
    if (!App.on('dday')) return [];
    return App.D.ddays.filter((x) => x.cal !== false).filter((x) => (x.yearly ? x.date.slice(5) === s.slice(5) && s >= x.date : x.date === s));
  };
  const memosDue = (s) => (App.on('memo') ? App.D.memos.filter((m) => m.due === s) : []);
  const visibleEvents = (s) => App.D.events.filter((e) => e.date === s);

  App.miniCal = function (y, m) {
    const td = todayStr();
    const has = new Set([...App.D.events.map((e) => e.date), ...App.D.ddays.filter((x) => !x.yearly && x.cal !== false).map((x) => x.date)]);
    let html = App.dayOrder().map((i) => `<span class="wd">${esc(App.wdName(i, 'narrow'))}</span>`).join('');
    for (const d of monthCells(y, m)) {
      const s = ymd(d);
      const cls = ['d', d.getMonth() !== m ? 'out' : '', s === td ? 'today' : '', has.has(s) ? 'has' : ''].join(' ');
      html += `<button type="button" class="${cls}" data-act="cal-jump" data-date="${s}">${d.getDate()}</button>`;
    }
    return `<div class="mini-cal">${html}</div>`;
  };

  App.VIEWS.calendar = function () {
    const D = App.D;
    const y = ui.calY, m = ui.calM;
    const td = todayStr();
    if (!ui.calCat || !cats().some((c) => c.id === ui.calCat)) ui.calCat = cats()[0] ? cats()[0].id : '';
    let cells = App.dayOrder().map((i) => `<div class="wd ${i === 0 ? 'sun' : ''}">${esc(App.wdName(i))}</div>`).join('');
    for (const d of monthCells(y, m)) {
      const s = ymd(d);
      const chips = [
        ...App.ddaysOn(s).map((x) => `<span class="chip dd" style="--c:${App.safeColor(x.color)}">${esc(x.title)}</span>`),
        ...visibleEvents(s).map((e) => `<span class="chip ev-drag" data-eid="${e.id}" style="--c:${App.eventColor(e)}" title="${esc(t('cal.dragHint'))}">${esc(e.title)}</span>`),
        ...(App.on('tasks') ? D.todos.filter((x) => x.date === s).map((x) => `<span class="chip todo ${x.done ? 'done' : ''}">${esc(x.text)}</span>`) : []),
        ...memosDue(s).map((x) => `<span class="chip todo memo-due">📝 ${esc(memoTitle(x))}</span>`)
      ];
      const di = App.on('diary') ? D.diary.find((x) => x.date === s) : null;
      const shown = chips.slice(0, 3).join('') + (chips.length > 3 ? `<span class="chip more">+${chips.length - 3}</span>` : '');
      const cls = ['cal-cell', d.getMonth() !== m ? 'out' : '', s === td ? 'today' : '', s === ui.calSel ? 'sel' : ''].join(' ');
      cells += `<button type="button" class="${cls}" data-act="cal-pick" data-date="${s}">
        <span class="num"><span class="n ${d.getDay() === 0 ? 'sun' : ''}">${d.getDate()}</span><span>${di ? esc(di.mood || '✎') : ''}</span></span>${shown}</button>`;
    }

    const sel = ui.calSel;
    const selEvents = D.events.filter((e) => e.date === sel);
    const selTodos = D.todos.filter((x) => x.date === sel);
    const selDiary = D.diary.find((x) => x.date === sel);
    const selDd = App.ddaysOn(sel);
    const selMemos = memosDue(sel);

    return `
    <section class="view">
      <header class="view-head">
        <div class="row gap-s">
          <h2 class="view-title">${new Intl.DateTimeFormat(App.loc(), { year: 'numeric', month: 'long' }).format(new Date(y, m, 1))}</h2>
          <button class="icon-btn" data-act="cal-move" data-n="-1" aria-label="${t('c.prev')}">${svg('left')}</button>
          <button class="btn small" data-act="cal-today">${t('c.today')}</button>
          <button class="icon-btn" data-act="cal-move" data-n="1" aria-label="${t('c.next')}">${svg('right')}</button>
        </div>
        <div class="cat-legend">
          <button class="btn small ${ui.calEdit ? 'primary' : ''}" data-act="cal-cats">${svg('edit')}${ui.calEdit ? t('cal.editDone') : t('cal.editCats')}</button>
        </div>
      </header>
      ${ui.calEdit ? catsPanel() : ''}
      <div class="cal-wrap">
        <div class="cal-grid">${cells}</div>
        <aside class="card day-panel">
          <h3>${fmt(sel, { month: 'long', day: 'numeric', weekday: 'long' })}</h3>
          ${selDd.length ? `<div class="day-sec">${selDd.map((x) => `<span class="pill" style="--c:${App.safeColor(x.color)}">${esc(x.title)} · ${esc(App.ddayInfo(x).label)}</span>`).join(' ')}</div>` : ''}
          <div class="day-sec">
            <span class="label">${t('cal.events')}</span>
            ${selEvents.length ? `<ul class="item-list">${selEvents.map((e) => `<li class="item ev-drag" data-eid="${e.id}" title="${esc(t('cal.dragHint'))}"><span class="dot" style="background:${App.eventColor(e)}"></span><span class="txt">${esc(e.title)}${catOf(e) ? ` <span class="muted small">${esc(catOf(e).name)}</span>` : ''}</span><button class="icon-btn hover-only" data-act="event-del" data-id="${e.id}" aria-label="${t('c.delete')}">${svg('x')}</button></li>`).join('')}</ul>` : ''}
            <div class="add-row"><input class="input" data-enter="event-add" data-keep="event-add" id="eventTitle" placeholder="${esc(t('cal.eventPh'))}"><button class="btn primary" data-act="event-add">${t('c.add')}</button></div>
            <div class="cat-pick">${cats().map((c) => `<button type="button" class="cat-chip" style="--c:${App.safeColor(c.color)}" data-act="event-cat" data-id="${c.id}" aria-pressed="${ui.calCat === c.id}"><i></i>${esc(c.name)}</button>`).join('')}</div>
          </div>
          ${App.on('tasks') ? `<div class="day-sec">
            <span class="label">${t('cal.todos')}</span>
            ${selTodos.length ? `<ul class="item-list">${selTodos.map(App.todoItem).join('')}</ul>` : ''}
            <input class="input quick" data-enter="todo-add-day" data-keep="day-todo" placeholder="${esc(t('task.todoPh'))}">
          </div>` : ''}
          ${selMemos.length ? `<div class="day-sec"><span class="label">${t('cal.memoDue')}</span><ul class="item-list">${selMemos.map((x) => `<li class="item"><span class="txt">📝 ${esc(memoTitle(x))}</span></li>`).join('')}</ul></div>` : ''}
          ${App.on('diary') ? `<div class="day-sec">
            <span class="label">${t('cal.diary')}</span>
            ${selDiary ? `<p class="small">${esc(selDiary.mood)} ${esc(selDiary.weather)} ${esc(selDiary.title || t('c.untitled'))}</p>` : ''}
            <button class="btn small" data-act="diary-write" data-date="${sel}">${selDiary ? t('diary.open') : t('diary.writeThis')}</button>
          </div>` : ''}
        </aside>
      </div>
    </section>`;
  };
  function memoTitle(m) {
    if (m.kind === 'check') return (m.body || '').split('\n')[0] || (m.items || []).map((i) => i.text).slice(0, 2).join(', ');
    return (m.title || m.body || '').split('\n')[0];
  }

  function addEvent() {
    const input = App.$('#eventTitle');
    const title = (input && input.value || '').trim();
    if (!title) return;
    const c = cats().find((x) => x.id === ui.calCat);
    const ev = { id: uid(), date: ui.calSel, title, cat: c ? c.id : '', color: c ? c.color : App.EVENT_COLORS[0] };
    App.update((d) => { d.events.push(ev); });
  }

  ui.catNewColor = PALETTE[4];
  const colorRow = (act, id, cur, inputAct) => `<div class="colors">${PALETTE.map((p) => `<button type="button" class="color-dot" style="background:${p}" data-act="${act}" ${id ? `data-id="${id}"` : ''} data-v="${p}" aria-pressed="${cur === p}" aria-label="${p}"></button>`).join('')}
    <label class="color-pick ${PALETTE.includes(cur) ? '' : 'on'}" title="${t('cc.pickColor')}"><input type="color" value="${App.safeColor(cur)}" data-change="${inputAct}" ${id ? `data-id="${id}"` : ''}><span>${t('cc.custom')}</span></label></div>`;
  const DEFAULT_CATS = [['c1', '일정', '#5b7cfa'], ['c2', '약속', '#e46b92'], ['c3', '과제', '#2a9d7f'], ['c4', '마감', '#e89a1c']];
  function catsPanel() {
    const missing = DEFAULT_CATS.filter(([id, name]) => !cats().some((c) => c.id === id || c.name === name));
    return `<div class="card cat-panel">
      <div class="card-head"><h3>${t('cal.catPanel')}</h3>${missing.length ? `<button class="btn small ghost" data-act="cat-restore">${t('cal.catRestore', { n: missing.map((m) => m[1]).join('·') })}</button>` : ''}</div>
      <ul class="cat-list">${cats().map((c) => `
        <li>
          <span class="cat-swatch" style="background:${App.safeColor(c.color)}"></span>
          <input class="input" value="${esc(c.name)}" data-change="cat-name" data-id="${c.id}" maxlength="12" aria-label="${t('cal.catName')}">
          ${colorRow('cat-color', c.id, c.color, 'cat-color-input')}
          <button class="icon-btn" data-act="cat-del" data-id="${c.id}" aria-label="${t('c.delete')}" title="${t('c.delete')}">${svg('trash')}</button>
        </li>`).join('') || `<li class="muted small">${t('cal.catNone')}</li>`}
        <li class="cat-new-row">
          <span class="cat-swatch" style="background:${App.safeColor(ui.catNewColor)}"></span>
          <input class="input" id="catNew" maxlength="12" placeholder="${esc(t('cal.catNewPh'))}" data-enter="cat-add">
          ${colorRow('cat-new-color', '', ui.catNewColor, 'cat-new-color-input')}
          <button class="btn small primary" data-act="cat-add">${t('c.add')}</button>
        </li>
      </ul>
      <p class="hint" style="margin:8px 0 0">${t('cal.catsHelp')}</p>
    </div>`;
  }
  const catsModal = () => { const k = App.$('#catNew') ? App.$('#catNew').value : ''; App.renderMain(); const n = App.$('#catNew'); if (n) n.value = k; };

  /* ---------- 일정 끌어서 다른 날로 옮기기 ---------- */
  let evDrag = null, swallowClick = false;
  document.addEventListener('pointerdown', (ev) => {
    if (App.ui.view !== 'calendar' || ev.button > 0) return;
    const el = ev.target.closest && ev.target.closest('.ev-drag');
    if (!el || ev.target.closest('button.icon-btn, .btn')) return;
    evDrag = { id: el.dataset.eid, el, sx: ev.clientX, sy: ev.clientY, ghost: null, over: null, pid: ev.pointerId };
  });
  document.addEventListener('pointermove', (ev) => {
    if (!evDrag) return;
    if (!evDrag.ghost) {
      if (Math.abs(ev.clientX - evDrag.sx) + Math.abs(ev.clientY - evDrag.sy) < 6) return;
      const e = App.D.events.find((x) => x.id === evDrag.id);
      if (!e) { evDrag = null; return; }
      const g = document.createElement('div');
      g.className = 'ev-ghost';
      g.style.setProperty('--c', App.eventColor(e));
      g.textContent = e.title;
      document.body.appendChild(g);
      evDrag.ghost = g;
      evDrag.el.classList.add('dragging');
      document.body.classList.add('ev-dragging');
    }
    ev.preventDefault();
    evDrag.ghost.style.transform = `translate(${ev.clientX + 10}px, ${ev.clientY + 10}px)`;
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const cell = hit && hit.closest && hit.closest('.cal-cell');
    if (evDrag.over && evDrag.over !== cell) evDrag.over.classList.remove('drop');
    if (cell) cell.classList.add('drop');
    evDrag.over = cell;
  }, { passive: false });
  const endDrag = (ev) => {
    if (!evDrag) return;
    const d = evDrag;
    evDrag = null;
    if (!d.ghost) return;
    d.ghost.remove();
    d.el.classList.remove('dragging');
    document.body.classList.remove('ev-dragging');
    if (d.over) d.over.classList.remove('drop');
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 0);
    if (ev.type === 'pointercancel' || !d.over) return;
    const date = d.over.dataset.date;
    const e = App.D.events.find((x) => x.id === d.id);
    if (!e || !date || e.date === date) return;
    ui.calSel = date;
    App.update((data) => { const x = data.events.find((y) => y.id === d.id); if (x) x.date = date; });
    App.toast(t('cal.moved', { d: fmt(date, { month: 'long', day: 'numeric' }) }));
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  // 끌기가 끝난 뒤 따라오는 클릭(날짜 선택)은 무시
  document.addEventListener('click', (ev) => { if (swallowClick) { ev.stopPropagation(); ev.preventDefault(); } }, true);

  Object.assign(App.A, {
    'cal-move': (el) => {
      const d = new Date(ui.calY, ui.calM + Number(el.dataset.n), 1);
      ui.calY = d.getFullYear(); ui.calM = d.getMonth();
      App.renderMain();
    },
    'cal-today': () => { const d = new Date(); ui.calY = d.getFullYear(); ui.calM = d.getMonth(); ui.calSel = todayStr(); App.renderMain(); },
    'cal-pick': (el) => {
      ui.calSel = el.dataset.date;
      const d = parse(ui.calSel);
      ui.calY = d.getFullYear(); ui.calM = d.getMonth();
      App.renderMain();
    },
    'cal-jump': (el) => { ui.calSel = el.dataset.date; const d = parse(ui.calSel); ui.calY = d.getFullYear(); ui.calM = d.getMonth(); App.go('calendar'); },
    'event-add': addEvent,
    'event-del': (el) => App.update((d) => { d.events = d.events.filter((x) => x.id !== el.dataset.id); }),
    'event-cat': (el) => {
      ui.calCat = el.dataset.id;
      App.$$('[data-act="event-cat"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === ui.calCat));
    },
    'cal-cats': () => { ui.calEdit = !ui.calEdit; App.renderMain(); },
    'cat-restore': () => {
      App.update((d) => DEFAULT_CATS.forEach(([id, name, color]) => { if (!d.eventCats.some((c) => c.id === id || c.name === name)) d.eventCats.push({ id, name, color }); }));
    },
    'cat-color': (el) => { App.silent((d) => { const c = d.eventCats.find((x) => x.id === el.dataset.id); if (c) c.color = el.dataset.v; }); catsModal(); },
    'cat-del': async (el) => {
      const c = cats().find((x) => x.id === el.dataset.id);
      const used = App.D.events.filter((e) => e.cat === c.id).length;
      if (await App.confirmBox(used ? t('cal.catDelUsed', { n: used }) : t('c.confirmDelete'))) {
        App.update((d) => { d.eventCats = d.eventCats.filter((x) => x.id !== c.id); d.events.forEach((e) => { if (e.cat === c.id) { e.cat = ''; e.color = c.color; } }); });
      }
      catsModal();
    },
    'cat-add': () => {
      const name = (App.$('#catNew').value || '').trim();
      if (!name) return;
      App.update((d) => { d.eventCats = d.eventCats || []; d.eventCats.push({ id: uid(), name, color: App.safeColor(ui.catNewColor) }); });
      App.toast(t('c.added'));
    },
    'cat-new-color': (el) => { ui.catNewColor = el.dataset.v; catsModal(); }
  });
  Object.assign(App.C, {
    'cat-name': (el) => { App.silent((d) => { const c = d.eventCats.find((x) => x.id === el.dataset.id); if (c && el.value.trim()) c.name = el.value.trim(); }); catsModal(); },
    'cat-new-color-input': (el) => { ui.catNewColor = el.value; catsModal(); },
    'cat-color-input': (el) => { App.silent((d) => { const c = d.eventCats.find((x) => x.id === el.dataset.id); if (c) c.color = el.value; }); catsModal(); }
  });
  Object.assign(App.K, {
    'event-add': addEvent,
    'cat-add': () => App.A['cat-add'](),
    'todo-add-day': (el) => App.addTodo(el.value, ui.calSel)
  });
})(window.App);
