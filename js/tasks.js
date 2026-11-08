// 할 일 + 루틴
(function (App) {
  const { t, esc, svg, uid, todayStr, addDays, parse, nowISO, fmt } = App;

  App.todayTodos = () => {
    const td = todayStr();
    return App.D.todos
      .filter((x) => x.date === td || (x.date && x.date < td && !x.done))
      .sort((a, b) => (a.done - b.done) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  };
  App.scheduled = (r, d) => r.days.includes(parse(d).getDay());
  App.todayRoutines = () => App.D.routines.filter((r) => App.scheduled(r, todayStr()));
  App.streak = function (r) {
    const td = todayStr();
    const start = (r.createdAt || td).slice(0, 10);
    let n = r.done[td] ? 1 : 0;
    let d = addDays(td, -1);
    for (let i = 0; i < 1000 && d >= start; i++, d = addDays(d, -1)) {
      if (!App.scheduled(r, d)) continue;
      if (r.done[d]) n++; else break;
    }
    return n;
  };

  App.todoItem = function (x) {
    const td = todayStr();
    let meta = '';
    if (x.date && x.date !== td) {
      const over = x.date < td && !x.done;
      meta = `<span class="meta ${over ? 'overdue' : ''}">${over ? t('task.overdue') + ' · ' : ''}${fmt(x.date, { month: 'short', day: 'numeric' })}</span>`;
    }
    return `<li class="item ${x.done ? 'done' : ''}">
      <input type="checkbox" class="check" data-change="todo-toggle" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="${esc(x.text)}">
      <span class="txt" data-act="todo-edit" data-id="${x.id}">${esc(x.text)}</span>${meta}
      <button class="icon-btn hover-only" data-act="todo-del" data-id="${x.id}" aria-label="${t('c.delete')}">${svg('x')}</button>
    </li>`;
  };
  App.routineCheck = function (r) {
    const td = todayStr();
    const s = App.streak(r);
    return `<li class="item ${r.done[td] ? 'done' : ''}">
      <input type="checkbox" class="check" data-change="routine-toggle" data-id="${r.id}" data-date="${td}" ${r.done[td] ? 'checked' : ''} aria-label="${esc(r.text)}">
      <span class="txt">${esc(r.text)}</span>
      ${s > 1 ? `<span class="meta">${t('task.streak', { n: s })}</span>` : ''}
    </li>`;
  };
  App.addTodo = function (text, date) {
    text = (text || '').trim();
    if (!text) return;
    App.update((d) => d.todos.push({ id: uid(), text, done: false, date: date || '', createdAt: nowISO() }));
  };

  const ui = App.ui;
  ui.taskFilter = 'today';
  ui.newDays = [0, 1, 2, 3, 4, 5, 6];

  App.VIEWS.tasks = function () {
    const D = App.D;
    const td = todayStr();
    const f = ui.taskFilter;
    let list;
    if (f === 'today') list = App.todayTodos();
    else if (f === 'done') list = D.todos.filter((x) => x.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    else list = [...D.todos].sort((a, b) => (a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999') || (a.createdAt || '').localeCompare(b.createdAt || ''));
    const order = App.dayOrder();

    const routineRow = (r) => {
      const isToday = App.scheduled(r, td);
      const s = App.streak(r);
      let dots = '';
      for (let i = 6; i >= 0; i--) {
        const d = addDays(td, -i);
        dots += `<i class="${r.done[d] ? 'on' : ''} ${App.scheduled(r, d) ? '' : 'off'}" title="${fmt(d, { month: 'numeric', day: 'numeric' })}"></i>`;
      }
      const dayText = r.days.length === 7 ? t('task.everyday') : order.filter((i) => r.days.includes(i)).map((i) => App.wdName(i)).join(' ');
      return `<div class="routine">
        <div class="routine-top">
          <input type="checkbox" class="check" data-change="routine-toggle" data-id="${r.id}" data-date="${td}" ${r.done[td] ? 'checked' : ''} ${isToday ? '' : 'disabled'} aria-label="${esc(r.text)}">
          <span class="name">${esc(r.text)}</span>
          ${s > 0 ? `<span class="streak">${t('task.streak', { n: s })}</span>` : ''}
          <button class="icon-btn hover-only" data-act="routine-del" data-id="${r.id}" aria-label="${t('c.delete')}">${svg('x')}</button>
        </div>
        <div class="routine-bottom"><div class="week-dots">${dots}</div><span class="muted small">${isToday ? esc(dayText) : t('task.restDay') + ' · ' + esc(dayText)}</span></div>
      </div>`;
    };

    return `
    <section class="view">
      <header class="view-head"><h2 class="view-title">${t('nav.tasks')}</h2></header>
      <div class="cols-2">
        <div class="card">
          <div class="card-head">
            <h3>${t('task.todo')}</h3>
            <div class="seg">${['today', 'all', 'done'].map((k) => `<button data-act="task-filter" data-f="${k}" aria-pressed="${f === k}">${t('task.f.' + k)}</button>`).join('')}</div>
          </div>
          <div class="add-row">
            <input class="input" id="todoText" data-enter="todo-add" data-keep="todo-add" placeholder="${esc(t('task.todoPh'))}">
            <input class="input date-input" id="todoDate" type="date" value="${f === 'today' ? td : ''}" aria-label="${t('c.date')}">
            <button class="btn primary" data-act="todo-add">${t('c.add')}</button>
          </div>
          ${list.length ? `<ul class="item-list">${list.map(App.todoItem).join('')}</ul>` : `<p class="empty">${t('task.empty')}</p>`}
          ${f === 'done' && list.length ? `<button class="btn ghost small" data-act="todo-clear">${t('task.clearDone')}</button>` : ''}
        </div>
        <div class="card">
          <div class="card-head"><h3>${t('task.routine')}</h3></div>
          <div class="add-row">
            <input class="input" id="routineText" data-enter="routine-add" data-keep="routine-add" placeholder="${esc(t('task.routinePh'))}">
            <button class="btn primary" data-act="routine-add">${t('c.add')}</button>
          </div>
          <div class="row gap-s" style="margin-bottom:14px"><span class="label">${t('task.daysHint')}</span>
            <div class="days">${order.map((i) => `<button type="button" class="day-tog" data-act="day-tog" data-d="${i}" aria-pressed="${ui.newDays.includes(i)}">${esc(App.wdName(i, 'narrow'))}</button>`).join('')}</div>
          </div>
          ${D.routines.length ? D.routines.map(routineRow).join('') : `<p class="empty">${t('task.empty')}</p>`}
        </div>
      </div>
    </section>`;
  };

  const findTodo = (d, id) => d.todos.find((x) => x.id === id);
  Object.assign(App.A, {
    'todo-del': (el) => App.update((d) => { d.todos = d.todos.filter((x) => x.id !== el.dataset.id); }),
    'todo-edit': (el) => {
      const id = el.dataset.id;
      const x = App.D.todos.find((y) => y.id === id);
      if (!x) return;
      const inp = document.createElement('input');
      inp.className = 'input inline-edit';
      inp.value = x.text;
      el.replaceWith(inp);
      inp.focus();
      let cancelled = false;
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) inp.blur();
        if (e.key === 'Escape') { cancelled = true; e.stopPropagation(); inp.blur(); }
      });
      inp.addEventListener('blur', () => {
        const v = inp.value.trim();
        App.update((d) => { const y = findTodo(d, id); if (y && v && !cancelled) y.text = v; });
      }, { once: true });
    },
    'todo-add': () => App.addTodo(App.$('#todoText').value, App.$('#todoDate').value),
    'todo-clear': () => App.update((d) => { d.todos = d.todos.filter((x) => !x.done); }),
    'task-filter': (el) => { ui.taskFilter = el.dataset.f; App.renderMain(); },
    'day-tog': (el) => {
      const i = Number(el.dataset.d);
      ui.newDays = ui.newDays.includes(i) ? ui.newDays.filter((x) => x !== i) : [...ui.newDays, i];
      el.setAttribute('aria-pressed', ui.newDays.includes(i));
    },
    'routine-add': () => addRoutine(),
    'routine-del': async (el) => {
      if (await App.confirmBox(t('c.confirmDelete'))) App.update((d) => { d.routines = d.routines.filter((x) => x.id !== el.dataset.id); });
    }
  });
  function addRoutine() {
    const input = App.$('#routineText');
    const text = (input && input.value || '').trim();
    if (!text || !ui.newDays.length) return;
    App.update((d) => d.routines.push({ id: uid(), text, days: [...ui.newDays], done: {}, createdAt: nowISO() }));
  }
  Object.assign(App.C, {
    'todo-toggle': (el) => App.update((d) => { const x = findTodo(d, el.dataset.id); if (x) { x.done = el.checked; x.doneAt = el.checked ? nowISO() : ''; } }),
    'routine-toggle': (el) => App.update((d) => {
      const r = d.routines.find((x) => x.id === el.dataset.id);
      if (!r) return;
      if (el.checked) r.done[el.dataset.date] = true; else delete r.done[el.dataset.date];
    })
  });
  Object.assign(App.K, {
    'todo-add': () => App.A['todo-add'](),
    'todo-add-today': (el) => App.addTodo(el.value, todayStr()),
    'routine-add': () => addRoutine()
  });
})(window.App);
