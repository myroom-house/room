// 문의함 — 오류 신고·기능 추천을 만든 사람 메일로 보내요 (Web3Forms)
(function (App) {
  const { t, esc, svg } = App;
  const ui = App.ui;
  ui.fb = { kind: 'bug', sending: false, sentAt: 0 };
  const KINDS = ['bug', 'idea', 'etc'];
  const key = () => (window.MYROOM_CONFIG && window.MYROOM_CONFIG.feedbackKey) || '';

  App.feedbackCard = function () {
    const ready = !!key();
    return `<div class="card fb-card">
      <h3>${t('fb.title')}</h3>
      <p class="hint" style="margin:0 0 10px">${t('fb.help')}</p>
      ${ready ? `
      <div class="seg" style="margin-bottom:10px">${KINDS.map((k) => `<button type="button" data-act="fb-kind" data-v="${k}" aria-pressed="${ui.fb.kind === k}">${t('fb.kind.' + k)}</button>`).join('')}</div>
      <textarea class="input fb-text" id="fbText" rows="5" maxlength="3000" placeholder="${esc(t('fb.ph.' + ui.fb.kind))}"></textarea>
      <input class="input" id="fbReply" type="email" maxlength="120" placeholder="${esc(t('fb.replyPh'))}" style="margin-top:8px">
      <label class="check-line"><input type="checkbox" id="fbInfo" checked> <span>${t('fb.withInfo')}</span></label>
      <div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn primary" data-act="fb-send" ${ui.fb.sending ? 'disabled' : ''}>${svg('send') || ''}${ui.fb.sending ? t('fb.sending') : t('fb.send')}</button></div>`
      : `<p class="muted small" style="margin:0">${t('fb.notReady')}</p>`}
    </div>`;
  };

  Object.assign(App.A, {
    'fb-kind': (el) => {
      ui.fb.kind = el.dataset.v;
      App.$$('[data-act="fb-kind"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === ui.fb.kind));
      const ta = App.$('#fbText'); if (ta) ta.placeholder = t('fb.ph.' + ui.fb.kind);
    },
    'fb-send': async () => {
      const text = (App.$('#fbText').value || '').trim();
      if (text.length < 5) { App.toast(t('fb.tooShort')); App.$('#fbText').focus(); return; }
      if (Date.now() - ui.fb.sentAt < 30000) { App.toast(t('fb.wait')); return; }
      const reply = (App.$('#fbReply').value || '').trim();
      const info = App.$('#fbInfo').checked;
      const body = {
        access_key: key(),
        subject: `[MyRoom ${t('fb.kind.' + ui.fb.kind)}] ${text.split('\n')[0].slice(0, 40)}`,
        from_name: 'MyRoom 문의함',
        kind: t('fb.kind.' + ui.fb.kind),
        message: text,
        botcheck: ''
      };
      if (reply) { body.email = reply; body.replyto = reply; }
      if (info) {
        body.app = (App.$('.set-ver') || {}).textContent || 'MyRoom';
        body.device = navigator.userAgent;
        body.screen = `${window.innerWidth}×${window.innerHeight}`;
        body.place = window.myroom ? 'desktop' : (window.matchMedia('(display-mode: standalone)').matches ? 'pwa' : 'web');
      }
      ui.fb.sending = true;
      const btn = App.$('[data-act="fb-send"]'); if (btn) { btn.disabled = true; btn.textContent = t('fb.sending'); }
      try {
        const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.success === false) throw new Error(j.message || res.status);
        ui.fb.sentAt = Date.now();
        App.$('#fbText').value = '';
        App.toast(t('fb.sent'));
      } catch (e) {
        console.error(e);
        App.toast(navigator.onLine ? t('fb.fail') : t('fb.offline'));
      } finally {
        ui.fb.sending = false;
        const b2 = App.$('[data-act="fb-send"]'); if (b2) { b2.disabled = false; b2.textContent = t('fb.send'); }
      }
    }
  });
})(window.App);
