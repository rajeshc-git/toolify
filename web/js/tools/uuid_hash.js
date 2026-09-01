// UUID, Cryptographic Hash & Checksum Verifier Studio
const UuidHashTool = {
  currentUuids: [],
  currentFileChecksums: null,
  activeTab: 'uuids',

  init() {
    const genBtn = document.getElementById('uuid-gen-btn');
    const copyBtn = document.getElementById('uuid-copy-btn');
    const hashInput = document.getElementById('hash-input');
    const hashHmacKey = document.getElementById('hash-hmac-key');
    const hashOutputFormat = document.getElementById('hash-output-format');
    const hashFileLoadInput = document.getElementById('hash-file-load-input');
    const fileDrop = document.getElementById('hash-file-dropzone');
    const fileInput = document.getElementById('hash-file-input');
    const verifyInput = document.getElementById('hash-verify-input');

    if (!genBtn) return;

    genBtn.addEventListener('click', () => this.generateUuids(true));
    
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        if (!this.currentUuids || this.currentUuids.length === 0) {
          App.showToast('No UUIDs to copy', 'error');
          return;
        }
        App.copyToClipboard(this.currentUuids.join('\n'), e.currentTarget);
        App.showToast(`Copied ${this.currentUuids.length} identifiers to clipboard`);
      });
    }

    // Format & Option change listeners
    ['uuid-type', 'uuid-count', 'uuid-opt-uppercase', 'uuid-opt-hyphens', 'uuid-opt-braces'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          if (this.currentUuids.length > 0) this.generateUuids(false);
        });
      }
    });

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

    // Debounced hash calculation (100ms)
    const debouncedCalc = Perf.debounce(() => this.calculateHashes(), 100);
    if (hashInput) hashInput.addEventListener('input', debouncedCalc);
    if (hashHmacKey) hashHmacKey.addEventListener('input', debouncedCalc);
    if (hashOutputFormat) hashOutputFormat.addEventListener('change', () => this.calculateHashes());

    // File Checksum Dropzone
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

    // Live Checksum Comparator
    if (verifyInput) {
      verifyInput.addEventListener('input', () => this.compareChecksums());
    }

    // Tab Navigation
    document.querySelectorAll('[data-hash-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-hash-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.hashTab;
        this.activeTab = tab;
        document.getElementById('tab-uuids').classList.toggle('active', tab === 'uuids');
        document.getElementById('tab-hashes').classList.toggle('active', tab === 'hashes');
        const fTab = document.getElementById('tab-filehash');
        if (fTab) fTab.classList.toggle('active', tab === 'filehash');
      });
    });

    // Start with empty state
    this.renderUuidEmptyState();
    this.renderHashEmptyState();
  },

  loadUuidPreset(type, count, upper, hyphens) {
    const typeSelect = document.getElementById('uuid-type');
    const countInput = document.getElementById('uuid-count');
    const upperCheckbox = document.getElementById('uuid-opt-uppercase');
    const hyphensCheckbox = document.getElementById('uuid-opt-hyphens');

    if (typeSelect) typeSelect.value = type;
    if (countInput) countInput.value = count;
    if (upperCheckbox) upperCheckbox.checked = upper;
    if (hyphensCheckbox) hyphensCheckbox.checked = hyphens;

    // Switch to UUID tab if not active
    const uuidTabBtn = document.querySelector('[data-hash-tab="uuids"]');
    if (uuidTabBtn) uuidTabBtn.click();

    this.generateUuids(true);
  },

  loadHashSample(text) {
    const hashInput = document.getElementById('hash-input');
    if (hashInput) {
      hashInput.value = text;
      // Switch to Hash tab
      const hashTabBtn = document.querySelector('[data-hash-tab="hashes"]');
      if (hashTabBtn) hashTabBtn.click();
      this.calculateHashes();
    }
  },

  resetCurrentTab() {
    if (this.activeTab === 'uuids') {
      this.currentUuids = [];
      this.renderUuidEmptyState();
      App.showToast('Reset UUID generator');
    } else if (this.activeTab === 'hashes') {
      const hashInput = document.getElementById('hash-input');
      const hashHmac = document.getElementById('hash-hmac-key');
      if (hashInput) hashInput.value = '';
      if (hashHmac) hashHmac.value = '';
      this.renderHashEmptyState();
      App.showToast('Reset hash input');
    } else if (this.activeTab === 'filehash') {
      this.currentFileChecksums = null;
      const verifyCard = document.getElementById('hash-verify-card');
      const results = document.getElementById('hash-file-results');
      const verifyInput = document.getElementById('hash-verify-input');
      if (verifyCard) verifyCard.style.display = 'none';
      if (verifyInput) verifyInput.value = '';
      if (results) results.innerHTML = '';
      App.showToast('Reset file checksum verifier');
    }
  },

  generateUuids(isManual = false) {
    const type = document.getElementById('uuid-type').value;
    const count = Math.min(100, Math.max(1, parseInt(document.getElementById('uuid-count').value, 10) || 5));
    const isUpper = document.getElementById('uuid-opt-uppercase')?.checked;
    const hasHyphens = document.getElementById('uuid-opt-hyphens')?.checked;
    const hasBraces = document.getElementById('uuid-opt-braces')?.checked;
    const outList = document.getElementById('uuid-output-list');

    this.currentUuids = [];
    for (let i = 0; i < count; i++) {
      let rawId = '';
      if (type === 'v4') rawId = crypto.randomUUID();
      else if (type === 'v7') rawId = this.generateUuidV7();
      else if (type === 'nanoid') rawId = this.generateNanoId();
      else if (type === 'ulid') rawId = this.generateUlid();
      else if (type === 'cuid2') rawId = this.generateCuid2();
      else rawId = crypto.randomUUID();

      // Format options
      if (!hasHyphens && (type === 'v4' || type === 'v7')) {
        rawId = rawId.replace(/-/g, '');
      }
      if (isUpper) {
        rawId = rawId.toUpperCase();
      }
      if (hasBraces) {
        rawId = `{${rawId}}`;
      }

      this.currentUuids.push(rawId);
    }

    if (outList) {
      outList.innerHTML = this.currentUuids.map((id, idx) => `
        <div class="pwd-single-line-item">
          <span class="pwd-single-line-tag">#${idx + 1}</span>
          <span class="pwd-single-line-value" onclick="App.copyToClipboard('${id}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">
            ${App.escapeHtml(id)}
          </span>
          <button type="button" class="url-action-icon-btn" onclick="App.copyToClipboard('${id}', this)" title="Copy identifier #${idx + 1}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
      `).join('');
    }

    if (isManual) {
      App.showToast(`Generated ${count} unique identifier(s)`);
    }
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

  generateUlid() {
    // 48-bit timestamp + 80-bit randomness in Crockford's Base32
    const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const now = Date.now();
    let timeStr = "";
    let t = now;
    for (let i = 9; i >= 0; i--) {
      timeStr = ENCODING[t % 32] + timeStr;
      t = Math.floor(t / 32);
    }
    const randBytes = new Uint8Array(10);
    crypto.getRandomValues(randBytes);
    let randStr = "";
    for (let i = 0; i < 16; i++) {
      randStr += ENCODING[randBytes[i % 10] % 32];
    }
    return timeStr + randStr;
  },

  generateCuid2() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    let str = alphabet[bytes[0] % 26]; // starts with a letter
    for (let i = 1; i < 24; i++) {
      str += alphabet[bytes[i] % alphabet.length];
    }
    return str;
  },

  crc32(bytes) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ this.crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return ((crc ^ (-1)) >>> 0).toString(16).padStart(8, '0');
  },

  crcTable: (() => {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[n] = c;
    }
    return table;
  })(),

  async calculateHashes() {
    const input = document.getElementById('hash-input');
    const hmacKeyInput = document.getElementById('hash-hmac-key');
    const formatSelect = document.getElementById('hash-output-format');
    const statsEl = document.getElementById('hash-input-stats');
    const text = input ? input.value : '';
    const hmacKey = hmacKeyInput ? hmacKeyInput.value : '';
    const format = formatSelect ? formatSelect.value : 'hex-lower';
    const container = document.getElementById('hash-results-list');

    if (!container) return;

    if (statsEl) {
      const bytesLen = new TextEncoder().encode(text).length;
      statsEl.innerText = `${text.length} chars, ${bytesLen} bytes`;
    }

    if (!text) {
      this.renderHashEmptyState();
      return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // Compute WebCrypto Standard Hashes
    const sha1Buf = await crypto.subtle.digest('SHA-1', data);
    const sha256Buf = await crypto.subtle.digest('SHA-256', data);
    const sha384Buf = await crypto.subtle.digest('SHA-384', data);
    const sha512Buf = await crypto.subtle.digest('SHA-512', data);

    const toFormatted = (buffer) => {
      const u8 = new Uint8Array(buffer);
      if (format === 'base64') {
        let binary = '';
        for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
        return btoa(binary);
      }
      const hex = Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
      return format === 'hex-upper' ? hex.toUpperCase() : hex;
    };

    let md5 = this.simpleMd5(text);
    if (format === 'hex-upper') md5 = md5.toUpperCase();
    else if (format === 'base64') {
      const md5Bytes = new Uint8Array(md5.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      let binary = '';
      for (let i = 0; i < md5Bytes.length; i++) binary += String.fromCharCode(md5Bytes[i]);
      md5 = btoa(binary);
    }

    const sha1 = toFormatted(sha1Buf);
    const sha256 = toFormatted(sha256Buf);
    const sha384 = toFormatted(sha384Buf);
    const sha512 = toFormatted(sha512Buf);
    const crc32Val = format === 'hex-upper' ? this.crc32(data).toUpperCase() : this.crc32(data);

    // Compute HMAC-SHA256 if key provided
    let hmacHtml = '';
    if (hmacKey) {
      try {
        const keyData = encoder.encode(hmacKey);
        const cryptoKey = await crypto.subtle.importKey(
          'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
        const hmacVal = toFormatted(signature);
        hmacHtml = `
          <div class="pwd-single-line-item" style="border-left: 3px solid var(--c-purple);">
            <span class="hash-algo" style="color:var(--c-purple);">HMAC-SHA256</span>
            <span class="pwd-single-line-value" onclick="App.copyToClipboard('${hmacVal}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">
              ${hmacVal}
            </span>
            <button type="button" class="url-action-icon-btn" onclick="App.copyToClipboard('${hmacVal}', this)" title="Copy HMAC-SHA256">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        `;
      } catch (e) {
        console.error('HMAC Error:', e);
      }
    }

    const algorithms = [
      { name: 'MD5', val: md5, bits: '128-bit' },
      { name: 'SHA-1', val: sha1, bits: '160-bit' },
      { name: 'SHA-256', val: sha256, bits: '256-bit' },
      { name: 'SHA-384', val: sha384, bits: '384-bit' },
      { name: 'SHA-512', val: sha512, bits: '512-bit' },
      { name: 'CRC-32', val: crc32Val, bits: '32-bit' }
    ];

    container.innerHTML = hmacHtml + algorithms.map(algo => `
      <div class="pwd-single-line-item">
        <span class="hash-algo" style="width: 75px; font-size: 0.72rem; font-weight: 800; color: var(--c-purple);">${algo.name}</span>
        <span class="pwd-single-line-value" onclick="App.copyToClipboard('${algo.val}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">
          ${algo.val}
        </span>
        <span style="font-size: 0.65rem; color: var(--text-dim); margin-right: 4px;">${algo.bits}</span>
        <button type="button" class="url-action-icon-btn" onclick="App.copyToClipboard('${algo.val}', this)" title="Copy ${algo.name}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
    `).join('');
  },

  async hashLocalFile(file) {
    const results = document.getElementById('hash-file-results');
    const verifyCard = document.getElementById('hash-verify-card');
    const verifyInput = document.getElementById('hash-verify-input');
    if (!results) return;

    Perf.showProgressBar('hash-file-dropzone', 0, true);
    results.innerHTML = `<div style="padding:14px; text-align:center; color:var(--c-purple); font-size:0.82rem;">Computing checksums for <strong>${App.escapeHtml(file.name)}</strong> (${Perf.formatBytes(file.size)})...</div>`;
    
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const sha256Buf = await crypto.subtle.digest('SHA-256', buffer);
      const sha512Buf = await crypto.subtle.digest('SHA-512', buffer);
      const sha1Buf = await crypto.subtle.digest('SHA-1', buffer);
      const toHex = (b) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');

      const sha256 = toHex(sha256Buf);
      const sha512 = toHex(sha512Buf);
      const sha1 = toHex(sha1Buf);
      const crc32Val = this.crc32(bytes);

      this.currentFileChecksums = {
        name: file.name,
        size: file.size,
        'SHA-256': sha256,
        'SHA-512': sha512,
        'SHA-1': sha1,
        'CRC-32': crc32Val
      };

      Perf.hideProgressBar('hash-file-dropzone');
      if (verifyCard) verifyCard.style.display = 'block';
      if (verifyInput) verifyInput.value = '';
      this.compareChecksums();

      results.innerHTML = `
        <div class="pwd-single-line-item" style="background: var(--bg-card); font-weight:700;">
          <span style="font-size: 0.74rem; color: var(--text-dim);">FILE</span>
          <span class="pwd-single-line-value" style="color: var(--text-main); font-family: var(--font-sans);">${App.escapeHtml(file.name)} (${Perf.formatBytes(file.size)})</span>
        </div>
        <div class="pwd-single-line-item">
          <span class="hash-algo" style="width: 75px; font-weight: 800; font-size: 0.72rem; color: var(--c-purple);">SHA-256</span>
          <span class="pwd-single-line-value" id="f-sha256" onclick="App.copyToClipboard('${sha256}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">${sha256}</span>
          <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha256}', this)" title="Copy SHA-256"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
        <div class="pwd-single-line-item">
          <span class="hash-algo" style="width: 75px; font-weight: 800; font-size: 0.72rem; color: var(--c-purple);">SHA-512</span>
          <span class="pwd-single-line-value" id="f-sha512" onclick="App.copyToClipboard('${sha512}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">${sha512}</span>
          <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha512}', this)" title="Copy SHA-512"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
        <div class="pwd-single-line-item">
          <span class="hash-algo" style="width: 75px; font-weight: 800; font-size: 0.72rem; color: var(--c-purple);">SHA-1</span>
          <span class="pwd-single-line-value" id="f-sha1" onclick="App.copyToClipboard('${sha1}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">${sha1}</span>
          <button class="url-action-icon-btn" onclick="App.copyToClipboard('${sha1}', this)" title="Copy SHA-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
        <div class="pwd-single-line-item">
          <span class="hash-algo" style="width: 75px; font-weight: 800; font-size: 0.72rem; color: var(--c-purple);">CRC-32</span>
          <span class="pwd-single-line-value" id="f-crc32" onclick="App.copyToClipboard('${crc32Val}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">${crc32Val}</span>
          <button class="url-action-icon-btn" onclick="App.copyToClipboard('${crc32Val}', this)" title="Copy CRC-32"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
      `;
      App.showToast(`Computed checksums for ${file.name}`);
    } catch(err) {
      Perf.hideProgressBar('hash-file-dropzone');
      results.innerHTML = `<p style="color:var(--c-red);">Error hashing file: ${err.message}</p>`;
    }
  },

  compareChecksums() {
    const input = document.getElementById('hash-verify-input');
    const badge = document.getElementById('hash-match-status-badge');
    if (!input || !badge) return;

    const val = input.value.trim().toLowerCase();
    if (!val) {
      badge.innerText = 'Awaiting Input';
      badge.style.background = 'var(--bg-card)';
      badge.style.color = 'var(--text-dim)';
      badge.style.borderColor = 'var(--border-color)';
      return;
    }

    if (!this.currentFileChecksums) {
      badge.innerText = 'Drop a file above';
      badge.style.background = 'var(--bg-card)';
      badge.style.color = 'var(--text-dim)';
      badge.style.borderColor = 'var(--border-color)';
      return;
    }

    let matchedAlgo = null;
    ['SHA-256', 'SHA-512', 'SHA-1', 'CRC-32'].forEach(algo => {
      const hash = (this.currentFileChecksums[algo] || '').toLowerCase();
      if (hash && hash === val) {
        matchedAlgo = algo;
      }
    });

    if (matchedAlgo) {
      badge.innerHTML = `✓ VALID CHECKSUM MATCH (${matchedAlgo})`;
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
      badge.style.color = '#10b981';
      badge.style.borderColor = '#10b981';
    } else {
      badge.innerHTML = `✗ MISMATCH / NO MATCH`;
      badge.style.background = 'rgba(239, 68, 68, 0.15)';
      badge.style.color = '#ef4444';
      badge.style.borderColor = '#ef4444';
    }
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

    let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

    for (let k = 0; k < lNumberOfWords; k += 16) {
      let AA = a, BB = b, CC = c, DD = d;
      a = FF(a, b, c, d, lWordArray[k], 7, 0xd76aa478);
      d = FF(d, a, b, c, lWordArray[k + 1], 12, 0xe8c7b756);
      c = FF(c, d, a, b, lWordArray[k + 2], 17, 0x242070db);
      b = FF(b, c, d, a, lWordArray[k + 3], 22, 0xc1bdceee);
      a = FF(a, b, c, d, lWordArray[k + 4], 7, 0xf57c0faf);
      d = FF(d, a, b, c, lWordArray[k + 5], 12, 0x4787c62a);
      c = FF(c, d, a, b, lWordArray[k + 6], 17, 0xa8304613);
      b = FF(b, c, d, a, lWordArray[k + 7], 22, 0xfd469501);
      a = FF(a, b, c, d, lWordArray[k + 8], 7, 0x698098d8);
      d = FF(d, a, b, c, lWordArray[k + 9], 12, 0x8b44f7af);
      c = FF(c, d, a, b, lWordArray[k + 10], 17, 0xffff5bb1);
      b = FF(b, c, d, a, lWordArray[k + 11], 22, 0x895cd7be);
      a = FF(a, b, c, d, lWordArray[k + 12], 7, 0x6b901122);
      d = FF(d, a, b, c, lWordArray[k + 13], 12, 0xfd987193);
      c = FF(c, d, a, b, lWordArray[k + 14], 17, 0xa679438e);
      b = FF(b, c, d, a, lWordArray[k + 15], 22, 0x49b40821);

      a = GG(a, b, c, d, lWordArray[k + 1], 5, 0xf61e2562);
      d = GG(d, a, b, c, lWordArray[k + 6], 9, 0xc040b340);
      c = GG(c, d, a, b, lWordArray[k + 11], 14, 0x265e5a51);
      b = GG(b, c, d, a, lWordArray[k], 20, 0xe9b6c7aa);
      a = GG(a, b, c, d, lWordArray[k + 5], 5, 0xd62f105d);
      d = GG(d, a, b, c, lWordArray[k + 10], 9, 0x2441453);
      c = GG(c, d, a, b, lWordArray[k + 15], 14, 0xd8a1e681);
      b = GG(b, c, d, a, lWordArray[k + 4], 20, 0xe7d3fbc8);
      a = GG(a, b, c, d, lWordArray[k + 9], 5, 0x21e1cde6);
      d = GG(d, a, b, c, lWordArray[k + 14], 9, 0xc33707d6);
      c = GG(c, d, a, b, lWordArray[k + 3], 14, 0xf4d50d87);
      b = GG(b, c, d, a, lWordArray[k + 8], 20, 0x455a14ed);
      a = GG(a, b, c, d, lWordArray[k + 13], 5, 0xa9e3e905);
      d = GG(d, a, b, c, lWordArray[k + 2], 9, 0xfcefa3f8);
      c = GG(c, d, a, b, lWordArray[k + 7], 14, 0x676f02d9);
      b = GG(b, c, d, a, lWordArray[k + 12], 20, 0x8d2a4c8a);

      a = HH(a, b, c, d, lWordArray[k + 5], 4, 0xfffa3942);
      d = HH(d, a, b, c, lWordArray[k + 8], 11, 0x8771f681);
      c = HH(c, d, a, b, lWordArray[k + 11], 16, 0x6d9d6122);
      b = HH(b, c, d, a, lWordArray[k + 14], 23, 0xfde5380c);
      a = HH(a, b, c, d, lWordArray[k + 1], 4, 0xa4beea44);
      d = HH(d, a, b, c, lWordArray[k + 4], 11, 0x4bdecfa9);
      c = HH(c, d, a, b, lWordArray[k + 7], 16, 0xf6bb4b60);
      b = HH(b, c, d, a, lWordArray[k + 10], 23, 0xbebfbc70);
      a = HH(a, b, c, d, lWordArray[k + 13], 4, 0x289b7ec6);
      d = HH(d, a, b, c, lWordArray[k], 11, 0xeaa127fa);
      c = HH(c, d, a, b, lWordArray[k + 3], 16, 0xd4ef3085);
      b = HH(b, c, d, a, lWordArray[k + 6], 23, 0x4881d05);
      a = HH(a, b, c, d, lWordArray[k + 9], 4, 0xd9d4d039);
      d = HH(d, a, b, c, lWordArray[k + 12], 11, 0xe6db99e5);
      c = HH(c, d, a, b, lWordArray[k + 15], 16, 0x1fa27cf8);
      b = HH(b, c, d, a, lWordArray[k + 2], 23, 0xc4ac5665);

      a = II(a, b, c, d, lWordArray[k], 6, 0xf4292244);
      d = II(d, a, b, c, lWordArray[k + 7], 10, 0x432aff97);
      c = II(c, d, a, b, lWordArray[k + 14], 15, 0xab9423a7);
      b = II(b, c, d, a, lWordArray[k + 5], 21, 0xfc93a039);
      a = II(a, b, c, d, lWordArray[k + 12], 6, 0x655b59c3);
      d = II(d, a, b, c, lWordArray[k + 3], 10, 0x8f0ccc92);
      c = II(c, d, a, b, lWordArray[k + 10], 15, 0xffeff47d);
      b = II(b, c, d, a, lWordArray[k + 1], 21, 0x85845dd1);
      a = II(a, b, c, d, lWordArray[k + 8], 6, 0x6fa87e4f);
      d = II(d, a, b, c, lWordArray[k + 15], 10, 0xfe2ce6e0);
      c = II(c, d, a, b, lWordArray[k + 6], 15, 0xa3014314);
      b = II(b, c, d, a, lWordArray[k + 13], 21, 0x4e0811a1);
      a = II(a, b, c, d, lWordArray[k + 4], 6, 0xf7537e82);
      d = II(d, a, b, c, lWordArray[k + 11], 10, 0xbd3af235);
      c = II(c, d, a, b, lWordArray[k + 2], 15, 0x2ad7d2bb);
      b = II(b, c, d, a, lWordArray[k + 9], 21, 0xeb86d391);

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
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; text-align: center; color: var(--text-dim); border: 1.5px dashed var(--border-color); border-radius: var(--radius-lg); margin-top: 6px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.6;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">No Identifiers Generated</span>
          <span style="font-size: 0.74rem; opacity: 0.7; margin-top: 2px;">Click "Generate" above or select a preset on the right</span>
        </div>
      `;
    }
  },

  renderHashEmptyState() {
    const container = document.getElementById('hash-results-list');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem 1.5rem; text-align: center; color: var(--text-dim); border: 1.5px dashed var(--border-color); border-radius: var(--radius-lg); margin-top: 6px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.6;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">No Hashes Computed</span>
          <span style="font-size: 0.74rem; opacity: 0.7; margin-top: 2px;">Type input text above or click a test payload on the right</span>
        </div>
      `;
    }
  }
};
