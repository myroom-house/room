// 홈 스티커 — 꾸미기에서 PNG·GIF 스티커를 올리고, 홈에 붙여서 끌어 옮기기·크기·회전
(function (App) {
  const { t, esc, svg, uid } = App;
  const ui = App.ui;
  ui.homeDeco = false;

  const list = () => (App.D.homeStickers = App.D.homeStickers || []);
  const lib = () => (App.D.stickers = App.D.stickers || []);

  // PNG·GIF만 받아서 스티커 보관함에 넣기 (다이어리와 같은 보관함)
  App.uploadStickers = async function () {
    const picked = await App.pickFiles('image/png,image/gif', true);
    const files = picked.filter((f) => f.type === 'image/png' || f.type === 'image/gif' || /\.(png|gif)$/i.test(f.name));
    if (picked.length > files.length) App.toast(t('dk.stickerOnly'));
    const added = [];
    for (const f of files) {
      const blob = f.type === 'image/gif' ? f : await Assets.shrinkImage(f, 800, true);
      const id = 's_' + uid();
      await Assets.put(id, blob);
      const s = { id: uid(), assetId: id, name: f.name, folder: App.stickerUploadFolder ? App.stickerUploadFolder() : '' };
      App.silent((d) => { d.stickers = d.stickers || []; d.stickers.push(s); });
      added.push(s);
    }
    return added;
  };

  function addToHome(assetId) {
    const n = list().length;
    App.update((d) => {
      d.homeStickers = d.homeStickers || [];
      d.homeStickers.push({ id: uid(), assetId, x: 55 + ((n * 7) % 30), y: 40 + ((n * 37) % 160), w: 110, r: Math.round(Math.random() * 16 - 8) });
    });
  }

  /* ---------- 홈 화면에 그리기 ---------- */
  App.homeStickerLayer = function () {
    const items = list();
    const edit = ui.homeDeco;
    if (!items.length && !edit) return '';
    return `<div class="home-stickers ${edit ? 'editing' : ''}" id="homeStk">${items.map((s) => `
        <div class="hs" data-id="${s.id}" style="left:${s.x}%;top:${s.y}px;width:${s.w}px;transform:translate(-50%,-50%) rotate(${s.r || 0}deg)">
          <img data-asset="${esc(s.assetId)}" alt="" draggable="false">
          ${edit ? `<button type="button" class="hs-x" data-act="hs-del" data-id="${s.id}" aria-label="${t('c.delete')}">×</button><span class="hs-rot" title="${t('hs.rotate')}"></span><span class="hs-size" title="${t('hs.resize')}"></span>` : ''}
        </div>`).join('')}</div>`;
  };
  App.homeStickerBar = function () {
    if (!ui.homeDeco) return '';
    return `<div class="hs-bar">
        <span>${svg('image')}<b>${t('hs.editing')}</b><span class="muted small">${t('hs.editHint')}</span></span>
        <span class="row gap-xs"><button class="btn small" data-act="hs-pick">${svg('plus')}${t('hs.add')}</button><button class="btn small primary" data-act="hs-done">${t('hs.done')}</button></span>
      </div>`;
  };

  /* ---------- 끌어서 옮기기 · 크기 · 회전 ---------- */
  let drag = null;
  document.addEventListener('pointerdown', (ev) => {
    if (!ui.homeDeco || App.ui.view !== 'home') return;
    const el = ev.target.closest && ev.target.closest('.home-stickers.editing .hs');
    if (!el || ev.target.closest('.hs-x')) return;
    const s = list().find((x) => x.id === el.dataset.id);
    const box = App.$('#homeStk');
    if (!s || !box) return;
    ev.preventDefault();
    const rect = box.getBoundingClientRect();
    const mode = ev.target.classList.contains('hs-size') ? 'size' : ev.target.classList.contains('hs-rot') ? 'rot' : 'move';
    const er = el.getBoundingClientRect();
    drag = { s, el, mode, rect, sx: ev.clientX, sy: ev.clientY, ox: s.x, oy: s.y, ow: s.w, cx: er.left + er.width / 2, cy: er.top + er.height / 2 };
    el.classList.add('on');
    try { el.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
  });
  document.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const { s, el, rect } = drag;
    if (drag.mode === 'move') {
      s.x = Math.max(0, Math.min(100, drag.ox + ((ev.clientX - drag.sx) / rect.width) * 100));
      s.y = Math.max(0, drag.oy + (ev.clientY - drag.sy));
      el.style.left = s.x + '%'; el.style.top = s.y + 'px';
    } else if (drag.mode === 'size') {
      const d0 = Math.hypot(drag.sx - drag.cx, drag.sy - drag.cy) || 1;
      const d1 = Math.hypot(ev.clientX - drag.cx, ev.clientY - drag.cy);
      s.w = Math.round(Math.max(36, Math.min(600, drag.ow * (d1 / d0))));
      el.style.width = s.w + 'px';
    } else {
      s.r = Math.round((Math.atan2(ev.clientY - drag.cy, ev.clientX - drag.cx) * 180) / Math.PI + 90);
      if (Math.abs(s.r % 90) < 4) s.r = Math.round(s.r / 90) * 90; // 똑바로 근처면 딱 맞추기
    }
    el.style.transform = `translate(-50%,-50%) rotate(${s.r || 0}deg)`;
  });
  const end = () => {
    if (!drag) return;
    drag.el.classList.remove('on');
    drag = null;
    App.silent(() => {});
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);

  /* ---------- 스티커 고르기 창 ---------- */
  function pickModal() {
    App.openModal(`
      <h3 class="modal-title">${t('hs.pickTitle')}</h3>
      <button class="btn primary block" data-act="hs-upload">${svg('upload')}${t('hs.upload')}</button>
      ${lib().length ? App.stickerFolderBar('modal') : ''}
      ${App.stickersInView().length ? `<div class="hs-lib">${App.stickersInView().map((s) => `<button type="button" data-act="hs-put" data-asset="${esc(s.assetId)}" data-stk-drag="${s.id}" title="${esc(s.name || '')}"><img data-asset="${esc(s.assetId)}" alt=""></button>`).join('')}</div>` : `<p class="hint">${lib().length ? t('stk.emptyFolder') : t('hs.libEmpty')}</p>`}
      <p class="hint" style="margin:8px 0 0">${t('hs.pickHint')}</p>
      <div class="modal-actions"><span></span><button class="btn" data-act="modal-close">${t('c.close')}</button></div>`, null, 'small');
    App.hydrateAssets(App.$('#modalLayer'));
  }

  Object.assign(App.A, {
    'hs-start': () => { ui.homeDeco = true; App.go('home'); },
    'hs-done': () => { ui.homeDeco = false; App.renderMain(); App.toast(t('c.saved')); },
    'hs-pick': pickModal,
    'hs-upload': async () => {
      const added = await App.uploadStickers();
      if (!added.length) return;
      if (App.ui.view === 'home' && ui.homeDeco) { App.closeModal({ noRender: true }); added.forEach((s) => addToHome(s.assetId)); App.toast(t('hs.added', { n: added.length })); }
      else { App.renderMain(); App.toast(t('dk.stickersAdded', { n: added.length })); }
    },
    'hs-put': (el) => {
      if (App.ui.view === 'home') { App.closeModal({ noRender: true }); addToHome(el.dataset.asset); }
      else { addToHome(el.dataset.asset); App.toast(t('hs.addedHome')); }
    },
    'hs-del': (el) => App.update((d) => { d.homeStickers = (d.homeStickers || []).filter((x) => x.id !== el.dataset.id); }),
    'hs-clear': async () => {
      if (!list().length) return;
      if (await App.confirmBox(t('hs.clearConfirm'), t('hs.clear'))) App.update((d) => { d.homeStickers = []; });
    },
    'hs-lib-del': async (el) => {
      if (!(await App.confirmBox(t('hs.libDelConfirm'), t('c.delete')))) return;
      const id = el.dataset.asset;
      App.update((d) => { d.stickers = (d.stickers || []).filter((x) => x.assetId !== id); d.homeStickers = (d.homeStickers || []).filter((x) => x.assetId !== id); });
    }
  });

  /* ---------- 꾸미기 화면 카드 ---------- */
  App.homeStickerCard = function () {
    return `<div class="card wide hs-card">
      <div class="card-head"><h3>${t('hs.title')}</h3>
        <div class="row gap-xs wrap">
          <button class="btn small" data-act="hs-upload">${svg('upload')}${t('hs.upload')}</button>
          <button class="btn small primary" data-act="hs-start">${t('hs.start')}</button>
        </div></div>
      <p class="hint" style="margin:0 0 10px">${t('hs.cardHint', { n: list().length })}</p>
      ${App.stickerFolderBar('manage')}
      ${App.stickersInView().length ? `<div class="hs-lib">${App.stickersInView().map((s) => `<div class="hs-lib-item ${App.ui.stkSel.has(s.id) ? 'sel' : ''}" data-stk-drag="${s.id}"><button type="button" data-act="hs-put" data-asset="${esc(s.assetId)}" title="${t('hs.putHome')}"><img data-asset="${esc(s.assetId)}" alt=""></button>${App.ui.stkSelect ? `<span class="hs-check">${App.ui.stkSel.has(s.id) ? '✓' : ''}</span>` : `<button type="button" class="hs-lib-x" data-act="hs-lib-del" data-asset="${esc(s.assetId)}" aria-label="${t('c.delete')}">×</button>`}</div>`).join('')}</div>` : `<p class="muted small" style="margin:0">${lib().length ? t('stk.emptyFolder') : t('hs.libEmpty')}</p>`}
      ${list().length ? `<button class="link-btn" style="margin-top:8px" data-act="hs-clear">${t('hs.clear')}</button>` : ''}
    </div>`;
  };
})(window.App);
