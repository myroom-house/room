// 디데이
(function (App) {
  const { t, esc, svg, uid, todayStr, addDays, daysBetween, fmt } = App;
  const ui = App.ui;
  ui.ddayColor = App.EVENT_COLORS[0];
  const DD_PALETTE = ['#5b7cfa', '#2fa4de', '#e46b92', '#f28b82', '#2a9d7f', '#8bc34a', '#e89a1c', '#fbbc04', '#9467d8', '#7d8594'];
  const SIZES = [['s', 'dday.sizeS'], ['m', 'dday.sizeM'], ['l', 'dday.sizeL'], ['fit', 'dday.sizeFit']];
  const colorPicker = (act, id, cur, inputAct) => `<div class="colors">${DD_PALETTE.map((c) => `<button type="button" class="color-dot" style="background:${c}" data-act="${act}" ${id ? `data-id="${id}"` : ''} data-c="${c}" aria-pressed="${cur === c}" aria-label="${c}"></button>`).join('')}
    <label class="color-pick ${DD_PALETTE.includes(cur) ? '' : 'on'}" title="${t('cc.pickColor')}"><input type="color" value="${App.safeColor(cur)}" data-change="${inputAct}" ${id ? `data-id="${id}"` : ''}><span>${t('cc.custom')}</span></label></div>`;

  // 이번에 다가오는(또는 지난) 날짜와 표시 문구
  App.ddayInfo = function (x) {
    const td = todayStr();
    let target = x.date;
    if (x.yearly) {
      const y = new Date().getFullYear();
      const md = x.date.slice(5);
      target = `${y}-${md}`;
      if (target < td) target = `${y + 1}-${md}`;
    }
    const diff = daysBetween(td, target);
    let label, sub = '';
    if (x.countFirst && diff <= 0) {
      const n = -diff + 1;
      label = t('dday.days', { n });
      const next = Math.ceil((n + 1) / 100) * 100;
      sub = t('dday.next', { n: next, date: fmt(addDays(x.date, next - 1), { year: 'numeric', month: 'short', day: 'numeric' }) });
    } else if (diff > 0) label = 'D-' + diff;
    else if (diff === 0) label = 'D-DAY';
    else label = 'D+' + (-diff);
    return { target, diff, label, sub };
  };

  App.sortedDdays = () => [...App.D.ddays].map((x) => ({ x, info: App.ddayInfo(x) }))
    .sort((a, b) => {
      const fa = a.info.diff >= 0 && !a.x.countFirst, fb = b.info.diff >= 0 && !b.x.countFirst;
      if (fa !== fb) return fa ? -1 : 1;
      return Math.abs(a.info.diff) - Math.abs(b.info.diff);
    });

  App.VIEWS.dday = function () {
    const list = App.sortedDdays();
    return `
    <section class="view">
      <header class="view-head"><h2 class="view-title">${t('nav.dday')}</h2></header>
      <div class="card">
        <div class="form-grid">
          <label class="field grow"><span class="label">${t('dday.title')}</span><input class="input" id="ddTitle" data-enter="dday-add" placeholder="${esc(t('dday.titlePh'))}"></label>
          <label class="field"><span class="label">${t('c.date')}</span><input class="input date-input" type="date" id="ddDate" value="${todayStr()}"></label>
        </div>
        <div class="row wrap gap-m" style="margin-top:12px">
          <label class="toggle"><input type="checkbox" class="check" id="ddYearly">${t('dday.yearly')}</label>
          <label class="toggle"><input type="checkbox" class="check" id="ddFirst">${t('dday.countFirst')}</label>
          <label class="toggle"><input type="checkbox" class="check" id="ddPin" checked>${t('dday.pin')}</label>
          ${App.on('calendar') ? `<label class="toggle"><input type="checkbox" class="check" id="ddCal" checked>${t('dday.cal')}</label>` : ''}
          <button type="button" class="btn small" data-act="dday-form-img">${svg('image')}${ui.ddImg ? t('dday.imgPicked') : t('dday.imgAdd')}</button>
        </div>
        <div class="row wrap gap-m" style="margin-top:12px">
          <span class="label" style="margin:0">${t('c.color')}</span>
          <span class="cat-swatch" style="background:${App.safeColor(ui.ddayColor)}"></span>
          ${colorPicker('dday-color', '', ui.ddayColor, 'dday-color-input')}
          <button class="btn primary push-right" data-act="dday-add">${t('c.add')}</button>
        </div>
        <p class="hint">${t('dday.hint')}</p>
      </div>
      ${list.length ? `<div class="dday-grid">${list.map(({ x, info }) => `
        <article class="dday-card ${x.img ? 'has-img' : ''}" style="--c:${App.safeColor(x.color)}">
          ${x.img ? `<div class="dday-img"><img data-asset="${esc(x.img)}" alt=""></div>` : ''}
          <div class="dday-body">
            <div class="dday-num">${esc(info.label)}</div>
            <div class="dday-title">${esc(x.title)}</div>
            <div class="muted small">${fmt(x.countFirst ? x.date : info.target, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}${x.yearly ? ' · ' + t('dday.yearlyShort') : ''}</div>
            ${info.sub ? `<div class="muted small">${esc(info.sub)}</div>` : ''}
            <div class="dday-opts">
              <label class="switch small"><input type="checkbox" data-change="dday-pin" data-id="${x.id}" ${x.pinned ? 'checked' : ''}><span class="sw-track"></span>${t('dday.pin')}</label>
              ${App.on('calendar') ? `<label class="switch small"><input type="checkbox" data-change="dday-cal" data-id="${x.id}" ${x.cal !== false ? 'checked' : ''}><span class="sw-track"></span>${t('dday.cal')}</label>` : ''}
              ${x.pinned ? `<label class="dd-size"><span>${t('dday.homeSize')}</span><select class="input small" data-change="dday-size" data-id="${x.id}">${SIZES.filter(([k]) => k !== 'fit' || x.img).map(([k, l]) => `<option value="${k}" ${(x.size || 'm') === k ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></label>` : ''}
            </div>
            <div class="dday-foot">
              ${ui.ddEditColor === x.id ? colorPicker('dday-recolor', x.id, x.color, 'dday-recolor-input') : `<button class="btn small ghost" data-act="dday-color-edit" data-id="${x.id}"><span class="cat-swatch" style="background:${App.safeColor(x.color)}"></span>${t('c.color')}</button>`}
              <div class="row gap-xs">
                <button class="icon-btn" data-act="dday-img" data-id="${x.id}" title="${x.img ? t('dday.imgChange') : t('dday.imgAdd')}">${svg('image')}</button>
                ${x.img ? `<button class="icon-btn" data-act="dday-img-del" data-id="${x.id}" title="${t('dday.imgDel')}">${svg('x')}</button>` : ''}
                <button class="icon-btn" data-act="dday-del" data-id="${x.id}" title="${t('c.delete')}">${svg('trash')}</button>
              </div>
            </div>
          </div>
        </article>`).join('')}</div>` : `<p class="empty center">${t('dday.empty')}</p>`}
    </section>`;
  };

  function addDday() {
    const title = App.$('#ddTitle').value.trim();
    const date = App.$('#ddDate').value;
    if (!title || !date) { App.$('#ddTitle').focus(); return; }
    App.update((d) => d.ddays.push({
      id: uid(), title, date,
      yearly: App.$('#ddYearly').checked,
      countFirst: App.$('#ddFirst').checked,
      pinned: App.$('#ddPin').checked,
      cal: App.$('#ddCal') ? App.$('#ddCal').checked : true,
      size: 'm',
      color: ui.ddayColor,
      img: ui.ddImg || ''
    }));
    ui.ddImg = '';
    App.toast(t('c.added'));
  }

  Object.assign(App.A, {
    'dday-add': addDday,
    'dday-color': (el) => { ui.ddayColor = el.dataset.c; rerenderKeep(); },
    'dday-color-edit': (el) => { ui.ddEditColor = el.dataset.id; App.renderMain(); },
    'dday-recolor': (el) => { ui.ddEditColor = null; App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x) x.color = el.dataset.c; }); },
    'dday-form-img': async () => {
      const [f] = await App.pickFiles('image/*');
      if (!f) return;
      const blob = await Assets.shrinkImage(f, 900, false);
      ui.ddImg = 'd_' + uid();
      await Assets.put(ui.ddImg, blob);
      rerenderKeep();
    },
    'dday-img': async (el) => {
      const [f] = await App.pickFiles('image/*');
      if (!f) return;
      const blob = await Assets.shrinkImage(f, 900, false);
      const id = 'd_' + uid();
      await Assets.put(id, blob);
      App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x) { if (x.img) Assets.del(x.img); x.img = id; } });
    },
    'dday-img-del': (el) => App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x && x.img) { Assets.del(x.img); x.img = ''; } }),
    'dday-del': async (el) => {
      if (await App.confirmBox(t('c.confirmDelete'))) App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x && x.img) Assets.del(x.img); d.ddays = d.ddays.filter((y) => y.id !== el.dataset.id); });
    }
  });
  App.K['dday-add'] = addDday;
  function rerenderKeep() {
    const keep = { t: App.$('#ddTitle').value, d: App.$('#ddDate').value, y: App.$('#ddYearly').checked, f: App.$('#ddFirst').checked, p: App.$('#ddPin').checked, c: App.$('#ddCal') ? App.$('#ddCal').checked : true };
    App.renderMain();
    App.$('#ddTitle').value = keep.t; App.$('#ddDate').value = keep.d; App.$('#ddYearly').checked = keep.y; App.$('#ddFirst').checked = keep.f; App.$('#ddPin').checked = keep.p;
    if (App.$('#ddCal')) App.$('#ddCal').checked = keep.c;
  }
  App.C['dday-color-input'] = (el) => { ui.ddayColor = el.value; rerenderKeep(); };
  App.C['dday-recolor-input'] = (el) => { ui.ddEditColor = null; App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x) x.color = el.value; }); };
  App.C['dday-cal'] = (el) => App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x) x.cal = el.checked; });
  App.C['dday-size'] = (el) => App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x) x.size = el.value; });
  App.C['dday-pin'] = (el) => App.update((d) => { const x = d.ddays.find((y) => y.id === el.dataset.id); if (x) x.pinned = el.checked; });
})(window.App);
