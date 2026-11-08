// 화면 일부(카드, 다이어리 종이)를 PNG 이미지로 만들기
(function (App) {
  const { t } = App;
  const desktop = !!(window.myroom && window.myroom.isDesktop);

  const toDataURL = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(blob); });
  const cleanFam = (f) => f.trim().replace(/^['"]|['"]$/g, '');

  async function fetchBlob(url) {
    try { const r = await fetch(url); return r.ok ? await r.blob() : null; } catch (e) { return null; }
  }
  async function bundledFontData(file) {
    if (desktop && window.myroom.readFont) {
      const bytes = await window.myroom.readFont(file.replace(/^files\//, ''));
      return bytes ? toDataURL(new Blob([bytes], { type: 'font/woff2' })) : '';
    }
    const b = await fetchBlob('fonts/' + file);
    return b ? toDataURL(b) : '';
  }

  // 이미지 안에서 쓴 글꼴만 골라서 넣기
  async function fontCSS(node) {
    const fams = new Set();
    const weights = new Set();
    [node, ...node.querySelectorAll('*')].forEach((el) => {
      const cs = getComputedStyle(el);
      cs.fontFamily.split(',').forEach((f) => fams.add(cleanFam(f)));
      weights.add(Number(cs.fontWeight) >= 600 ? 700 : 400);
    });
    const text = node.innerText + (node.querySelectorAll('input,textarea').length ? [...node.querySelectorAll('input,textarea')].map((i) => i.value).join('') : '');
    const cps = new Set([...text].map((c) => c.codePointAt(0)));
    cps.add(32);
    const hit = (ranges) => !ranges.length || ranges.some(([a, b]) => { for (const c of cps) if (c >= a && c <= b) return true; return false; });

    const out = [];
    const files = window.FONT_FILES || {};
    for (const fam of fams) {
      // 앱에 들어 있는 글꼴
      if (files[fam]) {
        for (const [file, w, ranges] of files[fam]) {
          if (fam === 'Pretendard' && !weights.has(w >= 600 ? 700 : 400) && w !== 600) continue;
          if (!hit(ranges)) continue;
          const data = await bundledFontData(file);
          if (data) out.push(`@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;src:url(${data}) format('woff2');}`);
        }
        continue;
      }
      // 내가 추가한 글꼴
      const f = (App.D.fonts || []).find((x) => cleanFam(x.family) === fam);
      if (!f) continue;
      if (f.kind === 'file' && f.assetId) {
        const blob = await Assets.getBlob(f.assetId);
        if (blob) out.push(`@font-face{font-family:'${fam}';src:url(${await toDataURL(blob)});}`);
      } else if (f.kind === 'css' && f.css) {
        let css = f.css;
        // @import 로 된 건 내용 가져오기
        for (const m of [...css.matchAll(/@import\s+url\(['"]?([^'")]+)['"]?\)\s*;?/g)]) {
          const b = await fetchBlob(m[1]);
          css = css.replace(m[0], b ? await b.text() : '');
        }
        for (const m of [...new Set([...css.matchAll(/url\(['"]?(https?:[^'")]+)['"]?\)/g)].map((x) => x[1]))]) {
          const b = await fetchBlob(m);
          if (b) css = css.split(m).join(await toDataURL(b));
        }
        out.push(css);
      }
    }
    return out.join('\n');
  }

  // node 를 PNG Blob 으로
  App.renderImage = async function (node, opts = {}) {
    if (!window.htmlToImage) throw new Error('no renderer');
    await document.fonts.ready;
    const fontEmbedCSS = await fontCSS(node);
    return window.htmlToImage.toBlob(node, {
      pixelRatio: opts.pixelRatio || 1,
      width: opts.width || node.offsetWidth,
      height: opts.height || node.offsetHeight,
      style: Object.assign({ transform: 'none', margin: '0', left: '0', top: '0' }, opts.style || {}),
      fontEmbedCSS,
      cacheBust: false,
      filter: (el) => !(el.classList && (el.classList.contains('h') || el.classList.contains('no-export')))
    });
  };

  App.saveImage = async function (blob, name) {
    if (!blob) return false;
    if (desktop && window.myroom.saveImage) return window.myroom.saveImage(new Uint8Array(await blob.arrayBuffer()), name);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  };

  App.copyImage = async function (blob) {
    if (!blob) return false;
    if (desktop && window.myroom.copyImage) return window.myroom.copyImage(new Uint8Array(await blob.arrayBuffer()));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  };

  // 저장/복사 공통 흐름 (진행 중 표시 + 결과 알림)
  let busy = false;
  App.exportNode = async function (node, how, name, opts) {
    if (busy || !node) return;
    busy = true;
    App.toast(t('ex.rendering'));
    try {
      const blob = await App.renderImage(node, opts);
      const ok = how === 'copy' ? await App.copyImage(blob) : await App.saveImage(blob, name);
      if (ok) App.toast(how === 'copy' ? t('ex.copiedImg') : t('ex.savedImg'));
    } catch (e) {
      console.error(e);
      App.toast(how === 'copy' ? t('ex.copyFail') : t('ex.saveFail'));
    } finally { busy = false; }
  };
})(window.App);
