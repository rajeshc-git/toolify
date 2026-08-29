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
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    const savedTheme = localStorage.getItem('devutility_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeText(savedTheme);

    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('devutility_theme', next);
      this.updateThemeText(next);
    });
  },

  updateThemeText(theme) {
    const textEl = document.querySelector('.theme-text');
    if (textEl) textEl.innerText = theme === 'dark' ? 'Light mode' : 'Dark mode';
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

    const openModal = () => {
      modal.style.display = 'flex';
      input.value = '';
      this.renderModalResults('');
      input.focus();
    };

    const closeModal = () => {
      modal.style.display = 'none';
    };

    if (sidebarSearchBtn) sidebarSearchBtn.addEventListener('click', openModal);

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal.style.display === 'none' || !modal.style.display) {
          openModal();
        } else {
          closeModal();
        }
      }
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    input.addEventListener('input', (e) => {
      this.renderModalResults(e.target.value.trim());
    });
  },

  renderModalResults(query) {
    const resultsList = document.getElementById('modal-results-list');
    if (!resultsList) return;

    const q = query.toLowerCase();

    const filtered = this.tools.filter(t => 
      !q || t.name.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      resultsList.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-muted);">No matching tools found</div>';
      return;
    }

    resultsList.innerHTML = filtered.map((tool, idx) => `
      <div class="modal-result-item ${idx === 0 ? 'selected' : ''}" onclick="window.location.hash='#${tool.id}'; document.getElementById('search-modal').style.display='none';">
        <div style="font-size:0.75rem; font-weight:700; color:var(--c-purple); width:80px;">${tool.cat}</div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:0.9rem;">${tool.name}</div>
          <div style="font-size:0.78rem; color:var(--text-muted);">${tool.desc}</div>
        </div>
        <kbd style="font-size:0.72rem; color:var(--text-dim);">↵</kbd>
      </div>
    `).join('');
  },

  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    if (!input) return;

    input.addEventListener('focus', () => {
      const modal = document.getElementById('search-modal');
      if (!modal) return;
      modal.style.display = 'flex';
      const modalInput = document.getElementById('modal-search-input');
      if (modalInput) {
        modalInput.value = '';
        this.renderModalResults('');
        modalInput.focus();
      }
    });
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
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
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
