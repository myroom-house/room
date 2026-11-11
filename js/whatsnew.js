// 업데이트 알림 — 큰 업데이트(popup: true)가 생기면 앱을 열 때 한 번 '새로 바뀐 것' 창을 띄워요
// 본 소식은 계정 데이터(settings.seenUpdate)에 적어서, 폰에서 봤으면 PC에서는 다시 안 떠요
(function (App) {
  const { t, esc } = App;
  const TAG = { new: ['wn.tag.new', ''], better: ['wn.tag.better', 'better'], fix: ['wn.tag.fix', 'fix'] };
  const GUIDE = 'https://myroom-house.github.io/room/guide/#updates';
  let list = null, tries = 0;

  const hasContent = (d) => ['todos', 'events', 'memos', 'diary', 'ddays', 'bookmarks', 'routines'].some((k) => (d[k] || []).length);
  const modalOpen = () => { const m = App.$('#modalLayer'); return m && !m.hidden; };

  function markSeen() {
    if (!list || !list.length) return;
    App.silent((d) => { d.settings.seenUpdate = list[0].id; });
  }

  function show(items) {
    App.openModal(`<div class="wn">
      <p class="wn-kicker">${t('wn.kicker')}</p>
      <h3 class="modal-title">${t('wn.title')}</h3>
      <div class="wn-list">${items.map((u) => {
        const tg = TAG[u.tag] || TAG.new;
        return `<section class="wn-item">
          <div class="up-head"><span class="up-date">${esc(u.date)}</span><span class="up-tag ${tg[1]}">${t(tg[0])}</span></div>
          <h4>${esc(u.title)}</h4>
          ${u.desc ? `<p>${esc(u.desc)}</p>` : ''}
          ${u.items && u.items.length ? `<ul>${u.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
        </section>`;
      }).join('')}</div>
      <div class="modal-actions"><a class="link-btn" href="${GUIDE}" target="_blank" rel="noopener">${t('wn.all')}</a><button class="btn primary" data-act="wn-ok">${t('wn.ok')}</button></div>
    </div>`, null, 'small');
  }

  async function check() {
    try {
      if (!list) {
        const r = await fetch('updates.json', { cache: 'no-cache' });
        list = await r.json();
      }
      if (!Array.isArray(list) || !list.length) return;
      const d = App.D;
      const seen = d.settings.seenUpdate;
      if (!seen) {
        // 이 기능이 생기기 전부터 쓰던 사람: 가장 최근 큰 소식 하나만 / 처음 온 사람: 안 띄우고 기억만
        if (!hasContent(d)) { markSeen(); return; }
      }
      const idx = seen ? list.findIndex((u) => u.id === seen) : -1;
      let fresh = (seen ? (idx < 0 ? [] : list.slice(0, idx)) : list).filter((u) => u.popup);
      if (!seen) fresh = fresh.slice(0, 2);
      if (!fresh.length) { if (idx !== 0) markSeen(); return; }
      if (modalOpen()) { if (++tries < 6) setTimeout(check, 4000); return; }
      show(fresh);
    } catch (e) { /* 소식을 못 불러와도 앱은 그대로 */ }
  }
  App.A['wn-ok'] = () => { markSeen(); App.closeModal(); };
  // 계정 연동이 먼저 끝나도록 잠깐 기다렸다가 확인
  window.addEventListener('load', () => setTimeout(check, 3500));
  App.checkWhatsNew = check;
})(window.App);
