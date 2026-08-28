// Case & Text Transformation Utilities Tool
const CaseTool = {
  init() {
    const input = document.getElementById('case-input');
    if (!input) return;

    input.addEventListener('input', () => {
      this.syncLineNumbers();
      this.updateAllConversions();
    });

    input.addEventListener('scroll', () => {
      const gutter = document.getElementById('case-line-gutter');
      if (gutter) gutter.scrollTop = input.scrollTop;
    });

    // Start empty
    input.value = '';
    this.syncLineNumbers();
  },

  syncLineNumbers() {
    const input = document.getElementById('case-input');
    const gutter = document.getElementById('case-line-gutter');
    if (!input || !gutter) return;

    const lines = input.value.split('\n').length;
    gutter.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  },

  loadFile(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const input = document.getElementById('case-input');
      if (input) {
        input.value = e.target.result;
        this.syncLineNumbers();
        this.updateAllConversions();
        App.showToast(`Loaded file: ${file.name}`);
      }
    };
    reader.onerror = () => {
      App.showToast('Error reading file', 'error');
    };
    reader.readAsText(file);
    // Reset file input value to allow re-upload of same file
    fileInput.value = '';
  },

  copyMainInput() {
    const input = document.getElementById('case-input');
    if (input && input.value) {
      navigator.clipboard.writeText(input.value);
      if (navigator.vibrate) navigator.vibrate(15);
      App.showToast('Copied input text');
    }
  },

  toggleFullscreen() {
    const grid = document.getElementById('case-outer-grid');
    const rightCol = document.getElementById('case-right-column');
    const conversionsCard = document.getElementById('case-conversions-card');
    const inputCard = document.getElementById('case-input-card');
    const input = document.getElementById('case-input');
    const gutter = document.getElementById('case-line-gutter');
    const btn = document.getElementById('case-fullscreen-btn');
    if (!grid || !rightCol || !conversionsCard || !inputCard || !input || !btn) return;

    const isFull = inputCard.classList.contains('fullscreen-active');

    const iconNormal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
    const iconActive = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

    if (isFull) {
      grid.style.gridTemplateColumns = '1fr 280px';
      rightCol.style.display = 'flex';
      conversionsCard.style.display = 'block';
      inputCard.classList.remove('fullscreen-active');
      btn.innerHTML = iconNormal;
      btn.title = "Fullscreen Input";
      input.style.height = '160px';
      if (gutter) gutter.style.height = '160px';
    } else {
      grid.style.gridTemplateColumns = '1fr';
      rightCol.style.display = 'none';
      conversionsCard.style.display = 'none';
      inputCard.classList.add('fullscreen-active');
      btn.innerHTML = iconActive;
      btn.title = "Exit Fullscreen";
      input.style.height = '420px';
      if (gutter) gutter.style.height = '420px';
    }
  },

  wordsFromStr(s) {
    if (!s) return [];
    return s
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_\-.]+/g, ' ')
      .trim()
      .split(/\s+/);
  },

  convertText(text, type) {
    if (!text) return '';
    const lines = text.split('\n');

    const mapped = lines.map(line => {
      if (!line.trim()) return line;
      const words = this.wordsFromStr(line);
      
      switch (type) {
        case 'upper':
          return line.toUpperCase();
        case 'lower':
          return line.toLowerCase();
        case 'title':
          return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        case 'camel':
          return words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        case 'pascal':
          return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        case 'snake':
          return words.map(w => w.toLowerCase()).join('_');
        case 'kebab':
          return words.map(w => w.toLowerCase()).join('-');
        case 'constant':
          return words.map(w => w.toUpperCase()).join('_');
        default:
          return line;
      }
    });

    return mapped.join('\n');
  },

  updateAllConversions() {
    const input = document.getElementById('case-input');
    if (!input) return;

    const text = input.value;
    const types = ['upper', 'lower', 'title', 'camel', 'pascal', 'snake', 'kebab', 'constant'];

    types.forEach(t => {
      const el = document.getElementById(`col-case-${t}`);
      if (el) {
        el.innerText = this.convertText(text, t);
      }
    });

    // Update Statistics
    const charCount = text.length;
    const charNoSpaces = text.replace(/\s+/g, '').length;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lineCount = text ? text.split('\n').length : 0;

    const statChar = document.getElementById('case-stat-char');
    const statNoSpace = document.getElementById('case-stat-nospace');
    const statWord = document.getElementById('case-stat-word');
    const statLine = document.getElementById('case-stat-line');

    if (statChar) statChar.innerText = `${charCount} chars`;
    if (statNoSpace) statNoSpace.innerText = `${charNoSpaces} no spaces`;
    if (statWord) statWord.innerText = `${wordCount} words`;
    if (statLine) statLine.innerText = `${lineCount} lines`;
  },

  applyCaseToInput(type) {
    const input = document.getElementById('case-input');
    if (input && input.value) {
      const converted = this.convertText(input.value, type);
      input.value = converted;
      this.syncLineNumbers();
      this.updateAllConversions();
      App.showToast(`Applied ${type} case conversion to editor`);
    }
  },

  copyCaseRow(type, btn) {
    const el = document.getElementById(`col-case-${type}`);
    if (el && el.innerText) {
      navigator.clipboard.writeText(el.innerText);
      if (navigator.vibrate) navigator.vibrate(15);
      
      const svg = btn.innerHTML;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => {
        btn.innerHTML = svg;
      }, 1000);

      App.showToast(`Copied ${type} version to clipboard`);
    }
  },

  // Line actions (right sidebar options)
  trimLines() {
    const input = document.getElementById('case-input');
    if (input && input.value) {
      input.value = input.value.split('\n').map(l => l.trim()).join('\n');
      this.syncLineNumbers();
      this.updateAllConversions();
      App.showToast('Trimmed trailing & leading whitespaces');
    }
  },

  removeDuplicates() {
    const input = document.getElementById('case-input');
    if (input && input.value) {
      const lines = input.value.split('\n');
      input.value = Array.from(new Set(lines)).join('\n');
      this.syncLineNumbers();
      this.updateAllConversions();
      App.showToast('Removed duplicate lines');
    }
  },

  sortLines() {
    const input = document.getElementById('case-input');
    if (input && input.value) {
      const lines = input.value.split('\n');
      input.value = lines.sort((a, b) => a.localeCompare(b)).join('\n');
      this.syncLineNumbers();
      this.updateAllConversions();
      App.showToast('Sorted lines alphabetically');
    }
  },

  removeEmptyLines() {
    const input = document.getElementById('case-input');
    if (input && input.value) {
      input.value = input.value.split('\n').filter(l => l.trim() !== '').join('\n');
      this.syncLineNumbers();
      this.updateAllConversions();
      App.showToast('Removed empty lines');
    }
  },

  clearInput() {
    const input = document.getElementById('case-input');
    if (input) {
      input.value = '';
      this.syncLineNumbers();
      this.updateAllConversions();
      App.showToast('Cleared input editor');
    }
  }
};

window.CaseTool = CaseTool;
