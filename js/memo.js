// 메모 — 생각난 것 바로 적기 · 체크리스트 · 기한
(function (App) {
  const { t, esc, svg, uid, todayStr, addDays, ymd, nowISO, fmt, daysBetween } = App;
  const ui = App.ui;
  ui.memoQ = '';
  ui.memoKind = 'text';
  ui.memoFilter = 'all';
  ui.memoDue = '';

  App.addMemo = function (text, opts = {}) {
    text = (text || '').trim();
    const kind = opts.kind || 'text';
    const items = kind === 'check' ? text.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => ({ id: uid(), text: x, done: false })) : [];
    if (kind === 'text' ? !text : !items.length) return false;
    App.update((d) => d.memos.push({ id: uid(), kind, title: '', body: kind === 'text' ? text : '', items, due: opts.due || '', pinned: false, createdAt: nowISO(), updatedAt: nowISO() }));
    return true;
  };
  const created = (m) => m.createdAt || m.updatedAt || '';
  const timeOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : new Intl.DateTimeFormat(App.loc(), { hour: 'numeric', minute: '2-digit' }).format(d); };
  const dayOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : ymd(d); };
  const allDone = (m) => m.kind === 'check' && m.items.length && m.items.every((i) => i.done);

  // 기한 표시: 오늘까지 / D-3 / 2일 지남
  App.dueBadge = function (m) {
    if (!m.due) return '';
    const n = daysBetween(todayStr(), m.due);
    const cls = allDone(m) ? 'ok' : n < 0 ? 'over' : n <= 1 ? 'soon' : '';
    const label = n === 0 ? t('memo.dueToday') : n > 0 ? `D-${n}` : t('memo.dueOver', { n: -n });
    return `<span class="due ${cls}" title="${fmt(m.due, { month: 'long', day: 'numeric', weekday: 'short' })}">${label}</span>`;
  };

  function memoItem(m) {
    const done = m.kind === 'check' ? m.items.filter((i) => i.done).length : 0;
    const body = m.kind === 'check'
      ? `<div class="memo-check">
          ${m.body ? `<b>${esc(m.body)}</b>` : ''}
          <ul>${m.items.map((i) => `<li class="${i.done ? 'done' : ''}"><input type="checkbox" class="check" data-change="memo-item-toggle" data-id="${m.id}" data-i="${i.id}" ${i.done ? 'checked' : ''} aria-label="${esc(i.text)}"><span>${esc(i.text)}</span><button class="icon-btn tiny hover-only" data-act="memo-item-del" data-id="${m.id}" data-i="${i.id}" aria-label="${t('c.delete')}">${svg('x')}</button></li>`).join('')}</ul>
        </div>`
      : `<div class="memo-text" data-act="memo-edit" data-id="${m.id}">${m.title ? `<b>${esc(m.title)}</b>\n` : ''}${esc(m.body)}</div>`;
    return `<li class="memo-item ${m.pinned ? 'pinned' : ''} ${allDone(m) ? 'all-done' : ''}">
      ${body}
      <div class="memo-meta">
        ${m.kind === 'check' ? `<span class="muted small">${done}/${m.items.length}</span>` : ''}
        ${App.dueBadge(m)}
        <span class="muted small">${timeOf(created(m))}</span>
        <label class="icon-btn due-btn" title="${t('memo.setDue')}">📅<input type="date" value="${esc(m.due || '')}" data-change="memo-due" data-id="${m.id}"></label>
        ${m.due ? `<button class="icon-btn" data-act="memo-due-clear" data-id="${m.id}" title="${t('memo.clearDue')}">${svg('x')}</button>` : ''}
        <button class="icon-btn ${m.pinned ? 'on' : ''}" data-act="memo-pin" data-id="${m.id}" title="${m.pinned ? t('memo.unpin') : t('memo.pin')}" aria-pressed="${!!m.pinned}">${svg('pin')}</button>
        <button class="icon-btn" data-act="memo-edit-open" data-id="${m.id}" title="${t('c.edit')}" aria-label="${t('c.edit')}">${svg('edit')}</button>
        <button class="icon-btn" data-act="memo-copy" data-id="${m.id}" title="${t('c.copy')}">${svg('copy')}</button>
        <button class="icon-btn" data-act="memo-del" data-id="${m.id}" title="${t('c.delete')}">${svg('trash')}</button>
      </div>
    </li>`;
  }
  App.memoItem = memoItem;
  const textOf = (m) => (m.kind === 'check' ? [m.body, ...m.items.map((i) => (i.done ? '☑ ' : '☐ ') + i.text)].filter(Boolean).join('\n') : (m.title ? m.title + '\n' : '') + m.body);

  App.VIEWS.memo = function () {
    const q = ui.memoQ.trim().toLowerCase();
    const f = ui.memoFilter;
    let all = [...App.D.memos].filter((m) => !q || textOf(m).toLowerCase().includes(q));
    if (f === 'due') all = all.filter((m) => m.due).sort((a, b) => a.due.localeCompare(b.due));
    else all.sort((a, b) => created(b).localeCompare(created(a)));
    if (f === 'check') all = all.filter((m) => m.kind === 'check');
    const pinned = f === 'due' ? [] : all.filter((m) => m.pinned);
    const rest = f === 'due' ? all : all.filter((m) => !m.pinned);
    const td = todayStr(), yd = addDays(td, -1);
    const groups = [];
    if (f === 'due') groups.push({ label: t('memo.byDue'), items: rest });
    else for (const m of rest) {
      const d = dayOf(created(m));
      const label = d === td ? t('c.today') : d === yd ? t('c.yesterday') : (d ? fmt(d, { month: 'long', day: 'numeric', weekday: 'short' }) : '');
      if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
      groups[groups.length - 1].items.push(m);
    }
    const check = ui.memoKind === 'check';
    return `
    <section class="view narrow">
      <header class="view-head">
        <h2 class="view-title">${t('nav.memo')}</h2>
        <input class="input search" type="search" data-input="memo-search" data-keep="memo-search" value="${esc(ui.memoQ)}" placeholder="${esc(t('c.search'))}">
      </header>
      <div class="capture">
        <div class="row" style="justify-content:space-between;margin-bottom:6px">
          <div class="seg small">${[['text', '📝 ' + t('memo.kindText')], ['check', '☑ ' + t('memo.kindCheck')]].map(([k, l]) => `<button data-act="memo-kind" data-v="${k}" aria-pressed="${ui.memoKind === k}">${l}</button>`).join('')}</div>
          <label class="due-pick"><span class="muted small">${t('memo.due')}</span><input type="date" class="input date-input small-input" value="${esc(ui.memoDue)}" data-change="memo-new-due"></label>
        </div>
        <textarea class="capture-input" rows="2" data-enter="memo-add" data-keep="memo-add" placeholder="${esc(check ? t('memo.checkPh') : t('memo.capturePh'))}"></textarea>
        <div class="capture-foot"><span class="muted small">${check ? t('memo.checkHint') : t('memo.captureHint')}</span><button class="btn primary small" data-act="memo-add">${t('c.save')}</button></div>
      </div>
      <div class="toolbar"><div class="seg">${[['all', t('memo.f.all')], ['check', t('memo.f.check')], ['due', t('memo.f.due')]].map(([k, l]) => `<button data-act="memo-filter" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div></div>
      ${pinned.length ? `<h3 class="group-label">${t('memo.pinned')}</h3><ul class="memo-list">${pinned.map(memoItem).join('')}</ul>` : ''}
      ${groups.filter((g) => g.items.length).map((g) => `<h3 class="group-label">${esc(g.label)}</h3><ul class="memo-list">${g.items.map(memoItem).join('')}</ul>`).join('')}
      ${!all.length ? `<p class="empty center">${t(q ? 'c.noResult' : 'memo.empty')}</p>` : ''}
    </section>`;
  };

  function autosize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 320) + 'px'; }
  App.after.memo = () => { const c = App.$('.capture-input'); if (c) autosize(c); };

  function saveCapture() {
    const el = App.$('[data-keep="memo-add"]');
    if (el && App.addMemo(el.value, { kind: ui.memoKind, due: ui.memoDue })) { ui.memoDue = ''; App.renderMain(); App.toast(t('c.saved')); }
  }
  const findM = (d, id) => d.memos.find((x) => x.id === id);

  Object.assign(App.A, {
    'memo-add': saveCapture,
    'memo-kind': (el) => { ui.memoKind = el.dataset.v; App.renderMain(); const c = App.$('.capture-input'); if (c) c.focus(); },
    'memo-filter': (el) => { ui.memoFilter = el.dataset.v; App.renderMain(); },
    'memo-pin': (el) => App.update((d) => { const m = findM(d, el.dataset.id); if (m) m.pinned = !m.pinned; }),
    'memo-copy': (el) => { const m = App.D.memos.find((x) => x.id === el.dataset.id); if (m) App.copyText(textOf(m)); },
    'memo-due-clear': (el) => App.update((d) => { const m = findM(d, el.dataset.id); if (m) m.due = ''; }),
    'memo-item-del': (el) => App.update((d) => { const m = findM(d, el.dataset.id); if (m) m.items = m.items.filter((i) => i.id !== el.dataset.i); }),
    'memo-del': async (el) => {
      if (await App.confirmBox(t('c.confirmDelete'))) { App.update((d) => { d.memos = d.memos.filter((x) => x.id !== el.dataset.id); }); App.toast(t('c.deleted')); }
    },
    'memo-edit': (el) => {
      const id = el.dataset.id;
      const m = App.D.memos.find((x) => x.id === id);
      if (!m) return;
      const ta = document.createElement('textarea');
      ta.className = 'input memo-editing';
      ta.value = (m.title ? m.title + '\n' : '') + m.body;
      el.replaceWith(ta);
      autosize(ta);
      ta.focus();
      ta.addEventListener('input', () => autosize(ta));
      ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); ta.blur(); } });
      ta.addEventListener('blur', () => {
        const v = ta.value.trim();
        App.update((d) => {
          const x = findM(d, id);
          if (!x) return;
          if (!v) { d.memos = d.memos.filter((y) => y.id !== id); return; }
          if (v !== ((x.title ? x.title + '\n' : '') + x.body)) { x.title = ''; x.body = v; x.updatedAt = nowISO(); }
        });
      }, { once: true });
    },
    // 메모 수정 창 (글 메모·체크리스트 모두)
    'memo-edit-open': (el) => {
      const m = App.D.memos.find((x) => x.id === el.dataset.id);
      if (!m) return;
      const check = m.kind === 'check';
      const head = check ? m.body || '' : m.title || '';
      const content = check ? m.items.map((i) => i.text).join('\n') : m.body || '';
      App.openModal(`
        <h3 class="modal-title">${t('memo.editTitle')}</h3>
        <div class="seg small" style="align-self:flex-start;margin-bottom:10px">${[['text', t('memo.kindText')], ['check', t('memo.kindCheck')]].map(([k, l]) => `<button type="button" data-act="memo-edit-kind" data-v="${k}" aria-pressed="${m.kind === k}">${l}</button>`).join('')}</div>
        <input class="input" id="memoEditHead" maxlength="80" value="${esc(head)}" placeholder="${esc(t('memo.editHeadPh'))}">
        <textarea class="input" id="memoEditBody" rows="8" style="margin-top:8px" placeholder="${esc(check ? t('memo.editItemsPh') : t('memo.editBodyPh'))}">${esc(content)}</textarea>
        <p class="hint" id="memoEditHint" style="margin:6px 0 0">${check ? t('memo.editItemsHint') : ''}</p>
        <div class="modal-actions"><span></span>
          <div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn primary" data-act="memo-edit-save" data-id="${m.id}" data-kind="${m.kind}">${t('c.save')}</button></div></div>`, null, 'small');
      const ta = App.$('#memoEditBody'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    },
    'memo-edit-kind': (el) => {
      App.$$('[data-act="memo-edit-kind"]').forEach((b) => b.setAttribute('aria-pressed', b === el));
      const save = App.$('[data-act="memo-edit-save"]'); if (save) save.dataset.kind = el.dataset.v;
      const check = el.dataset.v === 'check';
      App.$('#memoEditBody').placeholder = check ? t('memo.editItemsPh') : t('memo.editBodyPh');
      App.$('#memoEditHint').textContent = check ? t('memo.editItemsHint') : '';
    },
    'memo-edit-save': (el) => {
      const id = el.dataset.id, kind = el.dataset.kind;
      const head = App.$('#memoEditHead').value.trim();
      const body = App.$('#memoEditBody').value;
      App.update((d) => {
        const x = findM(d, id);
        if (!x) return;
        if (kind === 'check') {
          const lines = body.split('\n').map((l) => l.replace(/^\s*([-*•]|\[[ xX]?\]|☐|☑)\s*/, '').trim()).filter(Boolean);
          const old = x.kind === 'check' ? x.items : [];
          const used = new Set();
          x.items = lines.map((text, i) => {
            let prev = old.find((o) => o.text === text && !used.has(o.id));
            if (!prev && old[i] && !used.has(old[i].id)) prev = old[i];
            if (prev) used.add(prev.id);
            return { id: prev ? prev.id : uid(), text, done: prev ? !!prev.done : false };
          });
          x.body = head; x.title = '';
        } else {
          const wasCheck = x.kind === 'check';
          x.title = head;
          x.body = wasCheck && body === x.items.map((i) => i.text).join('\n') ? body : body.trim();
          x.items = [];
        }
        x.kind = kind;
        x.updatedAt = nowISO();
      });
      App.closeModal();
      App.toast(t('c.saved'));
    },
    'quick-memo': () => {
      App.openModal(`
        <h3 class="modal-title">${t('memo.quick')}</h3>
        <textarea class="input capture-modal" rows="4" data-enter="quick-memo-save" placeholder="${esc(t('memo.capturePh'))}" autofocus></textarea>
        <div class="modal-actions"><span class="muted small">${t('memo.captureHint')}</span>
          <div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn primary" data-act="quick-memo-save">${t('c.save')}</button></div></div>`, null, 'small');
    },
    'quick-memo-save': () => {
      const el = App.$('.capture-modal');
      if (el && el.value.trim()) {
        App.silent((d) => d.memos.push({ id: uid(), kind: 'text', title: '', body: el.value.trim(), items: [], due: '', pinned: false, createdAt: nowISO(), updatedAt: nowISO() }));
        App.closeModal();
        App.toast(t('memo.savedQuick'));
      } else App.closeModal();
    }
  });
  Object.assign(App.C, {
    'memo-item-toggle': (el) => App.update((d) => { const m = findM(d, el.dataset.id); const i = m && m.items.find((x) => x.id === el.dataset.i); if (i) i.done = el.checked; }),
    'memo-due': (el) => App.update((d) => { const m = findM(d, el.dataset.id); if (m) m.due = el.value; }),
    'memo-new-due': (el) => { ui.memoDue = el.value; }
  });
  App.I['memo-search'] = (el) => { ui.memoQ = el.value; App.renderMain(); };
  App.K['memo-add'] = (el, e) => {
    // 체크리스트는 Enter 로 줄을 늘리고, 저장은 버튼으로
    if (ui.memoKind === 'check') {
      const s = el.selectionStart;
      el.value = el.value.slice(0, s) + '\n' + el.value.slice(el.selectionEnd);
      el.selectionStart = el.selectionEnd = s + 1;
      autosize(el);
      return;
    }
    saveCapture();
  };
  App.K['memo-item-add'] = (el) => {
    const v = el.value.trim(); if (!v) return;
    App.update((d) => { const m = findM(d, el.dataset.id); if (m) m.items.push({ id: uid(), text: v, done: false }); });
    setTimeout(() => { const n = App.$(`[data-enter="memo-item-add"][data-id="${el.dataset.id}"]`); if (n) n.focus(); }, 0);
  };
  App.K['quick-memo-save'] = () => App.A['quick-memo-save']();
  document.addEventListener('input', (e) => { if (e.target.classList && (e.target.classList.contains('capture-input') || e.target.classList.contains('home-capture'))) autosize(e.target); });
})(window.App);
