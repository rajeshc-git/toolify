// HTML Editor & Live Sandbox Tool with visual element inspector, console logs, and device mockups
const HtmlSandboxTool = {
  currentTab: 'html', // 'html', 'css', or 'js'
  htmlCode: '',
  cssCode: '',
  jsCode: '',
  isInspectActive: false,
  selectedElementSelector: null,

  init() {
    const textarea = document.getElementById('sb-editor-textarea');
    const fileInput = document.getElementById('sb-file-input');
    const copyBtn = document.getElementById('sb-copy-btn');
    const downloadBtn = document.getElementById('sb-download-btn');
    const runBtn = document.getElementById('sb-run-btn');
    const fullscreenBtn = document.getElementById('sb-fullscreen-btn');
    const opentabBtn = document.getElementById('sb-opentab-btn');
    const consoleClear = document.getElementById('sb-console-clear');
    const inspectToggleBtn = document.getElementById('sb-inspect-toggle-btn');
    const inspCloseBtn = document.getElementById('sb-insp-close');

    const tabHtml = document.getElementById('sb-tab-html');
    const tabCss = document.getElementById('sb-tab-css');
    const tabJs = document.getElementById('sb-tab-js');

    const vpDesktop = document.getElementById('sb-vp-desktop');
    const vpTablet = document.getElementById('sb-vp-tablet');
    const vpMobile = document.getElementById('sb-vp-mobile');

    const actionDownload = document.getElementById('sb-action-download-combined');
    const actionClearEdits = document.getElementById('sb-action-clear-edits');
    const actionLoadSample = document.getElementById('sb-action-load-sample');
    const actionClearAll = document.getElementById('sb-action-clear-all');

    if (!textarea) return;

    // Load initial sample
    this.loadSample();

    // Tab bindings
    if (tabHtml) tabHtml.addEventListener('click', () => this.switchTab('html'));
    if (tabCss) tabCss.addEventListener('click', () => this.switchTab('css'));
    if (tabJs) tabJs.addEventListener('click', () => this.switchTab('js'));

    // Text Input updates & line scroll synchronization
    textarea.addEventListener('input', () => {
      this.saveCurrentTabCode();
      this.updateLineNumbers();
      
      const autoRefresh = document.getElementById('sb-opt-autorefresh').checked;
      if (autoRefresh) {
        if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => this.runPreview(), 300);
      }
    });

    const rafScrollSync = Perf.throttleRAF(() => {
      const numbersEl = document.getElementById('sb-line-numbers');
      if (numbersEl) numbersEl.scrollTop = textarea.scrollTop;
    });
    textarea.addEventListener('scroll', rafScrollSync);


    // Auto-refresh configuration switch toggle
    const autoRefreshToggle = document.getElementById('sb-opt-autorefresh');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        if (runBtn) runBtn.disabled = e.target.checked;
      });
    }

    if (runBtn) {
      runBtn.addEventListener('click', () => this.runPreview());
    }

    // Viewport Width bindings
    if (vpDesktop) vpDesktop.addEventListener('click', () => this.setViewport('100%', vpDesktop));
    if (vpTablet) vpTablet.addEventListener('click', () => this.setViewport('768px', vpTablet));
    if (vpMobile) vpMobile.addEventListener('click', () => this.setViewport('375px', vpMobile));

    // Fullscreen Preview Toggle
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        const frameContainer = document.getElementById('sb-preview-frame-container');
        if (frameContainer) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            frameContainer.requestFullscreen().catch(() => {
              App.showToast('Fullscreen mode not supported on this preview window', 'error');
            });
          }
        }
      });
    }

    // Open in new tab
    if (opentabBtn) {
      opentabBtn.addEventListener('click', () => {
        const compiled = this.compileHTML();
        const blob = new Blob([compiled], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      });
    }

    // Toggle Visual Element Inspector
    if (inspectToggleBtn) {
      inspectToggleBtn.addEventListener('click', () => {
        this.isInspectActive = !this.isInspectActive;
        inspectToggleBtn.classList.toggle('active', this.isInspectActive);
        inspectToggleBtn.style.color = this.isInspectActive ? 'var(--c-purple)' : '';

        const panel = document.getElementById('sb-visual-inspector-panel');
        if (panel && !this.isInspectActive) panel.style.display = 'none';

        // Notify iframe
        const iframe = document.getElementById('sb-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'toggle-inspect', active: this.isInspectActive }, '*');
        }

        if (this.isInspectActive) {
          App.showToast('Visual Element Inspector active. Click any element inside preview to edit styles.', 'info');
        }
      });
    }

    if (inspCloseBtn) {
      inspCloseBtn.addEventListener('click', () => {
        const panel = document.getElementById('sb-visual-inspector-panel');
        if (panel) panel.style.display = 'none';
        this.isInspectActive = false;
        if (inspectToggleBtn) {
          inspectToggleBtn.classList.remove('active');
          inspectToggleBtn.style.color = '';
        }
        const iframe = document.getElementById('sb-iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'toggle-inspect', active: false }, '*');
        }
      });
    }

    // Inspector style inputs listeners
    this.setupInspectorFormListeners();

    // Load file helper
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          textarea.value = evt.target.result;
          this.saveCurrentTabCode();
          this.updateLineNumbers();
          this.runPreview();
        };
        reader.readAsText(file);
      });
    }

    // Copy & Download Actions
    if (copyBtn) {
      copyBtn.addEventListener('click', () => App.copyToClipboard(textarea.value, copyBtn));
    }
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const compiled = this.compileHTML();
        this.triggerDownload(compiled, 'compiled_sandbox.html');
      });
    }

    // Clear Console
    if (consoleClear) {
      consoleClear.addEventListener('click', () => {
        const output = document.getElementById('sb-console-output');
        if (output) output.innerText = 'Console cleared.';
      });
    }

    // Options Panel Actions
    if (actionDownload) {
      actionDownload.addEventListener('click', () => {
        const compiled = this.compileHTML();
        this.triggerDownload(compiled, 'compiled_sandbox.html');
      });
    }
    if (actionClearEdits) {
      actionClearEdits.addEventListener('click', () => {
        textarea.value = '';
        this.saveCurrentTabCode();
        this.updateLineNumbers();
        this.runPreview();
      });
    }
    if (actionLoadSample) {
      actionLoadSample.addEventListener('click', () => {
        this.loadSample();
        this.switchTab('html');
        App.showToast('Sample counter loaded successfully');
      });
    }
    if (actionClearAll) {
      actionClearAll.addEventListener('click', () => {
        this.htmlCode = '';
        this.cssCode = '';
        this.jsCode = '';
        textarea.value = '';
        this.updateLineNumbers();
        this.runPreview();
        App.showToast('All tabs cleared');
      });
    }

    // Message listener for console & element selection
    window.addEventListener('message', (e) => {
      if (!e.data) return;
      if (e.data.type === 'sandbox-console') {
        const output = document.getElementById('sb-console-output');
        if (output) {
          if (output.innerText.startsWith('No console output yet') || output.innerText.startsWith('Console cleared')) {
            output.innerText = '';
          }
          const sign = e.data.logType === 'error' ? '🔴' : e.data.logType === 'warn' ? '🟡' : '⚪';
          output.innerText += `${sign} [${e.data.logType}] ${e.data.content}\n`;
          output.scrollTop = output.scrollHeight;
        }
      } else if (e.data.type === 'element-selected') {
        this.onElementSelected(e.data);
      }
    });

    // Initial render
    this.updateLineNumbers();
    this.runPreview();
    if (vpDesktop) this.setViewport('100%', vpDesktop);
  },

  setupInspectorFormListeners() {
    const dispSelect = document.getElementById('sb-insp-display');
    const colorInput = document.getElementById('sb-insp-color');
    const bgInput = document.getElementById('sb-insp-bg');
    const fontInput = document.getElementById('sb-insp-font');
    const sizeInput = document.getElementById('sb-insp-size');
    const weightSelect = document.getElementById('sb-insp-weight');
    const alignGroup = document.getElementById('sb-insp-align-group');

    const updateStyle = (prop, val) => {
      if (!this.selectedElementSelector) return;
      const iframe = document.getElementById('sb-iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'apply-style',
          selector: this.selectedElementSelector,
          prop: prop,
          val: val
        }, '*');
      }
    };

    if (dispSelect) dispSelect.addEventListener('change', (e) => updateStyle('display', e.target.value));
    if (colorInput) colorInput.addEventListener('input', (e) => updateStyle('color', e.target.value));
    if (bgInput) bgInput.addEventListener('input', (e) => updateStyle('backgroundColor', e.target.value));
    if (fontInput) fontInput.addEventListener('input', (e) => updateStyle('fontFamily', e.target.value));
    if (sizeInput) sizeInput.addEventListener('input', (e) => updateStyle('fontSize', e.target.value));
    if (weightSelect) weightSelect.addEventListener('change', (e) => updateStyle('fontWeight', e.target.value));

    if (alignGroup) {
      alignGroup.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          alignGroup.querySelectorAll('button').forEach(b => b.classList.remove('active', 'log-info'));
          btn.classList.add('active', 'log-info');
          updateStyle('textAlign', btn.dataset.align);
        });
      });
    }
  },

  onElementSelected(data) {
    this.selectedElementSelector = data.selector;
    const panel = document.getElementById('sb-visual-inspector-panel');
    if (!panel) return;

    panel.style.display = 'block';

    const tagEl = document.getElementById('sb-insp-tag');
    if (tagEl) tagEl.innerText = data.tag;

    const dispSelect = document.getElementById('sb-insp-display');
    const colorInput = document.getElementById('sb-insp-color');
    const bgInput = document.getElementById('sb-insp-bg');
    const fontInput = document.getElementById('sb-insp-font');
    const sizeInput = document.getElementById('sb-insp-size');
    const weightSelect = document.getElementById('sb-insp-weight');
    const alignGroup = document.getElementById('sb-insp-align-group');

    if (dispSelect) dispSelect.value = data.display || 'block';
    if (colorInput && data.color) colorInput.value = data.color;
    if (bgInput && data.bg) bgInput.value = data.bg;
    if (fontInput) fontInput.value = data.font || '';
    if (sizeInput) sizeInput.value = data.size || '';
    if (weightSelect) weightSelect.value = data.weight || '400';

    if (alignGroup) {
      alignGroup.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === data.textAlign);
        btn.classList.toggle('log-info', btn.dataset.align === data.textAlign);
      });
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    
    ['sb-tab-html', 'sb-tab-css', 'sb-tab-js'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === `sb-tab-${tab}`);
    });

    const textarea = document.getElementById('sb-editor-textarea');
    if (textarea) {
      textarea.value = tab === 'html' ? this.htmlCode : tab === 'css' ? this.cssCode : this.jsCode;
      this.updateLineNumbers();
    }
  },

  saveCurrentTabCode() {
    const textarea = document.getElementById('sb-editor-textarea');
    if (!textarea) return;
    const code = textarea.value;
    if (this.currentTab === 'html') this.htmlCode = code;
    else if (this.currentTab === 'css') this.cssCode = code;
    else this.jsCode = code;
  },

  updateLineNumbers() {
    const textarea = document.getElementById('sb-editor-textarea');
    const numbersEl = document.getElementById('sb-line-numbers');
    if (!textarea || !numbersEl) return;

    const lines = textarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) {
      html += `${i}<br>`;
    }
    numbersEl.innerHTML = html;
    numbersEl.scrollTop = textarea.scrollTop;
  },

  setViewport(width, btn) {
    const frameContainer = document.getElementById('sb-preview-frame-container');
    if (frameContainer) {
      frameContainer.style.width = '';
      frameContainer.style.margin = '0 auto';
      
      frameContainer.classList.remove('iphone-frame', 'ipad-frame', 'macbook-frame');
      
      if (width === '375px') {
        frameContainer.classList.add('iphone-frame');
      } else if (width === '768px') {
        frameContainer.classList.add('ipad-frame');
      } else if (width === '100%') {
        frameContainer.classList.add('macbook-frame');
      }
    }

    ['sb-vp-desktop', 'sb-vp-tablet', 'sb-vp-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', el === btn);
    });
  },

  loadSample() {
    this.htmlCode = `<div class="counter-container">
  <h1>Hello, world!</h1>
  <p>Edit the HTML, CSS, and JS tabs to see a live preview here.</p>
  
  <div class="counter-box">
    <button id="counter-btn" class="sb-btn">Click me</button>
    <div class="count-display">Clicks: <span id="clicks-count">0</span></div>
  </div>
</div>`;

    this.cssCode = `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;
  margin: 0;
  background-color: #ffffff;
}

.counter-container {
  text-align: center;
  color: #000000;
}

h1 {
  color: #7c3aed;
  font-size: 1.8rem;
  margin-bottom: 6px;
}

p {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 20px;
}

.sb-btn {
  background-color: #7c3aed;
  color: #ffffff;
  border: none;
  padding: 10px 20px;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transition: transform 0.1s ease;
}

.sb-btn:active {
  transform: scale(0.95);
}

.count-display {
  font-size: 0.9rem;
  margin-top: 10px;
  font-weight: 600;
}`;

    this.jsCode = `const btn = document.getElementById('counter-btn');
const display = document.getElementById('clicks-count');
let count = 0;

btn.addEventListener('click', () => {
  count++;
  display.innerText = count;
  console.log('Button clicked! Current count is: ' + count);
});`;

    const textarea = document.getElementById('sb-editor-textarea');
    if (textarea) {
      textarea.value = this.currentTab === 'html' ? this.htmlCode : this.currentTab === 'css' ? this.cssCode : this.jsCode;
    }
    this.updateLineNumbers();
    this.runPreview();
  },

  compileHTML() {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Live Preview</title>
    <style>
      ${this.cssCode}
    </style>
    <script>
      (function() {
        const _log = console.log;
        const _warn = console.warn;
        const _err = console.error;
        
        const send = (type, args) => {
          window.parent.postMessage({
            type: 'sandbox-console',
            logType: type,
            content: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
          }, '*');
        };
        
        console.log = function(...args) { _log(...args); send('log', args); };
        console.warn = function(...args) { _warn(...args); send('warn', args); };
        console.error = function(...args) { _err(...args); send('error', args); };
        
        window.addEventListener('error', function(e) {
          send('error', [e.message]);
        });
      })();

      // Visual Element Inspector Injected Script
      (function() {
        let inspectActive = ${this.isInspectActive};
        let hoveredEl = null;

        function rgbToHex(rgb) {
          if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
          const match = rgb.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
          if (!match) return '#ffffff';
          return "#" + ((1 << 24) + (parseInt(match[1]) << 16) + (parseInt(match[2]) << 8) + parseInt(match[3])).toString(16).slice(1);
        }

        function getUniqueSelector(el) {
          if (el.id) return '#' + el.id;
          if (el === document.body) return 'body';
          let path = [];
          while (el && el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.className && typeof el.className === 'string') {
              selector += '.' + el.className.trim().split(/\\s+/).join('.');
            }
            path.unshift(selector);
            el = el.parentNode;
          }
          return path.join(' > ');
        }

        window.addEventListener('message', function(e) {
          if (!e.data) return;
          if (e.data.type === 'toggle-inspect') {
            inspectActive = e.data.active;
            if (!inspectActive && hoveredEl) {
              hoveredEl.style.outline = '';
              hoveredEl = null;
            }
          } else if (e.data.type === 'apply-style') {
            const target = document.querySelector(e.data.selector);
            if (target) {
              target.style[e.data.prop] = e.data.val;
            }
          }
        });

        document.addEventListener('mouseover', function(e) {
          if (!inspectActive || e.target === document.body || e.target === document.documentElement) return;
          if (hoveredEl && hoveredEl !== e.target) hoveredEl.style.outline = '';
          hoveredEl = e.target;
          hoveredEl.style.outline = '2px dashed #7c3aed';
          hoveredEl.style.outlineOffset = '-2px';
        }, true);

        document.addEventListener('mouseout', function(e) {
          if (!inspectActive) return;
          if (e.target && e.target !== document.body) {
            e.target.style.outline = '';
          }
        }, true);

        document.addEventListener('click', function(e) {
          if (!inspectActive || e.target === document.body || e.target === document.documentElement) return;
          e.preventDefault();
          e.stopPropagation();

          const comp = window.getComputedStyle(e.target);
          window.parent.postMessage({
            type: 'element-selected',
            tag: e.target.tagName,
            display: comp.display,
            color: rgbToHex(comp.color),
            bg: rgbToHex(comp.backgroundColor),
            font: comp.fontFamily.replace(/"/g, ''),
            size: comp.fontSize,
            weight: comp.fontWeight,
            textAlign: comp.textAlign,
            selector: getUniqueSelector(e.target)
          }, '*');
        }, true);
      })();
    <\/script>
  </head>
  <body>
    ${this.htmlCode}
    <script>
      try {
        ${this.jsCode}
      } catch(err) {
        console.error(err.message);
      }
    <\/script>
  </body>
</html>`;
  },

  runPreview() {
    const iframe = document.getElementById('sb-iframe');
    if (!iframe) return;

    const output = document.getElementById('sb-console-output');
    if (output) {
      output.innerText = 'No console output yet — logs, warnings, and errors from the preview will appear here.';
    }

    const compiled = this.compileHTML();
    iframe.srcdoc = compiled;
  },

  triggerDownload(text, filename) {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
