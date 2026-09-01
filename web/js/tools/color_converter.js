// Color Converter, Image Palette Extractor & Gradient Studio Tool
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

  // Extracted Palette State
  extractedPalette: ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'],
  draggedSwatchIndex: null,

  // Gradient State
  gradientType: 'linear', // 'linear', 'radial', 'conic'
  gradientAngle: 135,
  gradientStops: [
    { color: '#8b5cf6', pos: 0 },
    { color: '#06b6d4', pos: 100 }
  ],

  switchTab(tab) {
    document.querySelectorAll('#color-studio-tabs button').forEach(b => {
      if (b.dataset.colorTab === tab) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    ['converter', 'extractor', 'gradient', 'contrast'].forEach(t => {
      const pane = document.getElementById(`col-tab-pane-${t}`);
      if (pane) {
        pane.style.display = (t === tab) ? 'block' : 'none';
      }
    });
  },

  init() {
    this.switchTab('converter');


    // Native Color Picker & Inputs
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

    // Format Text Inputs listeners
    if (inputHex) {
      inputHex.addEventListener('input', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#') && (val.length === 3 || val.length === 6)) val = '#' + val;
        if (/^#[0-9A-Fa-f]{3}$/.test(val)) {
          val = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
        }
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) this.setColor(val);
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

    // Image Dropzone Initialization
    this.initImageDropzone();

    // Gradient Initialization
    this.renderGradientStops();
    this.updateGradientPreview();

    this.renderPresetsGrid();
    this.renderExtractedPalette();
    this.setColor('#8b5cf6');
  },

  async openEyedropper() {
    if (window.EyeDropper) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          this.setColor(result.sRGBHex);
          App.showToast(`Picked color: ${result.sRGBHex}`);
        }
      } catch (e) {
        // User canceled
      }
    } else {
      App.showToast('EyeDropper API is available in modern Chromium browsers', 'info');
    }
  },

  // ==========================================
  // IMAGE PALETTE EXTRACTOR (DRAG & DROP WIZARD)
  // ==========================================
  initImageDropzone() {
    const dropzone = document.getElementById('color-img-dropzone');
    const fileInput = document.getElementById('color-img-file-input');
    const canvas = document.getElementById('color-extractor-canvas');
    const loupe = document.getElementById('color-pixel-loupe');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.processImageFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.processImageFile(e.target.files[0]);
        fileInput.value = '';
      }
    });

    // Canvas Loupe / Pixel Eyedropper on Hover & Click
    if (canvas && loupe) {
      const getPixelColor = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        return '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('');
      };

      canvas.addEventListener('mousemove', (e) => {
        const hex = getPixelColor(e);
        loupe.style.display = 'block';
        loupe.style.left = `${e.layerX}px`;
        loupe.style.top = `${e.layerY}px`;
        loupe.style.backgroundColor = hex;
      });

      canvas.addEventListener('mouseleave', () => {
        loupe.style.display = 'none';
      });

      canvas.addEventListener('click', (e) => {
        const hex = getPixelColor(e);
        this.setColor(hex);
        App.showToast(`Selected pixel color: ${hex}`);
      });
    }
  },

  processImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      App.showToast('Please upload an image file (PNG, JPG, WebP, SVG)', 'error');
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      this.extractPaletteFromImage(img);
    };
    img.src = url;
  },

  loadSampleImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 400, 260);
    grad.addColorStop(0, '#ec4899');
    grad.addColorStop(0.3, '#8b5cf6');
    grad.addColorStop(0.6, '#3b82f6');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 260);

    ctx.beginPath();
    ctx.arc(200, 100, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    const img = new Image();
    img.onload = () => this.extractPaletteFromImage(img);
    img.src = canvas.toDataURL();
  },

  extractPaletteFromImage(img) {
    const canvas = document.getElementById('color-extractor-canvas');
    const previewArea = document.getElementById('color-img-preview-area');
    if (!canvas || !previewArea) return;

    const maxDim = 600;
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    previewArea.style.display = 'block';

    const imgData = ctx.getImageData(0, 0, w, h).data;
    const colorMap = {};
    const step = 4 * 6;

    for (let i = 0; i < imgData.length; i += step) {
      const alpha = imgData[i + 3];
      if (alpha < 128) continue;

      const r = Math.round(imgData[i] / 24) * 24;
      const g = Math.round(imgData[i + 1] / 24) * 24;
      const b = Math.round(imgData[i + 2] / 24) * 24;
      const key = `${r},${g},${b}`;
      colorMap[key] = (colorMap[key] || 0) + 1;
    }

    const sorted = Object.entries(colorMap)
      .sort((a, b) => b[1] - a[1])
      .map(entry => {
        const [r, g, b] = entry[0].split(',').map(Number);
        return '#' + [Math.min(255, r), Math.min(255, g), Math.min(255, b)].map(c => c.toString(16).padStart(2, '0')).join('');
      });

    const palette = [];
    for (const hex of sorted) {
      if (!palette.some(p => this.colorDistance(p, hex) < 35)) {
        palette.push(hex);
      }
      if (palette.length >= 6) break;
    }

    if (palette.length > 0) {
      this.extractedPalette = palette;
      this.renderExtractedPalette();
      App.showToast(`Extracted ${palette.length} colors from image`);
    }
  },

  colorDistance(hex1, hex2) {
    const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
  },

  renderExtractedPalette() {
    const grid = document.getElementById('color-extracted-palette-grid');
    const countEl = document.getElementById('col-extracted-count');
    if (!grid) return;

    if (countEl) countEl.innerText = this.extractedPalette.length;

    grid.innerHTML = this.extractedPalette.map((hex, i) => `
      <div class="palette-swatch-card" draggable="true"
           ondragstart="ColorTool.onSwatchDragStart(event, ${i})"
           ondragover="ColorTool.onSwatchDragOver(event, ${i})"
           ondragleave="ColorTool.onSwatchDragLeave(event)"
           ondrop="ColorTool.onSwatchDrop(event, ${i})"
           onclick="ColorTool.setColor('${hex}')">
        
        <div class="palette-color-block" style="background-color: ${hex};" title="Click to use ${hex}"></div>
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 800; font-size: 0.72rem; color: var(--text-main); font-family: var(--font-mono);">${hex.toUpperCase()}</span>
          <button class="url-action-icon-btn" onclick="event.stopPropagation(); ColorTool.removeExtractedSwatch(${i})" title="Remove">×</button>
        </div>
      </div>
    `).join('');
  },

  onSwatchDragStart(e, index) {
    this.draggedSwatchIndex = index;
    e.dataTransfer.setData('text/plain', index);
    setTimeout(() => {
      const el = e.target.closest('.palette-swatch-card');
      if (el) el.classList.add('dragging');
    }, 0);
  },

  onSwatchDragOver(e, index) {
    e.preventDefault();
    const card = e.target.closest('.palette-swatch-card');
    if (card && this.draggedSwatchIndex !== index) {
      card.classList.add('drag-over');
    }
  },

  onSwatchDragLeave(e) {
    const card = e.target.closest('.palette-swatch-card');
    if (card) card.classList.remove('drag-over');
  },

  onSwatchDrop(e, targetIndex) {
    e.preventDefault();
    document.querySelectorAll('.palette-swatch-card').forEach(c => c.classList.remove('drag-over', 'dragging'));
    if (this.draggedSwatchIndex === null || this.draggedSwatchIndex === targetIndex) return;

    const moved = this.extractedPalette.splice(this.draggedSwatchIndex, 1)[0];
    this.extractedPalette.splice(targetIndex, 0, moved);
    this.draggedSwatchIndex = null;
    this.renderExtractedPalette();
  },

  removeExtractedSwatch(index) {
    this.extractedPalette.splice(index, 1);
    this.renderExtractedPalette();
  },

  exportPalette(format) {
    if (this.extractedPalette.length === 0) return;

    if (format === 'css') {
      const css = `:root {\n` + this.extractedPalette.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n') + `\n}`;
      App.copyToClipboard(css);
      App.showToast('Copied palette CSS variables to clipboard!');
    } else if (format === 'tailwind') {
      const tw = `colors: {\n` + this.extractedPalette.map((hex, i) => `  'palette-${i + 1}': '${hex}',`).join('\n') + `\n}`;
      App.copyToClipboard(tw);
      App.showToast('Copied Tailwind color config to clipboard!');
    } else if (format === 'json') {
      const json = JSON.stringify(this.extractedPalette, null, 2);
      App.copyToClipboard(json);
      App.showToast('Copied Palette JSON array to clipboard!');
    }
  },

  // ==========================================
  // GRADIENT STUDIO
  // ==========================================
  setGradientType(type) {
    this.gradientType = type;
    ['linear', 'radial', 'conic'].forEach(t => {
      const btn = document.getElementById(`grad-type-${t}`);
      if (btn) {
        btn.className = (t === type) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      }
    });
    this.updateGradientPreview();
  },

  updateGradientAngle(val) {
    this.gradientAngle = parseInt(val);
    const angleEl = document.getElementById('grad-angle-val');
    if (angleEl) angleEl.innerText = `${this.gradientAngle}°`;
    this.updateGradientPreview();
  },

  renderGradientStops() {
    const list = document.getElementById('col-gradient-stops-list');
    if (!list) return;

    list.innerHTML = this.gradientStops.map((stop, i) => `
      <div style="background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 6px 10px; display: flex; align-items: center; gap: 8px;">
        <input type="color" value="${stop.color}" oninput="ColorTool.gradientStops[${i}].color = this.value; ColorTool.updateGradientPreview();" style="width: 24px; height: 24px; border: none; border-radius: 4px; cursor: pointer;">
        <input type="number" min="0" max="100" value="${stop.pos}" oninput="ColorTool.gradientStops[${i}].pos = Math.max(0, Math.min(100, parseInt(this.value) || 0)); ColorTool.updateGradientPreview();" style="width: 50px; font-size: 0.76rem; font-weight: 700;" class="input-text">
        <span style="font-size: 0.72rem; color: var(--text-dim);">%</span>
        ${this.gradientStops.length > 2 ? `
          <button class="url-action-icon-btn" onclick="ColorTool.gradientStops.splice(${i}, 1); ColorTool.renderGradientStops(); ColorTool.updateGradientPreview();" title="Remove stop">×</button>
        ` : ''}
      </div>
    `).join('');
  },

  addGradientStop() {
    const newPos = Math.round(100 / (this.gradientStops.length + 1));
    const randomHex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    this.gradientStops.push({ color: randomHex, pos: newPos });
    this.gradientStops.sort((a, b) => a.pos - b.pos);
    this.renderGradientStops();
    this.updateGradientPreview();
  },

  randomizeGradient() {
    const randomHex1 = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const randomHex2 = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    this.gradientStops = [
      { color: randomHex1, pos: 0 },
      { color: randomHex2, pos: 100 }
    ];
    this.gradientAngle = Math.floor(Math.random() * 360);
    const slider = document.getElementById('grad-angle-slider');
    if (slider) slider.value = this.gradientAngle;
    const angleEl = document.getElementById('grad-angle-val');
    if (angleEl) angleEl.innerText = `${this.gradientAngle}°`;
    this.renderGradientStops();
    this.updateGradientPreview();
  },

  updateGradientPreview() {
    const preview = document.getElementById('col-gradient-preview-canvas');
    const cssOutput = document.getElementById('col-gradient-css-output');
    if (!preview || !cssOutput) return;

    const stopsStr = this.gradientStops.map(s => `${s.color} ${s.pos}%`).join(', ');
    let cssGrad = '';

    if (this.gradientType === 'linear') {
      cssGrad = `linear-gradient(${this.gradientAngle}deg, ${stopsStr})`;
    } else if (this.gradientType === 'radial') {
      cssGrad = `radial-gradient(circle, ${stopsStr})`;
    } else if (this.gradientType === 'conic') {
      cssGrad = `conic-gradient(from ${this.gradientAngle}deg, ${stopsStr})`;
    }

    preview.style.background = cssGrad;
    cssOutput.innerText = `background: ${cssGrad};`;
  },

  // ==========================================
  // CORE COLOR CONVERSION & HARMONIES
  // ==========================================
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
    if (lblH) lblH.innerText = `${Math.round(h)}°`;
    if (lblS) lblS.innerText = `${Math.round(s * 100)}%`;
    if (lblL) lblL.innerText = `${Math.round(l * 100)}%`;

    // Update Inputs & Codes
    const inputHex = document.getElementById('col-input-hex');
    const inputRgb = document.getElementById('col-input-rgb');
    const inputRgba = document.getElementById('col-input-rgba');
    const inputHsl = document.getElementById('col-input-hsl');

    if (inputHex && document.activeElement !== inputHex) inputHex.value = this.currentHex.toUpperCase();
    if (inputRgb && document.activeElement !== inputRgb) inputRgb.value = `rgb(${r}, ${g}, ${b})`;
    if (inputRgba && document.activeElement !== inputRgba) inputRgba.value = `rgba(${r}, ${g}, ${b}, 1)`;
    if (inputHsl && document.activeElement !== inputHsl) inputHsl.value = `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;

    const fmtHsv = document.getElementById('col-fmt-hsv');
    const fmtCmyk = document.getElementById('col-fmt-cmyk');
    const fmtCssVar = document.getElementById('col-fmt-cssvar');
    const fmtTw = document.getElementById('col-fmt-tw');

    if (fmtHsv) fmtHsv.innerText = `hsv(${Math.round(hsvH)}, ${Math.round(hsvS * 100)}%, ${Math.round(hsvV * 100)}%)`;
    if (fmtCmyk) fmtCmyk.innerText = `cmyk(${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%)`;
    if (fmtCssVar) fmtCssVar.innerText = `--color-primary: ${this.currentHex};`;
    if (fmtTw) fmtTw.innerText = `bg-[${this.currentHex}]`;

    // Update Swatch History
    if (!this.history.includes(this.currentHex)) {
      this.history.unshift(this.currentHex);
      if (this.history.length > 10) this.history.pop();
      this.renderHistory();
    }

    this.renderHarmonies(h, s, l);
    this.renderTintsAndShades(h, s);
    this.updateContrastSection();
    this.renderVisionSimulation(r, g, b);
  },

  renderHistory() {
    const historyContainer = document.getElementById('col-swatch-history');
    if (!historyContainer) return;
    historyContainer.innerHTML = this.history.map(hex => `
      <div onclick="ColorTool.setColor('${hex}')" style="width: 24px; height: 24px; border-radius: 4px; background: ${hex}; cursor: pointer; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);" title="${hex}"></div>
    `).join('');
  },

  renderPresetsGrid() {
    const presetsContainer = document.getElementById('col-preset-palette-grid');
    if (!presetsContainer) return;
    presetsContainer.innerHTML = this.presets.map(hex => `
      <div onclick="ColorTool.setColor('${hex}')" style="aspect-ratio: 1; border-radius: 4px; background: ${hex}; cursor: pointer; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);" title="${hex}"></div>
    `).join('');
  },

  renderHarmonies(h, s, l) {
    const container = document.getElementById('col-harmonies-container');
    if (!container) return;

    const harmonies = [
      { name: 'Complementary', hues: [h, (h + 180) % 360] },
      { name: 'Analogous', hues: [(h + 330) % 360, h, (h + 30) % 360] },
      { name: 'Triadic', hues: [h, (h + 120) % 360, (h + 240) % 360] },
      { name: 'Split-Complementary', hues: [h, (h + 150) % 360, (h + 210) % 360] },
      { name: 'Tetradic (Rectangle)', hues: [h, (h + 60) % 360, (h + 180) % 360, (h + 240) % 360] }
    ];

    container.innerHTML = harmonies.map(harm => `
      <div>
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">${harm.name}</div>
        <div style="display: flex; gap: 8px;">
          ${harm.hues.map(hue => {
            const hex = this.hslToHex(hue, s, l);
            return `
              <div onclick="ColorTool.setColor('${hex}')" style="flex: 1; height: 38px; border-radius: var(--radius-sm); background: ${hex}; cursor: pointer; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 800; color: ${l > 0.6 ? '#000' : '#fff'}; box-shadow: var(--shadow-sm);" title="Click to use ${hex}">
                ${hex.toUpperCase()}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  },

  renderTintsAndShades(h, s) {
    const container = document.getElementById('col-tints-strip');
    if (!container) return;

    const lightnesses = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.96];
    container.innerHTML = lightnesses.map(l => {
      const hex = this.hslToHex(h, s, l);
      return `
        <div onclick="ColorTool.setColor('${hex}')" style="height: 38px; background: ${hex}; cursor: pointer; border: 1px solid rgba(0,0,0,0.08); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700; color: ${l > 0.55 ? '#000' : '#fff'};" title="${hex}">
          ${Math.round(l * 100)}%
        </div>
      `;
    }).join('');
  },

  updateContrastSection() {
    const ratioBadge = document.getElementById('col-contrast-ratio-badge');
    const sampleBox = document.getElementById('col-contrast-sample-box');
    const bgBox = document.getElementById('col-bg-box');

    if (bgBox) bgBox.style.backgroundColor = this.backgroundHex;

    const fgLum = this.getLuminance(this.currentHex);
    const bgLum = this.getLuminance(this.backgroundHex);
    const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
    const formattedRatio = ratio.toFixed(2);

    if (ratioBadge) ratioBadge.innerText = `Contrast Ratio ${formattedRatio}:1`;
    if (sampleBox) {
      sampleBox.style.backgroundColor = this.backgroundHex;
      sampleBox.style.color = this.currentHex;
    }

    const setBadge = (id, passes) => {
      const el = document.getElementById(id);
      if (!el) return;
      const statusSpan = el.querySelector('.status-val');
      if (statusSpan) {
        statusSpan.innerText = passes ? 'PASS' : 'FAIL';
        statusSpan.style.color = passes ? '#10b981' : '#ef4444';
        statusSpan.style.fontWeight = '800';
      }
    };

    setBadge('wcag-aa-normal', ratio >= 4.5);
    setBadge('wcag-aa-large', ratio >= 3.0);
    setBadge('wcag-aaa-normal', ratio >= 7.0);
    setBadge('wcag-aaa-large', ratio >= 4.5);
  },

  getLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const a = [r, g, b].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  },

  renderVisionSimulation(r, g, b) {
    const grid = document.getElementById('col-vision-sim-grid');
    if (!grid) return;

    // Simulation transformation matrices
    const protanopia = [0.56667 * r + 0.43333 * g, 0.55833 * r + 0.44167 * g, 0.24167 * g + 0.75833 * b];
    const deuteranopia = [0.625 * r + 0.375 * g, 0.7 * r + 0.3 * g, 0.3 * g + 0.7 * b];
    const tritanopia = [0.95 * r + 0.05 * g, 0.43333 * g + 0.56667 * b, 0.475 * g + 0.525 * b];
    const achromatopsia = Array(3).fill(Math.round(0.299 * r + 0.587 * g + 0.114 * b));

    const sims = [
      { name: 'Normal Vision', rgb: [r, g, b] },
      { name: 'Protanopia (Red-Blind)', rgb: protanopia },
      { name: 'Deuteranopia (Green-Blind)', rgb: deuteranopia },
      { name: 'Tritanopia (Blue-Blind)', rgb: tritanopia },
      { name: 'Achromatopsia (Monochrome)', rgb: achromatopsia }
    ];

    grid.innerHTML = sims.map(s => {
      const hex = '#' + s.rgb.map(x => Math.min(255, Math.max(0, Math.round(x))).toString(16).padStart(2, '0')).join('');
      return `
        <div style="background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px;">
          <div style="height: 36px; border-radius: 4px; background: ${hex}; margin-bottom: 6px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);"></div>
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-main);">${s.name}</div>
          <div style="font-size: 0.65rem; color: var(--text-dim); font-family: var(--font-mono);">${hex.toUpperCase()}</div>
        </div>
      `;
    }).join('');
  },

  // Helper Math Conversions
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
    h = h % 360;
    if (h < 0) h += 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;

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
    c = (c - k) / (1 - k);
    m = (m - k) / (1 - k);
    y = (y - k) / (1 - k);
    return [c, m, y, k];
  }
};

window.ColorTool = ColorTool;
