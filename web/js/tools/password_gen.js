// Password & Suggestions Generator Tool
const PasswordTool = {
  init() {
    const genBtn = document.getElementById('pwd-generate-btn');
    const copyBtn = document.getElementById('pwd-copy-btn');
    const slider = document.getElementById('pwd-len-slider');
    const lenBadge = document.getElementById('pwd-len-badge');

    if (!genBtn || !slider) return;

    // Load clean default settings
    slider.value = 64;
    if (lenBadge) lenBadge.innerText = 64;

    ['pwd-opt-lower', 'pwd-opt-upper', 'pwd-opt-nums', 'pwd-opt-symbols', 'pwd-opt-exclude-ambig'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = true; // Checked by default
      }
    });

    slider.addEventListener('input', (e) => {
      if (lenBadge) lenBadge.innerText = e.target.value;
    });

    genBtn.addEventListener('click', () => this.generate());
    
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const val = document.getElementById('pwd-output').value;
        if (val && !val.startsWith('Please select')) {
          App.copyToClipboard(val, copyBtn);
        }
      });
    }

    // Start empty — generate only on click
    this.clearAll();
  },

  clearAll() {
    const outInput = document.getElementById('pwd-output');
    const suggestionsList = document.getElementById('pwd-suggestions-list');
    const entropyEl = document.getElementById('pwd-entropy-text');
    const strengthEl = document.getElementById('pwd-strength-text');
    const fillEl = document.getElementById('pwd-strength-fill');

    if (outInput) outInput.value = '';
    if (entropyEl) entropyEl.innerText = '0 bits entropy';
    if (strengthEl) strengthEl.innerText = 'None';
    if (fillEl) {
      fillEl.style.width = '0%';
      fillEl.style.backgroundColor = 'transparent';
    }
    if (suggestionsList) {
      suggestionsList.innerHTML = '<span style="font-size:0.72rem; color:var(--text-dim); font-style:italic;">No suggestions generated yet</span>';
    }
  },

  generate() {
    const lenInput = document.getElementById('pwd-len-slider');
    const outInput = document.getElementById('pwd-output');
    const suggestionsList = document.getElementById('pwd-suggestions-list');

    if (!lenInput || !outInput) return;

    const len = parseInt(lenInput.value, 10);
    const useLower = document.getElementById('pwd-opt-lower').checked;
    const useUpper = document.getElementById('pwd-opt-upper').checked;
    const useNums = document.getElementById('pwd-opt-nums').checked;
    const useSyms = document.getElementById('pwd-opt-symbols').checked;
    const excludeAmbig = document.getElementById('pwd-opt-exclude-ambig').checked;

    let charset = '';
    if (useLower) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (useUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useNums) charset += '0123456789';
    if (useSyms) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (excludeAmbig) {
      // Exclude l, I, 1, O, 0, o
      charset = charset.replace(/[lI1O0o]/g, '');
    }

    if (!charset) {
      outInput.value = 'Please select at least one character set';
      if (suggestionsList) suggestionsList.innerHTML = '<span class="text-muted">Select options on the left to generate suggestions</span>';
      return;
    }

    // Generate main password
    const mainPwd = this.generateRandomString(charset, len);
    outInput.value = mainPwd;

    // Calculate Entropy = len * log2(charset.length)
    const entropy = Math.round(len * Math.log2(charset.length));
    const entropyEl = document.getElementById('pwd-entropy-text');
    const strengthEl = document.getElementById('pwd-strength-text');
    const fillEl = document.getElementById('pwd-strength-fill');

    if (entropyEl) entropyEl.innerText = `${entropy} bits entropy`;

    if (strengthEl && fillEl) {
      if (entropy < 40) {
        strengthEl.innerText = 'Very Weak';
        fillEl.style.width = '25%';
        fillEl.style.backgroundColor = 'var(--c-red)';
      } else if (entropy < 65) {
        strengthEl.innerText = 'Weak';
        fillEl.style.width = '50%';
        fillEl.style.backgroundColor = 'var(--c-orange)';
      } else if (entropy < 90) {
        strengthEl.innerText = 'Strong';
        fillEl.style.width = '75%';
        fillEl.style.backgroundColor = 'var(--c-blue)';
      } else {
        strengthEl.innerText = 'Very Strong';
        fillEl.style.width = '100%';
        fillEl.style.backgroundColor = 'var(--c-green)';
      }
    }

    // Generate 4 sets of suggestions
    if (suggestionsList) {
      let suggestionsHtml = '';
      for (let s = 0; s < 4; s++) {
        const suggestion = this.generateRandomString(charset, len);
        suggestionsHtml += `
          <div class="pwd-suggestion-item">
            <span class="pwd-suggestion-text" id="pwd-suggest-val-${s}">${App.escapeHtml(suggestion)}</span>
            <button class="ts-copy-btn" onclick="App.copyToClipboard(document.getElementById('pwd-suggest-val-${s}').innerText, this)" title="Copy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        `;
      }
      suggestionsList.innerHTML = suggestionsHtml;
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
