// File to Base64 Tool - Memory-Safe On-Demand Engine
const FileBase64Tool = {
  currentFile: null,
  currentRawBase64: '',
  currentMimeType: '',

  init() {
    const dropzone = document.getElementById('file-b64-dropzone');
    const fileInput = document.getElementById('file-b64-input');
    const prefixToggle = document.getElementById('file-b64-prefix-toggle');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput) fileInput.click();
    });
    fileInput.addEventListener('click', (e) => e.stopPropagation());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.processFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.processFile(e.target.files[0]);
        fileInput.value = '';
      }
    });

    if (prefixToggle) {
      prefixToggle.checked = true;

      prefixToggle.addEventListener('change', () => {
        if (this.currentFile) this.renderResults();
      });
    }
  },

  processFile(file) {
    this.currentFile = file;
    this.currentMimeType = file.type || 'application/octet-stream';

    Perf.showProgressBar('file-b64-results', 0);

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        Perf.showProgressBar('file-b64-results', Math.round((e.loaded / e.total) * 90));
      }
    };
    reader.onload = (e) => {
      Perf.showProgressBar('file-b64-results', 95);
      const dataUri = e.target.result;
      const base64Index = dataUri.indexOf('base64,');
      if (base64Index !== -1) {
        this.currentRawBase64 = dataUri.substring(base64Index + 7);
      } else {
        this.currentRawBase64 = '';
      }

      this.renderResults();
      Perf.hideProgressBar('file-b64-results');
      App.showToast(`Converted ${file.name} (${Perf.formatBytes(file.size)}) to Base64`);
    };
    reader.onerror = () => {
      Perf.hideProgressBar('file-b64-results');
      App.showToast('Error reading file', 'error');
    };
    reader.readAsDataURL(file);
  },

  getPayload(withPrefix = true) {
    if (!this.currentRawBase64) return '';
    return withPrefix
      ? `data:${this.currentMimeType};base64,${this.currentRawBase64}`
      : this.currentRawBase64;
  },

  copySnippet(type, btn) {
    if (!this.currentFile) return;
    const prefixToggle = document.getElementById('file-b64-prefix-toggle');
    const includePrefix = prefixToggle ? prefixToggle.checked : true;
    const dataUri = `data:${this.currentMimeType};base64,${this.currentRawBase64}`;
    const name = this.currentFile.name;

    let content = '';
    if (type === 'payload') {
      content = this.getPayload(includePrefix);
    } else if (type === 'html') {
      content = `<img src="${dataUri}" alt="${name}">`;
    } else if (type === 'css') {
      content = `background-image: url("${dataUri}");`;
    } else if (type === 'md') {
      content = `![${name}](${dataUri})`;
    } else if (type === 'html-link') {
      content = `<a href="${dataUri}" download="${name}">Download ${name}</a>`;
    } else if (type === 'md-link') {
      content = `[Download ${name}](${dataUri})`;
    }

    if (content) {
      App.copyToClipboard(content, btn);
    }
  },

  renderResults() {
    const prefixToggle = document.getElementById('file-b64-prefix-toggle');
    const includePrefix = prefixToggle ? prefixToggle.checked : true;

    const mimeVal = document.getElementById('file-b64-mime-val');
    const mimeInfo = document.getElementById('file-b64-mime-info');
    const results = document.getElementById('file-b64-results');
    const payloadTextarea = document.getElementById('b64-out-datauri');
    const integrations = document.getElementById('file-b64-integrations');

    if (!this.currentFile || !results || !payloadTextarea || !integrations) return;

    // Show MIME type info badge
    if (mimeVal && mimeInfo) {
      mimeVal.innerText = `${this.currentMimeType} (${Perf.formatBytes(this.currentFile.size)})`;
      mimeInfo.style.display = 'flex';
    }

    results.style.display = 'block';

    const fullPayload = this.getPayload(includePrefix);
    const isLarge = fullPayload.length > 100 * 1024;

    // Safe textarea display to avoid DOM memory choke
    if (isLarge) {
      const previewSlice = fullPayload.substring(0, 102400);
      payloadTextarea.value = previewSlice + `\n\n… [Preview of first 100KB shown (${Perf.formatBytes(fullPayload.length)} total) — Click Copy or Download for complete full payload]`;
    } else {
      payloadTextarea.value = fullPayload;
    }

    // Attach click-to-copy handler to copy full payload from memory
    const copyPayloadBtn = document.getElementById('b64-copy-payload-btn');
    if (copyPayloadBtn) {
      copyPayloadBtn.onclick = (e) => this.copySnippet('payload', e.currentTarget);
    }

    const isImage = this.currentMimeType.startsWith('image/');
    const previewPrefix = `data:${this.currentMimeType};base64,${this.currentRawBase64.substring(0, 32)}…`;

    if (isImage) {
      integrations.innerHTML = `
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>HTML &lt;img&gt; tag</label>
            <button class="url-action-icon-btn" onclick="FileBase64Tool.copySnippet('html', this)" title="Copy HTML"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-html" class="input-text" readonly value='<img src="${previewPrefix}" alt="${App.escapeHtml(this.currentFile.name)}">'>
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>CSS background-image</label>
            <button class="url-action-icon-btn" onclick="FileBase64Tool.copySnippet('css', this)" title="Copy CSS"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-css" class="input-text" readonly value='background-image: url("${previewPrefix}");'>
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>Markdown Image</label>
            <button class="url-action-icon-btn" onclick="FileBase64Tool.copySnippet('md', this)" title="Copy Markdown"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-md" class="input-text" readonly value='![${App.escapeHtml(this.currentFile.name)}](${previewPrefix})'>
        </div>
      `;
    } else {
      integrations.innerHTML = `
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>HTML Download anchor link</label>
            <button class="url-action-icon-btn" onclick="FileBase64Tool.copySnippet('html-link', this)" title="Copy HTML link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-html-link" class="input-text" readonly value='<a href="${previewPrefix}" download="${App.escapeHtml(this.currentFile.name)}">Download ${App.escapeHtml(this.currentFile.name)}</a>'>
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>Markdown File Link</label>
            <button class="url-action-icon-btn" onclick="FileBase64Tool.copySnippet('md-link', this)" title="Copy Markdown link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-md-link" class="input-text" readonly value='[Download ${App.escapeHtml(this.currentFile.name)}](${previewPrefix})'>
        </div>
      `;
    }
  }
};
