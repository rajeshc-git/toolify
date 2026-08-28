// Color Converter & Palette Studio Tool
const ColorTool = {
  currentHex: '#8b5cf6',
  backgroundHex: '#ffffff',
  history: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
  presets: [
    '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9',
    '#06b6d4', '#10b981', '#22c55e', '#84cc16', '#eab308',
    '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#f43f5e',
    '#ffffff', '#cbd5e1', '#64748b', '#0f172a', '#000000'
  ],

  init() {
    const nativePicker = document.getElementById('native-color-picker');
    const bgPicker = document.getElementById('col-bg-picker');
    const bgHexInput = document.getElementById('col-bg-hex');
    const swapBtn = document.getElementById('col-swap-contrast-btn');

    const sliderH = document.getElementById('col-slider-h');
    const sliderS = document.getElementById('col-slider-s');
    const sliderL = document.getElementById('col-slider-l');

    const topRandomBtn = document.getElementById('col-random-top-btn');
    const actionRandomBtn = document.getElementById('col-action-random-btn');
    const actionResetBtn = document.getElementById('col-action-reset-btn');

    const inputHex = document.getElementById('col-input-hex');
    const inputRgb = document.getElementById('col-input-rgb');
    const inputRgba = document.getElementById('col-input-rgba');
    const inputHsl = document.getElementById('col-input-hsl');

    // Safe Event Listeners Binding
    if (nativePicker) {
      nativePicker.addEventListener('input', (e) => this.setColor(e.target.value));
    }

    // HSL Sliders
    if (sliderH && sliderS && sliderL) {
      const updateFromSliders = () => {
        const h = parseInt(sliderH.value);
        const s = parseInt(sliderS.value) / 100;
        const l = parseInt(sliderL.value) / 100;
        const hex = this.hslToHex(h, s, l);
        this.setColor(hex, false);
      };
      sliderH.addEventListener('input', updateFromSliders);
      sliderS.addEventListener('input', updateFromSliders);
      sliderL.addEventListener('input', updateFromSliders);
    }

    // Format Text Inputs listeners (allowing developers to type/paste color codes)
    if (inputHex) {
      inputHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#') && (val.length === 3 || val.length === 6)) val = '#' + val;
        if (/^#[0-9A-Fa-f]{3}$/.test(val)) {
          val = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
        }
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.setColor(val);
        }
      });
    }

    if (inputRgb) {
      inputRgb.addEventListener('input', (e) => {
        const parsed = this.parseRgb(e.target.value);
        if (parsed) {
          const hex = '#' + parsed.map(x => x.toString(16).padStart(2, '0')).join('');
          this.setColor(hex);
        }
      });
    }

    if (inputRgba) {
      inputRgba.addEventListener('input', (e) => {
        const parsed = this.parseRgb(e.target.value);
        if (parsed) {
          const hex = '#' + parsed.map(x => x.toString(16).padStart(2, '0')).join('');
          this.setColor(hex);
        }
      });
    }

    if (inputHsl) {
      inputHsl.addEventListener('input', (e) => {
        const parsed = this.parseHsl(e.target.value);
        if (parsed) {
          const hex = this.hslToHex(parsed[0], parsed[1], parsed[2]);
          this.setColor(hex);
        }
      });
    }

    // Contrast Background listeners
    if (bgPicker) {
      bgPicker.addEventListener('input', (e) => {
        this.backgroundHex = e.target.value;
        if (bgHexInput) bgHexInput.value = this.backgroundHex;
        this.updateContrastSection();
      });
    }

    if (bgHexInput) {
      bgHexInput.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          this.backgroundHex = val;
          if (bgPicker) bgPicker.value = val;
          this.updateContrastSection();
        }
      });
    }

    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        const temp = this.currentHex;
        this.setColor(this.backgroundHex);
        this.backgroundHex = temp;
        if (bgHexInput) bgHexInput.value = this.backgroundHex;
        if (bgPicker) bgPicker.value = this.backgroundHex;
        this.updateContrastSection();
      });
    }

    if (topRandomBtn) topRandomBtn.addEventListener('click', () => this.setRandomColor());
    if (actionRandomBtn) actionRandomBtn.addEventListener('click', () => this.setRandomColor());
    if (actionResetBtn) actionResetBtn.addEventListener('click', () => this.setColor('#8b5cf6'));

    this.renderPresetsGrid();
    if (nativePicker) {
      this.setColor('#8b5cf6');
    }
  },

  parseRgb(str) {
    const m = str.match(/rgba?\(?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) {
      const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
      if (r <= 255 && g <= 255 && b <= 255) return [r, g, b];
    }
    const clean = str.replace(/[rgba()]/gi, '').trim();
    const parts = clean.split(',').map(x => parseInt(x.trim(), 10));
    if (parts.length >= 3 && parts.every(x => !isNaN(x) && x >= 0 && x <= 255)) {
      return [parts[0], parts[1], parts[2]];
    }
    return null;
  },

  parseHsl(str) {
    const m = str.match(/hsla?\(?\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/i);
    if (m) {
      const h = parseInt(m[1]), s = parseInt(m[2]), l = parseInt(m[3]);
      if (h <= 360 && s <= 100 && l <= 100) return [h, s / 100, l / 100];
    }
    const clean = str.replace(/[hsla()%]/gi, '').trim();
    const parts = clean.split(',').map(x => parseFloat(x.trim()));
    if (parts.length >= 3 && parts.every(x => !isNaN(x) && x >= 0)) {
      const h = parts[0] % 360;
      const s = parts[1] > 1 ? parts[1] / 100 : parts[1];
      const l = parts[2] > 1 ? parts[2] / 100 : parts[2];
      return [h, Math.min(1, s), Math.min(1, l)];
    }
    return null;
  },

  setRandomColor() {
    const hex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    this.setColor(hex);
  },

  setColor(hex, updateSliders = true) {
    if (!hex || typeof hex !== 'string') return;
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return;
    this.currentHex = hex.toLowerCase();

    // Swatch preview & native picker
    const previewBox = document.getElementById('color-preview-box');
    const nativePicker = document.getElementById('native-color-picker');
    if (previewBox) previewBox.style.backgroundColor = this.currentHex;
    if (nativePicker) nativePicker.value = this.currentHex;

    // Convert colors
    const r = parseInt(this.currentHex.slice(1, 3), 16);
    const g = parseInt(this.currentHex.slice(3, 5), 16);
    const b = parseInt(this.currentHex.slice(5, 7), 16);

    const [h, s, l] = this.rgbToHsl(r, g, b);
    const [hsvH, hsvS, hsvV] = this.rgbToHsv(r, g, b);
    const [c, m, y, k] = this.rgbToCmyk(r, g, b);

    // Update Sliders
    if (updateSliders) {
      const sliderH = document.getElementById('col-slider-h');
      const sliderS = document.getElementById('col-slider-s');
      const sliderL = document.getElementById('col-slider-l');

      if (sliderH) sliderH.value = Math.round(h);
      if (sliderS) sliderS.value = Math.round(s * 100);
      if (sliderL) sliderL.value = Math.round(l * 100);
    }

    const lblH = document.getElementById('col-lbl-h');
    const lblS = document.getElementById('col-lbl-s');
    const lblL = document.getElementById('col-lbl-l');
    if (lblH) lblH.innerText = Math.round(h);
    if (lblS) lblS.innerText = `${Math.round(s * 100)}%`;
    if (lblL) lblL.innerText = `${Math.round(l * 100)}%`;

    // Dynamic Format Text inputs (avoid updating focused input to maintain cursor)
    const activeEl = document.activeElement;
    const inputHex = document.getElementById('col-input-hex');
    const inputRgb = document.getElementById('col-input-rgb');
    const inputRgba = document.getElementById('col-input-rgba');
    const inputHsl = document.getElementById('col-input-hsl');

    if (inputHex && activeEl !== inputHex) inputHex.value = this.currentHex;
    if (inputRgb && activeEl !== inputRgb) inputRgb.value = `rgb(${r}, ${g}, ${b})`;
    if (inputRgba && activeEl !== inputRgba) inputRgba.value = `rgba(${r}, ${g}, ${b}, 1)`;
    if (inputHsl && activeEl !== inputHsl) inputHsl.value = `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;

    // Other readonly outputs
    const fmtHsv = document.getElementById('col-fmt-hsv');
    const fmtCmyk = document.getElementById('col-fmt-cmyk');
    const fmtCssvar = document.getElementById('col-fmt-cssvar');
    const fmtTw = document.getElementById('col-fmt-tw');

    if (fmtHsv) fmtHsv.innerText = `hsv(${Math.round(hsvH)}, ${Math.round(hsvS * 100)}%, ${Math.round(hsvV * 100)}%)`;
    if (fmtCmyk) fmtCmyk.innerText = `cmyk(${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%)`;
    if (fmtCssvar) fmtCssvar.innerText = `--color-primary: ${this.currentHex};`;
    if (fmtTw) fmtTw.innerText = `bg-[${this.currentHex}]`;

    // Add to history
    if (!this.history.includes(this.currentHex)) {
      this.history.unshift(this.currentHex);
      if (this.history.length > 6) this.history.pop();
    }
    this.renderHistory();

    // Render Subsections
    this.renderHarmonies(h, s, l);
    this.renderTintsAndShades(h, s);
    this.updateContrastSection();
    this.renderColorblindSim(r, g, b);
  },

  renderHistory() {
    const container = document.getElementById('col-swatch-history');
    if (!container) return;
    container.innerHTML = this.history.map(hex => `
      <div onclick="ColorTool.setColor('${hex}')" style="width: 24px; height: 24px; border-radius: 50%; background: ${hex}; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.1s ease;" title="${hex}"></div>
    `).join('');
  },

  renderPresetsGrid() {
    const container = document.getElementById('col-preset-palette-grid');
    if (!container) return;
    container.innerHTML = this.presets.map(hex => `
      <div onclick="ColorTool.setColor('${hex}')" style="width: 100%; height: 22px; border-radius: 4px; background: ${hex}; border: 1px solid var(--border-color); cursor: pointer;" title="${hex}"></div>
    `).join('');
  },

  renderHarmonies(h, s, l) {
    const container = document.getElementById('col-harmonies-container');
    if (!container) return;

    const makeSwatch = (hue, isOriginal = false) => {
      const normalizedH = (hue + 360) % 360;
      const hex = this.hslToHex(normalizedH, s, l);
      const border = isOriginal ? '2px solid var(--c-purple)' : '1px solid var(--border-color)';
      return `<div onclick="ColorTool.setColor('${hex}')" style="width: 38px; height: 24px; border-radius: 6px; background: ${hex}; border: ${border}; cursor: pointer;" title="${hex}"></div>`;
    };

    container.innerHTML = `
      <div>
        <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); margin-bottom: 4px;">Complementary</div>
        <div style="display: flex; gap: 6px;">
          ${makeSwatch(h, true)}
          ${makeSwatch(h + 180)}
        </div>
      </div>
      <div>
        <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); margin-bottom: 4px;">Analogous</div>
        <div style="display: flex; gap: 6px;">
          ${makeSwatch(h - 30)}
          ${makeSwatch(h, true)}
          ${makeSwatch(h + 30)}
        </div>
      </div>
      <div>
        <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); margin-bottom: 4px;">Triadic</div>
        <div style="display: flex; gap: 6px;">
          ${makeSwatch(h, true)}
          ${makeSwatch(h + 120)}
          ${makeSwatch(h + 240)}
        </div>
      </div>
      <div>
        <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); margin-bottom: 4px;">Split-Complementary</div>
        <div style="display: flex; gap: 6px;">
          ${makeSwatch(h, true)}
          ${makeSwatch(h + 150)}
          ${makeSwatch(h + 210)}
        </div>
      </div>
    `;
  },

  renderTintsAndShades(h, s) {
    const strip = document.getElementById('col-tints-strip');
    if (!strip) return;

    let html = '';
    const lightnessSteps = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85];
    lightnessSteps.forEach(stepL => {
      const hex = this.hslToHex(h, s, stepL);
      html += `<div onclick="ColorTool.setColor('${hex}')" style="height: 36px; background: ${hex}; cursor: pointer;" title="${hex}"></div>`;
    });
    strip.innerHTML = html;
  },

  updateContrastSection() {
    const bgBox = document.getElementById('col-bg-box');
    const sampleBox = document.getElementById('col-contrast-sample-box');
    const badge = document.getElementById('col-contrast-ratio-badge');

    if (bgBox) bgBox.style.backgroundColor = this.backgroundHex;
    if (sampleBox) {
      sampleBox.style.backgroundColor = this.backgroundHex;
      sampleBox.style.color = this.currentHex;
    }

    const r1 = parseInt(this.currentHex.slice(1, 3), 16);
    const g1 = parseInt(this.currentHex.slice(3, 5), 16);
    const b1 = parseInt(this.currentHex.slice(5, 7), 16);

    const r2 = parseInt(this.backgroundHex.slice(1, 3), 16);
    const g2 = parseInt(this.backgroundHex.slice(3, 5), 16);
    const b2 = parseInt(this.backgroundHex.slice(5, 7), 16);

    const l1 = this.getLuminance(r1, g1, b1);
    const l2 = this.getLuminance(r2, g2, b2);

    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const ratioStr = ratio.toFixed(2);

    if (badge) badge.innerText = `Contrast Ratio ${ratioStr}:1`;

    this.updateWcagBadge('wcag-aa-normal', 'AA Normal Text', ratio >= 4.5, ratioStr);
    this.updateWcagBadge('wcag-aa-large', 'AA Large Text', ratio >= 3.0, ratioStr);
    this.updateWcagBadge('wcag-aaa-normal', 'AAA Normal Text', ratio >= 7.0, ratioStr);
    this.updateWcagBadge('wcag-aaa-large', 'AAA Large Text', ratio >= 4.5, ratioStr);
  },

  updateWcagBadge(id, label, pass, ratioStr) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.borderColor = pass ? '#10b981' : '#ef4444';
    el.style.background = pass ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)';
    el.innerHTML = `
      <div style="font-weight: 700; color: ${pass ? '#10b981' : '#ef4444'}; display: flex; align-items: center; justify-content: space-between;">
        <span>${label}</span>
        <span>${pass ? '✓ PASS' : '✕ FAIL'}</span>
      </div>
      <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px;">Contrast: ${ratioStr}:1</div>
    `;
  },

  renderColorblindSim(r, g, b) {
    const grid = document.getElementById('col-vision-sim-grid');
    if (!grid) return;

    const protan = this.applyColorMatrix(r, g, b, [0.56667, 0.43333, 0, 0.55833, 0.44167, 0, 0, 0.24167, 0.75833]);
    const deutan = this.applyColorMatrix(r, g, b, [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7]);
    const tritan = this.applyColorMatrix(r, g, b, [0.95, 0.05, 0, 0, 0.43333, 0.56667, 0, 0.475, 0.525]);
    const achroma = this.applyColorMatrix(r, g, b, [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114]);

    const simData = [
      { name: 'Protanopia (Red-Blind)', hex: protan },
      { name: 'Deuteranopia (Green-Blind)', hex: deutan },
      { name: 'Tritanopia (Blue-Blind)', hex: tritan },
      { name: 'Achromatopsia (Monochrome)', hex: achroma }
    ];

    grid.innerHTML = simData.map(item => `
      <div onclick="ColorTool.setColor('${item.hex}')" style="padding: 8px; background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-sm); text-align: center; cursor: pointer;" title="Set active to ${item.hex}">
        <div style="height: 32px; border-radius: 4px; background: ${item.hex}; border: 1px solid var(--border-color); margin-bottom: 6px;"></div>
        <div style="font-size: 0.68rem; font-weight: 700; color: var(--text-main);">${item.name}</div>
        <code style="font-size: 0.65rem; color: var(--text-dim);">${item.hex}</code>
      </div>
    `).join('');
  },

  applyColorMatrix(r, g, b, m) {
    const nr = Math.min(255, Math.max(0, Math.round(r * m[0] + g * m[1] + b * m[2])));
    const ng = Math.min(255, Math.max(0, Math.round(r * m[3] + g * m[4] + b * m[5])));
    const nb = Math.min(255, Math.max(0, Math.round(r * m[6] + g * m[7] + b * m[8])));
    return '#' + [nr, ng, nb].map(x => x.toString(16).padStart(2, '0')).join('');
  },

  getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  },

  rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s, l];
  },

  hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, (h / 360) + (1 / 3));
      g = hue2rgb(p, q, h / 360);
      b = hue2rgb(p, q, (h / 360) - (1 / 3));
    }
    const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h;
    const v = max;
    const s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h * 360, s, v];
  },

  rgbToCmyk(r, g, b) {
    let c = 1 - (r / 255);
    let m = 1 - (g / 255);
    let y = 1 - (b / 255);
    let k = Math.min(c, Math.min(m, y));
    if (k === 1) return [0, 0, 0, 1];
    return [(c - k) / (1 - k), (m - k) / (1 - k), (y - k) / (1 - k), k];
  }
};

window.ColorTool = ColorTool;
