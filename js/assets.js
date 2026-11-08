// 사진·스티커·폰트 같은 파일 저장소
// 데스크탑 앱: 데이터 폴더의 assets/ 안에 파일로 저장
// 브라우저 미리보기: IndexedDB에 저장
(function () {
  const desktop = !!(window.myroom && window.myroom.isDesktop);
  const urlCache = new Map();   // id -> blob URL
  const pending = new Map();    // id -> Promise<blob URL>

  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('myroom-assets', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('assets');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('assets', mode);
      const r = fn(tx.objectStore('assets'));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  /* 계정에 로그인하면 파일도 서버에 올려서 다른 기기에서 받아와요 (음악 파일 m_ 은 용량 때문에 제외) */
  let remote = null;
  const syncable = (id) => !!id && !/^m_/.test(id);
  function setRemote(r) { remote = r; }

  async function put(id, blob, opts = {}) {
    if (remote && !opts.noUpload && syncable(id)) remote.upload(id, blob);
    if (desktop) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await window.myroom.assetPut(id, blob.type, bytes);
    } else {
      await idb('readwrite', (s) => s.put(blob, id));
    }
    if (urlCache.has(id)) URL.revokeObjectURL(urlCache.get(id));
    urlCache.set(id, URL.createObjectURL(blob));
    return id;
  }

  async function localBlob(id) {
    if (desktop) {
      const a = await window.myroom.assetGet(id);
      return a ? new Blob([a.bytes], { type: a.type }) : null;
    }
    try { return (await idb('readonly', (s) => s.get(id))) || null; } catch (e) { return null; }
  }
  async function getBlob(id) {
    const b = await localBlob(id);
    if (b || !remote || !syncable(id)) return b;
    // 이 기기에 없으면 계정에서 받아오기
    try {
      const r = await remote.download(id);
      if (r) { await put(id, r, { noUpload: true }); return r; }
    } catch (e) { /* 무시 */ }
    return null;
  }
  async function list() {
    if (desktop) { try { return await window.myroom.assetList(); } catch (e) { return []; } }
    const d = await db();
    return new Promise((res) => { const r = d.transaction('assets').objectStore('assets').getAllKeys(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
  }

  // 화면에 쓸 수 있는 주소 (blob:) — 한 번 읽으면 기억해 둠
  function url(id) {
    if (!id) return Promise.resolve('');
    if (urlCache.has(id)) return Promise.resolve(urlCache.get(id));
    if (!pending.has(id)) {
      pending.set(id, getBlob(id).then((b) => {
        pending.delete(id);
        if (!b) return '';
        const u = URL.createObjectURL(b);
        urlCache.set(id, u);
        return u;
      }));
    }
    return pending.get(id);
  }
  const cachedUrl = (id) => urlCache.get(id) || '';

  async function del(id) {
    if (!id) return;
    if (remote && syncable(id)) remote.remove(id);
    if (desktop) await window.myroom.assetDel(id);
    else { try { await idb('readwrite', (s) => s.delete(id)); } catch (e) { /* 무시 */ } }
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
  }

  // 브라우저용 백업: 모든 파일을 base64로
  async function exportAll() {
    const out = {};
    if (desktop) return out;
    const d = await db();
    const keys = await new Promise((res) => { const r = d.transaction('assets').objectStore('assets').getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
    for (const k of keys) {
      const b = await getBlob(k);
      if (!b) continue;
      const buf = new Uint8Array(await b.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      out[k] = { type: b.type, b64: btoa(s) };
    }
    return out;
  }
  async function importAll(assets) {
    for (const [id, a] of Object.entries(assets || {})) {
      const bin = atob(a.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await put(id, new Blob([bytes], { type: a.type }));
    }
  }

  // 이미지 파일을 알맞은 크기로 줄여서 Blob으로
  function shrinkImage(file, max, keepAlpha) {
    return new Promise((resolve) => {
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') return resolve(file);
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(src);
        const s = Math.min(1, max / Math.max(img.width, img.height));
        if (s === 1 && file.size < 1.5 * 1024 * 1024) return resolve(file);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const png = keepAlpha || file.type === 'image/png' || file.type === 'image/webp';
        c.toBlob((b) => resolve(b || file), png ? 'image/png' : 'image/jpeg', 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(src); resolve(file); };
      img.src = src;
    });
  }

  window.Assets = { put, url, cachedUrl, del, getBlob, localBlob, list, exportAll, importAll, shrinkImage, desktop, setRemote, syncable };
})();
