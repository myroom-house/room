// 꾸미기 — 테마, 글꼴, 프로필, 위젯 HTML, 사용자 CSS
(function (App) {
  const { t, esc, svg, uid } = App;

  const VARS = ['--bg', '--paper', '--paper-2', '--ink', '--ink-soft', '--line', '--accent', '--accent-ink', '--accent-soft', '--radius', '--font', '--font-app', '--side-w'];
  const CLASSES = ['.room', '.side', '.profile', '.avatar', '.nav', '.topbar', '.main', '.card', '.hello-line', '.btn', '.input', '.cal-grid', '.dk-page', '.ex-card', '.dday-card', '.memo-item', '.bm-item', '.focus-main'];

  App.VIEWS.custom = function () {
    const D = App.D, p = D.profile, s = D.settings;
    const img = App.safeImg(p.avatar);
    const userFonts = D.fonts || [];
    return `
    <section class="view">
      <header class="view-head"><h2 class="view-title">${t('nav.custom')}</h2></header>
      <div class="cu-grid">
        <div class="card wide">
          <h3>${t('cu.theme')}</h3>
          <div class="themes">${Object.entries(App.THEMES).map(([k, c]) => `
            <button type="button" class="theme-card" data-act="theme-set" data-v="${k}" aria-pressed="${s.theme === k}">
              <span class="sw" style="background:${c.bg}"><i style="background:${c.paper}"></i><b style="background:${c.accent}"></b><em style="background:${c.ink}"></em></span>
              <span class="nm">${t('theme.' + k)}</span></button>`).join('')}
          </div>
        </div>

        ${App.homeStickerCard ? App.homeStickerCard() : ''}

        <div class="card wide">
          <div class="card-head"><h3>${t('cu.fonts')}</h3>
            <div class="row gap-xs wrap">
              <button class="btn small" data-act="font-add-file">${svg('upload')}${t('cu.fontFile')}</button>
              <button class="btn small" data-act="font-add-css">${t('cu.fontCss')}</button>
              <button class="btn small" data-act="font-add-local">${t('cu.fontLocal')}</button>
            </div>
          </div>
          <p class="hint">${t('cu.fontHelp')}</p>
          <div class="form-grid">
            <label class="field grow"><span class="label">${t('cu.appFont')}</span><select class="input select" data-change="set-font" data-k="appFont">${App.fontOptions(s.appFont)}</select></label>
          </div>
          <ul class="font-list">${App.allFonts().filter((f) => f.id).map((f) => `
            <li><span class="font-name">${esc(f.name)}${f.user ? '' : ` <span class="muted small">${t('cu.builtin')}</span>`}</span>
              <span class="font-sample" style="font-family:${f.family}, var(--font)">${t('cu.fontSample')}</span>
              ${f.user ? `<button class="icon-btn" data-act="font-del" data-id="${f.id}" title="${t('c.delete')}">${svg('trash')}</button>` : '<span class="icon-btn" aria-hidden="true"></span>'}</li>`).join('')}
          </ul>
          ${userFonts.length ? '' : `<p class="hint">${t('cu.fontEmpty')}</p>`}
        </div>

        <div class="card">
          <h3>${t('cu.profile')}</h3>
          <div class="avatar-edit">
            <div class="avatar big">${img ? `<img src="${esc(img)}" alt="">` : esc(p.emoji || '🌱')}</div>
            <div class="stack grow">
              <input class="input" data-change="avatar-url" value="${img.startsWith('data:') ? '' : esc(img)}" placeholder="${esc(t('cu.avatarUrl'))}">
              <div class="row gap-xs"><button class="btn small" data-act="avatar-upload">${t('cu.upload')}</button>${img ? `<button class="btn small ghost" data-act="avatar-remove">${t('cu.removeAvatar')}</button>` : ''}</div>
            </div>
          </div>
          <div class="form-grid">
            <label class="field"><span class="label">${t('cu.emoji')}</span><input class="input" style="width:80px" maxlength="8" data-input="profile-emoji" value="${esc(p.emoji)}"></label>
            <label class="field grow"><span class="label">${t('cu.name')}</span><input class="input" data-input="profile-name" value="${esc(p.name)}"></label>
          </div>
          <label class="field"><span class="label">${t('cu.status')}</span><input class="input" data-input="profile-status" value="${esc(p.status)}"></label>
          <span class="label">${t('cu.links')}</span>
          <div class="stack-s">${(p.links || []).map((l, i) => `
            <div class="row gap-xs"><input class="input" style="flex:0 0 110px" data-input="link-label" data-i="${i}" value="${esc(l.label)}" placeholder="${esc(t('cu.linkLabel'))}"><input class="input grow" data-input="link-url" data-i="${i}" value="${esc(l.url)}" placeholder="https://"><button class="icon-btn" data-act="link-del" data-i="${i}" aria-label="${t('c.delete')}">${svg('x')}</button></div>`).join('')}
          </div>
          <button class="btn small" data-act="link-add">${svg('plus')}${t('c.add')}</button>
        </div>

        <div class="card">
          <h3>${t('cu.htmlMoved')}</h3>
          <p class="hint" style="margin:0">${t('cu.htmlMovedHint')}</p>
          ${App.on('social') ? `<button class="btn small" data-act="so-go-edit">${t('cu.htmlGo')}</button>` : ''}
        </div>
      </div>
    </section>`;
  };
  App.after.custom = () => { App.hydrateAssets(App.$('#main')); };

  function parseFamily(css) {
    let m = css.match(/font-family\s*:\s*['"]?([^;'"}]+)/i);
    if (m) return m[1].trim();
    m = css.match(/family=([^:&;'")]+)/);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    return '';
  }
  function normalizeCss(code) {
    code = code.trim();
    const link = code.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (link) return `@import url('${link[1]}');`;
    if (/^https?:\/\//.test(code)) return `@import url('${code}');`;
    return code.replace(/<\/?style[^>]*>/gi, '');
  }

  Object.assign(App.A, {
    'theme-set': (el) => App.update((d) => { d.settings.theme = el.dataset.v; }),
    'font-add-file': async () => {
      const files = await App.pickFiles('.ttf,.otf,.woff,.woff2,font/*', true);
      for (const f of files) {
        const id = uid();
        const assetId = 'f_' + id;
        await Assets.put(assetId, f);
        App.silent((d) => d.fonts.push({ id, name: f.name.replace(/\.[^.]+$/, ''), family: 'mf-' + id, kind: 'file', assetId }));
      }
      if (files.length) { await App.registerFonts(); App.renderMain(); App.toast(t('cu.fontAdded')); }
    },
    'font-add-css': () => {
      App.openModal(`<h3 class="modal-title">${t('cu.fontCss')}</h3>
        <p class="hint">${t('cu.fontCssHelp')}</p>
        <textarea class="input code" id="fontCss" rows="7" spellcheck="false" placeholder="@font-face { font-family: 'MyFont'; src: url('https://…/MyFont.woff2') format('woff2'); }" autofocus></textarea>
        <input class="input" id="fontCssName" placeholder="${esc(t('cu.fontDisplayName'))}">
        <div class="modal-actions"><span></span><div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn primary" data-act="font-save-css">${t('c.add')}</button></div></div>`);
    },
    'font-save-css': async () => {
      const css = normalizeCss(App.$('#fontCss').value);
      const family = parseFamily(css);
      if (!css || !family) { App.toast(t('cu.fontNoFamily')); return; }
      const name = App.$('#fontCssName').value.trim() || family;
      App.silent((d) => d.fonts.push({ id: uid(), name, family, kind: 'css', css }));
      App.closeModal({ noRender: true });
      await App.registerFonts();
      App.renderAll();
      App.toast(t('cu.fontAdded'));
    },
    'font-add-local': () => {
      App.openModal(`<h3 class="modal-title">${t('cu.fontLocal')}</h3>
        <p class="hint">${t('cu.fontLocalHelp')}</p>
        <input class="input" id="fontLocal" placeholder="${esc(t('cu.fontLocalPh'))}" data-enter="font-save-local" autofocus>
        <div class="modal-actions"><span></span><div class="row"><button class="btn" data-act="modal-close">${t('c.cancel')}</button><button class="btn primary" data-act="font-save-local">${t('c.add')}</button></div></div>`, null, 'small');
    },
    'font-save-local': () => {
      const family = App.$('#fontLocal').value.trim().replace(/['";{}]/g, '');
      if (!family) return;
      App.silent((d) => d.fonts.push({ id: uid(), name: family, family, kind: 'local' }));
      App.closeModal();
      App.toast(t('cu.fontAdded'));
    },
    'font-del': async (el) => {
      const f = App.D.fonts.find((x) => x.id === el.dataset.id);
      if (!f || !(await App.confirmBox(t('c.confirmDelete')))) return;
      App.update((d) => {
        d.fonts = d.fonts.filter((x) => x.id !== f.id);
        if (d.settings.appFont === f.id) d.settings.appFont = '';
        if (d.settings.excerptFont === f.id) d.settings.excerptFont = '';
      });
      if (f.assetId) Assets.del(f.assetId);
      const st = document.querySelector(`style[data-font="${f.id}"]`); if (st) st.remove();
    },
    'avatar-upload': async () => {
      const [f] = await App.pickFiles('image/*');
      if (!f) return;
      const blob = await Assets.shrinkImage(f, 360, f.type === 'image/png');
      const r = new FileReader();
      r.onload = () => App.update((d) => { d.profile.avatar = r.result; });
      r.readAsDataURL(blob);
    },
    'avatar-remove': () => App.update((d) => { d.profile.avatar = ''; }),
    'link-add': () => App.update((d) => { d.profile.links = d.profile.links || []; d.profile.links.push({ label: '', url: '' }); }),
    'link-del': (el) => App.update((d) => { d.profile.links.splice(Number(el.dataset.i), 1); }),
    'css-clear': () => App.update((d) => { d.settings.customCSS = ''; })
  });
  App.K['font-save-local'] = () => App.A['font-save-local']();

  Object.assign(App.I, {
    'profile-name': (el) => { App.silent((d) => { d.profile.name = el.value; }); App.renderTitle(); App.renderProfile(); },
    'profile-status': (el) => { App.silent((d) => { d.profile.status = el.value; }); App.renderProfile(); },
    'profile-emoji': (el) => { App.silent((d) => { d.profile.emoji = el.value; }); App.renderProfile(); },
    'link-label': (el) => { App.silent((d) => { d.profile.links[Number(el.dataset.i)].label = el.value; }); App.renderProfile(); },
    'link-url': (el) => { App.silent((d) => { d.profile.links[Number(el.dataset.i)].url = el.value.trim(); }); App.renderProfile(); },
    'custom-css': (el) => { App.silent((d) => { d.settings.customCSS = el.value; }); App.$('#custom-css').textContent = el.value; },
    'custom-html': () => {}
  });
  Object.assign(App.C, {
    'set-font': (el) => App.update((d) => { d.settings[el.dataset.k] = el.value; }),
    'avatar-url': (el) => { const v = el.value.trim(); if (v && !App.safeImg(v)) return; App.update((d) => { d.profile.avatar = v; }); },
    'widget-toggle': (el) => App.silent((d) => { d.settings.useCustomHTML = el.checked; })
  });
})(window.App);
