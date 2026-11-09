// 스티커 보관함 폴더 — 폴더 만들기, 끌어서 폴더에 넣기, 여러 개 한꺼번에 옮기기
(function (App) {
  const { t, esc, svg, uid } = App;
  const ui = App.ui;
  ui.stkFolder = 'all';        // 'all' | '' (폴더 없음) | 폴더 id
  ui.stkSelect = false;        // 여러 개 고르기 모드
  ui.stkSel = new Set();       // 고른 스티커 id

  const folders = () => (App.D.stickerFolders = App.D.stickerFolders || []);
  const all = () => (App.D.stickers = App.D.stickers || []);
  const inFolder = (s, f) => (f === 'all' ? true : (s.folder || '') === f);
  App.stickersInView = () => {
    if (ui.stkFolder !== 'all' && ui.stkFolder !== '' && !folders().some((f) => f.id === ui.stkFolder)) ui.stkFolder = 'all';
    return all().filter((s) => inFolder(s, ui.stkFolder));
  };
  // 다른 메뉴로 가면 여러 개 고르기는 끝내기
  App.onLeave = App.onLeave || {};
  const prevLeave = App.onLeave.custom;
  App.onLeave.custom = () => { ui.stkSelect = false; ui.stkSel.clear(); if (prevLeave) prevLeave(); };
  App.stickerUploadFolder = () => (ui.stkFolder === 'all' ? '' : ui.stkFolder);

  // ctx: 'manage'(꾸미기) | 'diary' | 'modal'(홈 스티커 고르기)
  App.stickerFolderBar = function (ctx) {
    const count = (f) => all().filter((s) => inFolder(s, f)).length;
    const chip = (id, label, n) => `<button type="button" class="stk-folder ${ui.stkFolder === id ? 'on' : ''}" data-act="stk-folder" data-v="${esc(id)}" data-ctx="${ctx}" ${id !== 'all' ? `data-stk-folder="${esc(id)}"` : ''}>${id !== 'all' && id !== '' ? svg('folder') : ''}${esc(label)}<span>${n}</span></button>`;
    const cur = folders().find((f) => f.id === ui.stkFolder);
    return `<div class="stk-bar">
      <div class="stk-folders">
        ${chip('all', t('stk.all'), all().length)}
        ${folders().map((f) => chip(f.id, f.name, count(f.id))).join('')}
        ${all().some((s) => !s.folder) && folders().length ? chip('', t('stk.none'), count('')) : ''}
        <button type="button" class="stk-folder add" data-act="stk-folder-new" data-ctx="${ctx}">${svg('plus')}${t('stk.newFolder')}</button>
      </div>
      ${ctx === 'manage' ? `<div class="stk-tools">
        ${cur ? `<button class="link-btn" data-act="stk-folder-rename" data-ctx="${ctx}">${t('stk.rename')}</button><button class="link-btn" data-act="stk-folder-del" data-ctx="${ctx}">${t('stk.delFolder')}</button>` : ''}
        ${all().length ? `<button class="btn small ${ui.stkSelect ? 'primary' : ''}" data-act="stk-select-toggle">${ui.stkSelect ? t('stk.selectDone') : t('stk.select')}</button>` : ''}
      </div>` : ''}
    </div>
    ${ctx === 'manage' && ui.stkSelect ? `<div class="stk-selbar">
      <span><b>${ui.stkSel.size}</b>${t('stk.selected')}</span>
      <button class="link-btn" data-act="stk-sel-all">${t('stk.selAll')}</button>
      <select class="input small" data-change="stk-move" ${ui.stkSel.size ? '' : 'disabled'}><option value="__">${t('stk.moveTo')}</option>${folders().map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}<option value="">${t('stk.none')}</option><option value="__new">+ ${t('stk.newFolder')}</option></select>
      <button class="link-btn danger" data-act="stk-sel-del" ${ui.stkSel.size ? '' : 'disabled'}>${t('c.delete')}</button>
    </div>` : ''}
    ${folders().length && ctx !== 'modal' ? `<p class="hint stk-hint">${ctx === 'manage' && ui.stkSelect ? t('stk.dragHintMany') : t('stk.dragHint')}</p>` : ''}`;
  };

  function rerender(ctx) {
    if (ctx === 'modal' && App.A['hs-pick']) App.A['hs-pick']();
    else App.renderMain();
  }
  function moveTo(ids, folder) {
    App.update((d) => { (d.stickers || []).forEach((s) => { if (ids.includes(s.id)) s.folder = folder; }); });
    const f = folders().find((x) => x.id === folder);
    App.toast(t('stk.moved', { n: ids.length, f: f ? f.name : t('stk.none') }));
  }
  function nameModal(title, value, onSave) {
    App.openModal(`<h3 class="modal-title">${title}</h3>
      <input class="input" id="stkName" maxlength="20" value="${esc(value || '')}" placeholder="${esc(t('stk.namePh'))}" data-enter="stk-name-ok">
      <div class="modal-actions"><span></span><div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn primary" data-act="stk-name-ok">${t('c.save')}</button></div></div>`, null, 'small');
    pendingName = onSave;
    const i = App.$('#stkName'); if (i) { i.focus(); i.select(); }
  }
  let pendingName = null;

  Object.assign(App.A, {
    'stk-folder': (el) => { ui.stkFolder = el.dataset.v; rerender(el.dataset.ctx); },
    'stk-folder-new': (el) => {
      const ctx = el.dataset.ctx;
      nameModal(t('stk.newFolder'), '', (name, after) => {
        const id = uid();
        App.silent((d) => { d.stickerFolders = d.stickerFolders || []; d.stickerFolders.push({ id, name }); });
        ui.stkFolder = id;
        if (after) after(id);
        rerender(ctx === 'modal' ? 'modal' : '');
      });
    },
    'stk-name-ok': () => {
      const name = (App.$('#stkName').value || '').trim();
      if (!name) { App.$('#stkName').focus(); return; }
      const fn = pendingName; pendingName = null;
      App.closeModal({ noRender: true });
      if (fn) fn(name);
    },
    'stk-folder-rename': () => {
      const f = folders().find((x) => x.id === ui.stkFolder);
      if (!f) return;
      nameModal(t('stk.rename'), f.name, (name) => App.update((d) => { const x = (d.stickerFolders || []).find((y) => y.id === f.id); if (x) x.name = name; }));
    },
    'stk-folder-del': async () => {
      const f = folders().find((x) => x.id === ui.stkFolder);
      if (!f || !(await App.confirmBox(t('stk.delFolderConfirm', { f: f.name }), t('stk.delFolder')))) return;
      App.update((d) => {
        d.stickerFolders = (d.stickerFolders || []).filter((x) => x.id !== f.id);
        (d.stickers || []).forEach((s) => { if (s.folder === f.id) s.folder = ''; });
      });
      ui.stkFolder = 'all';
      App.renderMain();
    },
    'stk-select-toggle': () => { ui.stkSelect = !ui.stkSelect; ui.stkSel.clear(); App.renderMain(); },
    'stk-sel-all': () => { App.stickersInView().forEach((s) => ui.stkSel.add(s.id)); App.renderMain(); },
    'stk-sel-del': async () => {
      const ids = [...ui.stkSel];
      if (!ids.length || !(await App.confirmBox(t('stk.delManyConfirm', { n: ids.length }), t('c.delete')))) return;
      const gone = all().filter((s) => ids.includes(s.id)).map((s) => s.assetId);
      App.update((d) => {
        d.stickers = (d.stickers || []).filter((s) => !ids.includes(s.id));
        d.homeStickers = (d.homeStickers || []).filter((h) => !gone.includes(h.assetId));
      });
      const used = (a) => App.D.diary.some((e) => (e.items || []).some((i) => i.assetId === a));
      gone.forEach((a) => { if (!used(a)) Assets.del(a); });
      ui.stkSel.clear();
      App.renderMain();
    }
  });
  App.K['stk-name-ok'] = () => App.A['stk-name-ok']();
  App.C['stk-move'] = (el) => {
    const v = el.value;
    const ids = [...ui.stkSel];
    if (v === '__' || !ids.length) return;
    if (v === '__new') {
      nameModal(t('stk.newFolder'), '', (name) => {
        const id = uid();
        App.silent((d) => { d.stickerFolders = d.stickerFolders || []; d.stickerFolders.push({ id, name }); });
        moveTo(ids, id); ui.stkSel.clear(); ui.stkFolder = id; App.renderMain();
      });
      el.value = '__';
      return;
    }
    moveTo(ids, v); ui.stkSel.clear(); App.renderMain();
  };

  // 여러 개 고르기 모드에서는 스티커를 누르면 골라지기만 해요
  document.addEventListener('click', (ev) => {
    if (!ui.stkSelect || App.ui.view !== 'custom') return;
    const cell = ev.target.closest && ev.target.closest('.hs-card [data-stk-drag]');
    if (!cell || ev.target.closest('.hs-lib-x')) return;
    ev.stopPropagation(); ev.preventDefault();
    const id = cell.dataset.stkDrag;
    if (ui.stkSel.has(id)) ui.stkSel.delete(id); else ui.stkSel.add(id);
    App.renderMain();
  }, true);

  /* ---------- 스티커를 폴더로 끌어 넣기 ---------- */
  // 브라우저 기본 '이미지 끌기'가 끼어들지 않게
  document.addEventListener('dragstart', (ev) => { if (ev.target.closest && ev.target.closest('[data-stk-drag]')) ev.preventDefault(); }, true);
  let drag = null, swallow = false;
  document.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    const cell = ev.target.closest && ev.target.closest('[data-stk-drag]');
    if (!cell || ev.target.closest('.sticker-x, .hs-lib-x')) return;
    if (!folders().length && !document.querySelector('[data-stk-folder]')) return;
    drag = { id: cell.dataset.stkDrag, cell, sx: ev.clientX, sy: ev.clientY, ghost: null, over: null };
  });
  document.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) < 8) return;
      const ids = ui.stkSelect && ui.stkSel.has(drag.id) ? [...ui.stkSel] : [drag.id];
      drag.ids = ids;
      const img = drag.cell.querySelector('img');
      const g = document.createElement('div');
      g.className = 'stk-ghost';
      g.innerHTML = `${img ? `<img src="${img.src}" alt="">` : ''}${ids.length > 1 ? `<b>${ids.length}</b>` : ''}`;
      document.body.appendChild(g);
      drag.ghost = g;
      document.body.classList.add('stk-dragging');
    }
    ev.preventDefault();
    drag.ghost.style.transform = `translate(${ev.clientX - 28}px, ${ev.clientY - 28}px)`;
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const f = hit && hit.closest && hit.closest('[data-stk-folder]');
    if (drag.over && drag.over !== f) drag.over.classList.remove('drop');
    if (f) f.classList.add('drop');
    drag.over = f;
  }, { passive: false });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.ghost) return;
    d.ghost.remove();
    document.body.classList.remove('stk-dragging');
    swallow = true; setTimeout(() => { swallow = false; }, 0);
    if (!d.over) return;
    d.over.classList.remove('drop');
    moveTo(d.ids, d.over.dataset.stkFolder);
    if (ui.stkSelect) ui.stkSel.clear();
    if (App.$('#modalLayer') && !App.$('#modalLayer').hidden && App.A['hs-pick']) App.A['hs-pick']();
    else App.renderMain();
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  document.addEventListener('click', (ev) => { if (swallow) { ev.stopPropagation(); ev.preventDefault(); } }, true);
})(window.App);
