// File to Base64 Tool
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target.result;
      const base64Index = dataUri.indexOf('base64,');
      if (base64Index !== -1) {
        this.currentRawBase64 = dataUri.substring(base64Index + 7);
      } else {
        this.currentRawBase64 = '';
      }

      this.renderResults();
      App.showToast(`Converted ${file.name} (${(file.size / 1024).toFixed(1)} KB) to Base64`);
    };
    reader.readAsDataURL(file);
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
      mimeVal.innerText = this.currentMimeType;
      mimeInfo.style.display = 'flex';
    }

    results.style.display = 'block';

    const dataUri = `data:${this.currentMimeType};base64,${this.currentRawBase64}`;
    const activePayload = includePrefix ? dataUri : this.currentRawBase64;

    payloadTextarea.value = activePayload;

    // Dynamically render integrations based on image/other MIME type
    const isImage = this.currentMimeType.startsWith('image/');
    
    if (isImage) {
      integrations.innerHTML = `
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>HTML &lt;img&gt; tag</label>
            <button class="url-action-icon-btn" onclick="App.copyToClipboard(document.getElementById('b64-out-html').value, this)" title="Copy HTML"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-html" class="input-text" readonly value='<img src="${dataUri}" alt="${App.escapeHtml(this.currentFile.name)}">'>
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>CSS background-image</label>
            <button class="url-action-icon-btn" onclick="App.copyToClipboard(document.getElementById('b64-out-css').value, this)" title="Copy CSS"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-css" class="input-text" readonly value='background-image: url("${dataUri}");'>
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>Markdown Image</label>
            <button class="url-action-icon-btn" onclick="App.copyToClipboard(document.getElementById('b64-out-md').value, this)" title="Copy Markdown"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-md" class="input-text" readonly value='![${App.escapeHtml(this.currentFile.name)}](${dataUri})'>
        </div>
      `;
    } else {
      integrations.innerHTML = `
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>HTML Download anchor link</label>
            <button class="url-action-icon-btn" onclick="App.copyToClipboard(document.getElementById('b64-out-html-link').value, this)" title="Copy HTML link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-html-link" class="input-text" readonly value='<a href="${dataUri}" download="${App.escapeHtml(this.currentFile.name)}">Download ${App.escapeHtml(this.currentFile.name)}</a>'>
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <div class="label-row">
            <label>Markdown File Link</label>
            <button class="url-action-icon-btn" onclick="App.copyToClipboard(document.getElementById('b64-out-md-link').value, this)" title="Copy Markdown link"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
          <input type="text" id="b64-out-md-link" class="input-text" readonly value='[Download ${App.escapeHtml(this.currentFile.name)}](${dataUri})'>
        </div>
      `;
    }
  }
};
