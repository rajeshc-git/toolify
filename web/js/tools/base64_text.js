// Base64 Text & Hex Encoder / Decoder Tool
const Base64TextTool = {
  currentFmt: 'b64',
  _encodeJob: null,

  init() {
    const plain = document.getElementById('b64t-plain');
    const encoded = document.getElementById('b64t-encoded');
    const encodeBtn = document.getElementById('b64t-encode-btn');
    const decodeBtn = document.getElementById('b64t-decode-btn');
    const copyBtn = document.getElementById('b64t-copy-btn');

    if (!plain) return;

    encodeBtn.addEventListener('click', () => this.encode());
    decodeBtn.addEventListener('click', () => this.decode());

    // Debounced input handler — 200ms delay to avoid encoding on every keystroke
    const debouncedEncode = Perf.debounce(() => this.encode(), 200);
    plain.addEventListener('input', debouncedEncode);

    copyBtn.addEventListener('click', () => {
      if (encoded.value) App.copyToClipboard(encoded.value);
    });

    document.querySelectorAll('[data-b64-fmt]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-b64-fmt]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFmt = btn.dataset.b64Fmt;
        this.encode();
      });
    });
  },

  encode() {
    const str = document.getElementById('b64t-plain').value;
    const out = document.getElementById('b64t-encoded');
    if (!str) { out.value = ''; this._updateSizeBadge(0, 0); return; }

    try {
      const utf8Bytes = new TextEncoder().encode(str);
      const inputSize = utf8Bytes.length;

      // For large inputs (>50KB), process in chunks to avoid UI freeze
      if (inputSize > 50 * 1024 && (this.currentFmt === 'hex' || this.currentFmt === 'bin')) {
        this._chunkedEncode(utf8Bytes, out);
        return;
      }

      let result;
      if (this.currentFmt === 'b64') {
        result = btoa(unescape(encodeURIComponent(str)));
      } else if (this.currentFmt === 'urlsafe') {
        result = btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else if (this.currentFmt === 'hex') {
        result = Array.from(utf8Bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      } else if (this.currentFmt === 'bin') {
        result = Array.from(utf8Bytes).map(b => b.toString(2).padStart(8, '0')).join(' ');
      }
      out.value = result;
      this._updateSizeBadge(inputSize, result.length);
    } catch (err) {
      out.value = `Encoding Error: ${err.message}`;
    }
  },

  // Chunked encoding for hex/binary formats on large inputs
  async _chunkedEncode(utf8Bytes, out) {
    if (this._encodeJob) { this._encodeJob.cancelled = true; }
    const job = { cancelled: false };
    this._encodeJob = job;
    const inputSize = utf8Bytes.length;

    Perf.showProgressBar('b64t-encoded', 0);
    out.value = 'Processing…';

    const chunkSize = 4096;
    const parts = [];
    const fmt = this.currentFmt;

    for (let i = 0; i < inputSize; i += chunkSize) {
      if (job.cancelled) return;
      const end = Math.min(i + chunkSize, inputSize);
      const chunk = utf8Bytes.slice(i, end);

      if (fmt === 'hex') {
        parts.push(Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' '));
      } else {
        parts.push(Array.from(chunk).map(b => b.toString(2).padStart(8, '0')).join(' '));
      }

      Perf.showProgressBar('b64t-encoded', Math.round((end / inputSize) * 100));

      // Yield to event loop every chunk
      if (i + chunkSize < inputSize) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (!job.cancelled) {
      const result = parts.join(' ');
      out.value = result;
      this._updateSizeBadge(inputSize, result.length);
      Perf.hideProgressBar('b64t-encoded');
    }
    this._encodeJob = null;
  },

  _updateSizeBadge(inputBytes, outputLen) {
    let badge = document.getElementById('b64t-size-badge');
    if (!badge) {
      const toolbar = document.getElementById('b64t-encode-btn')?.parentElement;
      if (toolbar) {
        badge = document.createElement('span');
        badge.id = 'b64t-size-badge';
        badge.className = 'toolify-status-pill size-info';
        toolbar.appendChild(badge);
      }
    }
    if (badge) {
      if (inputBytes === 0) { badge.textContent = ''; return; }
      badge.textContent = `${Perf.formatBytes(inputBytes)} → ${Perf.formatBytes(outputLen)}`;
    }
  },

  decode() {
    const str = document.getElementById('b64t-encoded').value.trim();
    const plain = document.getElementById('b64t-plain');
    if (!str) return;

    try {
      if (this.currentFmt === 'b64' || this.currentFmt === 'urlsafe') {
        let clean = str.replace(/-/g, '+').replace(/_/g, '/');
        while (clean.length % 4) clean += '=';
        const binary = atob(clean);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        plain.value = new TextDecoder().decode(bytes);
      } else if (this.currentFmt === 'hex') {
        const hex = str.replace(/\s+/g, '');
        const matches = hex.match(/.{1,2}/g) || [];
        const bytes = new Uint8Array(matches.map(byte => parseInt(byte, 16)));
        plain.value = new TextDecoder().decode(bytes);
      } else if (this.currentFmt === 'bin') {
        const binArr = str.split(/\s+/).filter(Boolean);
        const bytes = new Uint8Array(binArr.map(b => parseInt(b, 2)));
        plain.value = new TextDecoder().decode(bytes);
      }
      this._updateSizeBadge(str.length, plain.value.length);
      App.showToast('Decoded to plain text');
    } catch (err) {
      App.showToast(`Decoding Error: ${err.message}`, 'error');
    }
  }
};
