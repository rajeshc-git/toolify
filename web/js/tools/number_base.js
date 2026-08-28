// Number Base & Bitwise Converter Tool with dynamic bit representation and ASCII conversion
const NumberBaseTool = {
  init() {
    const dec = document.getElementById('base-dec');
    const hex = document.getElementById('base-hex');
    const bin = document.getElementById('base-bin');
    const oct = document.getElementById('base-oct');
    const txt = document.getElementById('base-text');

    if (!dec || !hex || !bin || !oct || !txt) return;

    dec.addEventListener('input', () => this.fromDec(dec.value));
    hex.addEventListener('input', () => this.fromHex(hex.value));
    bin.addEventListener('input', () => this.fromBin(bin.value));
    oct.addEventListener('input', () => this.fromOct(oct.value));
    txt.addEventListener('input', () => this.fromText(txt.value));

    // Start empty
    this.clearAll();
  },

  clearAll() {
    const dec = document.getElementById('base-dec');
    const hex = document.getElementById('base-hex');
    const bin = document.getElementById('base-bin');
    const oct = document.getElementById('base-oct');
    const txt = document.getElementById('base-text');
    const bitsView = document.getElementById('bitwise-bits-view');
    const bitHeader = document.querySelector('.bitwise-calc-section h3');

    const s8 = document.getElementById('base-signed-8');
    const s16 = document.getElementById('base-signed-16');
    const s32 = document.getElementById('base-signed-32');

    if (dec) dec.value = '';
    if (hex) hex.value = '';
    if (bin) bin.value = '';
    if (oct) oct.value = '';
    if (txt) txt.value = '';

    if (s8) s8.innerHTML = '<span style="color:var(--text-dim);">Signed:</span> - <br> <span style="color:var(--text-dim);">Unsigned:</span> -';
    if (s16) s16.innerHTML = '<span style="color:var(--text-dim);">Signed:</span> - <br> <span style="color:var(--text-dim);">Unsigned:</span> -';
    if (s32) s32.innerHTML = '<span style="color:var(--text-dim);">Signed:</span> - <br> <span style="color:var(--text-dim);">Unsigned:</span> -';

    if (bitsView) {
      bitsView.innerHTML = `<div style="font-size:0.72rem; color:var(--text-dim); font-style:italic;">Enter a number to visualize bits</div>`;
    }
    if (bitHeader) {
      bitHeader.innerText = 'Bitwise 32-Bit Representation';
    }
  },

  updateAll(val, sourceId = '') {
    const num = BigInt(val);

    const decEl = document.getElementById('base-dec');
    const hexEl = document.getElementById('base-hex');
    const binEl = document.getElementById('base-bin');
    const octEl = document.getElementById('base-oct');
    const textEl = document.getElementById('base-text');

    if (decEl && sourceId !== 'base-dec') decEl.value = num.toString(10);
    if (hexEl && sourceId !== 'base-hex') hexEl.value = num.toString(16).toUpperCase();
    if (binEl && sourceId !== 'base-bin') binEl.value = num.toString(2);
    if (octEl && sourceId !== 'base-oct') octEl.value = num.toString(8);
    
    // ASCII / UTF-8 Text conversion
    if (textEl && sourceId !== 'base-text') {
      const absNum = num < 0n ? -num : num;
      let hex = absNum.toString(16);
      if (hex.length % 2 !== 0) hex = '0' + hex;
      
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
      }
      
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        textEl.value = decoder.decode(new Uint8Array(bytes));
      } catch (e) {
        // Fallback to escape sequences
        let str = '';
        bytes.forEach(code => {
          if (code >= 32 && code <= 126) {
            str += String.fromCharCode(code);
          } else if (code > 0) {
            str += '\\x' + code.toString(16).padStart(2, '0');
          }
        });
        textEl.value = str;
      }
    }

    // Two's Complement Integer representations
    // 8-bit
    const val8 = Number(num & 0xFFn);
    const signed8 = val8 >= 128 ? val8 - 256 : val8;
    const s8 = document.getElementById('base-signed-8');
    if (s8) s8.innerHTML = `<span style="color:var(--text-dim);">Signed:</span> ${signed8} <br> <span style="color:var(--text-dim);">Unsigned:</span> ${val8}`;

    // 16-bit
    const val16 = Number(num & 0xFFFFn);
    const signed16 = val16 >= 32768 ? val16 - 65536 : val16;
    const s16 = document.getElementById('base-signed-16');
    if (s16) s16.innerHTML = `<span style="color:var(--text-dim);">Signed:</span> ${signed16} <br> <span style="color:var(--text-dim);">Unsigned:</span> ${val16}`;

    // 32-bit
    const val32 = Number(num & 0xFFFFFFFFn);
    const signed32 = val32 >= 2147483648 ? val32 - 4294967296 : val32;
    const s32 = document.getElementById('base-signed-32');
    if (s32) s32.innerHTML = `<span style="color:var(--text-dim);">Signed:</span> ${signed32} <br> <span style="color:var(--text-dim);">Unsigned:</span> ${val32}`;

    // Dynamic bit representation
    const bitLenStr = num.toString(2);
    const actualLen = bitLenStr.length;
    
    let padLen = 8;
    if (actualLen > 32) padLen = 64;
    else if (actualLen > 16) padLen = 32;
    else if (actualLen > 8) padLen = 16;
    
    const bitHeader = document.querySelector('.bitwise-calc-section h3');
    if (bitHeader) {
      bitHeader.innerText = `Bitwise ${padLen}-Bit Representation`;
    }

    let bits = '';
    if (num >= 0n) {
      bits = num.toString(2).padStart(padLen, '0');
      if (bits.length > padLen) {
        bits = bits.slice(-padLen);
      }
    } else {
      const mask = (1n << BigInt(padLen)) - 1n;
      bits = ((num) & mask).toString(2).padStart(padLen, '0');
    }

    const bitsView = document.getElementById('bitwise-bits-view');
    if (bitsView) {
      let html = '';
      for (let i = 0; i < padLen; i += 8) {
        const byte = bits.slice(i, i + 8);
        html += `<div class="byte-group" style="display:inline-flex; gap:2px; margin:4px 6px; padding:4px 8px; background:var(--bg-pane); border-radius:6px; border:1px solid var(--border-color);">
          ${byte.split('').map(b => `<span style="font-family:var(--font-mono); font-weight:700; color:${b==='1'?'var(--text-main)':'var(--text-dim)'};">${b}</span>`).join('')}
        </div>`;
      }
      bitsView.innerHTML = html;
    }
  },

  fromDec(v) {
    if (!v.trim()) {
      this.clearAll();
      return;
    }
    try {
      const clean = v.replace(/[^0-9-]/g, '');
      if (clean) this.updateAll(BigInt(clean), 'base-dec');
    } catch(e){}
  },

  fromHex(v) {
    if (!v.trim()) {
      this.clearAll();
      return;
    }
    try {
      const clean = v.replace(/[^0-9A-Fa-f]/g, '');
      if (clean) this.updateAll(BigInt('0x' + clean), 'base-hex');
    } catch(e){}
  },

  fromBin(v) {
    if (!v.trim()) {
      this.clearAll();
      return;
    }
    try {
      const clean = v.replace(/[^01]/g, '');
      if (clean) this.updateAll(BigInt('0b' + clean), 'base-bin');
    } catch(e){}
  },

  fromOct(v) {
    if (!v.trim()) {
      this.clearAll();
      return;
    }
    try {
      const clean = v.replace(/[^0-7]/g, '');
      if (clean) this.updateAll(BigInt('0o' + clean), 'base-oct');
    } catch(e){}
  },

  fromText(v) {
    if (!v) {
      this.clearAll();
      return;
    }
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(v);
      let hex = '';
      bytes.forEach(b => {
        hex += b.toString(16).padStart(2, '0');
      });
      if (hex) {
        this.updateAll(BigInt('0x' + hex), 'base-text');
      }
    } catch(e){}
  }
};
