// Client-Side PDF Tools Suite with Live Thumbnails & Interactive Drag-and-Drop Wizard
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
}

const PdfTool = {
  activeTab: 'merge', // 'merge', 'split', 'img2pdf', 'compress'
  loadedPdfs: [], // Array of { file, name, size, pageCount, thumbUrl, id }
  selectedImages: [], // Array of { file, name, src, type, rotation, id }
  
  // Split Wizard State
  splitFile: null, // { file, name, size, pageCount, pages: [{ pageNum, thumbUrl }] }
  splitMode: 'extract', // 'extract' (visual page picker) or 'divide' (cut dividers)
  splitExtractFormat: 'single', // 'single' (1 PDF) or 'zip' (separate PDFs per page)
  splitSelectedPages: new Set(), // Set of 0-based page indices
  splitCuts: new Set(), // Set of 0-based page indices after which a cut occurs (e.g. 0 means cut after page 1)
  lastClickedPageIndex: null, // For Shift-click range selection
  
  // Compress State
  compressFile: null, // { file, name, size, thumbUrl }
  compressPreset: 'recommended', // 'extreme', 'recommended', 'less'
  
  // Results cache for all 4 tools
  mergeResult: null,
  splitResult: null,
  imgResult: null,
  compressResult: null,

  // Drag-and-drop state
  dragSourceIndex: null,
  dragSourceType: null,

  init() {
    const dropzone = document.getElementById('pdf-suite-dropzone');
    const fileInput = document.getElementById('pdf-suite-file-input');

    if (!dropzone || !fileInput) return;

    // Dropzone events
    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput) fileInput.click();
    });
    fileInput.addEventListener('click', (e) => e.stopPropagation());

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.handleImportFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.handleImportFiles(e.target.files);
        fileInput.value = '';
      }
    });

    // Tab buttons
    document.querySelectorAll('#pdf-suite-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#pdf-suite-tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTab = btn.dataset.pdfTab;
        this.updateTabUI();
      });
    });

    this.updateTabUI();
  },

  // ==========================================
  // FULL-PAGE BLURRED BACKDROP PROGRESS OVERLAY
  // ==========================================
  showProgressOverlay(title, subtitle, current = 0, total = 100) {
    const overlay = document.getElementById('pdf-progress-overlay');
    const titleEl = document.getElementById('pdf-progress-title');
    const subtitleEl = document.getElementById('pdf-progress-subtitle');
    const fillEl = document.getElementById('pdf-progress-fill');
    const statusEl = document.getElementById('pdf-progress-status-text');
    const percentEl = document.getElementById('pdf-progress-percent');

    if (titleEl) titleEl.innerText = title;
    if (subtitleEl) subtitleEl.innerText = subtitle;
    
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (percentEl) percentEl.innerText = `${pct}%`;
    if (statusEl) statusEl.innerText = 'Initializing...';

    if (overlay) {
      overlay.style.display = 'flex';
      overlay.offsetHeight; // Force DOM reflow for CSS transition
      overlay.classList.add('active');
    }
  },

  updateProgressOverlay(current, total, statusText) {
    const fillEl = document.getElementById('pdf-progress-fill');
    const statusEl = document.getElementById('pdf-progress-status-text');
    const percentEl = document.getElementById('pdf-progress-percent');

    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (percentEl) percentEl.innerText = `${pct}%`;
    if (statusEl && statusText) statusEl.innerText = statusText;
  },

  hideProgressOverlay() {
    const overlay = document.getElementById('pdf-progress-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        if (!overlay.classList.contains('active')) {
          overlay.style.display = 'none';
        }
      }, 260);
    }
  },

  // ==========================================
  // REAL-TIME PDF THUMBNAIL RENDERING ENGINE
  // ==========================================
  async renderPdfDocPageToDataUrl(pdfDoc, pageNum = 1, targetWidth = 200) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scale = targetWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn(`Failed to render page ${pageNum}:`, err);
      return null;
    }
  },

  async renderPdfPageToDataUrl(arrayBuffer, pageNum = 1, targetWidth = 240) {
    try {
      if (typeof pdfjsLib === 'undefined') return null;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
      const pdf = await loadingTask.promise;
      return await this.renderPdfDocPageToDataUrl(pdf, pageNum, targetWidth);
    } catch (err) {
      console.warn('PDF thumbnail generation warning:', err);
      return null;
    }
  },

  async loadPdfMetadataAndThumb(file) {
    try {
      const buffer = await file.arrayBuffer();
      let pageCount = 1;
      let thumbUrl = null;

      if (typeof pdfjsLib !== 'undefined') {
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
        const pdf = await loadingTask.promise;
        pageCount = pdf.numPages;
        thumbUrl = await this.renderPdfDocPageToDataUrl(pdf, 1, 260);
      }

      return {
        file,
        name: file.name,
        size: file.size,
        pageCount,
        thumbUrl,
        id: 'pdf_' + Math.random().toString(36).substr(2, 9)
      };
    } catch (e) {
      return {
        file,
        name: file.name,
        size: file.size,
        pageCount: 1,
        thumbUrl: null,
        id: 'pdf_' + Math.random().toString(36).substr(2, 9)
      };
    }
  },

  setCompressPreset(preset) {
    this.compressPreset = preset;
    this.compressResult = null;
    this.renderCompressControls();
    this.renderItemsList();
  },

  updateTabUI() {
    const fileInput = document.getElementById('pdf-suite-file-input');
    const dropTitle = document.getElementById('pdf-dropzone-title');
    const dropSubtitle = document.getElementById('pdf-dropzone-subtitle');
    const extraControls = document.getElementById('pdf-tab-extra-controls');
    const dropzone = document.getElementById('pdf-suite-dropzone');

    if (extraControls) extraControls.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';

    if (this.activeTab === 'merge') {
      if (fileInput) { fileInput.accept = '.pdf'; fileInput.multiple = true; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop two or more PDFs here, or click to browse';
      if (dropSubtitle) dropSubtitle.innerText = 'Reorder pages easily by dragging preview cards before merging.';
    } else if (this.activeTab === 'split') {
      if (fileInput) { fileInput.accept = '.pdf'; fileInput.multiple = false; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop a PDF file here to split';
      if (dropSubtitle) dropSubtitle.innerText = 'Interactive visual split wizard with live thumbnails & cut dividers.';
    } else if (this.activeTab === 'img2pdf') {
      if (fileInput) { fileInput.accept = 'image/*'; fileInput.multiple = true; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop images (PNG, JPG, WebP) here';
      if (dropSubtitle) dropSubtitle.innerText = 'Drag cards to re-arrange pages, rotate or convert to PDF.';
    } else if (this.activeTab === 'compress') {
      if (fileInput) { fileInput.accept = '.pdf'; fileInput.multiple = false; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop a PDF file here to compress';
      if (dropSubtitle) dropSubtitle.innerText = 'Lossless text & vector compression with smart image optimization.';

      this.renderCompressControls();
    }

    this.renderItemsList();
  },

  renderCompressControls() {
    const extraControls = document.getElementById('pdf-tab-extra-controls');
    if (!extraControls || this.activeTab !== 'compress') return;

    if (!this.compressFile || this.compressResult) {
      extraControls.style.display = 'none';
      return;
    }

    const presetLabels = {
      extreme: 'Extreme Compression',
      recommended: 'Recommended Compression',
      less: 'Less Compression'
    };

    extraControls.style.display = 'block';
    extraControls.innerHTML = `
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>1. Choose Compression Level</span>
          </div>
          <span style="font-size: 0.72rem; color: var(--text-dim);">Presets optimized for highest quality</span>
        </div>

        <div class="pdf-compress-presets-grid">
          <!-- Preset 1: Extreme -->
          <div class="pdf-preset-card ${this.compressPreset === 'extreme' ? 'active' : ''}" onclick="PdfTool.setCompressPreset('extreme')">
            <div class="pdf-preset-header">
              <span class="pdf-preset-badge badge-extreme">Smallest</span>
              <div class="pdf-preset-radio"></div>
            </div>
            <div class="pdf-preset-title">Extreme Compression</div>
            <div class="pdf-preset-desc">High compression, smaller file size. Ideal for web & email attachments.</div>
          </div>

          <!-- Preset 2: Recommended -->
          <div class="pdf-preset-card ${this.compressPreset === 'recommended' ? 'active' : ''}" onclick="PdfTool.setCompressPreset('recommended')">
            <div class="pdf-preset-header">
              <span class="pdf-preset-badge badge-recommended">Recommended</span>
              <div class="pdf-preset-radio"></div>
            </div>
            <div class="pdf-preset-title">Recommended Compression</div>
            <div class="pdf-preset-desc">Good compression, high visual quality. Best balance for most documents.</div>
          </div>

          <!-- Preset 3: Less -->
          <div class="pdf-preset-card ${this.compressPreset === 'less' ? 'active' : ''}" onclick="PdfTool.setCompressPreset('less')">
            <div class="pdf-preset-header">
              <span class="pdf-preset-badge badge-less">High Quality</span>
              <div class="pdf-preset-radio"></div>
            </div>
            <div class="pdf-preset-title">Less Compression</div>
            <div class="pdf-preset-desc">Minimal compression, original crisp clarity. Preserves finest image details.</div>
          </div>
        </div>

        <!-- Big Main Action Button -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-color); margin-top: 4px; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 0.76rem; color: var(--text-muted);">
            Ready to compress <strong>${this.compressFile.name}</strong> (${this.formatBytes(this.compressFile.size)})
          </div>
          <button id="pdf-main-compress-btn" class="btn btn-primary" onclick="PdfTool.executeCompress()" style="font-size: 0.92rem; font-weight: 700; padding: 10px 24px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.28); cursor: pointer;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="4 14 10 14 10 20"></polyline>
              <polyline points="20 10 14 10 14 4"></polyline>
              <line x1="14" y1="10" x2="21" y2="3"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            Compress PDF (${presetLabels[this.compressPreset]})
          </button>
        </div>
      </div>
    `;
  },

  async handleImportFiles(files) {
    const fileList = Array.from(files);

    if (this.activeTab === 'merge') {
      const validPdfs = fileList.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (validPdfs.length > 0) {
        this.showProgressOverlay(
          'Importing PDF Documents',
          `Generating preview covers for ${validPdfs.length} file(s)...`,
          0,
          validPdfs.length
        );

        try {
            for (let i = 0; i < validPdfs.length; i++) {
            const f = validPdfs[i];
            this.updateProgressOverlay(i + 1, validPdfs.length, `Loading cover preview for ${f.name}...`);
            const item = await this.loadPdfMetadataAndThumb(f);
            this.loadedPdfs.push(item);
            this.renderItemsList();
          }
          this.mergeResult = null;
          App.showToast(`Ready to merge ${this.loadedPdfs.length} PDFs`);
        } catch (e) {
          console.error(e);
          App.showToast('Error importing PDFs: ' + e.message, 'error');
        } finally {
          this.hideProgressOverlay();
        }
      }
    } else if (this.activeTab === 'split') {
      const pdf = fileList.find(f => f.name.toLowerCase().endsWith('.pdf'));
      if (pdf) {
        this.showProgressOverlay(
          'Importing PDF Document',
          `${pdf.name} (${this.formatBytes(pdf.size)})`,
          0,
          100
        );

        try {
          const buffer = await pdf.arrayBuffer();
          let pageCount = 1;
          const pages = [];

          if (typeof pdfjsLib !== 'undefined') {
            this.updateProgressOverlay(5, 100, 'Parsing PDF document structure...');
            const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
            const pdfDoc = await loadingTask.promise;
            pageCount = pdfDoc.numPages;

            for (let i = 1; i <= pageCount; i++) {
              const progressPct = 8 + Math.round((i / pageCount) * 90);
              this.updateProgressOverlay(
                progressPct,
                100,
                `Rendering live preview for page ${i} of ${pageCount}...`
              );
              const thumbUrl = await this.renderPdfDocPageToDataUrl(pdfDoc, i, 200);
              pages.push({ pageNum: i, thumbUrl });
            }
          }

          const item = {
            file: pdf,
            name: pdf.name,
            size: pdf.size,
            pageCount,
            thumbUrl: pages[0]?.thumbUrl || null,
            pages,
            id: 'pdf_' + Math.random().toString(36).substr(2, 9)
          };

          item.pages = pages;
          this.splitFile = item;
          this.splitSelectedPages = new Set(pages.map((_, i) => i)); // Select all by default
          this.splitCuts = new Set();
          this.lastClickedPageIndex = null;
          this.splitResult = null;
          this.renderItemsList();
          App.showToast(`Successfully loaded ${pages.length || item.pageCount} pages from ${pdf.name}`);
        } catch (e) {
          console.error(e);
          App.showToast('Failed to load PDF: ' + e.message, 'error');
        } finally {
          this.hideProgressOverlay();
        }
      }
    } else if (this.activeTab === 'img2pdf') {
      fileList.forEach(file => {
        if (file.type.startsWith('image/')) {
          this.selectedImages.push({
            file,
            name: file.name,
            src: URL.createObjectURL(file),
            type: file.type,
            rotation: 0,
            id: 'img_' + Math.random().toString(36).substr(2, 9)
          });
        }
      });
      this.imgResult = null;
      this.renderItemsList();
      App.showToast(`Added ${fileList.length} image(s) for PDF generation`);
    } else if (this.activeTab === 'compress') {
      const pdf = fileList.find(f => f.name.toLowerCase().endsWith('.pdf'));
      if (pdf) {
        this.showProgressOverlay('Loading PDF for Compression', `${pdf.name} (${this.formatBytes(pdf.size)})`, 0, 100);
        try {
          this.updateProgressOverlay(50, 100, 'Generating cover preview...');
          const item = await this.loadPdfMetadataAndThumb(pdf);
          this.compressFile = item;
          this.compressOriginalSize = pdf.size;
          this.compressResult = null;
          this.updateTabUI();
          App.showToast(`Selected ${pdf.name} for compression`);
        } finally {
          this.hideProgressOverlay();
        }
      }
    }

    this.updateTabUI();
  },

  clearAll() {
    this.loadedPdfs = [];
    this.selectedImages = [];
    this.splitFile = null;
    this.compressFile = null;
    this.compressOriginalSize = 0;
    this.splitSelectedPages.clear();
    this.splitCuts.clear();
    this.lastClickedPageIndex = null;
    this.mergeResult = null;
    this.splitResult = null;
    this.imgResult = null;
    this.compressResult = null;
    this.updateTabUI();
    App.showToast('Cleared PDF tools workspace');
  },

  // ==========================================
  // DRAG AND DROP REORDERING WIZARD HANDLERS
  // ==========================================
  onDragStart(e, index, type) {
    this.dragSourceIndex = index;
    this.dragSourceType = type;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
    setTimeout(() => {
      const el = e.target.closest('.pdf-wizard-card');
      if (el) el.classList.add('dragging');
    }, 0);
  },

  onDragOver(e, index, type) {
    if (this.dragSourceType !== type) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('.pdf-wizard-card');
    if (card && this.dragSourceIndex !== index) {
      card.classList.add('drag-over');
    }
  },

  onDragLeave(e, index, type) {
    const card = e.target.closest('.pdf-wizard-card');
    if (card) card.classList.remove('drag-over');
  },

  onDrop(e, targetIndex, type) {
    e.preventDefault();
    document.querySelectorAll('.pdf-wizard-card').forEach(c => {
      c.classList.remove('drag-over', 'dragging');
    });

    if (this.dragSourceType !== type || this.dragSourceIndex === null) return;
    const sourceIndex = this.dragSourceIndex;
    if (sourceIndex === targetIndex) return;

    if (type === 'merge') {
      const movedItem = this.loadedPdfs.splice(sourceIndex, 1)[0];
      this.loadedPdfs.splice(targetIndex, 0, movedItem);
      this.renderItemsList();
      App.showToast(`Moved #${sourceIndex + 1} to #${targetIndex + 1}`);
    } else if (type === 'img2pdf') {
      const movedItem = this.selectedImages.splice(sourceIndex, 1)[0];
      this.selectedImages.splice(targetIndex, 0, movedItem);
      this.renderItemsList();
      App.showToast(`Reordered image to page #${targetIndex + 1}`);
    }

    this.dragSourceIndex = null;
    this.dragSourceType = null;
  },

  rotateImage(index) {
    if (!this.selectedImages[index]) return;
    this.selectedImages[index].rotation = ((this.selectedImages[index].rotation || 0) + 90) % 360;
    this.renderItemsList();
  },

  // ==========================================
  // SPLIT WIZARD INTERACTIVE CONTROLS
  // ==========================================
  setSplitMode(mode) {
    this.splitMode = mode;
    this.renderItemsList();
  },

  setSplitExtractFormat(fmt) {
    this.splitExtractFormat = fmt;
    this.renderItemsList();
  },

  toggleSplitPage(pageIndex, event) {
    if (event && event.shiftKey && this.lastClickedPageIndex !== null) {
      // Shift-click range selection
      const start = Math.min(this.lastClickedPageIndex, pageIndex);
      const end = Math.max(this.lastClickedPageIndex, pageIndex);
      for (let i = start; i <= end; i++) {
        this.splitSelectedPages.add(i);
      }
    } else {
      if (this.splitSelectedPages.has(pageIndex)) {
        this.splitSelectedPages.delete(pageIndex);
      } else {
        this.splitSelectedPages.add(pageIndex);
      }
    }
    this.lastClickedPageIndex = pageIndex;
    this.renderItemsList();
  },

  setSplitSelectionMode(mode) {
    if (!this.splitFile || !this.splitFile.pages) return;
    const total = this.splitFile.pages.length;

    if (mode === 'all') {
      this.splitSelectedPages.clear();
      for (let i = 0; i < total; i++) this.splitSelectedPages.add(i);
    } else if (mode === 'odd') {
      this.splitSelectedPages.clear();
      for (let i = 0; i < total; i += 2) this.splitSelectedPages.add(i);
    } else if (mode === 'even') {
      this.splitSelectedPages.clear();
      for (let i = 1; i < total; i += 2) this.splitSelectedPages.add(i);
    } else if (mode === 'invert') {
      const inverted = new Set();
      for (let i = 0; i < total; i++) {
        if (!this.splitSelectedPages.has(i)) inverted.add(i);
      }
      this.splitSelectedPages = inverted;
    } else if (mode === 'none') {
      this.splitSelectedPages.clear();
    }

    this.renderItemsList();
  },

  toggleCutDivider(pageIndex) {
    if (this.splitCuts.has(pageIndex)) {
      this.splitCuts.delete(pageIndex);
    } else {
      this.splitCuts.add(pageIndex);
    }
    this.renderItemsList();
  },

  setCutInterval(interval) {
    if (!this.splitFile || !this.splitFile.pages) return;
    const total = this.splitFile.pages.length;
    this.splitCuts.clear();
    for (let i = interval - 1; i < total - 1; i += interval) {
      this.splitCuts.add(i);
    }
    this.renderItemsList();
  },

  calculateCutParts() {
    if (!this.splitFile || !this.splitFile.pages) return [];
    const total = this.splitFile.pages.length;
    const sortedCuts = Array.from(this.splitCuts).sort((a, b) => a - b);
    const parts = [];
    let start = 0;

    sortedCuts.forEach((cutIdx) => {
      if (cutIdx >= start && cutIdx < total - 1) {
        parts.push({
          startPage: start + 1,
          endPage: cutIdx + 1,
          pageIndices: Array.from({ length: (cutIdx + 1) - start }, (_, i) => start + i)
        });
        start = cutIdx + 1;
      }
    });

    if (start < total) {
      parts.push({
        startPage: start + 1,
        endPage: total,
        pageIndices: Array.from({ length: total - start }, (_, i) => start + i)
      });
    }

    return parts;
  },

  formatBytes(bytes) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  downloadBlob(blob, fileName) {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    }, 300);
    App.showToast(`Downloading ${fileName}...`);
  },

  renderItemsList() {
    const container = document.getElementById('pdf-suite-items-list');
    const dropzone = document.getElementById('pdf-suite-dropzone');
    if (!container) return;

    let html = '';

    // ==========================================
    // 1. MERGE TAB (INTERACTIVE DRAGGABLE CARDS)
    // ==========================================
    if (this.activeTab === 'merge') {
      if (this.mergeResult) {
        if (dropzone) dropzone.style.display = 'none';
        const res = this.mergeResult;
        html = `
          <div class="pdf-compress-result-box">
            <div class="pdf-compress-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">PDFs Merged Successfully!</h2>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${res.fileName} • Combined ${res.totalPdfs} documents</div>
            </div>

            <!-- Merged Output Live Preview -->
            ${res.thumbUrl ? `
              <div style="width: 140px; margin: 0 auto; box-shadow: var(--shadow-lg); border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color);">
                <img src="${res.thumbUrl}" style="width: 100%; display: block;">
              </div>
            ` : ''}

            <div class="pdf-compress-stats-row">
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Files Merged</span>
                <span class="pdf-compress-stat-value">${res.totalPdfs} PDFs</span>
              </div>
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Output File Size</span>
                <span class="pdf-compress-stat-value" style="color: #10b981;">${this.formatBytes(res.size)}</span>
              </div>
            </div>

            <button class="btn btn-primary" onclick="PdfTool.downloadBlob(PdfTool.mergeResult.blob, PdfTool.mergeResult.fileName)" style="font-size: 0.95rem; font-weight: 700; padding: 12px 28px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Merged PDF (${this.formatBytes(res.size)})
            </button>
            <div style="display: flex; gap: 12px; margin-top: 4px;">
              <button class="btn btn-secondary" onclick="PdfTool.mergeResult = null; PdfTool.updateTabUI();" style="font-size: 0.76rem; padding: 6px 14px;">
                Re-order & Merge Again
              </button>
              <button class="btn btn-secondary" onclick="PdfTool.clearAll();" style="font-size: 0.76rem; padding: 6px 14px;">
                Merge More PDFs
              </button>
            </div>
          </div>
        `;
      } else {
        if (dropzone) dropzone.style.display = 'block';
        if (this.loadedPdfs.length === 0) {
          html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No PDFs added yet. Drop at least 2 PDF files to merge.</div>`;
        } else {
          const totalBytes = this.loadedPdfs.reduce((sum, f) => sum + f.size, 0);
          html = `
            <div class="url-card" style="padding: 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <div>
                  <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${this.loadedPdfs.length} PDFs Loaded</span>
                  <span style="font-size: 0.72rem; color: var(--text-dim); margin-left: 6px;">(${this.formatBytes(totalBytes)} total) • Drag tiles to reorder</span>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-secondary" onclick="document.getElementById('pdf-suite-file-input').click()" style="font-size: 0.74rem; padding: 5px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add More
                  </button>
                  <button class="btn-danger-outline" onclick="PdfTool.clearAll()" style="font-size: 0.74rem; padding: 5px 10px; border-radius: var(--radius-sm);">Clear</button>
                </div>
              </div>

              <!-- Interactive Drag & Drop Wizard Grid -->
              <div class="pdf-wizard-grid">
                ${this.loadedPdfs.map((pdf, i) => `
                  <div class="pdf-wizard-card" draggable="true"
                       ondragstart="PdfTool.onDragStart(event, ${i}, 'merge')"
                       ondragover="PdfTool.onDragOver(event, ${i}, 'merge')"
                       ondragleave="PdfTool.onDragLeave(event, ${i}, 'merge')"
                       ondrop="PdfTool.onDrop(event, ${i}, 'merge')">
                    
                    <span class="pdf-order-badge">#${i+1}</span>
                    <button onclick="PdfTool.removePdf(${i})" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.75); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; z-index: 2;" title="Remove">×</button>

                    <div class="pdf-preview-box">
                      ${pdf.thumbUrl ? `
                        <img src="${pdf.thumbUrl}" class="pdf-preview-canvas" alt="${pdf.name}">
                      ` : `
                        <div class="pdf-preview-placeholder">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          <span>PDF Document</span>
                        </div>
                      `}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <div style="font-weight: 700; font-size: 0.78rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${pdf.name}">${pdf.name}</div>
                      <div style="display: flex; justify-content: space-between; font-size: 0.66rem; color: var(--text-dim);">
                        <span>${pdf.pageCount} ${pdf.pageCount === 1 ? 'Page' : 'Pages'}</span>
                        <span>${this.formatBytes(pdf.size)}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 14px; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 0.74rem; color: var(--text-muted);">
                  ${this.loadedPdfs.length < 2 ? '⚠️ Please add at least 2 PDFs to merge' : 'Files will be merged in the visual order above'}
                </span>
                <button id="pdf-main-merge-btn" class="btn btn-primary" onclick="PdfTool.executeMerge()" ${this.loadedPdfs.length < 2 ? 'disabled' : ''} style="font-size: 0.92rem; font-weight: 700; padding: 10px 26px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.28); cursor: pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"/></svg>
                  Merge ${this.loadedPdfs.length} PDF Files
                </button>
              </div>
            </div>
          `;
        }
      }
    }

    // ==========================================
    // 2. SPLIT TAB (VISUAL WIZARD & CUT DIVIDERS)
    // ==========================================
    else if (this.activeTab === 'split') {
      if (this.splitResult) {
        if (dropzone) dropzone.style.display = 'none';
        const res = this.splitResult;
        html = `
          <div class="pdf-compress-result-box">
            <div class="pdf-compress-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">PDF Split Successfully!</h2>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${res.fileName} • ${res.description}</div>
            </div>

            <!-- Split Preview -->
            ${res.thumbUrl ? `
              <div style="width: 140px; margin: 0 auto; box-shadow: var(--shadow-lg); border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color);">
                <img src="${res.thumbUrl}" style="width: 100%; display: block;">
              </div>
            ` : ''}

            <div class="pdf-compress-stats-row">
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Output Type</span>
                <span class="pdf-compress-stat-value">${res.isZip ? 'ZIP Bundle' : 'Single PDF'}</span>
              </div>
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Files / Pages</span>
                <span class="pdf-compress-stat-value">${res.outputCount}</span>
              </div>
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Output Size</span>
                <span class="pdf-compress-stat-value" style="color: #10b981;">${this.formatBytes(res.size)}</span>
              </div>
            </div>
            <button class="btn btn-primary" onclick="PdfTool.downloadBlob(PdfTool.splitResult.blob, PdfTool.splitResult.fileName)" style="font-size: 0.95rem; font-weight: 700; padding: 12px 28px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Split Result (${this.formatBytes(res.size)})
            </button>
            <div style="display: flex; gap: 12px; margin-top: 4px;">
              <button class="btn btn-secondary" onclick="PdfTool.splitResult = null; PdfTool.updateTabUI();" style="font-size: 0.76rem; padding: 6px 14px;">
                Re-configure & Split Again
              </button>
              <button class="btn btn-secondary" onclick="PdfTool.clearAll();" style="font-size: 0.76rem; padding: 6px 14px;">
                Split Another PDF
              </button>
            </div>
          </div>
        `;
      } else {
        if (dropzone) dropzone.style.display = 'block';
        if (!this.splitFile) {
          html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No PDF selected for splitting. Drop a PDF file above.</div>`;
        } else {
          const file = this.splitFile;
          const pages = file.pages || [];
          const cutParts = this.calculateCutParts();

          html = `
            <div class="url-card" style="padding: 16px;">
              <!-- Header -->
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: 800; font-size: 0.72rem; color: #ef4444; background: rgba(239,68,68,0.1); padding: 4px 6px; border-radius: 4px;">PDF</span>
                  <div>
                    <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${file.name}</div>
                    <div style="font-size: 0.68rem; color: var(--text-dim);">${file.pageCount} total pages • ${this.formatBytes(file.size)}</div>
                  </div>
                </div>
                <button class="url-action-icon-btn" onclick="PdfTool.splitFile = null; PdfTool.updateTabUI();" title="Remove">×</button>
              </div>

              <!-- Visual Split Wizard Sub-navigation Tabs -->
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                <div class="pdf-split-subnav">
                  <button class="pdf-split-subnav-btn ${this.splitMode === 'extract' ? 'active' : ''}" onclick="PdfTool.setSplitMode('extract')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    1. Visual Page Picker
                  </button>
                  <button class="pdf-split-subnav-btn ${this.splitMode === 'divide' ? 'active' : ''}" onclick="PdfTool.setSplitMode('divide')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                    2. Split by Cut Dividers ✂️
                  </button>
                </div>

                ${this.splitMode === 'extract' ? `
                  <!-- Output Format Toggle -->
                  <div style="display: flex; gap: 6px; align-items: center; background: var(--bg-pane); padding: 3px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <span style="font-size: 0.68rem; font-weight: 700; color: var(--text-dim); margin-right: 4px;">Output:</span>
                    <button class="btn ${this.splitExtractFormat === 'single' ? 'btn-primary' : 'btn-secondary'}" onclick="PdfTool.setSplitExtractFormat('single')" style="font-size: 0.68rem; padding: 3px 8px;">
                      Merge to 1 PDF
                    </button>
                    <button class="btn ${this.splitExtractFormat === 'zip' ? 'btn-primary' : 'btn-secondary'}" onclick="PdfTool.setSplitExtractFormat('zip')" style="font-size: 0.68rem; padding: 3px 8px;">
                      Separate PDFs (.ZIP)
                    </button>
                  </div>
                ` : `
                  <!-- Quick Cut Presets -->
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <span style="font-size: 0.68rem; font-weight: 700; color: var(--text-dim);">Cut Every:</span>
                    <button class="btn btn-secondary" onclick="PdfTool.setCutInterval(1)" style="font-size: 0.68rem; padding: 3px 8px;">1 Page</button>
                    <button class="btn btn-secondary" onclick="PdfTool.setCutInterval(2)" style="font-size: 0.68rem; padding: 3px 8px;">2 Pages</button>
                    <button class="btn btn-secondary" onclick="PdfTool.setCutInterval(5)" style="font-size: 0.68rem; padding: 3px 8px;">5 Pages</button>
                    <button class="btn-danger-outline" onclick="PdfTool.splitCuts.clear(); PdfTool.renderItemsList();" style="font-size: 0.68rem; padding: 3px 8px;">Reset Cuts</button>
                  </div>
                `}
              </div>

              ${this.splitMode === 'extract' ? `
                <!-- Mode 1: Visual Page Picker Toolbar -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary" onclick="PdfTool.setSplitSelectionMode('all')" style="font-size: 0.72rem; padding: 4px 10px;">Select All</button>
                    <button class="btn btn-secondary" onclick="PdfTool.setSplitSelectionMode('odd')" style="font-size: 0.72rem; padding: 4px 10px;">Odd Pages</button>
                    <button class="btn btn-secondary" onclick="PdfTool.setSplitSelectionMode('even')" style="font-size: 0.72rem; padding: 4px 10px;">Even Pages</button>
                    <button class="btn btn-secondary" onclick="PdfTool.setSplitSelectionMode('invert')" style="font-size: 0.72rem; padding: 4px 10px;">Invert</button>
                    <button class="btn btn-secondary" onclick="PdfTool.setSplitSelectionMode('none')" style="font-size: 0.72rem; padding: 4px 10px;">Clear</button>
                  </div>
                  <div style="font-size: 0.76rem; font-weight: 800; color: var(--c-purple);">
                    ${this.splitSelectedPages.size} of ${pages.length} Pages Picked (Tip: Hold Shift + Click for range)
                  </div>
                </div>

                <!-- Real-time Visual Page Thumbnails Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 12px; max-height: 380px; overflow-y: auto; padding: 6px; margin-bottom: 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--bg-pane);">
                  ${pages.map((p, i) => `
                    <div class="pdf-page-tile ${this.splitSelectedPages.has(i) ? 'selected' : ''}" onclick="PdfTool.toggleSplitPage(${i}, event)">
                      <div class="pdf-page-check-badge">
                        ${this.splitSelectedPages.has(i) ? '✓' : ''}
                      </div>
                      <div class="pdf-preview-box" style="aspect-ratio: 1/1.35;">
                        ${p.thumbUrl ? `<img src="${p.thumbUrl}" class="pdf-preview-canvas">` : `<span style="font-size: 0.7rem; color: var(--text-dim);">Page ${p.pageNum}</span>`}
                      </div>
                      <div style="text-align: center; font-weight: 700; font-size: 0.74rem; color: var(--text-main);">
                        Page ${p.pageNum}
                      </div>
                    </div>
                  `).join('')}
                </div>

                <!-- Action Button for Visual Page Picker -->
                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 12px; flex-wrap: wrap; gap: 10px;">
                  <span style="font-size: 0.74rem; color: var(--text-muted);">
                    ${this.splitSelectedPages.size === 0 ? '⚠️ Click pages to pick which ones to extract' : `Will generate: ${this.splitExtractFormat === 'single' ? '1 Merged PDF' : `${this.splitSelectedPages.size} Separate PDFs (.ZIP)`}`}
                  </span>
                  <button id="pdf-main-split-btn" class="btn btn-primary" onclick="PdfTool.executeSplit()" ${this.splitSelectedPages.size === 0 ? 'disabled' : ''} style="font-size: 0.92rem; font-weight: 700; padding: 10px 24px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.28); cursor: pointer;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Extract ${this.splitSelectedPages.size} Pages ${this.splitExtractFormat === 'single' ? '(1 PDF)' : '(.ZIP)'}
                  </button>
                </div>
              ` : `
                <!-- Mode 2: Cut Dividers Visual Slicer Grid -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                  <span style="font-size: 0.74rem; color: var(--text-muted);">
                    Click the <strong>✂️ Cut</strong> separators between pages to divide document into separate files:
                  </span>
                  <span style="font-size: 0.76rem; font-weight: 800; color: #ef4444;">
                    Document will be split into ${cutParts.length} Separate PDF Part(s)
                  </span>
                </div>

                <div class="pdf-cut-grid-container">
                  ${pages.map((p, i) => `
                    <div class="pdf-cut-item-wrapper">
                      <div style="display: flex; flex-direction: column; width: 120px;">
                        <div class="pdf-preview-box" style="aspect-ratio: 1/1.35; width: 120px;">
                          ${p.thumbUrl ? `<img src="${p.thumbUrl}" class="pdf-preview-canvas">` : `<span style="font-size: 0.7rem; color: var(--text-dim);">Page ${p.pageNum}</span>`}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                          <span style="font-weight: 700; font-size: 0.72rem; color: var(--text-main);">Page ${p.pageNum}</span>
                          ${cutParts.find(part => part.pageIndices.includes(i)) ? `
                            <span class="pdf-part-chip">Part ${cutParts.findIndex(part => part.pageIndices.includes(i)) + 1}</span>
                          ` : ''}
                        </div>
                      </div>

                      ${i < pages.length - 1 ? `
                        <div class="pdf-cut-divider-btn ${this.splitCuts.has(i) ? 'cut-active' : ''}" onclick="PdfTool.toggleCutDivider(${i})" title="${this.splitCuts.has(i) ? 'Remove Cut' : 'Click to Split here'}">
                          <span style="font-size: 13px;">✂️</span>
                          <span>${this.splitCuts.has(i) ? 'CUT' : 'SPLIT'}</span>
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>

                <!-- Action Button for Cut Dividers -->
                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 12px; flex-wrap: wrap; gap: 10px;">
                  <span style="font-size: 0.74rem; color: var(--text-muted);">
                    Will create ${cutParts.length} PDF file(s): ${cutParts.map((part, idx) => `Part ${idx+1} (p.${part.startPage}-${part.endPage})`).join(', ')}
                  </span>
                  <button id="pdf-main-split-btn" class="btn btn-primary" onclick="PdfTool.executeSplit()" style="font-size: 0.92rem; font-weight: 700; padding: 10px 24px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.28); cursor: pointer;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                    Split into ${cutParts.length} PDF Documents (.ZIP)
                  </button>
                </div>
              `}
            </div>
          `;
        }
      }
    }

    // ==========================================
    // 3. IMAGE -> PDF TAB (DRAGGABLE PHOTO TILES)
    // ==========================================
    else if (this.activeTab === 'img2pdf') {
      if (this.imgResult) {
        if (dropzone) dropzone.style.display = 'none';
        const res = this.imgResult;
        html = `
          <div class="pdf-compress-result-box">
            <div class="pdf-compress-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">PDF Created Successfully!</h2>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${res.fileName} • Combined ${res.totalImages} images</div>
            </div>

            <!-- Preview -->
            ${res.thumbUrl ? `
              <div style="width: 140px; margin: 0 auto; box-shadow: var(--shadow-lg); border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color);">
                <img src="${res.thumbUrl}" style="width: 100%; display: block;">
              </div>
            ` : ''}

            <div class="pdf-compress-stats-row">
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Total Images</span>
                <span class="pdf-compress-stat-value">${res.totalImages} Images</span>
              </div>
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">PDF File Size</span>
                <span class="pdf-compress-stat-value" style="color: #10b981;">${this.formatBytes(res.size)}</span>
              </div>
            </div>
            <button class="btn btn-primary" onclick="PdfTool.downloadBlob(PdfTool.imgResult.blob, PdfTool.imgResult.fileName)" style="font-size: 0.95rem; font-weight: 700; padding: 12px 28px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download Generated PDF (${this.formatBytes(res.size)})
            </button>
            <div style="display: flex; gap: 12px; margin-top: 4px;">
              <button class="btn btn-secondary" onclick="PdfTool.imgResult = null; PdfTool.updateTabUI();" style="font-size: 0.76rem; padding: 6px 14px;">
                Add More Images
              </button>
              <button class="btn btn-secondary" onclick="PdfTool.clearAll();" style="font-size: 0.76rem; padding: 6px 14px;">
                Create Another PDF
              </button>
            </div>
          </div>
        `;
      } else {
        if (dropzone) dropzone.style.display = 'block';
        if (this.selectedImages.length === 0) {
          html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No images added yet. Drop PNG or JPG images to convert.</div>`;
        } else {
          html = `
            <div class="url-card" style="padding: 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <div>
                  <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${this.selectedImages.length} Images Added</span>
                  <span style="font-size: 0.72rem; color: var(--text-dim); margin-left: 6px;">Drag tiles to reorder pages • Click ↻ to rotate</span>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-secondary" onclick="document.getElementById('pdf-suite-file-input').click()" style="font-size: 0.74rem; padding: 5px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add More
                  </button>
                  <button class="btn-danger-outline" onclick="PdfTool.clearAll()" style="font-size: 0.74rem; padding: 5px 10px; border-radius: var(--radius-sm);">Clear</button>
                </div>
              </div>

              <!-- Draggable Image Tiles Wizard Grid -->
              <div class="pdf-wizard-grid">
                ${this.selectedImages.map((img, i) => `
                  <div class="pdf-wizard-card" draggable="true"
                       ondragstart="PdfTool.onDragStart(event, ${i}, 'img2pdf')"
                       ondragover="PdfTool.onDragOver(event, ${i}, 'img2pdf')"
                       ondragleave="PdfTool.onDragLeave(event, ${i}, 'img2pdf')"
                       ondrop="PdfTool.onDrop(event, ${i}, 'img2pdf')">
                    
                    <span class="pdf-order-badge">Page ${i+1}</span>
                    
                    <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 4px; z-index: 2;">
                      <button onclick="PdfTool.rotateImage(${i})" style="background: rgba(0,0,0,0.75); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;" title="Rotate 90°">↻</button>
                      <button onclick="PdfTool.removeImg(${i})" style="background: rgba(0,0,0,0.75); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center;" title="Remove">×</button>
                    </div>

                    <div class="pdf-preview-box">
                      <img src="${img.src}" class="pdf-preview-canvas" style="transform: rotate(${img.rotation || 0}deg); transition: transform 0.2s ease;">
                    </div>

                    <div style="font-weight: 700; font-size: 0.76rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${img.name}">
                      ${img.name}
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 14px; flex-wrap: wrap; gap: 10px;">
                <span style="font-size: 0.74rem; color: var(--text-muted);">Each image will be embedded as a high-resolution PDF page</span>
                <button id="pdf-main-img-btn" class="btn btn-primary" onclick="PdfTool.executeImg2Pdf()" style="font-size: 0.92rem; font-weight: 700; padding: 10px 24px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.28); cursor: pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Generate PDF from ${this.selectedImages.length} Images
                </button>
              </div>
            </div>
          `;
        }
      }
    }

    // ==========================================
    // 4. COMPRESS TAB (WITH LIVE PDF PREVIEW)
    // ==========================================
    else if (this.activeTab === 'compress') {
      if (this.compressResult) {
        if (dropzone) dropzone.style.display = 'none';
        const res = this.compressResult;
        html = `
          <div class="pdf-compress-result-box">
            <div class="pdf-compress-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <div>
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">PDF Compressed Successfully!</h2>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${res.fileName}</div>
            </div>

            <!-- Side-by-side Live PDF Previews -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; margin: 4px 0;">
              ${this.compressFile && this.compressFile.thumbUrl ? `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <div style="width: 130px; box-shadow: var(--shadow-md); border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color);">
                    <img src="${this.compressFile.thumbUrl}" style="width: 100%; display: block;">
                  </div>
                  <span style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted);">Original Document</span>
                </div>
              ` : ''}

              <div style="font-size: 1.5rem; color: var(--c-purple);">→</div>

              ${res.thumbUrl ? `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                  <div style="width: 130px; box-shadow: var(--shadow-lg); border-radius: 6px; overflow: hidden; border: 2px solid #10b981;">
                    <img src="${res.thumbUrl}" style="width: 100%; display: block;">
                  </div>
                  <span style="font-size: 0.68rem; font-weight: 800; color: #10b981;">Compressed Result</span>
                </div>
              ` : ''}
            </div>

            <!-- Size Comparison Card -->
            <div class="pdf-compress-stats-row">
              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Original Size</span>
                <span class="pdf-compress-stat-value" style="color: var(--text-muted);">${this.formatBytes(res.origSize)}</span>
              </div>

              <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <span class="pdf-compress-savings-pill">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  -${res.savingsPercent}%
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </div>

              <div class="pdf-compress-stat-item">
                <span class="pdf-compress-stat-label">Compressed Size</span>
                <span class="pdf-compress-stat-value" style="color: #10b981;">${this.formatBytes(res.newSize)}</span>
              </div>
            </div>

            <!-- Primary Download Button -->
            <button class="btn btn-primary" onclick="PdfTool.downloadBlob(PdfTool.compressResult.blob, PdfTool.compressResult.fileName)" style="font-size: 0.95rem; font-weight: 700; padding: 12px 28px; display: inline-flex; align-items: center; gap: 8px; border-radius: var(--radius-md); box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download PDF (${this.formatBytes(res.newSize)})
            </button>

            <!-- Quick Action Links -->
            <div style="display: flex; gap: 12px; margin-top: 4px;">
              <button class="btn btn-secondary" onclick="PdfTool.compressResult = null; PdfTool.updateTabUI();" style="font-size: 0.76rem; padding: 6px 14px;">
                Change Preset & Recompress
              </button>
              <button class="btn btn-secondary" onclick="PdfTool.clearAll();" style="font-size: 0.76rem; padding: 6px 14px;">
                Compress Another PDF
              </button>
            </div>
          </div>
        `;
      } else {
        if (dropzone) dropzone.style.display = 'block';
        if (!this.compressFile) {
          html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No PDF selected for compression. Drop a PDF file above.</div>`;
        } else {
          const file = this.compressFile;
          html = `
            <div class="url-card" style="padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 14px;">
                ${file.thumbUrl ? `
                  <div style="width: 50px; height: 64px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); flex-shrink: 0; box-shadow: var(--shadow-sm);">
                    <img src="${file.thumbUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                  </div>
                ` : `
                  <span style="font-weight: 800; font-size: 0.72rem; color: #ef4444; background: rgba(239,68,68,0.1); padding: 4px 6px; border-radius: 4px;">PDF</span>
                `}
                <div>
                  <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${file.name}</div>
                  <div style="font-size: 0.7rem; color: var(--text-dim);">Original Size: <strong>${this.formatBytes(file.size)}</strong> • ${file.pageCount} ${file.pageCount === 1 ? 'Page' : 'Pages'}</div>
                </div>
              </div>
              <button class="url-action-icon-btn" onclick="PdfTool.compressFile = null; PdfTool.compressResult = null; PdfTool.updateTabUI();" title="Remove PDF">×</button>
            </div>
          `;
        }
      }
    }

    container.innerHTML = html;
  },

  removePdf(index) {
    this.loadedPdfs.splice(index, 1);
    this.renderItemsList();
  },

  removeImg(index) {
    this.selectedImages.splice(index, 1);
    this.renderItemsList();
  },

  async executeMerge() {
    if (this.loadedPdfs.length < 2) return;
    const mainBtn = document.getElementById('pdf-main-merge-btn');
    if (mainBtn) {
      mainBtn.classList.add('btn-loading');
      mainBtn.disabled = true;
      mainBtn.innerHTML = `<span class="spinner-sm" style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: spin 0.6s linear infinite;"></span> Merging...`;
    }
    Perf.showProgressBar('pdf-tab-content-area', 0);
    App.showToast('Merging PDF files...');

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded. Please ensure js/vendor/pdf-lib.min.js exists.');
      }

      const mergedPdf = await PDFLib.PDFDocument.create();
      const total = this.loadedPdfs.length;

      for (let idx = 0; idx < total; idx++) {
        const item = this.loadedPdfs[idx];
        Perf.showProgressBar('pdf-tab-content-area', Math.round((idx / total) * 80));
        const fileBytes = new Uint8Array(await item.file.arrayBuffer());
        const pdf = await PDFLib.PDFDocument.load(fileBytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      Perf.showProgressBar('pdf-tab-content-area', 90);
      const mergedPdfBytes = await mergedPdf.save({ useObjectStreams: true });
      Perf.showProgressBar('pdf-tab-content-area', 100);

      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const finalFileName = `Merged_Document_${Date.now()}.pdf`;

      // Generate thumbnail for merged output
      const thumbUrl = await this.renderPdfPageToDataUrl(await blob.arrayBuffer(), 1, 260);

      this.mergeResult = {
        blob,
        fileName: finalFileName,
        totalPdfs: total,
        size: mergedPdfBytes.length,
        thumbUrl
      };

      this.updateTabUI();
      App.showToast('PDFs merged successfully! Click Download to save.');
    } catch(err) {
      console.error(err);
      App.showToast('Error merging PDFs: ' + err.message, 'error');
    } finally {
      Perf.hideProgressBar('pdf-tab-content-area');
    }
  },

  async executeSplit() {
    if (!this.splitFile) return;
    const mainBtn = document.getElementById('pdf-main-split-btn');
    if (mainBtn) {
      mainBtn.classList.add('btn-loading');
      mainBtn.disabled = true;
      mainBtn.innerHTML = `<span class="spinner-sm" style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: spin 0.6s linear infinite;"></span> Splitting...`;
    }

    this.showProgressOverlay('Processing Split Operation', `${this.splitFile.name}`, 0, 100);

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded.');
      }

      this.updateProgressOverlay(10, 100, 'Reading document structures...');
      const fileBytes = new Uint8Array(await this.splitFile.file.arrayBuffer());
      const srcPdf = await PDFLib.PDFDocument.load(fileBytes, { ignoreEncryption: true });
      const baseName = this.splitFile.name.replace(/\.[^/.]+$/, "");

      // MODE 1: VISUAL PAGE PICKER
      if (this.splitMode === 'extract') {
        if (this.splitSelectedPages.size === 0) {
          App.showToast('Please select at least 1 page to extract', 'error');
          if (mainBtn) { mainBtn.classList.remove('btn-loading'); mainBtn.disabled = false; }
          return;
        }

        const sortedIndices = Array.from(this.splitSelectedPages).sort((a, b) => a - b);
        this.updateProgressOverlay(20, 100, `Extracting ${sortedIndices.length} pages...`);

        // Option A: Single Merged PDF
        if (this.splitExtractFormat === 'single') {
          const splitPdf = await PDFLib.PDFDocument.create();
          const copiedPages = await splitPdf.copyPages(srcPdf, sortedIndices);
          copiedPages.forEach((page) => splitPdf.addPage(page));

          this.updateProgressOverlay(70, 100, 'Saving merged extracted PDF...');
          const splitPdfBytes = await splitPdf.save({ useObjectStreams: true });
          const blob = new Blob([splitPdfBytes], { type: 'application/pdf' });
          const finalFileName = `Extracted_${baseName}.pdf`;
          
          this.updateProgressOverlay(90, 100, 'Generating preview...');
          const thumbUrl = await this.renderPdfPageToDataUrl(await blob.arrayBuffer(), 1, 260);

          this.splitResult = {
            blob,
            fileName: finalFileName,
            isZip: false,
            outputCount: `${sortedIndices.length} Pages in 1 PDF`,
            description: `Extracted ${sortedIndices.length} selected pages into a single document`,
            size: splitPdfBytes.length,
            thumbUrl
          };
        } 
        // Option B: Separate PDFs in ZIP
        else {
          if (typeof JSZip === 'undefined') throw new Error('JSZip library is missing.');
          const zip = new JSZip();
          const zipFolder = zip.folder(`Extracted_${baseName}`);

          for (let i = 0; i < sortedIndices.length; i++) {
            const pageIdx = sortedIndices[i];
            const pct = 20 + Math.round((i / sortedIndices.length) * 65);
            this.updateProgressOverlay(pct, 100, `Extracting page ${pageIdx + 1} (${i + 1}/${sortedIndices.length})...`);
            
            const singlePdf = await PDFLib.PDFDocument.create();
            const [copiedPage] = await singlePdf.copyPages(srcPdf, [pageIdx]);
            singlePdf.addPage(copiedPage);
            const bytes = await singlePdf.save({ useObjectStreams: true });
            zipFolder.file(`Page_${pageIdx + 1}.pdf`, bytes);
          }

          this.updateProgressOverlay(88, 100, 'Packaging ZIP archive...');
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const finalFileName = `Extracted_Pages_${baseName}.zip`;

          this.splitResult = {
            blob: zipBlob,
            fileName: finalFileName,
            isZip: true,
            outputCount: `${sortedIndices.length} Individual PDFs`,
            description: `Extracted ${sortedIndices.length} separate PDF files packaged as a ZIP archive`,
            size: zipBlob.size,
            thumbUrl: this.splitFile.pages && this.splitFile.pages[sortedIndices[0]] ? this.splitFile.pages[sortedIndices[0]].thumbUrl : null
          };
        }
      } 
      // MODE 2: CUT DIVIDERS (MULTI-PART SLICER)
      else {
        const cutParts = this.calculateCutParts();
        this.updateProgressOverlay(15, 100, `Slicing document into ${cutParts.length} parts...`);

        if (typeof JSZip === 'undefined') throw new Error('JSZip library is missing.');
        const zip = new JSZip();
        const zipFolder = zip.folder(`Split_${baseName}`);

        for (let i = 0; i < cutParts.length; i++) {
          const part = cutParts[i];
          const pct = 20 + Math.round((i / cutParts.length) * 65);
          this.updateProgressOverlay(pct, 100, `Building Part ${i + 1} (Pages ${part.startPage}–${part.endPage})...`);
          
          const partPdf = await PDFLib.PDFDocument.create();
          const copiedPages = await partPdf.copyPages(srcPdf, part.pageIndices);
          copiedPages.forEach(p => partPdf.addPage(p));
          const bytes = await partPdf.save({ useObjectStreams: true });
          zipFolder.file(`Part_${i + 1}_Pages_${part.startPage}-${part.endPage}.pdf`, bytes);
        }

        this.updateProgressOverlay(88, 100, 'Packaging ZIP archive...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const finalFileName = `Split_Parts_${baseName}.zip`;

        this.splitResult = {
          blob: zipBlob,
          fileName: finalFileName,
          isZip: true,
          outputCount: `${cutParts.length} Document Parts`,
          description: `Split into ${cutParts.length} documents across cut boundaries and packaged as a ZIP`,
          size: zipBlob.size,
          thumbUrl: this.splitFile.pages && this.splitFile.pages[0] ? this.splitFile.pages[0].thumbUrl : null
        };
      }

      this.updateProgressOverlay(100, 100, 'Complete!');
      this.updateTabUI();
      App.showToast('Document split successfully! Click Download to save.');
    } catch(err) {
      console.error(err);
      App.showToast('Error splitting PDF: ' + err.message, 'error');
    } finally {
      if (mainBtn) { mainBtn.classList.remove('btn-loading'); mainBtn.disabled = false; }
      this.hideProgressOverlay();
    }
  },


  async executeImg2Pdf() {
    if (this.selectedImages.length === 0) return;
    const mainBtn = document.getElementById('pdf-main-img-btn');
    if (mainBtn) {
      mainBtn.classList.add('btn-loading');
      mainBtn.disabled = true;
      mainBtn.innerHTML = `<span class="spinner-sm" style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: spin 0.6s linear infinite;"></span> Creating PDF...`;
    }

    App.showToast('Generating PDF from images...');

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded.');
      }

      const pdfDoc = await PDFLib.PDFDocument.create();

      for (const img of this.selectedImages) {
        let embeddedImg;
        const bytes = await (await fetch(img.src)).arrayBuffer();
        if (img.src.includes('image/png') || img.type.includes('png')) {
          embeddedImg = await pdfDoc.embedPng(bytes);
        } else {
          embeddedImg = await pdfDoc.embedJpg(bytes);
        }

        const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: embeddedImg.width,
          height: embeddedImg.height,
          rotate: PDFLib.degrees(img.rotation || 0)
        });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const finalFileName = `Images_Document_${Date.now()}.pdf`;

      const thumbUrl = await this.renderPdfPageToDataUrl(await blob.arrayBuffer(), 1, 260);

      this.imgResult = {
        blob,
        fileName: finalFileName,
        totalImages: this.selectedImages.length,
        size: pdfBytes.length,
        thumbUrl
      };

      this.updateTabUI();
      App.showToast('Generated PDF from images successfully!');
    } catch(err) {
      console.error(err);
      App.showToast('Error generating PDF: ' + err.message, 'error');
    } finally {
      if (mainBtn) { mainBtn.classList.remove('btn-loading'); mainBtn.disabled = false; }
    }
  },

  // Helper to safely decompress zlib/deflate streams
  async decompressDeflateStream(bytes) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          result.set(c, offset);
          offset += c.length;
        }
        return result;
      } catch (e) {
        try {
          const dsRaw = new DecompressionStream('deflate-raw');
          const writer = dsRaw.writable.getWriter();
          writer.write(bytes);
          writer.close();
          const reader = dsRaw.readable.getReader();
          const chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const result = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            result.set(c, offset);
            offset += c.length;
          }
          return result;
        } catch (e2) {
          return null;
        }
      }
    }
    return null;
  },

  async executeCompress() {
    if (!this.compressFile) return;
    const mainBtn = document.getElementById('pdf-main-compress-btn');
    if (mainBtn) {
      mainBtn.classList.add('btn-loading');
      mainBtn.disabled = true;
      mainBtn.innerHTML = `
        <span class="spinner-sm" style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: spin 0.6s linear infinite;"></span>
        Compressing PDF...
      `;
    }
    Perf.showProgressBar('pdf-tab-content-area', 10);

    App.showToast(`Compressing ${this.compressFile.name}...`);

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded.');
      }

      const fileBytes = new Uint8Array(await this.compressFile.file.arrayBuffer());
      const pdfDoc = await PDFLib.PDFDocument.load(fileBytes, { ignoreEncryption: true });

      // Preset parameters
      let scale = 0.80;
      let quality = 0.72;

      if (this.compressPreset === 'extreme') {
        scale = 0.60;
        quality = 0.50;
      } else if (this.compressPreset === 'less') {
        scale = 1.00;
        quality = 0.88;
      }

      Perf.showProgressBar('pdf-tab-content-area', 30);

      // Process and optimize image streams SAFELY (Lossless font & vector preservation)
      const objects = pdfDoc.context.enumerateIndirectObjects();
      let imageCount = 0;
      let totalImages = 0;

      for (const [ref, obj] of objects) {
        if (obj instanceof PDFLib.PDFRawStream || obj instanceof PDFLib.PDFStream) {
          const dict = obj.dict;
          if (dict) {
            const subtype = dict.get(PDFLib.PDFName.of('Subtype'));
            const subtypeStr = subtype ? subtype.toString() : '';
            if (subtypeStr === '/Image') {
              totalImages++;
              try {
                const filter = dict.get(PDFLib.PDFName.of('Filter'));
                const filterStr = filter ? filter.toString() : '';
                const isJpeg = filterStr.includes('DCTDecode');

                const widthObj = dict.get(PDFLib.PDFName.of('Width'));
                const heightObj = dict.get(PDFLib.PDFName.of('Height'));
                const width = (widthObj && typeof widthObj.value === 'number') ? widthObj.value : (widthObj ? parseInt(widthObj.toString()) : null);
                const height = (heightObj && typeof heightObj.value === 'number') ? heightObj.value : (heightObj ? parseInt(heightObj.toString()) : null);

                // Check for predictor or non-standard decode parameters
                const decodeParms = dict.get(PDFLib.PDFName.of('DecodeParms'));
                const hasPredictor = decodeParms && decodeParms.toString().includes('Predictor');

                let bytes = null;
                try {
                  bytes = obj.getContents();
                } catch (e) {
                  bytes = obj.contents;
                }

                if (!bytes || bytes.length < 1500) {
                  continue;
                }

                if (isJpeg) {
                  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
                    const blob = new Blob([bytes], { type: 'image/jpeg' });
                    const img = await new Promise((resolve, reject) => {
                      const i = new Image();
                      const url = URL.createObjectURL(blob);
                      i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
                      i.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
                      i.src = url;
                    });

                    const targetW = Math.max(1, Math.round(img.width * scale));
                    const targetH = Math.max(1, Math.round(img.height * scale));

                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    const compressedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                    if (compressedBlob && compressedBlob.size < bytes.length * 0.95) {
                      const newBytes = new Uint8Array(await compressedBlob.arrayBuffer());
                      obj.contents = newBytes;
                      dict.set(PDFLib.PDFName.of('Length'), PDFLib.PDFNumber.of(newBytes.length));
                      dict.set(PDFLib.PDFName.of('Width'), PDFLib.PDFNumber.of(targetW));
                      dict.set(PDFLib.PDFName.of('Height'), PDFLib.PDFNumber.of(targetH));
                      imageCount++;
                    }
                  }
                } else if (filterStr.includes('FlateDecode') && width && height && !hasPredictor) {
                  const bitsPerComp = dict.get(PDFLib.PDFName.of('BitsPerComponent'));
                  const bpc = bitsPerComp ? parseInt(bitsPerComp.toString()) : 8;
                  const colorSpace = dict.get(PDFLib.PDFName.of('ColorSpace'))?.toString() || '';

                  if (bpc === 8 && (colorSpace.includes('DeviceRGB') || colorSpace.includes('/RGB'))) {
                    const uncompressedBytes = await this.decompressDeflateStream(bytes);
                    if (uncompressedBytes && uncompressedBytes.length === width * height * 3) {
                      const canvas = document.createElement('canvas');
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      const imgData = ctx.createImageData(width, height);

                      let offset = 0;
                      for (let i = 0; i < uncompressedBytes.length; i += 3) {
                        imgData.data[offset] = uncompressedBytes[i];
                        imgData.data[offset + 1] = uncompressedBytes[i + 1];
                        imgData.data[offset + 2] = uncompressedBytes[i + 2];
                        imgData.data[offset + 3] = 255;
                        offset += 4;
                      }
                      ctx.putImageData(imgData, 0, 0);

                      let finalCanvas = canvas;
                      if (scale < 0.98) {
                        const scaledCanvas = document.createElement('canvas');
                        scaledCanvas.width = Math.max(1, Math.round(width * scale));
                        scaledCanvas.height = Math.max(1, Math.round(height * scale));
                        const sCtx = scaledCanvas.getContext('2d');
                        sCtx.imageSmoothingEnabled = true;
                        sCtx.imageSmoothingQuality = 'high';
                        sCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
                        finalCanvas = scaledCanvas;
                      }

                      const compressedBlob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/jpeg', quality));
                      if (compressedBlob && compressedBlob.size < bytes.length * 0.95) {
                        const newBytes = new Uint8Array(await compressedBlob.arrayBuffer());
                        obj.contents = newBytes;
                        dict.set(PDFLib.PDFName.of('Length'), PDFLib.PDFNumber.of(newBytes.length));
                        dict.set(PDFLib.PDFName.of('Filter'), PDFLib.PDFName.of('DCTDecode'));
                        dict.set(PDFLib.PDFName.of('ColorSpace'), PDFLib.PDFName.of('DeviceRGB'));
                        dict.set(PDFLib.PDFName.of('Width'), PDFLib.PDFNumber.of(finalCanvas.width));
                        dict.set(PDFLib.PDFName.of('Height'), PDFLib.PDFNumber.of(finalCanvas.height));
                        imageCount++;
                      }
                    }
                  }
                }
              } catch (imgErr) {
                console.warn('Skipping unsupported image stream safely:', imgErr);
              }
            }
          }
        }
      }

      Perf.showProgressBar('pdf-tab-content-area', 75);

      // Compact structure, strip dead objects & compress object streams
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addGlyphsHtmlToPdfMap: false
      });

      Perf.showProgressBar('pdf-tab-content-area', 100);

      const origSize = this.compressFile.size;
      const newSize = compressedBytes.length;
      const savings = origSize > 0 ? Math.max(0, Math.round(((origSize - newSize) / origSize) * 100)) : 0;

      const blob = new Blob([compressedBytes], { type: 'application/pdf' });
      const finalFileName = `Compressed_${this.compressFile.name}`;

      // Generate live preview of the compressed result!
      const compressedThumbUrl = await this.renderPdfPageToDataUrl(await blob.arrayBuffer(), 1, 260);

      this.compressResult = {
        blob: blob,
        fileName: finalFileName,
        origSize: origSize,
        newSize: newSize,
        savingsPercent: savings,
        imageCount: imageCount,
        totalImages: totalImages,
        thumbUrl: compressedThumbUrl
      };

      this.updateTabUI();
      App.showToast(`Compressed successfully! Saved ${savings}% (${this.formatBytes(origSize - newSize)}). Click Download to save.`);
    } catch(err) {
      console.error(err);
      App.showToast('Error compressing PDF: ' + err.message, 'error');
    } finally {
      Perf.hideProgressBar('pdf-tab-content-area');
    }
  }
};

window.PdfTool = PdfTool;


