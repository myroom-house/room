// 북마크 — 링크, 제목, 추가 내용
(function (App) {
  const { t, esc, svg, uid, nowISO } = App;
  const ui = App.ui;
  ui.bmQ = ''; ui.bmTag = '';

  const tagsOf = (s) => String(s || '').split(/[,#]/).map((x) => x.trim()).filter(Boolean);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const normUrl = (u) => { u = (u || '').trim(); if (u && !/^[a-z]+:\/\//i.test(u)) u = 'https://' + u; return App.safeUrl(u); };

  function form(x) {
    x = x || { url: '', title: '', note: '', tags: [] };
    return `
      <div class="form-grid">
        <input class="input grow" id="bmUrl" value="${esc(x.url)}" placeholder="${esc(t('bm.url'))}" data-enter="bm-key">
        <input class="input grow" id="bmTitle" value="${esc(x.title)}" placeholder="${esc(t('bm.title'))}" data-enter="bm-key">
      </div>
      <textarea class="input" id="bmNote" rows="2" placeholder="${esc(t('bm.note'))}">${esc(x.note)}</textarea>
      <input class="input" id="bmTags" value="${esc((x.tags || []).join(', '))}" placeholder="${esc(t('ex.tags'))}" data-enter="bm-key">`;
  }
  function readForm() {
    const v = (id) => App.$('#' + id).value.trim();
    const url = normUrl(v('bmUrl'));
    return { url, title: v('bmTitle') || host(url), note: v('bmNote'), tags: tagsOf(v('bmTags')) };
  }

  function row(x) {
    const h = host(x.url);
    return `<li class="bm-item">
      <div class="bm-icon" aria-hidden="true"><span>${esc((x.title || h || '?').trim().charAt(0).toUpperCase())}</span>${h ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64" alt="" data-fallback>` : ''}</div>
      <div class="bm-body">
        <a class="bm-title" href="${esc(x.url)}" data-act="open-url" data-url="${esc(x.url)}">${esc(x.title || h)}</a>
        <div class="muted small bm-host">${esc(h)}</div>
        ${x.note ? `<p class="bm-note">${esc(x.note)}</p>` : ''}
        ${(x.tags || []).length ? `<div class="tags">${x.tags.map((g) => `<button class="tag" data-act="bm-tag" data-tag="${esc(g)}">#${esc(g)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="bm-actions">
        <button class="icon-btn" data-act="bm-copy" data-id="${x.id}" title="${t('bm.copyLink')}">${svg('link')}</button>
        <button class="icon-btn" data-act="bm-edit" data-id="${x.id}" title="${t('c.edit')}">${svg('edit')}</button>
        <button class="icon-btn" data-act="bm-del" data-id="${x.id}" title="${t('c.delete')}">${svg('trash')}</button>
      </div>
    </li>`;
  }

  App.VIEWS.bookmark = function () {
    const q = ui.bmQ.trim().toLowerCase();
    const tags = [...new Set(App.D.bookmarks.flatMap((x) => x.tags || []))].sort();
    const list = [...App.D.bookmarks]
      .filter((x) => !ui.bmTag || (x.tags || []).includes(ui.bmTag))
      .filter((x) => !q || [x.title, x.url, x.note, (x.tags || []).join(' ')].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return `
    <section class="view narrow">
      <header class="view-head"><h2 class="view-title">${t('nav.bookmark')} <span class="count">${App.D.bookmarks.length}</span></h2></header>
      <div class="card stack">${form()}<div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="bm-add">${t('c.add')}</button></div></div>
      <div class="toolbar">
        <input class="input search" type="search" data-input="bm-search" data-keep="bm-search" value="${esc(ui.bmQ)}" placeholder="${esc(t('c.search'))}">
        <div class="tags">${tags.map((g) => `<button class="tag ${g === ui.bmTag ? 'on' : ''}" data-act="bm-tag" data-tag="${g === ui.bmTag ? '' : esc(g)}">#${esc(g)}</button>`).join('')}</div>
      </div>
      ${list.length ? `<ul class="bm-list">${list.map(row).join('')}</ul>` : `<p class="empty center">${t(App.D.bookmarks.length ? 'c.noResult' : 'bm.empty')}</p>`}
    </section>`;
  };

  function addBm() {
    const f = readForm();
    if (!f.url) { App.toast(t('bm.badUrl')); App.$('#bmUrl').focus(); return; }
    App.update((d) => d.bookmarks.push({ id: uid(), ...f, createdAt: nowISO() }));
    App.toast(t('c.added'));
  }

  Object.assign(App.A, {
    'bm-add': addBm,
    'bm-copy': (el) => { const x = App.D.bookmarks.find((y) => y.id === el.dataset.id); if (x) App.copyText(x.url); },
    'bm-del': async (el) => {
      if (await App.confirmBox(t('c.confirmDelete'))) App.update((d) => { d.bookmarks = d.bookmarks.filter((x) => x.id !== el.dataset.id); });
    },
    'bm-tag': (el) => { ui.bmTag = el.dataset.tag; App.renderMain(); },
    'bm-edit': (el) => {
      const x = App.D.bookmarks.find((y) => y.id === el.dataset.id);
      if (!x) return;
      App.openModal(`<h3 class="modal-title">${t('c.edit')}</h3><div class="stack">${form(x)}</div>
        <div class="modal-actions"><span></span><div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn primary" data-act="bm-save" data-id="${x.id}">${t('c.save')}</button></div></div>`);
    },
    'bm-save': (el) => {
      const f = readForm();
      if (!f.url) { App.toast(t('bm.badUrl')); return; }
      App.silent((d) => { const x = d.bookmarks.find((y) => y.id === el.dataset.id); if (x) Object.assign(x, f); });
      App.closeModal();
    }
  });
  App.K['bm-key'] = () => { const s = App.$('[data-act="bm-save"]'); if (s) App.A['bm-save'](s); else addBm(); };
  App.I['bm-search'] = (el) => { ui.bmQ = el.value; App.renderMain(); };
})(window.App);
