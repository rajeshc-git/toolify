// Toolify Performance Utilities — debounce, throttle, progress, chunked processing
const Perf = {
  // Reusable debounce — returns a debounced version of fn
  debounce(fn, ms = 150) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  // RAF-based throttle — fires at most once per animation frame
  throttleRAF(fn) {
    let rafId = null;
    return function(...args) {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        fn.apply(this, args);
        rafId = null;
      });
    };
  },

  // Show a slim progress bar inside a container element
  showProgressBar(containerId, percent = 0, indeterminate = false) {
    let bar = document.getElementById(`pb-${containerId}`);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = `pb-${containerId}`;
      bar.className = 'toolify-progress-bar' + (indeterminate ? ' indeterminate' : '');
      bar.innerHTML = '<div class="toolify-progress-fill" style="width:0%"></div>';
      const container = document.getElementById(containerId);
      if (container) container.prepend(bar);
      else return;
    }
    bar.classList.remove('hidden');
    bar.classList.toggle('indeterminate', indeterminate);
    const fill = bar.querySelector('.toolify-progress-fill');
    if (fill && !indeterminate) {
      fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
      fill.classList.toggle('done', percent >= 100);
    }
  },

  // Hide and remove progress bar with fade
  hideProgressBar(containerId) {
    const bar = document.getElementById(`pb-${containerId}`);
    if (bar) {
      const fill = bar.querySelector('.toolify-progress-fill');
      if (fill) { fill.style.width = '100%'; fill.classList.add('done'); }
      setTimeout(() => {
        bar.classList.add('hidden');
        setTimeout(() => bar.remove(), 300);
      }, 400);
    }
  },

  // Show a CSS spinner inside an element
  showSpinner(elementId, label = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    const existing = el.querySelector('.toolify-spinner-wrap');
    if (existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.className = 'toolify-spinner-wrap';
    wrap.innerHTML = `<span class="toolify-spinner"></span>${label ? `<span>${label}</span>` : ''}`;
    el.prepend(wrap);
  },

  // Remove spinner from element
  hideSpinner(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const wrap = el.querySelector('.toolify-spinner-wrap');
    if (wrap) wrap.remove();
  },

  // Process array in chunks to keep UI responsive
  // Returns a Promise that resolves when all chunks are done
  chunkedProcess(items, chunkSize, processFn, onProgress) {
    return new Promise((resolve) => {
      let idx = 0;
      const total = items.length;
      const results = [];
      function processChunk() {
        const end = Math.min(idx + chunkSize, total);
        for (let i = idx; i < end; i++) {
          results.push(processFn(items[i], i));
        }
        idx = end;
        if (onProgress) onProgress(Math.round((idx / total) * 100), idx, total);
        if (idx < total) {
          setTimeout(processChunk, 0);
        } else {
          resolve(results);
        }
      }
      if (total === 0) { resolve(results); return; }
      processChunk();
    });
  },

  // Format bytes to human readable string
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
};

window.Perf = Perf;

