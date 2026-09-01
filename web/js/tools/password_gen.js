// Password Generator Tool with Clean Single-Line Sets & Empty State
const PasswordTool = {
  currentBatch: [],
  isGenerated: false,

  init() {
    const slider = document.getElementById('pwd-len-slider');
    const lenBadge = document.getElementById('pwd-len-badge');

    if (!slider) return;

    // Default 16 chars
    slider.value = 16;
    if (lenBadge) lenBadge.innerText = 16;

    ['pwd-opt-lower', 'pwd-opt-upper', 'pwd-opt-nums', 'pwd-opt-symbols', 'pwd-opt-exclude-ambig'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = true; // Checked by default
        el.addEventListener('change', () => {
          if (this.isGenerated) this.generate();
        });
      }
    });

    slider.addEventListener('input', (e) => {
      if (lenBadge) lenBadge.innerText = e.target.value;
      this.updatePresetActiveState(parseInt(e.target.value, 10));
      if (this.isGenerated) this.generate();
    });

    // Start with clean empty state by default
    this.clearAll();
  },

  applyPreset(len, lower, upper, nums, syms, excludeAmbig) {
    const slider = document.getElementById('pwd-len-slider');
    const lenBadge = document.getElementById('pwd-len-badge');
    const optLower = document.getElementById('pwd-opt-lower');
    const optUpper = document.getElementById('pwd-opt-upper');
    const optNums = document.getElementById('pwd-opt-nums');
    const optSyms = document.getElementById('pwd-opt-symbols');
    const optAmbig = document.getElementById('pwd-opt-exclude-ambig');

    if (slider) slider.value = len;
    if (lenBadge) lenBadge.innerText = len;
    if (optLower) optLower.checked = lower;
    if (optUpper) optUpper.checked = upper;
    if (optNums) optNums.checked = nums;
    if (optSyms) optSyms.checked = syms;
    if (optAmbig) optAmbig.checked = excludeAmbig;

    this.updatePresetActiveState(len);
    this.generate(true);
  },

  updatePresetActiveState(len) {
    document.querySelectorAll('.pwd-preset-chip').forEach(chip => {
      const text = chip.textContent || '';
      chip.classList.toggle('active', text.includes(`(${len})`));
    });
  },

  clearAll() {
    this.isGenerated = false;
    this.currentBatch = [];

    const outInput = document.getElementById('pwd-output');
    const heroDisplay = document.getElementById('pwd-hero-display');
    const suggestionsList = document.getElementById('pwd-suggestions-list');
    const strengthContainer = document.getElementById('pwd-strength-container');
    const emptyBadge = document.getElementById('pwd-empty-badge');
    const genBtnText = document.getElementById('pwd-gen-btn-text');

    if (outInput) outInput.value = '';
    if (heroDisplay) {
      heroDisplay.innerHTML = '<span class="pwd-placeholder-text">Click "Generate Password" below</span>';
    }
    if (emptyBadge) {
      emptyBadge.innerText = 'Ready';
      emptyBadge.className = 'pwd-empty-tag';
    }
    if (genBtnText) genBtnText.innerText = 'Generate Password';
    if (strengthContainer) strengthContainer.style.display = 'none';

    if (suggestionsList) {
      suggestionsList.innerHTML = `
        <div class="pwd-empty-placeholder-card">
          Click <strong>"Generate Password"</strong> to create 4 alternative candidate keys.
        </div>
      `;
    }
  },

  formatColoredPassword(pwd) {
    let html = '';
    for (let i = 0; i < pwd.length; i++) {
      const char = pwd[i];
      if (/[0-9]/.test(char)) {
        html += `<span class="pwd-char-digit">${App.escapeHtml(char)}</span>`;
      } else if (/[A-Z]/.test(char)) {
        html += `<span class="pwd-char-upper">${App.escapeHtml(char)}</span>`;
      } else if (/[a-z]/.test(char)) {
        html += `<span class="pwd-char-lower">${App.escapeHtml(char)}</span>`;
      } else {
        html += `<span class="pwd-char-symbol">${App.escapeHtml(char)}</span>`;
      }
    }
    return html;
  },

  copyMainPassword() {
    const outInput = document.getElementById('pwd-output');
    const copyBtn = document.getElementById('pwd-copy-btn');
    const heroBox = document.getElementById('pwd-hero-box');

    if (!outInput || !outInput.value) {
      App.showToast('Please generate a password first', 'error');
      return;
    }

    const val = outInput.value;
    if (val.startsWith('Please select')) return;

    // Use unified App clipboard utility matching all other tools
    App.copyToClipboard(val, copyBtn);

    // Visual feedback on hero box
    if (heroBox) {
      heroBox.style.borderColor = 'var(--c-green, #10b981)';
      setTimeout(() => {
        heroBox.style.borderColor = '';
      }, 600);
    }
  },

  calculateCrackTime(entropy) {
    if (entropy < 28) return 'Instant';
    if (entropy < 36) return 'Few seconds';
    if (entropy < 45) return 'Few hours';
    if (entropy < 55) return 'Few months';
    if (entropy < 70) return '~100 Years';
    if (entropy < 90) return '~100,000 Years';
    if (entropy < 120) return '~3.4 Trillion Years';
    return '~Centuries (Unbreakable)';
  },

  generate(isManualClick = false) {
    const lenInput = document.getElementById('pwd-len-slider');
    const outInput = document.getElementById('pwd-output');
    const heroDisplay = document.getElementById('pwd-hero-display');
    const suggestionsList = document.getElementById('pwd-suggestions-list');
    const strengthContainer = document.getElementById('pwd-strength-container');
    const emptyBadge = document.getElementById('pwd-empty-badge');
    const genBtnText = document.getElementById('pwd-gen-btn-text');

    if (!lenInput || !outInput) return;

    const len = parseInt(lenInput.value, 10);
    const useLower = document.getElementById('pwd-opt-lower')?.checked;
    const useUpper = document.getElementById('pwd-opt-upper')?.checked;
    const useNums = document.getElementById('pwd-opt-nums')?.checked;
    const useSyms = document.getElementById('pwd-opt-symbols')?.checked;
    const excludeAmbig = document.getElementById('pwd-opt-exclude-ambig')?.checked;

    let charset = '';
    if (useLower) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (useUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useNums) charset += '0123456789';
    if (useSyms) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (excludeAmbig) {
      // Exclude visually confusing characters: l, I, 1, O, 0, o
      charset = charset.replace(/[lI1O0o]/g, '');
    }

    if (!charset) {
      outInput.value = '';
      if (heroDisplay) heroDisplay.innerHTML = '<span style="color:var(--c-red); font-size: 0.88rem;">Please select at least one character set</span>';
      if (suggestionsList) suggestionsList.innerHTML = '<div class="pwd-empty-placeholder-card">Select options on the right to generate passwords</div>';
      if (strengthContainer) strengthContainer.style.display = 'none';
      return;
    }

    this.isGenerated = true;

    // Generate main hero password
    const mainPwd = this.generateRandomString(charset, len);
    outInput.value = mainPwd;
    if (heroDisplay) {
      heroDisplay.innerHTML = this.formatColoredPassword(mainPwd);
    }
    if (genBtnText) genBtnText.innerText = 'Regenerate';
    if (emptyBadge) {
      emptyBadge.innerText = 'Active';
      emptyBadge.style.color = 'var(--c-purple)';
    }

    // Show and Calculate Entropy = len * log2(charset.length)
    if (strengthContainer) strengthContainer.style.display = 'flex';
    const entropy = Math.round(len * Math.log2(charset.length));
    const entropyEl = document.getElementById('pwd-entropy-text');
    const strengthEl = document.getElementById('pwd-strength-text');
    const fillEl = document.getElementById('pwd-strength-fill');
    const crackTimeEl = document.getElementById('pwd-crack-time');

    if (entropyEl) entropyEl.innerText = `${entropy} bits entropy`;
    if (crackTimeEl) crackTimeEl.innerText = `Crack time: ${this.calculateCrackTime(entropy)}`;

    if (strengthEl && fillEl) {
      if (entropy < 36) {
        strengthEl.innerText = 'Very Weak';
        strengthEl.style.color = 'var(--c-red, #ef4444)';
        fillEl.style.width = '20%';
        fillEl.style.backgroundColor = 'var(--c-red, #ef4444)';
      } else if (entropy < 55) {
        strengthEl.innerText = 'Moderate';
        strengthEl.style.color = 'var(--c-orange, #f97316)';
        fillEl.style.width = '45%';
        fillEl.style.backgroundColor = 'var(--c-orange, #f97316)';
      } else if (entropy < 80) {
        strengthEl.innerText = 'Strong';
        strengthEl.style.color = 'var(--c-blue, #0284c7)';
        fillEl.style.width = '75%';
        fillEl.style.backgroundColor = 'var(--c-blue, #0284c7)';
      } else {
        strengthEl.innerText = 'Very Strong';
        strengthEl.style.color = 'var(--c-green, #10b981)';
        fillEl.style.width = '100%';
        fillEl.style.backgroundColor = 'var(--c-green, #10b981)';
      }
    }

    // Generate 4 sets of single-line alternative passwords using unified .url-action-icon-btn
    this.currentBatch = [mainPwd];
    if (suggestionsList) {
      let rowsHtml = '';
      for (let s = 1; s <= 4; s++) {
        const altPwd = this.generateRandomString(charset, len);
        this.currentBatch.push(altPwd);
        
        rowsHtml += `
          <div class="pwd-single-line-item">
            <span class="pwd-single-line-tag">#${s}</span>
            <span class="pwd-single-line-value" onclick="App.copyToClipboard('${altPwd}', this.parentElement.querySelector('.url-action-icon-btn'))" title="Click to copy">
              ${this.formatColoredPassword(altPwd)}
            </span>
            <button type="button" class="url-action-icon-btn" onclick="App.copyToClipboard('${altPwd}', this)" title="Copy password #${s}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        `;
      }
      suggestionsList.innerHTML = rowsHtml;
    }

    if (isManualClick) {
      App.showToast('Generated fresh passwords');
    }
  },

  generateRandomString(charset, len) {
    const array = new Uint32Array(len);
    window.crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < len; i++) {
      result += charset[array[i] % charset.length];
    }
    return result;
  }
};
