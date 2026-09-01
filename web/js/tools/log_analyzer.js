// Log Analyzer & Stream Filter Tool
const LogTool = {
  activeFiles: [], // Array of { name, size, lines: Array of strings }
  parsedLines: [], // Array of { fileName, lineNum, text, severity, timestamp }
  matchIndices: [],
  currentMatchIndex: -1,
  timelineFilterSegment: null, // index of filtered segment, null for all
  historyKey: 'log-analyzer',
  caseSensitive: false,
  regexMode: false,

  init() {
    const query = document.getElementById('log-query');
    const optRegex = document.getElementById('log-opt-regex');
    const optCase = document.getElementById('log-opt-case');
    const sampleBtn = document.getElementById('log-sample-btn');
    const clearBtn = document.getElementById('log-clear-btn');
    
    const dropzone = document.getElementById('log-dropzone');
    const fileInput = document.getElementById('log-file-input');
    const folderInput = document.getElementById('log-folder-input');

    const prevBtn = document.getElementById('log-btn-prev');
    const nextBtn = document.getElementById('log-btn-next');
    const copyBtn = document.getElementById('log-copy-btn');
    const downloadBtn = document.getElementById('log-download-btn');

    if (!query) return;

    // Search query events with 150ms debounce
    const debouncedFilter = Perf.debounce(() => this.filterLogs(), 150);
    query.addEventListener('input', debouncedFilter);

    if (optRegex) {
      optRegex.addEventListener('change', (e) => {
        this.regexMode = e.target.checked;
        this.filterLogs();
      });
    }

    if (optCase) {
      optCase.addEventListener('click', () => {
        this.caseSensitive = !this.caseSensitive;
        optCase.classList.toggle('active', this.caseSensitive);
        this.filterLogs();
      });
    }

    // Load sample
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        const sampleText = `[2026-08-28 11:30:01.102] [main] INFO com.app.service.AppInitializer - Initializing application context...
[2026-08-28 11:30:01.341] [main] DEBUG com.app.repository.UserRepository - Initializing HikariPool connection pool...
[2026-08-28 11:30:01.890] [main] INFO com.zaxxer.hikari.HikariDataSource - HikariPool-1 - Starting...
[2026-08-28 11:30:02.011] [main] WARN com.zaxxer.hikari.pool.PoolBase - HikariPool-1 - mysql-connector-j-8.0.33.jar Pool configuration lacks validationQuery
[2026-08-28 11:30:02.410] [main] INFO com.zaxxer.hikari.pool.HikariPool - HikariPool-1 - Added connection com.mysql.cj.jdbc.ConnectionImpl@6921b3
[2026-08-28 11:30:02.912] [main] INFO com.app.service.AppInitializer - Application context initialized successfully in 1810 ms.
[2026-08-28 11:30:03.112] [http-nio-8080-exec-1] DEBUG com.app.web.filter.JwtAuthFilter - Extracting JWT authorization headers
[2026-08-28 11:30:03.210] [http-nio-8080-exec-1] WARN com.app.web.filter.JwtAuthFilter - Missing JWT Authorization token from headers
[2026-08-28 11:30:03.950] [http-nio-8080-exec-2] DEBUG com.app.web.filter.JwtAuthFilter - Token authenticated successfully for user_id=987
[2026-08-28 11:30:04.002] [http-nio-8080-exec-2] ERROR com.app.service.PaymentService - Transaction failed for order_id=324: Socket timeout from gateway
[2026-08-28 11:30:04.502] [http-nio-8080-exec-2] ERROR com.app.service.PaymentService - Database connection timed out after retry
[2026-08-28 11:30:05.105] [Database-1] TRACE com.app.config.DatabaseConfig - Executing query: SELECT * FROM orders WHERE id = 324`;
        
        this.activeFiles = [{ name: 'logfile.log', size: sampleText.length, lines: sampleText.split('\n') }];
        this.parseActiveFiles();
        App.showToast('Sample logs loaded successfully');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }

    // Gutter navigations
    if (prevBtn) prevBtn.addEventListener('click', () => this.navigateMatch(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this.navigateMatch(1));

    // Export actions
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = this.getFilteredText();
        if (text) App.copyToClipboard(text);
      });
    }
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const text = this.getFilteredText();
        if (text) {
          const blob = new Blob([text], { type: 'text/plain' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'filtered_logs.log';
          a.click();
        }
      });
    }

    // Bind severity filters toggles
    ['log-lvl-err', 'log-lvl-warn', 'log-lvl-info', 'log-lvl-debug', 'log-lvl-trace', 'log-lvl-other'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          this.filterLogs();
        });
      }
    });

    // Drag & Drop
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-focus)';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length > 0) this.importFiles(e.dataTransfer.files);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) this.importFiles(e.target.files);
      });
    }

    if (folderInput) {
      folderInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) this.importFiles(e.target.files);
      });
    }

  },

  clearAll() {
    this.activeFiles = [];
    this.parsedLines = [];
    this.matchIndices = [];
    this.currentMatchIndex = -1;
    this.timelineFilterSegment = null;
    
    const query = document.getElementById('log-query');
    if (query) query.value = '';

    const outView = document.getElementById('log-output-view');
    if (outView) outView.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-dim); font-style: italic; font-size: 0.82rem;">No logs loaded. Drop files, choose folders, or load sample logs to begin.</div>';
    
    this.renderSidebarDetails();
    this.updateStatsBadge(0, 0);
  },

  async importFiles(files) {
    const list = Array.from(files).filter(f => 
      f.name.endsWith('.log') || f.name.endsWith('.txt') || f.name.endsWith('.err') || f.type.startsWith('text/')
    );

    if (list.length === 0) {
      App.showToast('No valid log files found (.log, .txt)', 'error');
      return;
    }

    // Sort alphabetically
    list.sort((a, b) => a.name.localeCompare(b));

    for (const file of list) {
      const text = await this.readText(file);
      this.activeFiles.push({
        name: file.name,
        size: file.size,
        lines: text.split('\n')
      });
    }

    this.parseActiveFiles();
    App.showToast(`Successfully imported ${list.length} log file(s)`);
  },

  readText(file) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = (e) => resolve(e.target.result);
      r.onerror = () => resolve('');
      r.readAsText(file);
    });
  },

  parseActiveFiles() {
    this.parsedLines = [];
    
    this.activeFiles.forEach(file => {
      file.lines.forEach((line, idx) => {
        if (!line.trim()) return;

        const upper = line.toUpperCase();
        let severity = 'other';
        if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('EXCEPTION') || upper.includes('ERR')) severity = 'error';
        else if (upper.includes('WARN') || upper.includes('WARNING')) severity = 'warn';
        else if (upper.includes('INFO')) severity = 'info';
        else if (upper.includes('DEBUG')) severity = 'debug';
        else if (upper.includes('TRACE')) severity = 'trace';

        this.parsedLines.push({
          fileName: file.name,
          lineNum: idx + 1,
          text: line,
          severity
        });
      });
    });

    // Automatically make all filter toggles active on file load
    ['error', 'warn', 'info', 'debug', 'trace', 'other'].forEach(sev => {
      const btn = document.getElementById(`log-lvl-${sev}`);
      if (btn) btn.classList.add('active');
    });

    this.timelineFilterSegment = null;
    this.renderSidebarDetails();
    this.filterLogs();
  },

  filterLogs() {
    const queryVal = document.getElementById('log-query').value;
    const outView = document.getElementById('log-output-view');
    if (!outView) return;

    if (this.parsedLines.length === 0) {
      outView.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-dim); font-style: italic; font-size: 0.82rem;">No logs loaded. Drop files, choose folders, or load sample logs to begin.</div>';
      this.updateStatsBadge(0, 0);
      return;
    }

    // Get active severities
    const activeSevs = new Set();
    ['error', 'warn', 'info', 'debug', 'trace', 'other'].forEach(sev => {
      const btn = document.getElementById(`log-lvl-${sev}`);
      if (btn && btn.classList.contains('active')) {
        activeSevs.add(sev);
      }
    });

    // Filter by search text
    let regex = null;
    if (queryVal.trim()) {
      if (this.regexMode) {
        try {
          regex = new RegExp(queryVal, this.caseSensitive ? '' : 'i');
        } catch(e) {
          regex = null;
        }
      }
    }

    // Calculate segment bounds if timeline slice is filtered
    let startIdx = 0, endIdx = this.parsedLines.length;
    if (this.timelineFilterSegment !== null) {
      const segSize = Math.ceil(this.parsedLines.length / 12);
      startIdx = this.timelineFilterSegment * segSize;
      endIdx = Math.min(startIdx + segSize, this.parsedLines.length);
    }

    let matchHtml = [];
    this.matchIndices = [];

    this.parsedLines.forEach((line, idx) => {
      // Timeline filter check
      if (idx < startIdx || idx >= endIdx) return;

      // Severity check
      if (!activeSevs.has(line.severity)) return;

      // Search match query check
      let isMatch = true;
      if (queryVal.trim()) {
        if (regex) {
          isMatch = regex.test(line.text);
        } else {
          const matchStr = this.caseSensitive ? line.text : line.text.toLowerCase();
          const searchStr = this.caseSensitive ? queryVal : queryVal.toLowerCase();
          
          if (searchStr.includes('|')) {
            const parts = searchStr.split('|');
            isMatch = parts.some(p => p.trim() && matchStr.includes(p.trim()));
          } else {
            isMatch = matchStr.includes(searchStr);
          }
        }
      }

      if (!isMatch) return;

      // Construct highlighted match
      let displayHtml = App.escapeHtml(line.text);
      if (queryVal.trim()) {
        if (regex) {
          displayHtml = displayHtml.replace(regex, '<span class="match-hl">$&</span>');
        } else {
          const parts = queryVal.split('|').map(p => p.trim()).filter(Boolean);
          parts.forEach(part => {
            const escPart = App.escapeHtml(part);
            displayHtml = displayHtml.replace(new RegExp(`(${escPart})`, this.caseSensitive ? 'g' : 'gi'), '<span class="match-hl">$1</span>');
          });
        }
      }

      const matchId = `log-match-row-${this.matchIndices.length}`;
      this.matchIndices.push(idx);

      // Capped DOM rendering to keep browser silky smooth on large logs
      if (this.matchIndices.length <= 500) {
        matchHtml.push(`
          <div class="log-row log-${line.severity}" id="${matchId}">
            <div class="log-row-gutter" title="${line.fileName}">${line.fileName.slice(0, 10)}:${line.lineNum}</div>
            <div class="log-row-text">${displayHtml}</div>
          </div>
        `);
      }
    });

    if (this.matchIndices.length > 500) {
      matchHtml.push(`
        <div style="padding: 10px; text-align: center; color: var(--text-dim); font-size: 0.72rem; font-style: italic; background: var(--bg-pane); border-top: 1px solid var(--border-color);">
          Showing first 500 of ${this.matchIndices.length} matches. Refine your search query or click "Export / Copy" to get the full log output.
        </div>
      `);
    }

    outView.innerHTML = matchHtml.length > 0 ? matchHtml.join('') : '<div style="padding:1.5rem; text-align:center; color:var(--text-muted);">No matching logs found</div>';
    this.updateStatsBadge(this.matchIndices.length, this.parsedLines.length);

    this.currentMatchIndex = -1;
    this.updateMatchIndexLabel();
  },

  updateStatsBadge(matches, total) {
    const badge = document.getElementById('log-match-badge');
    if (badge) badge.innerText = `${matches} / ${total} lines`;
  },

  navigateMatch(direction) {
    if (this.matchIndices.length === 0) return;
    
    this.currentMatchIndex += direction;
    if (this.currentMatchIndex < 0) this.currentMatchIndex = this.matchIndices.length - 1;
    if (this.currentMatchIndex >= this.matchIndices.length) this.currentMatchIndex = 0;

    this.updateMatchIndexLabel();

    const row = document.getElementById(`log-match-row-${this.currentMatchIndex}`);
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      // Flash row
      row.style.outline = '2px solid var(--c-purple)';
      setTimeout(() => { row.style.outline = 'none'; }, 800);
    }
  },

  updateMatchIndexLabel() {
    const lbl = document.getElementById('log-index-val');
    if (!lbl) return;
    if (this.matchIndices.length === 0) {
      lbl.innerText = '- / 0';
    } else {
      lbl.innerText = `${this.currentMatchIndex === -1 ? '-' : this.currentMatchIndex + 1} / ${this.matchIndices.length}`;
    }
  },

  getFilteredText() {
    if (this.matchIndices.length === 0) return '';
    return this.matchIndices.map(idx => this.parsedLines[idx].text).join('\n');
  },

  renderSidebarDetails() {
    const filesList = document.getElementById('log-files-list');
    const lvlDist = document.getElementById('log-level-distribution');
    const timeline = document.getElementById('log-timeline-chart');
    const keywords = document.getElementById('log-keywords-cloud');

    // 1. Files List Details
    if (filesList) {
      if (this.activeFiles.length === 0) {
        filesList.innerHTML = '<div style="font-size: 0.72rem; color: var(--text-dim); text-align: center; padding: 2px;">No active files</div>';
      } else {
        filesList.innerHTML = this.activeFiles.map((f, idx) => `
          <div class="log-file-chip">
            <span style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:130px;" title="${f.name}">${f.name}</span>
            <span style="color:var(--text-dim); font-size:0.65rem;">${f.lines.length} lines</span>
            <button class="log-file-chip-close" onclick="LogTool.removeFile(${idx})">×</button>
          </div>
        `).join('');
      }
    }

    if (this.parsedLines.length === 0) {
      if (lvlDist) lvlDist.innerHTML = '';
      if (timeline) timeline.innerHTML = '';
      if (keywords) keywords.innerHTML = '';
      return;
    }

    // 2. Level Severity Distributions
    const counts = { error: 0, warn: 0, info: 0, debug: 0, trace: 0, other: 0 };
    this.parsedLines.forEach(l => counts[l.severity]++);
    const total = this.parsedLines.length;

    if (lvlDist) {
      lvlDist.innerHTML = `
        <div style="background-color:#ef4444; width:${(counts.error/total)*100}%;" title="Error: ${counts.error} lines"></div>
        <div style="background-color:#f59e0b; width:${(counts.warn/total)*100}%;" title="Warn: ${counts.warn} lines"></div>
        <div style="background-color:#3b82f6; width:${(counts.info/total)*100}%;" title="Info: ${counts.info} lines"></div>
        <div style="background-color:#a855f7; width:${(counts.debug/total)*100}%;" title="Debug: ${counts.debug} lines"></div>
        <div style="background-color:#0d9488; width:${(counts.trace/total)*100}%;" title="Trace: ${counts.trace} lines"></div>
        <div style="background-color:#db2777; width:${(counts.other/total)*100}%;" title="Other: ${counts.other} lines"></div>
      `;
    }

    // 3. Timeline Density Slicing Histogram
    if (timeline) {
      const segSize = Math.ceil(total / 12);
      let segmentMax = 0;
      const segs = Array.from({ length: 12 }, (_, sIdx) => {
        const start = sIdx * segSize;
        const end = Math.min(start + segSize, total);
        const count = Math.max(0, end - start);
        if (count > segmentMax) segmentMax = count;
        return count;
      });

      timeline.innerHTML = segs.map((count, sIdx) => {
        const heightPct = segmentMax > 0 ? (count / segmentMax) * 100 : 0;
        const activeCls = this.timelineFilterSegment === sIdx ? 'active' : '';
        return `
          <div class="log-chart-bar ${activeCls}" style="height:${Math.max(4, heightPct)}%;" onclick="LogTool.filterTimelineSegment(${sIdx})" title="Segment ${sIdx+1}: ${count} lines"></div>
        `;
      }).join('');
    }

    // 4. Keyword cloud tags cloud
    if (keywords) {
      const wordCounts = {};
      const wordSeverities = {};
      const ignoreWords = new Set(['the', 'and', 'a', 'of', 'to', 'in', 'is', 'for', 'on', 'with', 'at', 'by', 'an', 'from', 'this', 'that', 'it', 'was', 'were', 'be', 'or', 'as', 'are', 'at', 'log', 'logs']);
      
      this.parsedLines.forEach(line => {
        const words = line.text.match(/[a-zA-Z]{3,}/g);
        if (words) {
          words.forEach(w => {
            const clean = w.toLowerCase();
            if (ignoreWords.has(clean) || clean.length > 25) return;
            
            wordCounts[w] = (wordCounts[w] || 0) + 1;
            
            if (!wordSeverities[w]) {
              wordSeverities[w] = { error: 0, warn: 0, info: 0, debug: 0, trace: 0, other: 0 };
            }
            wordSeverities[w][line.severity]++;
          });
        }
      });

      // Get top 15 terms
      const sortedWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

      keywords.innerHTML = sortedWords.map(([word, count]) => {
        const sevs = wordSeverities[word] || { error: 0, warn: 0, info: 0, debug: 0, trace: 0, other: 0 };
        let dominantSev = 'other';
        let maxVal = -1;
        for (const [sev, val] of Object.entries(sevs)) {
          if (val > maxVal) {
            maxVal = val;
            dominantSev = sev;
          }
        }

        let colorStyle = '';
        if (dominantSev === 'error') colorStyle = 'border-color: #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.08);';
        else if (dominantSev === 'warn') colorStyle = 'border-color: #f59e0b; color: #f59e0b; background: rgba(245, 158, 11, 0.08);';
        else if (dominantSev === 'info') colorStyle = 'border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.08);';
        else if (dominantSev === 'debug') colorStyle = 'border-color: #a855f7; color: #a855f7; background: rgba(168, 85, 247, 0.08);';
        else if (dominantSev === 'trace') colorStyle = 'border-color: #6b7280; color: #6b7280; background: rgba(107, 114, 128, 0.08);';
        else colorStyle = 'border-color: #9ca3af; color: #9ca3af; background: rgba(156, 163, 175, 0.08);';

        return `
          <span class="log-keyword-badge" style="${colorStyle}" onclick="LogTool.filterByKeyword('${word.replace(/'/g, "\\'")}')">${word} (${count})</span>
        `;
      }).join('');
    }
  },

  removeFile(index) {
    this.activeFiles.splice(index, 1);
    this.parseActiveFiles();
    App.showToast('File removed from logs stream');
  },

  filterTimelineSegment(segmentIndex) {
    if (this.timelineFilterSegment === segmentIndex) {
      this.timelineFilterSegment = null; // Clear timeline filter
    } else {
      this.timelineFilterSegment = segmentIndex;
    }
    
    // Refresh bar chart rendering
    const timeline = document.getElementById('log-timeline-chart');
    if (timeline) {
      Array.from(timeline.children).forEach((bar, sIdx) => {
        bar.classList.toggle('active', this.timelineFilterSegment === sIdx);
      });
    }

    this.filterLogs();
  },

  filterByKeyword(word) {
    const query = document.getElementById('log-query');
    if (query) {
      query.value = word;
      this.filterLogs();
    }
  }
};
