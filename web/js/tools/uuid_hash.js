// UUID & Cryptographic Hash Generator + File Checksum
const UuidHashTool = {
  currentUuids: [],

  init() {
    const genBtn = document.getElementById('uuid-gen-btn');
    const copyBtn = document.getElementById('uuid-copy-btn');
    const hashInput = document.getElementById('hash-input');
    const hashFileLoadInput = document.getElementById('hash-file-load-input');
    const fileDrop = document.getElementById('hash-file-dropzone');
    const fileInput = document.getElementById('hash-file-input');

    if (!genBtn) return;

    genBtn.addEventListener('click', () => this.generateUuids());
    
    // Start empty — generate only on click
    this.renderUuidEmptyState();
    this.renderHashEmptyState();

    if (hashFileLoadInput) {
      hashFileLoadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (hashInput) {
            hashInput.value = evt.target.result;
            this.calculateHashes();
            App.showToast(`Loaded payload from ${file.name}`);
          }
        };
        reader.readAsText(file);
      });
    }

    hashInput.addEventListener('input', () => this.calculateHashes());

    if (fileDrop) {
      fileDrop.addEventListener('click', () => fileInput.click());
      fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
      fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
      fileDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDrop.classList.remove('dragover');
        if (e.dataTransfer.files.length) this.hashLocalFile(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) this.hashLocalFile(e.target.files[0]);
      });
    }

    document.querySelectorAll('[data-hash-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-hash-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.hashTab;
        document.getElementById('tab-uuids').classList.toggle('active', tab === 'uuids');
        document.getElementById('tab-hashes').classList.toggle('active', tab === 'hashes');
        const fTab = document.getElementById('tab-filehash');
        if (fTab) fTab.classList.toggle('active', tab === 'filehash');
      });
    });

    // Render initial empty states
    this.renderUuidEmptyState();
    this.renderHashEmptyState();
  },

  async hashLocalFile(file) {
    const results = document.getElementById('hash-file-results');
    results.innerHTML = `<p style="color:var(--c-purple);">Computing checksum for ${file.name} (${(file.size / 1024).toFixed(1)} KB)...</p>`;
    
    const buffer = await file.arrayBuffer();
    const sha256Buf = await crypto.subtle.digest('SHA-256', buffer);
    const sha1Buf = await crypto.subtle.digest('SHA-1', buffer);
    const toHex = (b) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');

    const sha256 = toHex(sha256Buf);
    const sha1 = toHex(sha1Buf);

    results.innerHTML = `
      <div class="hash-row">
        <span class="hash-algo">File</span>
        <span class="hash-val"><strong>${App.escapeHtml(file.name)}</strong> (${(file.size/1024).toFixed(1)} KB)</span>
      </div>
      <div class="hash-row">
        <span class="hash-algo">SHA-256</span>
        <span class="hash-val">${sha256}</span>
        <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha256}', this)" title="Copy SHA-256"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
      </div>
      <div class="hash-row">
        <span class="hash-algo">SHA-1</span>
        <span class="hash-val">${sha1}</span>
        <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha1}', this)" title="Copy SHA-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
      </div>
    `;
    App.showToast(`Computed file checksum for ${file.name}`);
  },

  generateUuids() {
    const type = document.getElementById('uuid-type').value;
    const count = Math.min(100, Math.max(1, parseInt(document.getElementById('uuid-count').value, 10) || 5));
    const outList = document.getElementById('uuid-output-list');

    this.currentUuids = [];
    for (let i = 0; i < count; i++) {
      if (type === 'v4') this.currentUuids.push(crypto.randomUUID());
      else if (type === 'v7') this.currentUuids.push(this.generateUuidV7());
      else if (type === 'nanoid') this.currentUuids.push(this.generateNanoId());
    }

      outList.innerHTML = this.currentUuids.map(uuid => `
        <div class="hash-row" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 2px;">
          <span style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-color); word-break: break-all; margin-right: 12px;">${uuid}</span>
          <button class="url-action-icon-btn" onclick="App.copyToClipboard('${uuid}', this)" title="Copy UUID"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
        </div>
      `).join('');
  },

  generateUuidV7() {
    const now = Date.now();
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[0] = (now / 0x10000000000) & 0xff;
    bytes[1] = (now / 0x100000000) & 0xff;
    bytes[2] = (now / 0x1000000) & 0xff;
    bytes[3] = (now / 0x10000) & 0xff;
    bytes[4] = (now / 0x100) & 0xff;
    bytes[5] = now & 0xff;

    bytes[6] = 0x70 | (bytes[6] & 0x0f);
    bytes[8] = 0x80 | (bytes[8] & 0x3f);

    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  },

  generateNanoId(size = 21) {
    const urlAlphabet = 'useandom-26T1983_40STOpknife9zHQGBLRVfx-bl7i6w_IKMAZ';
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    let id = '';
    for (let i = 0; i < size; i++) {
      id += urlAlphabet[bytes[i] % urlAlphabet.length];
    }
    return id;
  },

  async calculateHashes() {
    const input = document.getElementById('hash-input');
    const text = input ? input.value : '';
    const container = document.getElementById('hash-results-list');
    if (!container) return;

    if (!text) {
      this.renderHashEmptyState();
      return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const sha1Buf = await crypto.subtle.digest('SHA-1', data);
    const sha256Buf = await crypto.subtle.digest('SHA-256', data);
    const sha512Buf = await crypto.subtle.digest('SHA-512', data);

    const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const sha1 = toHex(sha1Buf);
    const sha256 = toHex(sha256Buf);
    const sha512 = toHex(sha512Buf);
    const md5 = this.simpleMd5(text);

    container.innerHTML = `
      <div class="hash-row">
        <span class="hash-algo">MD5</span>
        <span class="hash-val" id="h-md5">${md5}</span>
        <button class="url-action-icon-btn" onclick="App.copyToClipboard('${md5}', this)" title="Copy MD5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
      </div>
      <div class="hash-row">
        <span class="hash-algo">SHA-1</span>
        <span class="hash-val" id="h-sha1">${sha1}</span>
        <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha1}', this)" title="Copy SHA-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
      </div>
      <div class="hash-row">
        <span class="hash-algo">SHA-256</span>
        <span class="hash-val" id="h-sha256">${sha256}</span>
        <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha256}', this)" title="Copy SHA-256"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
      </div>
      <div class="hash-row">
        <span class="hash-algo">SHA-512</span>
        <span class="hash-val" id="h-sha512">${sha512}</span>
        <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha512}', this)" title="Copy SHA-512"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
      </div>
    `;
  },

  simpleMd5(string) {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      var lX4, lY4, lX8, lY8, lResult;
      lX8 = lX & 0x80000000; lY8 = lY & 0x80000000;
      lX4 = lX & 0x40000000; lY4 = lY & 0x40000000;
      lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
      if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
        else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
      } else return lResult ^ lX8 ^ lY8;
    }
    function F(x, y, z) { return (x & y) | (~x & z); }
    function G(x, y, z) { return (x & z) | (y & ~z); }
    function H(x, y, z) { return x ^ y ^ z; }
    function I(x, y, z) { return y ^ (x | ~z); }
    function FF(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function GG(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function HH(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function II(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }

    let x = [];
    let k, AA, BB, CC, DD, a, b, c, d;
    let S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    let S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    let S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    let S41 = 6, S42 = 10, S43 = 15, S44 = 21;

    let str = unescape(encodeURIComponent(string));
    let lMessageLength = str.length;
    let lNumberOfWords_temp1 = lMessageLength + 8;
    let lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    let lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    let lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;

    while (lByteCount < lMessageLength) {
      let lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    let lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;

    a = 0x67452301; b = 0xefcdab89; c = 0x98badcfe; d = 0x10325476;

    for (k = 0; k < lNumberOfWords; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = FF(a, b, c, d, lWordArray[k], S11, 0xd76aa478);
      d = FF(d, a, b, c, lWordArray[k + 1], S12, 0xe8c7b756);
      c = FF(c, d, a, b, lWordArray[k + 2], S13, 0x242070db);
      b = FF(b, c, d, a, lWordArray[k + 3], S14, 0xc1bdceee);
      a = FF(a, b, c, d, lWordArray[k + 4], S11, 0xf57c0faf);
      d = FF(d, a, b, c, lWordArray[k + 5], S12, 0x4787c62a);
      c = FF(c, d, a, b, lWordArray[k + 6], S13, 0xa8304613);
      b = FF(b, c, d, a, lWordArray[k + 7], S14, 0xfd469501);
      a = FF(a, b, c, d, lWordArray[k + 8], S11, 0x698098d8);
      d = FF(d, a, b, c, lWordArray[k + 9], S12, 0x8b44f7af);
      c = FF(c, d, a, b, lWordArray[k + 10], S13, 0xffff5bb1);
      b = FF(b, c, d, a, lWordArray[k + 11], S14, 0x895cd7be);
      a = FF(a, b, c, d, lWordArray[k + 12], S11, 0x6b901122);
      d = FF(d, a, b, c, lWordArray[k + 13], S12, 0xfd987193);
      c = FF(c, d, a, b, lWordArray[k + 14], S13, 0xa679438e);
      b = FF(b, c, d, a, lWordArray[k + 15], S14, 0x49b40821);

      a = GG(a, b, c, d, lWordArray[k + 1], S21, 0xf61e2562);
      d = GG(d, a, b, c, lWordArray[k + 6], S22, 0xc040b340);
      c = GG(c, d, a, b, lWordArray[k + 11], S23, 0x265e5a51);
      b = GG(b, c, d, a, lWordArray[k], S24, 0xe9b6c7aa);
      a = GG(a, b, c, d, lWordArray[k + 5], S21, 0xd62f105d);
      d = GG(d, a, b, c, lWordArray[k + 10], S22, 0x2441453);
      c = GG(c, d, a, b, lWordArray[k + 15], S23, 0xd8a1e681);
      b = GG(b, c, d, a, lWordArray[k + 4], S24, 0xe7d3fbc8);
      a = GG(a, b, c, d, lWordArray[k + 9], S21, 0x21e1cde6);
      d = GG(d, a, b, c, lWordArray[k + 14], S22, 0xc33707d6);
      c = GG(c, d, a, b, lWordArray[k + 3], S23, 0xf4d50d87);
      b = GG(b, c, d, a, lWordArray[k + 8], S24, 0x455a14ed);
      a = GG(a, b, c, d, lWordArray[k + 13], S21, 0xa9e3e905);
      d = GG(d, a, b, c, lWordArray[k + 2], S22, 0xfcefa3f8);
      c = GG(c, d, a, b, lWordArray[k + 7], S23, 0x676f02d9);
      b = GG(b, c, d, a, lWordArray[k + 12], S24, 0x8d2a4c8a);

      a = HH(a, b, c, d, lWordArray[k + 5], S31, 0xfffa3942);
      d = HH(d, a, b, c, lWordArray[k + 8], S32, 0x8771f681);
      c = HH(c, d, a, b, lWordArray[k + 11], S33, 0x6d9d6122);
      b = HH(b, c, d, a, lWordArray[k + 14], S34, 0xfde5380c);
      a = HH(a, b, c, d, lWordArray[k + 1], S31, 0xa4beea44);
      d = HH(d, a, b, c, lWordArray[k + 4], S32, 0x4bdecfa9);
      c = HH(c, d, a, b, lWordArray[k + 7], S33, 0xf6bb4b60);
      b = HH(b, c, d, a, lWordArray[k + 10], S34, 0xbebfbc70);
      a = HH(a, b, c, d, lWordArray[k + 13], S31, 0x289b7ec6);
      d = HH(d, a, b, c, lWordArray[k], S32, 0xeaa127fa);
      c = HH(c, d, a, b, lWordArray[k + 3], S33, 0xd4ef3085);
      b = HH(b, c, d, a, lWordArray[k + 6], S34, 0x4881d05);
      a = HH(a, b, c, d, lWordArray[k + 9], S31, 0xd9d4d039);
      d = HH(d, a, b, c, lWordArray[k + 12], S32, 0xe6db99e5);
      c = HH(c, d, a, b, lWordArray[k + 15], S33, 0x1fa27cf8);
      b = HH(b, c, d, a, lWordArray[k + 2], S34, 0xc4ac5665);

      a = II(a, b, c, d, lWordArray[k], S41, 0xf4292244);
      d = II(d, a, b, c, lWordArray[k + 7], S42, 0x432aff97);
      c = II(c, d, a, b, lWordArray[k + 14], S43, 0xab9423a7);
      b = II(b, c, d, a, lWordArray[k + 5], S44, 0xfc93a039);
      a = II(a, b, c, d, lWordArray[k + 12], S41, 0x655b59c3);
      d = II(d, a, b, c, lWordArray[k + 3], S42, 0x8f0ccc92);
      c = II(c, d, a, b, lWordArray[k + 10], S43, 0xffeff47d);
      b = II(b, c, d, a, lWordArray[k + 1], S44, 0x85845dd1);
      a = II(a, b, c, d, lWordArray[k + 8], S41, 0x6fa87e4f);
      d = II(d, a, b, c, lWordArray[k + 15], S42, 0xfe2ce6e0);
      c = II(c, d, a, b, lWordArray[k + 6], S43, 0xa3014314);
      b = II(b, c, d, a, lWordArray[k + 13], S44, 0x4e0811a1);
      a = II(a, b, c, d, lWordArray[k + 4], S41, 0xf7537e82);
      d = II(d, a, b, c, lWordArray[k + 11], S42, 0xbd3af235);
      c = II(c, d, a, b, lWordArray[k + 2], S43, 0x2ad7d2bb);
      b = II(b, c, d, a, lWordArray[k + 9], S44, 0xeb86d391);

      a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }

    function wordToHex(lValue) {
      let str = "";
      for (let lCount = 0; lCount <= 3; lCount++) {
        let lByte = (lValue >>> (lCount * 8)) & 255;
        let hex = "0" + lByte.toString(16);
        str += hex.substr(hex.length - 2, 2);
      }
      return str;
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
  },

  renderUuidEmptyState() {
    const outList = document.getElementById('uuid-output-list');
    if (outList) {
      outList.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; text-align: center; color: var(--text-dim); border: 1.5px dashed var(--border-color); border-radius: var(--radius-lg); margin-top: 10px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px; opacity: 0.5;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
          <span style="font-size: 0.76rem; font-weight: 500; color: var(--text-main);">No UUIDs generated yet</span>
          <span style="font-size: 0.68rem; opacity: 0.7; margin-top: 2px;">Click "Generate" above to create unique identifiers</span>
        </div>
      `;
    }
  },

  renderHashEmptyState() {
    const container = document.getElementById('hash-results-list');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; text-align: center; color: var(--text-dim); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); margin-top: 10px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px; opacity: 0.5;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span style="font-size: 0.76rem; font-weight: 500; color: var(--text-main);">No hash calculated yet</span>
          <span style="font-size: 0.68rem; opacity: 0.7; margin-top: 2px;">Type input text above or upload a file payload</span>
        </div>
      `;
    }
  }
};