// Toolify Main Application Coordinator & Router
const App = {
  tools: [
    { id: 'har-extractor', name: 'HAR Extractor', cat: 'DATA', desc: 'Inspect API requests, headers, and responses from HAR files' },
    { id: 'json-tools', name: 'JSON Tools', cat: 'DATA', desc: 'Format, minify, and convert JSON to CSV, YAML, & TypeScript' },
    { id: 'log-analyzer', name: 'Log Analyzer', cat: 'DATA', desc: 'Filter and search large log files by level, file, or pattern' },
    { id: 'document-analyzer', name: 'Document Analyzer', cat: 'DATA', desc: 'Inspect text statistics, reading score, word frequency' },
    { id: 'base64-converter', name: 'Base64 Converter', cat: 'ENCODING', desc: 'Decode base64 string or data URI into image, PDF, audio' },
    { id: 'file-to-base64', name: 'File to Base64', cat: 'ENCODING', desc: 'Convert any file into Base64 Data URI or img tag' },
    { id: 'base64-text', name: 'Base64 Text Encoder', cat: 'ENCODING', desc: 'Encode and decode plain text as Base64, Hex, Binary' },
    { id: 'url-encoder', name: 'URL Encoder / Decoder', cat: 'ENCODING', desc: 'Encode/decode full URLs and parse query parameters' },
    { id: 'jwt-decoder', name: 'JWT Decoder', cat: 'SECURITY', desc: 'Decode JWT header, payload, expiry status, and remaining time' },
    { id: 'password-generator', name: 'Password Generator', cat: 'SECURITY', desc: 'Generate secure random passwords & passphrases with entropy' },
    { id: 'uuid-hash', name: 'UUID & Hash Generator', cat: 'SECURITY', desc: 'Generate UUID v4, v7, NanoID, MD5, SHA-256, SHA-512' },
    { id: 'regex-tester', name: 'Regex Tester', cat: 'TEXT', desc: 'Test regular expressions against sample text with live matches' },
    { id: 'text-diff', name: 'Text Diff', cat: 'TEXT', desc: 'Line-by-line and character diff for plain text & code' },
    { id: 'case-text', name: 'Case & Text Utilities', cat: 'TEXT', desc: 'Convert casing, slugify, sort lines, trim, and deduplicate' },
    { id: 'html-sandbox', name: 'HTML & Markdown Live', cat: 'TEXT', desc: 'Live preview sandbox for HTML, CSS, JS, and Markdown' },
    { id: 'timestamp-converter', name: 'Timestamp Converter', cat: 'UTILITIES', desc: 'Convert between epoch time and human-readable dates' },
    { id: 'number-base', name: 'Number Base Converter', cat: 'UTILITIES', desc: 'Convert decimal, hex, octal, binary, and 32-bit float' },
    { id: 'color-converter', name: 'Color Converter', cat: 'UTILITIES', desc: 'Convert HEX, RGB, HSL, CMYK, and check WCAG contrast ratios' },
    { id: 'cron-explainer', name: 'Cron Explainer', cat: 'UTILITIES', desc: 'Explain cron expressions in plain English and calculate next runs' },
    { id: 'pdf-tools', name: 'PDF Tools', cat: 'UTILITIES', desc: 'Merge, split, extract text, and convert images to PDF' },
  ],

  init() {
    this.checkStandaloneMode();
    try { this.setupTheme(); } catch(e) { console.error('Theme setup error:', e); }
    try { this.setupNavigation(); } catch(e) { console.error('Navigation setup error:', e); }
    try { this.setupCommandPalette(); } catch(e) { console.error('Command palette setup error:', e); }
    try { this.setupGlobalSearch(); } catch(e) { console.error('Global search setup error:', e); }
    try { this.initTools(); } catch(e) { console.error('Tool init error:', e); }

    // Handle hash route changes
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();

    console.log('%cToolify Initialized%c [20 tools loaded]', 'color:#7c3aed; font-weight:bold; font-size:14px;', 'color:#10b981;');
  },

  checkStandaloneMode() {
    // Only hide download buttons when inside true native desktop apps (Electron or Cocoa ToolifyNativeApp)
    const isStandalone = navigator.userAgent.includes('Electron') ||
                         navigator.userAgent.includes('ToolifyNativeApp') ||
                         window.isToolifyNativeDesktopApp === true;

    if (isStandalone) {
      document.documentElement.classList.add('is-standalone-app');
      const dlWrap = document.getElementById('topbar-downloads-wrap');
      if (dlWrap) dlWrap.style.display = 'none';
    } else {
      document.documentElement.classList.remove('is-standalone-app');
      const dlWrap = document.getElementById('topbar-downloads-wrap');
      if (dlWrap) dlWrap.style.display = 'flex';
    }
  },



  initTools() {
    const toolInits = [
      ['HarTool', () => typeof HarTool !== 'undefined' && HarTool.init()],
      ['JsonTool', () => typeof JsonTool !== 'undefined' && JsonTool.init()],
      ['LogTool', () => typeof LogTool !== 'undefined' && LogTool.init()],
      ['DocAnalyzerTool', () => typeof DocAnalyzerTool !== 'undefined' && DocAnalyzerTool.init()],
      ['Base64ConverterTool', () => typeof Base64ConverterTool !== 'undefined' && Base64ConverterTool.init()],
      ['FileBase64Tool', () => typeof FileBase64Tool !== 'undefined' && FileBase64Tool.init()],
      ['Base64TextTool', () => typeof Base64TextTool !== 'undefined' && Base64TextTool.init()],
      ['UrlTool', () => typeof UrlTool !== 'undefined' && UrlTool.init()],
      ['JwtTool', () => typeof JwtTool !== 'undefined' && JwtTool.init()],
      ['PasswordTool', () => typeof PasswordTool !== 'undefined' && PasswordTool.init()],
      ['UuidHashTool', () => typeof UuidHashTool !== 'undefined' && UuidHashTool.init()],
      ['RegexTool', () => typeof RegexTool !== 'undefined' && RegexTool.init()],
      ['TextDiffTool', () => typeof TextDiffTool !== 'undefined' && TextDiffTool.init()],
      ['CaseTool', () => typeof CaseTool !== 'undefined' && CaseTool.init()],
      ['HtmlSandboxTool', () => typeof HtmlSandboxTool !== 'undefined' && HtmlSandboxTool.init()],
      ['TimestampTool', () => typeof TimestampTool !== 'undefined' && TimestampTool.init()],
      ['NumberBaseTool', () => typeof NumberBaseTool !== 'undefined' && NumberBaseTool.init()],
      ['ColorTool', () => typeof ColorTool !== 'undefined' && ColorTool.init()],
      ['CronTool', () => typeof CronTool !== 'undefined' && CronTool.init()],
      ['PdfTool', () => typeof PdfTool !== 'undefined' && PdfTool.init()],
    ];

    toolInits.forEach(([name, initFn]) => {
      try { initFn(); } catch(e) { console.error(`Error initializing ${name}:`, e); }
    });
  },

  handleRoute() {
    const hash = (window.location.hash || '#home').replace('#', '') || 'home';
    const views = document.querySelectorAll('.tool-view');
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

    let activeFound = false;
    views.forEach(v => {
      if (v.id === 'view-' + hash) {
        v.classList.add('active');
        activeFound = true;
      } else {
        v.classList.remove('active');
      }
    });

    if (!activeFound) {
      const homeView = document.getElementById('view-home');
      if (homeView) homeView.classList.add('active');
    }

    navItems.forEach(item => {
      if (item.getAttribute('data-tool') === hash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  setupTheme() {
    const segButtons = document.querySelectorAll('.theme-seg-btn');
    const savedTheme = localStorage.getItem('devutility_theme') || 'colorful';
    
    this.applyTheme(savedTheme, false);

    // Segmented Toggle in Topbar Header
    segButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.setTheme;
        if (theme) this.applyTheme(theme, true);
      });
    });
  },

  applyTheme(theme, showToast = false) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('devutility_theme', theme);

    // Update Segmented Buttons Active State
    document.querySelectorAll('.theme-seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.setTheme === theme);
    });


    if (showToast) {
      const labels = {
        light: '☀️ Light Mode activated',
        colorful: '🎨 Colorful Mesh Sunset Mode activated',
        dark: '🌙 Dark Mode activated'
      };
      this.showToast(labels[theme] || `Theme set to ${theme}`);
    }
  },


  setupNavigation() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const brandLink = document.getElementById('brand-link');

    const openMobileSidebar = () => {
      if (sidebar) sidebar.classList.add('mobile-open');
      if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    };

    const closeMobileSidebar = () => {
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    };

    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
      });
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          closeMobileSidebar();
        } else {
          openMobileSidebar();
        }
      });
    }

    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    }

    if (brandLink) {
      brandLink.addEventListener('click', closeMobileSidebar);
    }

    // Close mobile sidebar on nav click
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        closeMobileSidebar();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileSidebar();
      }
    });
  },

  setupCommandPalette() {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('modal-search-input');
    const sidebarSearchBtn = document.getElementById('sidebar-search-btn');

    if (!modal || !input) return;

    let selectedIndex = 0;
    let currentFiltered = [];

    const openModal = (initialQuery = '') => {
      modal.style.display = 'flex';
      input.value = initialQuery;
      selectedIndex = 0;
      currentFiltered = this.renderModalResults(initialQuery, selectedIndex);
      input.focus();
    };

    const closeModal = () => {
      modal.style.display = 'none';
    };

    const selectAndOpen = (tool) => {
      if (!tool) return;
      window.location.hash = `#${tool.id}`;
      closeModal();
      this.showToast(`Opened ${tool.name}`);
    };

    if (sidebarSearchBtn) sidebarSearchBtn.addEventListener('click', () => openModal());

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal.style.display === 'none' || !modal.style.display) {
          openModal();
        } else {
          closeModal();
        }
      }
      if (e.key === 'Escape') {
        if (modal.style.display === 'flex') closeModal();
        const dlModal = document.getElementById('download-app-modal');
        if (dlModal && dlModal.style.display === 'flex') dlModal.style.display = 'none';
      }
    });


    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    input.addEventListener('input', (e) => {
      selectedIndex = 0;
      currentFiltered = this.renderModalResults(e.target.value.trim(), selectedIndex);
    });

    // Keyboard navigation: Enter to execute search/open, ArrowUp/ArrowDown to select
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentFiltered.length > 0) {
          selectedIndex = (selectedIndex + 1) % currentFiltered.length;
          this.updateSelectedModalItem(selectedIndex);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentFiltered.length > 0) {
          selectedIndex = (selectedIndex - 1 + currentFiltered.length) % currentFiltered.length;
          this.updateSelectedModalItem(selectedIndex);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentFiltered.length > 0) {
          const tool = currentFiltered[selectedIndex] || currentFiltered[0];
          selectAndOpen(tool);
        }
      }
    });
  },

  updateSelectedModalItem(index) {
    const items = document.querySelectorAll('.modal-result-item');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === index);
      if (idx === index) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  },

  renderModalResults(query, selectedIndex = 0) {
    const resultsList = document.getElementById('modal-results-list');
    if (!resultsList) return [];

    const q = (query || '').toLowerCase();

    const filtered = this.tools.filter(t => 
      !q || t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      resultsList.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted);">No matching tools found</div>';
      return [];
    }

    resultsList.innerHTML = filtered.map((tool, idx) => `
      <div class="modal-result-item ${idx === selectedIndex ? 'selected' : ''}" data-tool-id="${tool.id}" onclick="window.location.hash='#${tool.id}'; document.getElementById('search-modal').style.display='none';">
        <div style="font-size:0.75rem; font-weight:700; color:var(--c-purple); width:80px;">${tool.cat}</div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:0.9rem;">${tool.name}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${tool.desc}</div>
        </div>
        <kbd style="font-size:0.72rem; color:var(--text-dim);">↵</kbd>
      </div>
    `).join('');

    return filtered;
  },

  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    if (!input) return;

    const modal = document.getElementById('search-modal');
    const modalInput = document.getElementById('modal-search-input');

    const openWithQuery = (q = '') => {
      if (!modal) return;
      modal.style.display = 'flex';
      if (modalInput) {
        modalInput.value = q;
        this.renderModalResults(q);
        modalInput.focus();
      }
    };

    input.addEventListener('focus', () => {
      openWithQuery(input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        const match = this.tools.find(t => 
          t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
        );
        if (match) {
          window.location.hash = `#${match.id}`;
          this.showToast(`Opened ${match.name}`);
        } else {
          openWithQuery(input.value);
        }
      }
    });
  },

  openDownloadModal(platform = 'mac') {
    const modal = document.getElementById('download-app-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    this.switchDownloadTab(platform);

    modal.onclick = (e) => {
      if (e.target === modal) this.closeDownloadModal();
    };
  },

  closeDownloadModal() {
    const modal = document.getElementById('download-app-modal');
    if (modal) modal.style.display = 'none';
  },

  switchDownloadTab(platform) {
    const tabMac = document.getElementById('download-tab-mac');
    const tabWin = document.getElementById('download-tab-windows');
    const panelMac = document.getElementById('download-panel-mac');
    const panelWin = document.getElementById('download-panel-windows');

    if (platform === 'mac') {
      if (tabMac) tabMac.classList.add('active');
      if (tabWin) tabWin.classList.remove('active');
      if (panelMac) panelMac.style.display = 'flex';
      if (panelWin) panelWin.style.display = 'none';
    } else {
      if (tabWin) tabWin.classList.add('active');
      if (tabMac) tabMac.classList.remove('active');
      if (panelWin) panelWin.style.display = 'flex';
      if (panelMac) panelMac.style.display = 'none';
    }
  },

  onDownloadTriggered(platform) {
    if (platform === 'mac') {
      this.showToast('🚀 Downloading Toolify.dmg for macOS...');
    } else {
      this.showToast('🚀 Downloading Toolify.exe for Windows...');
    }
  },



  copyToClipboard(text, triggerEl) {
    const btn = triggerEl || (window.event ? window.event.currentTarget || window.event.target : null);
    
    // Haptic feedback (vibrate 15ms)
    if (navigator.vibrate) {
      try { navigator.vibrate(15); } catch(e) {}
    }

    const performCopy = () => {
      this.showToast('Copied to clipboard!');
      if (btn) this.applyCopyFeedback(btn);
    };

    const textLength = text ? text.length : 0;

    // For very large strings (>5MB), offer download instead — clipboard APIs will fail
    if (textLength > 5 * 1024 * 1024) {
      this._downloadAsFile(text, 'toolify_output.txt');
      this.showToast('Output too large for clipboard — downloaded as file instead');
      if (btn) this.applyCopyFeedback(btn);
      return;
    }

    // For large strings (>100KB), use Blob + ClipboardItem API to avoid DOM overhead
    if (textLength > 100 * 1024 && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const blob = new Blob([text], { type: 'text/plain' });
        const item = new ClipboardItem({ 'text/plain': blob });
        navigator.clipboard.write([item]).then(performCopy).catch(() => {
          // Fallback to writeText
          navigator.clipboard.writeText(text).then(performCopy).catch(() => {
            this._fallbackCopy(text);
            performCopy();
          });
        });
        return;
      } catch(e) {
        // ClipboardItem not supported, fall through
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(performCopy).catch(() => {
        this._fallbackCopy(text);
        if (btn) this.applyCopyFeedback(btn);
      });
    } else {
      this._fallbackCopy(text);
      if (btn) this.applyCopyFeedback(btn);
    }
  },


  applyCopyFeedback(btn) {
    if (!btn || btn.classList.contains('copy-feedback-active')) return;

    btn.classList.add('copy-feedback-active');
    const originalHtml = btn.innerHTML;
    const originalText = btn.innerText.trim();

    const hasSvg = btn.querySelector('svg');
    const isTextCopy = originalText.toLowerCase() === 'copy' || originalText.toLowerCase() === 'copy all';

    if (isTextCopy) {
      btn.innerText = '✓ Copied';
      if (btn.style) {
        btn.style.color = '#10b981';
        btn.style.borderColor = '#10b981';
      }
    } else if (hasSvg) {
      const svg = btn.querySelector('svg');
      const width = svg.getAttribute('width') || '14';
      const height = svg.getAttribute('height') || '14';
      btn.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" class="copy-tick-animation"><polyline points="20 6 9 17 4 12"/></svg>`;
      if (btn.style) btn.style.color = '#10b981';
    } else {
      btn.innerText = '✓';
    }

    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.classList.remove('copy-feedback-active');
      if (btn.style) {
        btn.style.color = '';
        btn.style.borderColor = '';
      }
    }, 1500);
  },

  _fallbackCopy(text) {
    // Cap textarea fallback at 500KB to prevent DOM freeze
    const safeText = text && text.length > 512000 ? text.substring(0, 512000) : text;
    const ta = document.createElement('textarea');
    ta.value = safeText;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    if (text && text.length > 512000) {
      this.showToast('Text was truncated for clipboard. Use download for full output.');
    }
  },

  _downloadAsFile(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'toolify_output.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 100);
  },


  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'error' ? '⚠️' : '✓';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => toast.remove(), 200);
    }, 2400);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Lightweight Local History system for each tool
  saveHistory(toolId, value) {
    if (!value || typeof value !== 'string') return;
    const clean = value.trim();
    if (!clean || clean.length > 2000) return; // avoid huge payloads

    let list = this.getHistory(toolId);
    // Remove if already exists
    list = list.filter(item => item !== clean);
    // Add to front
    list.unshift(clean);
    // Cap at 10 items
    list = list.slice(0, 10);
    localStorage.setItem(`history_${toolId}`, JSON.stringify(list));
    this.renderHistory(toolId);
  },

  getHistory(toolId) {
    try {
      const data = localStorage.getItem(`history_${toolId}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  clearHistory(toolId) {
    localStorage.removeItem(`history_${toolId}`);
    this.renderHistory(toolId);
  },

  renderHistory(toolId) {
    const listEl = document.getElementById(`${toolId}-history-list`);
    if (!listEl) return;

    const list = this.getHistory(toolId);
    if (list.length === 0) {
      listEl.innerHTML = '<div style="font-size:0.75rem; color:var(--text-dim); text-align:center; padding:4px 0;">No history</div>';
      return;
    }

    listEl.innerHTML = list.map((item, idx) => {
      const label = item.length > 25 ? item.slice(0, 23) + '...' : item;
      // Escape for single quote string injection
      const esc = item.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      return `
        <div class="history-item" onclick="window.dispatchEvent(new CustomEvent('load-history', {detail: {toolId: '${toolId}', value: '${esc}' }}));" title="${App.escapeHtml(item)}">
          ${App.escapeHtml(label)}
        </div>
      `;
    }).join('');
  }
};

window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
