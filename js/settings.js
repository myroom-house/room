// 설정 + 앱 시작
(function (App) {
  const { t } = App;

  App.VIEWS.settings = function () {
    const s = App.D.settings;
    return `
    <section class="view narrow">
      <header class="view-head"><h2 class="view-title">${t('nav.settings')}</h2></header>
      <div class="stack">
        ${App.accountCard ? App.accountCard() : ''}
        <div class="card">
          <h3>${t('set.modules')}</h3>
          <p class="hint" style="margin:0 0 10px">${t('set.modulesHelp')}</p>
          <div class="mod-grid">${App.MODULES.map((m) => `<label class="switch"><input type="checkbox" data-change="mod-toggle" data-m="${m}" ${App.on(m) ? 'checked' : ''}><span class="sw-track"></span>${App.svg(m)}${t('nav.' + m)}</label>`).join('')}</div>
        </div>
        <div class="card set-row"><h3>${t('set.weekStart')}</h3>
          <div class="seg"><button data-act="week-set" data-v="0" aria-pressed="${s.weekStart === 0}">${t('set.sun')}</button><button data-act="week-set" data-v="1" aria-pressed="${s.weekStart === 1}">${t('set.mon')}</button></div></div>
        <div class="card">
          <div class="set-row"><h3>${t('set.backup')}</h3>
            <div class="row gap-xs"><button class="btn" data-act="export">${t('set.export')}</button><button class="btn" data-act="import">${t('set.import')}</button></div></div>
          <p class="hint">${t('set.backupHelp')}</p>
        </div>
        ${Store.desktop ? `<div class="card set-row"><h3>${t('set.folder')}</h3><button class="btn" data-act="open-folder">${t('set.openFolder')}</button></div>` : ''}
        <div class="card set-row"><h3>${t('set.reset')}</h3><button class="btn danger" data-act="reset">${t('set.reset')}</button></div>
        <p class="muted small">MyRoom v0.6.1</p>
      </div>
    </section>`;
  };

  App.C['mod-toggle'] = (el) => App.update((d) => { d.settings.modules = d.settings.modules || {}; d.settings.modules[el.dataset.m] = el.checked; });

  Object.assign(App.A, {
    'week-set': (el) => App.update((d) => { d.settings.weekStart = Number(el.dataset.v); }),
    export: async () => { try { if (await Store.exportData()) App.toast(t('set.exported')); } catch (e) { App.toast(t('set.exportFail')); } },
    import: async () => {
      try {
        if (await Store.importData()) { await App.registerFonts(); App.toast(t('set.imported')); }
        else App.toast(t('set.importFail'));
      } catch (e) { App.toast(t('set.importFail')); }
    },
    'open-folder': () => window.myroom && window.myroom.openFolder(),
    reset: async () => { if (await App.confirmBox(t('set.resetConfirm'), t('set.reset'))) { Store.reset(); App.toast(t('set.resetDone')); } }
  });

  /* ---------- 시작 ---------- */
  function countVisit() {
    App.silent((d) => {
      const td = App.todayStr();
      if (d.visits.lastDate !== td) { d.visits.today = 0; d.visits.lastDate = td; }
      d.visits.today += 1;
      d.visits.total += 1;
    });
  }

  async function init() {
    App.D = await Store.load();
    countVisit();
    App.applyTheme();
    App.renderAll();
    App.registerFonts().then(() => App.applyTheme());
    Store.subscribe(() => { App.D = Store.get(); App.applyTheme(); App.renderAll(); App.paintFocus && App.paintFocus(); App.paintPlayer && App.paintPlayer(); });
    (App.onReady || []).forEach((f) => f());
    if (window.myroom && window.myroom.onQuickMemo) window.myroom.onQuickMemo(() => App.A['quick-memo']());

    // 웹으로 열었을 때: 오프라인에서도 열리게
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !(window.myroom && window.myroom.isDesktop)) navigator.serviceWorker.register('sw.js').catch(() => {});

    let day = App.todayStr();
    setInterval(() => { if (App.todayStr() !== day) { day = App.todayStr(); countVisit(); App.renderAll(); } }, 60 * 1000);
  }
  init();
})(window.App);
