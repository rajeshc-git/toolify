// JSON Tools Studio: Visualizer, Table View, Auto-Repair, Minifier, Redactor, JSONPath, CSV/YAML/XML/TS Converter
const JsonTool = {
  currentTab: 'editor', // 'editor', 'table', 'visualizer', 'converter'
  parsedData: null,
  undoStack: [],
  redoStack: [],
  history: [],
  currentMode: 'csv',
  indentSpaces: 2,
  sortKeysEnabled: false,
  minifyEnabled: false,
  _nodeCount: 0,
  _maxNodes: 500,

  // Table View State
  _tableRows: [],
  _tableCols: [],
  _filteredTableRows: [],
  _tableSortCol: null,
  _tableSortAsc: true,
  _tablePage: 0,
  _tablePageSize: 50,

  // Search & Replace State
  _searchMatches: [],
  _currentMatchIdx: -1,
  _searchRegex: false,
  _searchCase: false,
  _searchWord: false,

  init() {
    const input = document.getElementById('json-input');
    if (!input) return;

    // Studio Tab Navigation
    ['editor', 'table', 'visualizer', 'converter'].forEach(tab => {
      const btn = document.getElementById(`json-tab-${tab}`);
      if (btn) {
        btn.addEventListener('click', () => this.switchTab(tab));
      }
    });

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

    // Debounced input handler (150ms)
    const debouncedParse = Perf.debounce(() => {
      this.parseInputText();
      this.saveHistoryStateDelayed();
    }, 150);
    input.addEventListener('input', debouncedParse);

    // Global Search & Replace bindings
    this.setupSearchReplace();

    // Sample Button
    const sampleBtn = document.getElementById('json-sample-btn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        input.value = JSON.stringify([
          {
            id: "usr_101",
            name: "Antigravity Engineer",
            role: "AI Pair Programmer",
            active: true,
            auth: "[REDACTED]",
            stats: { latencyMs: 0.8, memoryMB: 12.4, tools: 20 },
            tags: ["kernel", "minified", "portable"],
            version: "2.0.0"
          },
          {
            id: "usr_102",
            name: "Cloud Architect",
            role: "Infrastructure Lead",
            active: true,
            auth: "[REDACTED]",
            stats: { latencyMs: 1.2, memoryMB: 18.1, tools: 15 },
            tags: ["docker", "k8s", "aws"],
            version: "2.0.0"
          },
          {
            id: "usr_103",
            name: "Security Auditor",
            role: "SecOps Specialist",
            active: false,
            auth: "[REDACTED]",
            stats: { latencyMs: 2.1, memoryMB: 9.6, tools: 8 },
            tags: ["jwt", "oauth2", "audit"],
            version: "2.0.0"
          }
        ], null, 2);
        this.parseInputText();
        App.showToast('Sample JSON array loaded');
      });
    }

    // Converter Mode Toggles
    document.querySelectorAll('[data-json-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentMode = btn.dataset.jsonMode;
        this.updateActiveTab();
        this.transform();
      });
    });

    const queryBtn = document.getElementById('json-query-btn');
    if (queryBtn) {
      queryBtn.addEventListener('click', () => this.queryJsonPath());
    }

    const queryInput = document.getElementById('json-query-input');
    if (queryInput) {
      const debouncedQuery = Perf.debounce(() => this.queryJsonPath(), 150);
      queryInput.addEventListener('input', debouncedQuery);
    }

    const copyBtn = document.getElementById('json-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const out = document.getElementById('json-output').value;
        if (out) App.copyToClipboard(out);
      });
    }

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
    
    // Default clean empty state
    input.value = '';
    this.parseInputText();
  },

  setupSearchReplace() {
    const findInput = document.getElementById('json-find-input');
    const replaceInput = document.getElementById('json-replace-input');
    const optRegex = document.getElementById('json-opt-regex');
    const optCase = document.getElementById('json-opt-case');
    const optWord = document.getElementById('json-opt-word');
    const prevBtn = document.getElementById('json-btn-find-prev');
    const nextBtn = document.getElementById('json-btn-find-next');
    const repOneBtn = document.getElementById('json-btn-replace-one');
    const repAllBtn = document.getElementById('json-btn-replace-all');

    if (!findInput) return;

    const debouncedSearch = Perf.debounce(() => this.executeFind(), 150);
    findInput.addEventListener('input', debouncedSearch);

    if (optRegex) {
      optRegex.addEventListener('click', () => {
        this._searchRegex = !this._searchRegex;
        optRegex.classList.toggle('active', this._searchRegex);
        this.executeFind();
      });
    }

    if (optCase) {
      optCase.addEventListener('click', () => {
        this._searchCase = !this._searchCase;
        optCase.classList.toggle('active', this._searchCase);
        this.executeFind();
      });
    }

    if (optWord) {
      optWord.addEventListener('click', () => {
        this._searchWord = !this._searchWord;
        optWord.classList.toggle('active', this._searchWord);
        this.executeFind();
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', () => this.jumpMatch(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this.jumpMatch(1));
    if (repOneBtn) repOneBtn.addEventListener('click', () => this.replaceOne());
    if (repAllBtn) repAllBtn.addEventListener('click', () => this.replaceAll());

    // Keyboard shortcut Ctrl+F / Cmd+F to focus search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const view = document.getElementById('view-json-tools');
        if (view && view.classList.contains('active')) {
          e.preventDefault();
          findInput.focus();
          findInput.select();
        }
      }
    });

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.jumpMatch(e.shiftKey ? -1 : 1);
      }
    });
  },

  switchTab(tab) {
    this.currentTab = tab;
    
    // Top tabs: editor (workspace) vs converter
    const editorTabBtn = document.getElementById('json-tab-editor');
    const converterTabBtn = document.getElementById('json-tab-converter');
    if (editorTabBtn) editorTabBtn.classList.toggle('active', tab !== 'converter');
    if (converterTabBtn) converterTabBtn.classList.toggle('active', tab === 'converter');

    // Panes
    const editorPane = document.getElementById('json-pane-editor');
    const tablePane = document.getElementById('json-pane-table');
    const visualizerPane = document.getElementById('json-pane-visualizer');
    const converterPane = document.getElementById('json-pane-converter');

    if (editorPane) editorPane.style.display = tab === 'editor' ? 'block' : 'none';
    if (tablePane) tablePane.style.display = tab === 'table' ? 'block' : 'none';
    if (visualizerPane) visualizerPane.style.display = tab === 'visualizer' ? 'block' : 'none';
    if (converterPane) converterPane.style.display = tab === 'converter' ? 'block' : 'none';

    // Toolbar view toggle buttons (Editor / Table / Tree)
    const editorBtn = document.getElementById('json-btn-view-editor');
    const tblBtn = document.getElementById('json-btn-view-table');
    const treeBtn = document.getElementById('json-btn-view-tree');
    if (editorBtn) editorBtn.classList.toggle('active', tab === 'editor');
    if (tblBtn) tblBtn.classList.toggle('active', tab === 'table');
    if (treeBtn) treeBtn.classList.toggle('active', tab === 'visualizer');

    if (tab === 'table') {
      this.buildTableDataset();
      this.renderTable();
    } else if (tab === 'visualizer') {
      this.renderTree();
    } else if (tab === 'converter') {
      this.transform();
    }
  },

  parseInputText() {
    const input = document.getElementById('json-input');
    const statusEl = document.getElementById('json-editor-status');
    if (!input) return;

    const raw = input.value.trim();
    if (!raw) {
      this.parsedData = null;
      this.undoStack = [];
      this.redoStack = [];
      if (statusEl) { statusEl.textContent = 'Empty'; statusEl.style.color = 'var(--text-dim)'; }
      this.updateStats(0);
      return;
    }

    try {
      this.parsedData = JSON.parse(raw);
      if (statusEl) {
        statusEl.textContent = '✓ Valid JSON';
        statusEl.style.color = '#10b981';
      }
      this.updateStats(raw.length);
      if (this.currentTab === 'table') this.buildTableDataset(), this.renderTable();
      else if (this.currentTab === 'visualizer') this.renderTree();
      else if (this.currentTab === 'converter') this.transform();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `✗ Invalid JSON: ${err.message}`;
        statusEl.style.color = '#ef4444';
      }
    }
  },

  // =========================================================================
  // Core Action Toolbar Methods (Format, Repair, Minify, Sort, Redact)
  // =========================================================================

  formatJson() {
    const input = document.getElementById('json-input');
    if (!input || !input.value.trim()) return;
    try {
      this.saveStateToUndo();
      const parsed = JSON.parse(input.value.trim());
      input.value = JSON.stringify(parsed, null, this.indentSpaces);
      this.parseInputText();
      App.showToast('Formatted JSON');
    } catch (e) {
      App.showToast('Cannot format invalid JSON. Try "Auto-Repair"', 'error');
    }
  },

  repairJson() {
    const input = document.getElementById('json-input');
    if (!input || !input.value.trim()) return;

    this.saveStateToUndo();
    let text = input.value.trim();

    try {
      // 1. Fix single quotes to double quotes for keys and strings
      text = text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
      
      // 2. Fix unquoted keys: e.g. { name: "val" } -> { "name": "val" }
      text = text.replace(/([{,]\s*)([a-zA-Z0-9_$-]+)\s*:/g, '$1"$2":');
      
      // 3. Fix Python literals: True -> true, False -> false, None -> null
      text = text.replace(/:\s*True\b/g, ': true')
                 .replace(/:\s*False\b/g, ': false')
                 .replace(/:\s*None\b/g, ': null');

      // 4. Remove trailing commas before } and ]
      text = text.replace(/,\s*([}\]])/g, '$1');

      // 5. Close unclosed brackets / braces
      const openBraces = (text.match(/\{/g) || []).length;
      const closeBraces = (text.match(/\}/g) || []).length;
      if (openBraces > closeBraces) text += '}'.repeat(openBraces - closeBraces);

      const openBrackets = (text.match(/\[/g) || []).length;
      const closeBrackets = (text.match(/\]/g) || []).length;
      if (openBrackets > closeBrackets) text += ']'.repeat(openBrackets - closeBrackets);

      // Verify repaired JSON
      const repairedObj = JSON.parse(text);
      input.value = JSON.stringify(repairedObj, null, this.indentSpaces);
      this.parseInputText();
      App.showToast('Successfully repaired JSON syntax!');
    } catch (err) {
      App.showToast('Could not automatically repair JSON: ' + err.message, 'error');
    }
  },

  minify() {
    const input = document.getElementById('json-input');
    if (!input || !input.value.trim()) return;
    try {
      this.saveStateToUndo();
      const parsed = JSON.parse(input.value.trim());
      input.value = JSON.stringify(parsed);
      this.parseInputText();
      App.showToast('Minified JSON to single line');
    } catch (err) {
      App.showToast('Invalid JSON to minify', 'error');
    }
  },

  sortKeys() {
    const input = document.getElementById('json-input');
    if (!input || !input.value.trim()) return;
    try {
      this.saveStateToUndo();
      const parsed = JSON.parse(input.value.trim());
      const sorted = this.sortObjectKeys(parsed);
      input.value = JSON.stringify(sorted, null, this.indentSpaces);
      this.parseInputText();
      App.showToast('Sorted keys A-Z');
    } catch (err) {
      App.showToast('Invalid JSON to sort', 'error');
    }
  },

  sortObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObjectKeys(item));
    const sorted = {};
    Object.keys(obj).sort((a, b) => a.localeCompare(b)).forEach(k => {
      sorted[k] = this.sortObjectKeys(obj[k]);
    });
    return sorted;
  },

  redactSensitiveKeys() {
    const input = document.getElementById('json-input');
    if (!input || !input.value.trim()) return;
    try {
      this.saveStateToUndo();
      const parsed = JSON.parse(input.value.trim());
      const sensitiveKeys = new Set(['password', 'token', 'secret', 'apikey', 'key', 'ssn', 'auth', 'email', 'card', 'authorization', 'bearer']);
      
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

  copyCurrentJson(btn) {
    const input = document.getElementById('json-input');
    if (input && input.value) {
      App.copyToClipboard(input.value, btn);
    }
  },

  clearAll() {
    const input = document.getElementById('json-input');
    if (input) {
      this.saveStateToUndo();
      input.value = '';
      this.parseInputText();
    }
  },

  // =========================================================================
  // Interactive Data Table Engine (▦ View as Table)
  // =========================================================================

  buildTableDataset() {
    if (!this.parsedData) {
      this._tableRows = [];
      this._tableCols = [];
      this._filteredTableRows = [];
      return;
    }

    let items = [];
    if (Array.isArray(this.parsedData)) {
      items = this.parsedData;
    } else if (typeof this.parsedData === 'object' && this.parsedData !== null) {
      // If object with array property (e.g. { data: [...], users: [...] }), use that array
      const arrayKey = Object.keys(this.parsedData).find(k => Array.isArray(this.parsedData[k]));
      if (arrayKey) {
        items = this.parsedData[arrayKey];
      } else {
        items = [this.parsedData];
      }
    }

    this._tableRows = items;

    // Collect distinct column headers
    const colsSet = new Set();
    items.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(k => colsSet.add(k));
      } else {
        colsSet.add('value');
      }
    });

    this._tableCols = Array.from(colsSet);
    this._filteredTableRows = [...this._tableRows];
    this._tablePage = 0;
  },

  filterTable() {
    const searchVal = document.getElementById('json-table-search')?.value.toLowerCase().trim() || '';
    if (!searchVal) {
      this._filteredTableRows = [...this._tableRows];
    } else {
      this._filteredTableRows = this._tableRows.filter(row => {
        if (typeof row !== 'object' || row === null) return String(row).toLowerCase().includes(searchVal);
        return Object.values(row).some(v => {
          if (v === null || v === undefined) return false;
          if (typeof v === 'object') return JSON.stringify(v).toLowerCase().includes(searchVal);
          return String(v).toLowerCase().includes(searchVal);
        });
      });
    }
    this._tablePage = 0;
    this.renderTable();
  },

  sortTable(col) {
    if (this._tableSortCol === col) {
      this._tableSortAsc = !this._tableSortAsc;
    } else {
      this._tableSortCol = col;
      this._tableSortAsc = true;
    }

    this._filteredTableRows.sort((a, b) => {
      const valA = (a && typeof a === 'object') ? a[col] : a;
      const valB = (b && typeof b === 'object') ? b[col] : b;

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return this._tableSortAsc ? valA - valB : valB - valA;
      }
      return this._tableSortAsc 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });

    this.renderTable();
  },

  changeTablePageSize(val) {
    this._tablePageSize = val === 'all' ? Infinity : parseInt(val, 10) || 50;
    this._tablePage = 0;
    this.renderTable();
  },

  prevTablePage() {
    if (this._tablePage > 0) {
      this._tablePage--;
      this.renderTable();
    }
  },

  nextTablePage() {
    const maxPage = Math.ceil(this._filteredTableRows.length / this._tablePageSize) - 1;
    if (this._tablePage < maxPage) {
      this._tablePage++;
      this.renderTable();
    }
  },

  renderTable() {
    const container = document.getElementById('json-table-container');
    const countEl = document.getElementById('json-table-row-count');
    const paginationInfo = document.getElementById('json-table-pagination-info');
    const prevBtn = document.getElementById('json-table-prev-btn');
    const nextBtn = document.getElementById('json-table-next-btn');

    if (!container) return;

    if (this._tableRows.length === 0) {
      container.innerHTML = `
        <div class="json-table-empty-box">
          <svg class="json-table-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
          </svg>
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main); margin-bottom: 4px;">No Tabular Data Loaded</div>
          <div style="font-size: 0.74rem; color: var(--text-dim); max-width: 320px; line-height: 1.4; margin-bottom: 12px;">
            Paste a JSON array of objects or CSV text into the Editor to explore and sort as an interactive table.
          </div>
          <button class="log-filter-btn" onclick="JsonTool.switchTab('editor')" style="padding: 4px 12px; font-size: 0.75rem;">{ } Open Editor</button>
        </div>
      `;
      if (countEl) countEl.textContent = '0 rows';
      if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0';
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    const total = this._filteredTableRows.length;
    const pageSize = this._tablePageSize;
    const startIdx = this._tablePage * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const visibleRows = this._filteredTableRows.slice(startIdx, endIdx);

    if (countEl) countEl.textContent = `${total} row${total === 1 ? '' : 's'}`;
    if (paginationInfo) paginationInfo.textContent = `Showing ${total === 0 ? 0 : startIdx + 1}–${endIdx} of ${total}`;
    if (prevBtn) prevBtn.disabled = this._tablePage === 0;
    if (nextBtn) nextBtn.disabled = endIdx >= total;

    let html = `<table class="json-data-table"><thead><tr><th style="width:40px;">#</th>`;
    this._tableCols.forEach(col => {
      const isSorted = this._tableSortCol === col;
      const arrow = isSorted ? (this._tableSortAsc ? ' ▲' : ' ▼') : '';
      html += `<th onclick="JsonTool.sortTable('${App.escapeHtml(col)}')">${App.escapeHtml(col)}${arrow}</th>`;
    });
    html += `</tr></thead><tbody>`;

    visibleRows.forEach((row, rIdx) => {
      html += `<tr><td style="color:var(--text-dim); font-size:0.7rem;">${startIdx + rIdx + 1}</td>`;
      this._tableCols.forEach(col => {
        let val = (typeof row === 'object' && row !== null) ? row[col] : row;
        let cellContent = '';

        if (val === null || val === undefined) {
          cellContent = `<span class="json-type-null">null</span>`;
        } else if (typeof val === 'boolean') {
          cellContent = `<span class="${val ? 'json-type-bool-true' : 'json-type-bool-false'}">${val}</span>`;
        } else if (typeof val === 'number') {
          cellContent = `<span class="json-type-num">${val}</span>`;
        } else if (typeof val === 'object') {
          cellContent = `<span class="json-type-obj">${App.escapeHtml(JSON.stringify(val))}</span>`;
        } else {
          cellContent = App.escapeHtml(String(val));
        }

        html += `<td title="${App.escapeHtml(typeof val === 'object' ? JSON.stringify(val) : String(val))}">${cellContent}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  exportTableCsv() {
    if (!this._tableRows.length) return;
    const csv = this.jsonToCsv(this._filteredTableRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `exported_table_${Date.now()}.csv`;
    a.click();
    App.showToast('Exported table as CSV');
  },

  // =========================================================================
  // Global Search & Replace Engine
  // =========================================================================

  executeFind() {
    const findInput = document.getElementById('json-find-input');
    const countEl = document.getElementById('json-find-count');
    const input = document.getElementById('json-input');
    if (!findInput || !input) return;

    const query = findInput.value;
    if (!query) {
      this._searchMatches = [];
      this._currentMatchIdx = -1;
      if (countEl) countEl.textContent = '0/0';
      return;
    }

    const text = input.value;
    let regex;
    try {
      let pattern = this._searchRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (this._searchWord) pattern = `\\b${pattern}\\b`;
      regex = new RegExp(pattern, this._searchCase ? 'g' : 'gi');
    } catch (e) {
      if (countEl) countEl.textContent = 'Regex err';
      return;
    }

    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({ index: match.index, length: match[0].length });
      if (!regex.global) break;
    }

    this._searchMatches = matches;
    this._currentMatchIdx = matches.length ? 0 : -1;
    this.updateMatchUI();
  },

  jumpMatch(delta) {
    if (!this._searchMatches.length) return;
    this._currentMatchIdx = (this._currentMatchIdx + delta + this._searchMatches.length) % this._searchMatches.length;
    this.updateMatchUI();
  },

  updateMatchUI() {
    const countEl = document.getElementById('json-find-count');
    const input = document.getElementById('json-input');
    if (!countEl || !input) return;

    if (!this._searchMatches.length) {
      countEl.textContent = '0/0';
      return;
    }

    countEl.textContent = `${this._currentMatchIdx + 1}/${this._searchMatches.length}`;
    const m = this._searchMatches[this._currentMatchIdx];
    if (m) {
      input.focus();
      input.setSelectionRange(m.index, m.index + m.length);
    }
  },

  replaceOne() {
    const replaceInput = document.getElementById('json-replace-input');
    const input = document.getElementById('json-input');
    if (!replaceInput || !input || this._currentMatchIdx === -1) return;

    const m = this._searchMatches[this._currentMatchIdx];
    if (!m) return;

    this.saveStateToUndo();
    const val = input.value;
    const replacement = replaceInput.value;
    input.value = val.substring(0, m.index) + replacement + val.substring(m.index + m.length);
    this.parseInputText();
    this.executeFind();
  },

  replaceAll() {
    const findInput = document.getElementById('json-find-input');
    const replaceInput = document.getElementById('json-replace-input');
    const input = document.getElementById('json-input');
    if (!findInput || !replaceInput || !input || !findInput.value) return;

    this.saveStateToUndo();
    const query = findInput.value;
    const replacement = replaceInput.value;
    let pattern = this._searchRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (this._searchWord) pattern = `\\b${pattern}\\b`;
    const regex = new RegExp(pattern, this._searchCase ? 'g' : 'gi');

    input.value = input.value.replace(regex, replacement);
    this.parseInputText();
    this.executeFind();
    App.showToast('Replaced all occurrences');
  },

  // =========================================================================
  // Bidirectional Converters (CSV ↔ JSON, YAML ↔ JSON, XML ↔ JSON, TS)
  // =========================================================================

  transform() {
    const raw = document.getElementById('json-input')?.value.trim();
    const outEl = document.getElementById('json-output');
    if (!raw || !outEl) return;

    try {
      let result = '';
      if (this.currentMode === 'csv') {
        const parsed = JSON.parse(raw);
        result = this.jsonToCsv(parsed);
      } else if (this.currentMode === 'csv-to-json') {
        result = JSON.stringify(this.csvToJson(raw), null, this.indentSpaces);
      } else if (this.currentMode === 'yaml') {
        const parsed = JSON.parse(raw);
        result = this.jsonToYaml(parsed);
      } else if (this.currentMode === 'yaml-to-json') {
        result = JSON.stringify(this.yamlToJson(raw), null, this.indentSpaces);
      } else if (this.currentMode === 'xml') {
        const parsed = JSON.parse(raw);
        result = this.jsonToXml(parsed);
      } else if (this.currentMode === 'ts') {
        const parsed = JSON.parse(raw);
        result = this.jsonToTypeScript('RootObject', parsed);
      }
      outEl.value = result;
    } catch (err) {
      outEl.value = `Conversion Note: ${err.message}`;
    }
  },

  jsonToCsv(obj) {
    const items = Array.isArray(obj) ? obj : [obj];
    if (items.length === 0) return '';
    const keys = Array.from(new Set(items.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : ['value'])));
    const header = keys.map(k => `"${String(k).replace(/"/g, '""')}"`).join(',');
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

  csvToJson(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (!lines.length) return [];

    // Parse CSV line handling quotes and delimiters
    const parseCsvLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      const delimiter = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');

      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === delimiter && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    // Parse type inferences
    const parseValue = (val) => {
      if (val === '' || val === 'null') return null;
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (!isNaN(val) && !isNaN(parseFloat(val))) return Number(val);
      return val;
    };

    const headers = parseCsvLine(lines[0]);
    const jsonArr = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const obj = {};
      headers.forEach((h, hIdx) => {
        obj[h || `col_${hIdx + 1}`] = parseValue(values[hIdx]);
      });
      jsonArr.push(obj);
    }

    return jsonArr;
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
    return '\n' + keys.map(k => `${spaces}${k}: ${this.jsonToYaml(obj[k], indent + 1)}`).join('\n');
  },

  yamlToJson(yamlText) {
    // Lightweight line-based YAML parser for flat/nested maps
    const lines = yamlText.split('\n');
    const result = {};
    lines.forEach(line => {
      const match = line.match(/^(\s*)([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (match) {
        let val = match[3].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        else if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val === 'null') val = null;
        else if (!isNaN(val) && val !== '') val = Number(val);
        result[match[2]] = val;
      }
    });
    return result;
  },

  jsonToXml(obj, rootName = 'root') {
    const toXml = (val, tag) => {
      if (val === null || val === undefined) return `<${tag}/>`;
      if (Array.isArray(val)) return val.map(item => toXml(item, tag)).join('\n');
      if (typeof val === 'object') {
        const inner = Object.keys(val).map(k => toXml(val[k], k)).join('\n');
        return `<${tag}>\n${inner}\n</${tag}>`;
      }
      return `<${tag}>${App.escapeHtml(String(val))}</${tag}>`;
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n` + toXml(obj, rootName);
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

  downloadConvertedOutput() {
    const out = document.getElementById('json-output')?.value;
    if (!out) return;
    const extMap = { 'csv': 'csv', 'csv-to-json': 'json', 'yaml': 'yaml', 'yaml-to-json': 'json', 'xml': 'xml', 'ts': 'ts' };
    const ext = extMap[this.currentMode] || 'txt';
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `converted.${ext}`;
    a.click();
    App.showToast(`Downloaded converted .${ext}`);
  },

  updateActiveTab() {
    document.querySelectorAll('[data-json-mode]').forEach(b => {
      b.classList.toggle('active', b.dataset.jsonMode === this.currentMode);
      b.classList.toggle('log-info', b.dataset.jsonMode === this.currentMode);
    });
  },

  // =========================================================================
  // Visualizer Tree & Node Building
  // =========================================================================

  renderTree(maxDepth = 99, filterText = '') {
    const container = document.getElementById('json-tree-container');
    if (!container) return;

    if (!this.parsedData) {
      container.innerHTML = `<div style="color: var(--text-dim); font-style: italic; padding: 1.5rem; text-align: center; font-size: 0.8rem;">JSON visualizer workspace. Paste or load JSON content to begin.</div>`;
      return;
    }

    this._nodeCount = 0;
    container.innerHTML = '';
    const rootNode = this.createTreeNode(null, this.parsedData, 0, filterText, maxDepth, []);
    container.appendChild(rootNode);
  },

  createTreeNode(key, val, depth, filterText, maxDepth, path) {
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
      const valSpan = document.createElement('span');
      valSpan.className = 'json-value';
      
      let type = typeof val;
      if (val === null) type = 'null';
      
      if (type === 'string') {
        valSpan.innerText = `"${val}"`;
        valSpan.style.color = '#10b981';
      } else if (type === 'number') {
        valSpan.innerText = val;
        valSpan.style.color = '#3b82f6';
      } else if (type === 'boolean') {
        valSpan.innerText = val;
        valSpan.style.color = '#f59e0b';
      } else if (type === 'null') {
        valSpan.innerText = 'null';
        valSpan.style.color = '#ef4444';
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
          if (e.key === 'Enter') saveValue();
          else if (e.key === 'Escape') this.renderTree();
        });
        
        editInput.addEventListener('blur', saveValue);
        valSpan.replaceWith(editInput);
        editInput.focus();
      });
      
      container.appendChild(valSpan);
    }
    
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
      this.redoStack = [];
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

  foldAll() { this.renderTree(0); },
  unfoldAll() { this.renderTree(99); },
  collapseToLevel(level) { this.renderTree(level); },

  filterKeys() {
    const filterInput = document.getElementById('json-tree-filter');
    if (filterInput) this.renderTree(99, filterInput.value.trim());
  },

  changeIndentation(spaces) {
    this.indentSpaces = spaces;
    this.syncInputFromParsed();
  },

  toggleSortKeys(el) {
    this.sortKeysEnabled = el.checked;
    if (this.sortKeysEnabled && this.parsedData) {
      this.sortKeys();
    }
  },

  toggleMinify(el) {
    this.minifyEnabled = el.checked;
    if (this.minifyEnabled && this.parsedData) {
      this.minify();
    } else {
      this.syncInputFromParsed();
    }
  },

  async loadFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const input = document.getElementById('json-input');
      if (input) {
        input.value = text;
        this.parseInputText();
        App.showToast(`Loaded file: ${file.name}`);
      }
    } catch (e) {
      App.showToast('Error loading file: ' + e.message, 'error');
    }
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
    let snippet = raw.slice(0, 30) + '...';
    this.history = this.history.filter(h => h.raw !== raw);
    this.history.unshift({ raw, label: snippet });
    if (this.history.length > 5) this.history.pop();
    try {
      localStorage.setItem('devutility_json_history', JSON.stringify(this.history));
    } catch (e) {}
    this.renderHistory();
  },

  clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem('devutility_json_history');
    } catch (e) {}
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
      <button class="log-filter-btn" style="text-align: left; padding: 6px 10px; font-family: var(--font-mono); font-size: 0.72rem; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onclick="JsonTool.loadHistoryItem(${i})" title="${App.escapeHtml(h.raw)}">
        ${App.escapeHtml(h.label)}
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

    if (this.parsedData) countKeys(this.parsedData);
    statKeys.innerText = `${keyCount} keys`;
    statSize.innerText = Perf.formatBytes(charSize);
  },

  queryJsonPath() {
    const q = document.getElementById('json-query-input')?.value.trim();
    if (!q) {
      this.transform();
      return;
    }
    const raw = document.getElementById('json-input')?.value.trim();
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
    } catch (e) {}
  }
};

window.JsonTool = JsonTool;

