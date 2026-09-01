// JSON Tools: Visualizer, Formatter, Minifier, Redactor, JSONPath, CSV/YAML/TS Converter
const JsonTool = {
  currentTab: 'visualizer', // 'visualizer' or 'converter'
  parsedData: null,
  undoStack: [],
  redoStack: [],
  history: [],
  currentMode: 'formatted',
  indentSpaces: 2,
  sortKeysEnabled: false,
  minifyEnabled: false,
  _nodeCount: 0,
  _maxNodes: 500,

  init() {
    const input = document.getElementById('json-input');
    if (!input) return;

    // Tabs Event Listeners
    const tabVisualizer = document.getElementById('json-tab-visualizer');
    const tabConverter = document.getElementById('json-tab-converter');
    
    if (tabVisualizer && tabConverter) {
      tabVisualizer.addEventListener('click', () => this.switchTab('visualizer'));
      tabConverter.addEventListener('click', () => this.switchTab('converter'));
    }

    // Drag and Drop Zone setup
    const dropZone = document.getElementById('json-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--c-purple)';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border-color)';
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer.files[0];
        if (file) this.loadFile(file);
      });
      dropZone.addEventListener('click', () => {
        document.getElementById('json-file-loader').click();
      });
    }

    // Debounced input handler — 200ms to avoid re-parsing on every keystroke
    const debouncedParse = Perf.debounce(() => {
      this.parseInputText();
      this.saveHistoryStateDelayed();
    }, 200);
    input.addEventListener('input', debouncedParse);

    // Start empty
    input.value = '';
    this.parseInputText();

    // Bind original buttons
    const sampleBtn = document.getElementById('json-sample-btn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        input.value = JSON.stringify({
          project: "Toolify",
          version: "2.0.0",
          active: true,
          author: { name: "Antigravity Engineer", role: "AI Pair Programmer", email: "[REDACTED]" },
          stats: { tools: 20, memoryMB: 12.4, latencyMs: 0.8 },
          tags: ["kernel", "minified", "zero-bloat", "portable"]
        }, null, 2);
        this.parseInputText();
      });
    }

    const formatBtn = document.getElementById('json-format-btn');
    if (formatBtn) {
      formatBtn.addEventListener('click', () => {
        this.currentMode = 'formatted';
        this.updateActiveTab();
        this.transform();
      });
    }

    const minifyBtn = document.getElementById('json-minify-btn');
    if (minifyBtn) {
      minifyBtn.addEventListener('click', () => {
        this.minify();
      });
    }

    const redactBtn = document.getElementById('json-redact-btn');
    if (redactBtn) {
      redactBtn.addEventListener('click', () => {
        this.redactSensitiveKeys();
      });
    }

    const queryBtn = document.getElementById('json-query-btn');
    if (queryBtn) {
      queryBtn.addEventListener('click', () => this.queryJsonPath());
    }

    const queryInput = document.getElementById('json-query-input');
    if (queryInput) {
      const debouncedQuery = Perf.debounce(() => this.queryJsonPath(), 200);
      queryInput.addEventListener('input', debouncedQuery);
    }

    const clearBtn = document.getElementById('json-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        this.parseInputText();
      });
    }

    const pasteBtn = document.getElementById('json-paste-btn');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          input.value = text;
          this.parseInputText();
        } catch (e) {
          App.showToast('Please paste directly into input', 'error');
        }
      });
    }

    const copyBtn = document.getElementById('json-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const out = document.getElementById('json-output').value;
        if (out) App.copyToClipboard(out);
      });
    }

    document.querySelectorAll('[data-json-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentMode = btn.dataset.jsonMode;
        this.updateActiveTab();
        this.transform();
      });
    });

    // History setup
    const clearHistBtn = document.getElementById('json-tools-clear-history-btn');
    if (clearHistBtn) {
      clearHistBtn.addEventListener('click', () => this.clearHistory());
    }

    try {
      const saved = localStorage.getItem('devutility_json_history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load json history:', e);
    }
    
    this.renderHistory();
  },

  switchTab(tab) {
    this.currentTab = tab;
    
    const tabVisualizer = document.getElementById('json-tab-visualizer');
    const tabConverter = document.getElementById('json-tab-converter');
    const paneVisualizer = document.getElementById('json-pane-visualizer');
    const paneConverter = document.getElementById('json-pane-converter');
    
    if (tabVisualizer && tabConverter && paneVisualizer && paneConverter) {
      tabVisualizer.classList.toggle('active', tab === 'visualizer');
      tabConverter.classList.toggle('active', tab === 'converter');
      paneVisualizer.style.display = tab === 'visualizer' ? 'block' : 'none';
      paneConverter.style.display = tab === 'converter' ? 'block' : 'none';
    }
  },

  parseInputText() {
    const input = document.getElementById('json-input');
    if (!input) return;

    const raw = input.value.trim();
    if (!raw) {
      this.parsedData = null;
      this.undoStack = [];
      this.redoStack = [];
      this.renderTree();
      this.updateStats(0);
      return;
    }

    // Show spinner for large JSON
    const isLarge = raw.length > 100 * 1024;
    if (isLarge) Perf.showSpinner('json-tree-container', `Parsing ${Perf.formatBytes(raw.length)}…`);

    try {
      this.parsedData = JSON.parse(raw);
      if (isLarge) Perf.hideSpinner('json-tree-container');
      this.renderTree();
      this.updateStats(raw.length);
      this.transform();
    } catch (err) {
      if (isLarge) Perf.hideSpinner('json-tree-container');
      const container = document.getElementById('json-tree-container');
      if (container) {
        container.innerHTML = `<div style="color: var(--c-red); font-weight: 700; font-size: 0.82rem; padding: 10px;">Invalid JSON: ${err.message}</div>`;
      }
    }
  },

  renderTree(maxDepth = 99, filterText = '') {
    const container = document.getElementById('json-tree-container');
    if (!container) return;

    if (!this.parsedData) {
      container.innerHTML = `<div style="color: var(--text-dim); font-style: italic; padding: 1.5rem; text-align: center; font-size: 0.8rem;">JSON visualizer workspace. Paste or load JSON content to begin.</div>`;
      return;
    }

    // Reset node counter for virtualization
    this._nodeCount = 0;
    container.innerHTML = '';
    const rootNode = this.createTreeNode(null, this.parsedData, 0, filterText, maxDepth, []);
    container.appendChild(rootNode);
  },

  createTreeNode(key, val, depth, filterText, maxDepth, path) {
    // Virtualization: cap total rendered nodes to prevent DOM overload
    this._nodeCount++;
    if (this._nodeCount > this._maxNodes) {
      const truncMsg = document.createElement('div');
      truncMsg.style.cssText = 'padding:6px 18px; font-size:0.72rem; color:var(--text-dim); font-style:italic;';
      truncMsg.textContent = `… ${this._nodeCount > this._maxNodes + 1 ? '' : '(tree capped at ' + this._maxNodes + ' nodes — use search or collapse branches)'}`;
      if (this._nodeCount === this._maxNodes + 1) return truncMsg;
      return document.createDocumentFragment();
    }

    const container = document.createElement('div');
    container.className = 'json-node';
    container.style.paddingLeft = '18px';
    container.style.position = 'relative';
    container.style.lineHeight = '1.5';
    container.style.fontSize = '0.8rem';
    
    const isCollapsible = typeof val === 'object' && val !== null;
    
    // Toggle folding arrow
    if (isCollapsible) {
      const arrow = document.createElement('span');
      arrow.className = 'json-arrow';
      arrow.innerHTML = depth >= maxDepth ? '▶' : '▼';
      arrow.style.position = 'absolute';
      arrow.style.left = '4px';
      arrow.style.cursor = 'pointer';
      arrow.style.fontSize = '0.65rem';
      arrow.style.color = 'var(--text-dim)';
      
      arrow.addEventListener('click', () => {
        const children = container.querySelector('.json-children');
        if (children) {
          const collapsed = children.style.display === 'none';
          children.style.display = collapsed ? 'block' : 'none';
          arrow.innerHTML = collapsed ? '▼' : '▶';
        }
      });
      container.appendChild(arrow);
    }
    
    // Key Label
    if (key !== null) {
      const keySpan = document.createElement('span');
      keySpan.className = 'json-key';
      keySpan.innerText = `"${key}": `;
      keySpan.style.color = 'var(--c-purple)';
      keySpan.style.fontWeight = '700';
      container.appendChild(keySpan);
    }
    
    if (isCollapsible) {
      const isArr = Array.isArray(val);
      const keys = Object.keys(val);
      
      const typeSpan = document.createElement('span');
      typeSpan.className = 'json-type';
      typeSpan.innerText = isArr ? `[ ${val.length} items ` : `{ ${keys.length} keys `;
      typeSpan.style.color = 'var(--text-dim)';
      typeSpan.style.fontSize = '0.7rem';
      typeSpan.style.fontStyle = 'italic';
      container.appendChild(typeSpan);
      
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'json-children';
      childrenDiv.style.marginLeft = '4px';
      childrenDiv.style.borderLeft = '1px dashed var(--border-color)';
      childrenDiv.style.display = depth >= maxDepth ? 'none' : 'block';
      
      keys.forEach(k => {
        const childNode = this.createTreeNode(k, val[k], depth + 1, filterText, maxDepth, [...path, k]);
        childrenDiv.appendChild(childNode);
      });
      
      container.appendChild(childrenDiv);
      
      const closeSpan = document.createElement('div');
      closeSpan.className = 'json-close-bracket';
      closeSpan.innerText = isArr ? ']' : '}';
      closeSpan.style.color = 'var(--text-dim)';
      container.appendChild(closeSpan);
    } else {
      // Leaf primitive nodes
      const valSpan = document.createElement('span');
      valSpan.className = 'json-value';
      
      let type = typeof val;
      if (val === null) type = 'null';
      
      if (type === 'string') {
        valSpan.innerText = `"${val}"`;
        valSpan.style.color = '#10b981'; // Green
      } else if (type === 'number') {
        valSpan.innerText = val;
        valSpan.style.color = '#3b82f6'; // Blue
      } else if (type === 'boolean') {
        valSpan.innerText = val;
        valSpan.style.color = '#f59e0b'; // Orange
      } else if (type === 'null') {
        valSpan.innerText = 'null';
        valSpan.style.color = '#ef4444'; // Red
        valSpan.style.fontWeight = '700';
      }
      
      // Inline Editing via Double-Click
      valSpan.addEventListener('dblclick', () => {
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.value = type === 'string' ? val : String(val);
        editInput.style.fontFamily = 'var(--font-mono)';
        editInput.style.fontSize = '0.78rem';
        editInput.style.padding = '1px 4px';
        editInput.style.border = '1px solid var(--border-focus)';
        editInput.style.borderRadius = '3px';
        editInput.style.background = 'var(--bg-input)';
        editInput.style.color = 'var(--text-main)';
        editInput.style.outline = 'none';
        
        const saveValue = () => {
          let newVal = editInput.value.trim();
          if (type === 'number') {
            const num = Number(newVal);
            if (!isNaN(num)) newVal = num;
          } else if (type === 'boolean') {
            newVal = newVal.toLowerCase() === 'true';
          } else if (type === 'null') {
            newVal = null;
          }
          this.updateValueAtPath(path, newVal);
        };
        
        editInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            saveValue();
          } else if (e.key === 'Escape') {
            this.renderTree();
          }
        });
        
        editInput.addEventListener('blur', saveValue);
        valSpan.replaceWith(editInput);
        editInput.focus();
      });
      
      container.appendChild(valSpan);
    }
    
    // Key filtering
    if (filterText && key !== null) {
      const matchesKey = key.toLowerCase().includes(filterText.toLowerCase());
      const matchesValue = !isCollapsible && String(val).toLowerCase().includes(filterText.toLowerCase());
      if (!matchesKey && !matchesValue && !isCollapsible) {
        container.style.display = 'none';
      }
    }
    
    return container;
  },

  updateValueAtPath(path, newVal) {
    if (!this.parsedData) return;
    this.saveStateToUndo();
    
    let current = this.parsedData;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = newVal;
    
    this.syncInputFromParsed();
    this.renderTree();
  },

  syncInputFromParsed() {
    const input = document.getElementById('json-input');
    if (input && this.parsedData) {
      input.value = JSON.stringify(this.parsedData, null, this.indentSpaces);
      this.updateStats(input.value.length);
    }
  },

  saveStateToUndo() {
    if (this.parsedData) {
      this.undoStack.push(JSON.stringify(this.parsedData));
      this.redoStack = []; // Clear redo stack on new interaction
    }
  },

  undo() {
    if (this.undoStack.length === 0) return;
    const currentStr = JSON.stringify(this.parsedData);
    this.redoStack.push(currentStr);
    
    const prev = this.undoStack.pop();
    this.parsedData = JSON.parse(prev);
    this.syncInputFromParsed();
    this.renderTree();
    App.showToast('Undo transform');
  },

  redo() {
    if (this.redoStack.length === 0) return;
    const currentStr = JSON.stringify(this.parsedData);
    this.undoStack.push(currentStr);
    
    const next = this.redoStack.pop();
    this.parsedData = JSON.parse(next);
    this.syncInputFromParsed();
    this.renderTree();
    App.showToast('Redo transform');
  },

  // Folding toolbar commands
  foldAll() {
    this.renderTree(0);
  },

  unfoldAll() {
    this.renderTree(99);
  },

  collapseToLevel(level) {
    this.renderTree(level);
  },

  filterKeys() {
    const filterInput = document.getElementById('json-tree-filter');
    if (filterInput) {
      this.renderTree(99, filterInput.value.trim());
    }
  },

  // Options settings panel changes
  changeIndentation(spaces) {
    this.indentSpaces = spaces;
    
    const btn2 = document.getElementById('json-indent-2');
    const btn4 = document.getElementById('json-indent-4');
    if (btn2 && btn4) {
      btn2.classList.toggle('active', spaces === 2);
      btn2.classList.toggle('log-info', spaces === 2);
      btn4.classList.toggle('active', spaces === 4);
      btn4.classList.toggle('log-info', spaces === 4);
    }
    
    this.syncInputFromParsed();
  },

  toggleSortKeys(el) {
    this.sortKeysEnabled = el.checked;
    if (this.sortKeysEnabled && this.parsedData) {
      this.saveStateToUndo();
      this.parsedData = this.sortObjectKeys(this.parsedData);
      this.syncInputFromParsed();
      this.renderTree();
      App.showToast('Sorted object keys alphabetically');
    }
  },

  toggleMinify(el) {
    this.minifyEnabled = el.checked;
    if (this.minifyEnabled && this.parsedData) {
      const input = document.getElementById('json-input');
      if (input) {
        input.value = JSON.stringify(this.parsedData);
        this.renderTree();
      }
    } else {
      this.syncInputFromParsed();
    }
  },

  sortObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObjectKeys(item));
    
    const sorted = {};
    Object.keys(obj).sort().forEach(k => {
      sorted[k] = this.sortObjectKeys(obj[k]);
    });
    return sorted;
  },

  // File loading methods
  loadFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const input = document.getElementById('json-input');
      if (input) {
        input.value = e.target.result;
        this.parseInputText();
        App.showToast(`Loaded file: ${file.name}`);
      }
    };
    reader.onerror = () => {
      App.showToast('Error loading JSON file', 'error');
    };
    reader.readAsText(file);
  },

  triggerFileLoader() {
    document.getElementById('json-file-loader').click();
  },

  downloadJson() {
    const input = document.getElementById('json-input');
    if (!input || !input.value) return;

    const blob = new Blob([input.value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.json';
    a.click();
    App.showToast('Downloaded JSON file');
  },

  // Find & Replace Search mechanism
  findSearch() {
    const searchVal = document.getElementById('json-tree-search').value.trim();
    if (!searchVal) return;

    const nodes = document.querySelectorAll('#json-tree-container .json-key, #json-tree-container .json-value');
    nodes.forEach(n => {
      n.style.backgroundColor = 'transparent';
      n.style.color = '';
      if (n.innerText.toLowerCase().includes(searchVal.toLowerCase())) {
        n.style.backgroundColor = '#fef08a'; // yellow highlight
        n.style.color = '#000000';
      }
    });
  },

  replaceSearch() {
    const searchVal = document.getElementById('json-tree-search').value.trim();
    const replaceVal = document.getElementById('json-tree-replace').value;
    const input = document.getElementById('json-input');
    if (!input || !searchVal) return;

    let raw = input.value;
    if (raw.includes(searchVal)) {
      this.saveStateToUndo();
      raw = raw.replaceAll(searchVal, replaceVal);
      input.value = raw;
      this.parseInputText();
      App.showToast(`Replaced matches of "${searchVal}"`);
    }
  },

  // History state helpers
  saveHistoryStateDelayed() {
    if (this.historyTimeout) clearTimeout(this.historyTimeout);
    this.historyTimeout = setTimeout(() => {
      const input = document.getElementById('json-input');
      if (input && input.value.trim()) {
        this.saveHistoryState(input.value.trim());
      }
    }, 2000);
  },

  saveHistoryState(raw) {
    if (!raw || raw.length < 10) return;
    let snippet = raw;
    if (snippet.length > 30) snippet = snippet.slice(0, 30) + '...';
    
    this.history = this.history.filter(h => h.raw !== raw);
    this.history.unshift({ raw, label: snippet });
    if (this.history.length > 5) this.history.pop();
    
    try {
      localStorage.setItem('devutility_json_history', JSON.stringify(this.history));
    } catch (e) {
      console.error(e);
    }
    
    this.renderHistory();
  },

  clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem('devutility_json_history');
    } catch (e) {
      console.error(e);
    }
    this.renderHistory();
    App.showToast('JSON History cleared');
  },

  renderHistory() {
    const container = document.getElementById('json-history-list');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `<div style="font-size: 0.68rem; color: var(--text-dim); text-align: center; padding: 6px; font-style: italic;">No history yet</div>`;
      return;
    }

    container.innerHTML = this.history.map((h, i) => `
      <button class="log-filter-btn" style="text-align: left; padding: 6px 10px; font-family: var(--font-mono); font-size: 0.72rem; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onclick="JsonTool.loadHistoryItem(${i})" title="${h.raw}">
        ${h.label}
      </button>
    `).join('');
  },

  loadHistoryItem(index) {
    const item = this.history[index];
    const input = document.getElementById('json-input');
    if (item && input) {
      input.value = item.raw;
      this.parseInputText();
    }
  },

  updateStats(charSize) {
    const statKeys = document.getElementById('json-stat-keys');
    const statSize = document.getElementById('json-stat-size');
    if (!statKeys || !statSize) return;

    let keyCount = 0;
    const countKeys = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;
      if (Array.isArray(obj)) {
        obj.forEach(countKeys);
      } else {
        const keys = Object.keys(obj);
        keyCount += keys.length;
        keys.forEach(k => countKeys(obj[k]));
      }
    };

    if (this.parsedData) {
      countKeys(this.parsedData);
    }

    statKeys.innerText = `${keyCount} keys`;
    statSize.innerText = charSize < 1024 ? `${charSize} B` : `${(charSize / 1024).toFixed(1)} KB`;
  },

  // Conversions and query original tools
  redactSensitiveKeys() {
    const input = document.getElementById('json-input');
    try {
      const parsed = JSON.parse(input.value);
      const sensitiveKeys = new Set(['password', 'token', 'secret', 'apikey', 'key', 'ssn', 'auth', 'email', 'card']);
      
      const redact = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(redact);
        const res = {};
        for (const [k, v] of Object.entries(obj)) {
          if (sensitiveKeys.has(k.toLowerCase())) {
            res[k] = '[REDACTED]';
          } else {
            res[k] = redact(v);
          }
        }
        return res;
      };

      const redacted = redact(parsed);
      input.value = JSON.stringify(redacted, null, this.indentSpaces);
      this.parseInputText();
      App.showToast('Sensitive keys redacted');
    } catch (e) {
      App.showToast('Invalid JSON to redact', 'error');
    }
  },

  queryJsonPath() {
    const q = document.getElementById('json-query-input').value.trim();
    if (!q) {
      this.transform();
      return;
    }
    const raw = document.getElementById('json-input').value.trim();
    try {
      let data = JSON.parse(raw);
      const path = q.replace(/^\$\.?/, '').split('.');
      for (const segment of path) {
        if (!segment) continue;
        const arrayMatch = segment.match(/(\w+)\[(\d+)\]/);
        if (arrayMatch) {
          data = data[arrayMatch[1]][parseInt(arrayMatch[2], 10)];
        } else {
          data = data[segment];
        }
      }
      document.getElementById('json-output').value = JSON.stringify(data, null, 2);
    } catch (e) {
      // Query in progress
    }
  },

  minify() {
    const input = document.getElementById('json-input').value.trim();
    if (!input) return;
    try {
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      document.getElementById('json-output').value = minified;
      App.showToast('JSON Minified');
    } catch (err) {
      App.showToast('Invalid JSON to minify', 'error');
    }
  },

  transform() {
    const raw = document.getElementById('json-input').value.trim();
    const outEl = document.getElementById('json-output');
    if (!raw || !outEl) return;

    try {
      const parsed = JSON.parse(raw);
      let result = '';
      if (this.currentMode === 'formatted') {
        result = JSON.stringify(parsed, null, this.indentSpaces);
      } else if (this.currentMode === 'csv') {
        result = this.jsonToCsv(parsed);
      } else if (this.currentMode === 'yaml') {
        result = this.jsonToYaml(parsed);
      } else if (this.currentMode === 'ts') {
        result = this.jsonToTypeScript('RootObject', parsed);
      }
      outEl.value = result;
    } catch (err) {
      // transform in progress
    }
  },

  jsonToCsv(obj) {
    const items = Array.isArray(obj) ? obj : [obj];
    if (items.length === 0) return '';
    const keys = Array.from(new Set(items.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : ['value'])));
    const header = keys.map(k => `"${k.replace(/"/g, '""')}"`).join(',');
    const rows = items.map(item => {
      if (typeof item !== 'object' || item === null) return `"${String(item).replace(/"/g, '""')}"`;
      return keys.map(k => {
        let val = item[k];
        if (val === undefined || val === null) return '""';
        if (typeof val === 'object') val = JSON.stringify(val);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });
    return [header, ...rows].join('\n');
  },

  jsonToYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    if (obj === null) return 'null';
    if (typeof obj !== 'object') {
      if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
      return String(obj);
    }
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return '\n' + obj.map(item => `${spaces}- ${this.jsonToYaml(item, indent + 1).trimStart()}`).join('\n');
    }
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return '\n' + keys.map(k => {
      const val = obj[k];
      if (typeof val === 'object' && val !== null) {
        return `${spaces}${k}:${this.jsonToYaml(val, indent + 1)}`;
      }
      return `${spaces}${k}: ${this.jsonToYaml(val, indent + 1)}`;
    }).join('\n');
  },

  jsonToTypeScript(interfaceName, obj) {
    if (typeof obj !== 'object' || obj === null) return `type ${interfaceName} = ${typeof obj};`;
    if (Array.isArray(obj)) {
      const innerType = obj.length > 0 ? typeof obj[0] : 'any';
      return `type ${interfaceName} = ${innerType}[];`;
    }
    let lines = [`export interface ${interfaceName} {`];
    for (const [key, val] of Object.entries(obj)) {
      let type = 'any';
      if (val === null) type = 'null';
      else if (Array.isArray(val)) type = val.length ? `${typeof val[0]}[]` : 'any[]';
      else if (typeof val === 'object') type = 'Record<string, any>';
      else type = typeof val;
      lines.push(`  ${key}: ${type};`);
    }
    lines.push('}');
    return lines.join('\n');
  },

  updateActiveTab() {
    document.querySelectorAll('[data-json-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.jsonMode === this.currentMode);
    });
  }
};

window.JsonTool = JsonTool;
