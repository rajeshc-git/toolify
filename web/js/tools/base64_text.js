// Base64 Text & Hex Encoder / Decoder Tool
const Base64TextTool = {
  currentFmt: 'b64',

  init() {
    const plain = document.getElementById('b64t-plain');
    const encoded = document.getElementById('b64t-encoded');
    const encodeBtn = document.getElementById('b64t-encode-btn');
    const decodeBtn = document.getElementById('b64t-decode-btn');
    const copyBtn = document.getElementById('b64t-copy-btn');

    if (!plain) return;

    encodeBtn.addEventListener('click', () => this.encode());
    decodeBtn.addEventListener('click', () => this.decode());
    plain.addEventListener('input', () => this.encode());

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
    if (!str) { out.value = ''; return; }

    try {
      const utf8Bytes = new TextEncoder().encode(str);
      if (this.currentFmt === 'b64') {
        out.value = btoa(unescape(encodeURIComponent(str)));
      } else if (this.currentFmt === 'urlsafe') {
        out.value = btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else if (this.currentFmt === 'hex') {
        out.value = Array.from(utf8Bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      } else if (this.currentFmt === 'bin') {
        out.value = Array.from(utf8Bytes).map(b => b.toString(2).padStart(8, '0')).join(' ');
      }
    } catch (err) {
      out.value = `Encoding Error: ${err.message}`;
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
        plain.value = decodeURIComponent(escape(atob(clean)));
      } else if (this.currentFmt === 'hex') {
        const hex = str.replace(/\s+/g, '');
        const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        plain.value = new TextDecoder().decode(bytes);
      } else if (this.currentFmt === 'bin') {
        const binArr = str.split(/\s+/).filter(Boolean);
        const bytes = new Uint8Array(binArr.map(b => parseInt(b, 2)));
        plain.value = new TextDecoder().decode(bytes);
      }
      App.showToast('Decoded to plain text');
    } catch (err) {
      App.showToast(`Decoding Error: ${err.message}`, 'error');
    }
  }
};
