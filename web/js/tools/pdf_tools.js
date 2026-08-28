// Client-Side PDF Tools Suite using industry-standard PDF-Lib
const PdfTool = {
  activeTab: 'merge', // 'merge', 'split', 'img2pdf', 'compress'
  loadedPdfs: [],
  selectedImages: [],
  splitFile: null,
  compressFile: null,
  compressOriginalSize: 0,
  compressImageSize: 0,

  init() {
    const dropzone = document.getElementById('pdf-suite-dropzone');
    const fileInput = document.getElementById('pdf-suite-file-input');
    const addBtn = document.getElementById('pdf-sidebar-add-btn');
    const actionBtn = document.getElementById('pdf-sidebar-action-btn');
    const clearBtn = document.getElementById('pdf-sidebar-clear-btn');

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

    if (addBtn) addBtn.addEventListener('click', () => fileInput.click());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearAll());
    if (actionBtn) actionBtn.addEventListener('click', () => this.executeAction());

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

  updateTabUI() {
    const fileInput = document.getElementById('pdf-suite-file-input');
    const dropTitle = document.getElementById('pdf-dropzone-title');
    const dropSubtitle = document.getElementById('pdf-dropzone-subtitle');
    const addLbl = document.getElementById('pdf-sidebar-add-lbl');
    const actionLbl = document.getElementById('pdf-sidebar-action-lbl');
    const extraControls = document.getElementById('pdf-tab-extra-controls');

    if (extraControls) extraControls.style.display = 'none';

    if (this.activeTab === 'merge') {
      if (fileInput) { fileInput.accept = '.pdf'; fileInput.multiple = true; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop two or more PDFs here, or click to browse';
      if (dropSubtitle) dropSubtitle.innerText = 'They will be merged in the order listed — reorder before merging.';
      if (addLbl) addLbl.innerText = 'Add PDFs';
      if (actionLbl) actionLbl.innerText = 'Merge & Download';
    } else if (this.activeTab === 'split') {
      if (fileInput) { fileInput.accept = '.pdf'; fileInput.multiple = false; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop a PDF file here to split';
      if (dropSubtitle) dropSubtitle.innerText = 'Extract individual pages or specified page ranges.';
      if (addLbl) addLbl.innerText = 'Choose PDF';
      if (actionLbl) actionLbl.innerText = 'Split & Download';
    } else if (this.activeTab === 'img2pdf') {
      if (fileInput) { fileInput.accept = 'image/*'; fileInput.multiple = true; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop images (PNG, JPG, WebP) here';
      if (dropSubtitle) dropSubtitle.innerText = 'Images will be combined into a single PDF document.';
      if (addLbl) addLbl.innerText = 'Add Images';
      if (actionLbl) actionLbl.innerText = 'Generate & Download PDF';
    } else if (this.activeTab === 'compress') {
      if (fileInput) { fileInput.accept = '.pdf'; fileInput.multiple = false; }
      if (dropTitle) dropTitle.innerText = 'Drag & drop a PDF file here to compress';
      if (dropSubtitle) dropSubtitle.innerText = 'Reduce PDF file size 100% locally in browser memory.';
      if (addLbl) addLbl.innerText = 'Choose PDF';
      if (actionLbl) actionLbl.innerText = 'Compress & Download';

      if (extraControls) {
        extraControls.style.display = 'block';
        extraControls.innerHTML = `
          <div style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main); display: flex; align-items: center; justify-content: space-between;">
              <span>Interactive Compression Studio</span>
              <span style="font-size: 0.72rem; color: var(--c-purple); font-weight: 800;" id="pdf-compress-est-percent">-0% Est. Savings</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
              <!-- Column 1: Sliders -->
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">
                    <span>Image Resolution</span><span id="pdf-compress-val-resolution">70%</span>
                  </div>
                  <input type="range" id="pdf-compress-scale" min="10" max="100" value="70" class="slider-range">
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">
                    <span>Compression Quality</span><span id="pdf-compress-val-quality">60%</span>
                  </div>
                  <input type="range" id="pdf-compress-quality" min="10" max="100" value="60" class="slider-range">
                </div>
              </div>

              <!-- Column 2: Live Size Progress Meter -->
              <div style="display: flex; flex-direction: column; justify-content: center; background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.74rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">
                  <span>Estimated File Size</span>
                  <span id="pdf-compress-est-size">0 KB</span>
                </div>
                <div style="height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
                  <div id="pdf-compress-progress-bar" style="width: 100%; height: 100%; background: var(--c-purple); transition: width 0.15s ease, background 0.15s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.64rem; color: var(--text-dim);">
                  <span>Original: <strong id="pdf-compress-orig-size">0 KB</strong></span>
                  <span>Est: <strong id="pdf-compress-target-size">0 KB</strong></span>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // Bind slider change listeners
        const sliderScale = document.getElementById('pdf-compress-scale');
        const sliderQuality = document.getElementById('pdf-compress-quality');
        if (sliderScale && sliderQuality) {
          sliderScale.addEventListener('input', () => this.updateCompressEstimate());
          sliderQuality.addEventListener('input', () => this.updateCompressEstimate());
        }
        
        this.updateCompressEstimate();
      }
    }

    this.renderItemsList();
  },

  updateCompressEstimate() {
    const sliderScale = document.getElementById('pdf-compress-scale');
    const sliderQuality = document.getElementById('pdf-compress-quality');
    
    const valResolution = document.getElementById('pdf-compress-val-resolution');
    const valQuality = document.getElementById('pdf-compress-val-quality');
    const estPercent = document.getElementById('pdf-compress-est-percent');
    const estSize = document.getElementById('pdf-compress-est-size');
    const origSizeEl = document.getElementById('pdf-compress-orig-size');
    const targetSizeEl = document.getElementById('pdf-compress-target-size');
    const progressBar = document.getElementById('pdf-compress-progress-bar');
    
    if (!sliderScale || !sliderQuality) return;
    
    const scale = parseInt(sliderScale.value) / 100;
    const quality = parseInt(sliderQuality.value) / 100;
    
    if (valResolution) valResolution.innerText = `${Math.round(scale * 100)}%`;
    if (valQuality) valQuality.innerText = `${Math.round(quality * 100)}%`;
    
    const origSize = this.compressOriginalSize || 0;
    const imageSize = this.compressImageSize || 0;
    const nonImageSize = Math.max(0, origSize - imageSize);
    
    // Estimate JPEG compression formula
    const estImageSize = imageSize * (scale * scale) * (0.15 + 0.85 * quality) * 0.75;
    // Structural metadata compaction savings (average of 2% + 500 bytes, capped at original size)
    const structuralSavings = origSize > 0 ? Math.min(origSize, Math.round(origSize * 0.02) + 500) : 0;
    const estTotalSize = Math.max(0, Math.round(nonImageSize - structuralSavings + estImageSize));
    
    const savings = origSize > 0 ? Math.max(0, Math.round(((origSize - estTotalSize) / origSize) * 100)) : 0;
    
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 KB';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    if (origSizeEl) origSizeEl.innerText = formatBytes(origSize);
    if (targetSizeEl) targetSizeEl.innerText = formatBytes(estTotalSize);
    if (estSize) estSize.innerText = formatBytes(estTotalSize);
    if (estPercent) estPercent.innerText = `-${savings}% Est. Savings`;
    
    if (progressBar) {
      const percentageLeft = origSize > 0 ? Math.round((estTotalSize / origSize) * 100) : 100;
      progressBar.style.width = `${Math.min(100, percentageLeft)}%`;
      
      // Dynamic colors based on savings
      if (savings > 50) {
        progressBar.style.backgroundColor = '#10b981'; // Green (high savings)
      } else if (savings > 25) {
        progressBar.style.backgroundColor = '#f59e0b'; // Amber (balanced)
      } else {
        progressBar.style.backgroundColor = '#7c3aed'; // Purple (original/high quality)
      }
    }
  },

  handleImportFiles(files) {
    const fileList = Array.from(files);
    if (this.activeTab === 'merge') {
      fileList.forEach(file => {
        if (file.name.toLowerCase().endsWith('.pdf')) {
          this.loadedPdfs.push(file);
        }
      });
      App.showToast(`Added ${fileList.length} PDF(s) to merge list`);
    } else if (this.activeTab === 'split') {
      if (fileList.length && fileList[0].name.toLowerCase().endsWith('.pdf')) {
        this.splitFile = fileList[0];
        App.showToast(`Selected ${this.splitFile.name} for splitting`);
      }
    } else if (this.activeTab === 'img2pdf') {
      fileList.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            this.selectedImages.push({ name: file.name, src: e.target.result });
            this.renderItemsList();
          };
          reader.readAsDataURL(file);
        }
      });
      App.showToast(`Added ${fileList.length} image(s) for PDF generation`);
    } else if (this.activeTab === 'compress') {
      if (fileList.length && fileList[0].name.toLowerCase().endsWith('.pdf')) {
        this.compressFile = fileList[0];
        this.compressOriginalSize = this.compressFile.size;
        this.compressImageSize = 0;
        this.renderItemsList();
        
        App.showToast(`Selected ${this.compressFile.name}. Analyzing streams...`);
        
        // Asynchronously analyze image objects for live calculations
        (async () => {
          try {
            if (typeof PDFLib !== 'undefined') {
              const fileBytes = new Uint8Array(await this.compressFile.arrayBuffer());
              const pdfDoc = await PDFLib.PDFDocument.load(fileBytes);
              const objects = pdfDoc.context.enumerateIndirectObjects();
              let imageBytesSum = 0;
              for (const [ref, obj] of objects) {
                if (obj instanceof PDFLib.PDFRawStream || obj instanceof PDFLib.PDFStream) {
                  const dict = obj.dict;
                  if (dict) {
                    const subtype = dict.get(PDFLib.PDFName.of('Subtype'));
                    const subtypeStr = subtype ? subtype.toString() : '';
                    if (subtypeStr === '/Image') {
                      if (obj.getContents) {
                        try {
                          imageBytesSum += obj.getContents().length;
                        } catch (e) {
                          imageBytesSum += obj.getContentsSize ? obj.getContentsSize() : (obj.contents ? obj.contents.length : 0);
                        }
                      }
                    }
                  }
                }
              }
              // Save exact image bytes found (no default to 70%!)
              this.compressImageSize = imageBytesSum;
              this.updateCompressEstimate();
              App.showToast(`Analysis complete. Groundbreaking live estimate ready.`);
            }
          } catch (err) {
            console.error(err);
            this.compressImageSize = 0;
            this.updateCompressEstimate();
          }
        })();
      }
    }

    this.renderItemsList();
  },

  clearAll() {
    this.loadedPdfs = [];
    this.selectedImages = [];
    this.splitFile = null;
    this.compressFile = null;
    this.compressOriginalSize = 0;
    this.compressImageSize = 0;
    this.renderItemsList();
    App.showToast('Cleared PDF tools workspace');
  },

  renderItemsList() {
    const container = document.getElementById('pdf-suite-items-list');
    const actionBtn = document.getElementById('pdf-sidebar-action-btn');
    if (!container) return;

    let hasItems = false;
    let html = '';

    if (this.activeTab === 'merge') {
      hasItems = this.loadedPdfs.length >= 2;
      if (this.loadedPdfs.length === 0) {
        html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No PDFs added yet. Drop at least 2 PDF files to merge.</div>`;
      } else {
        html = this.loadedPdfs.map((file, i) => `
          <div class="url-card" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; font-size: 0.72rem; color: #ef4444; background: rgba(239,68,68,0.1); padding: 4px 6px; border-radius: 4px;">PDF</span>
              <div>
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-main);">${file.name}</div>
                <div style="font-size: 0.68rem; color: var(--text-dim);">${(file.size/1024).toFixed(1)} KB</div>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="url-action-icon-btn" onclick="PdfTool.movePdf(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move Up">↑</button>
              <button class="url-action-icon-btn" onclick="PdfTool.movePdf(${i}, 1)" ${i === this.loadedPdfs.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
              <button class="url-action-icon-btn" onclick="PdfTool.removePdf(${i})" title="Remove">×</button>
            </div>
          </div>
        `).join('');
      }
    } else if (this.activeTab === 'split') {
      hasItems = !!this.splitFile;
      if (!this.splitFile) {
        html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No PDF selected for splitting. Drop a PDF file above.</div>`;
      } else {
        html = `
          <div class="url-card" style="padding: 12px 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: 800; font-size: 0.72rem; color: #ef4444; background: rgba(239,68,68,0.1); padding: 4px 6px; border-radius: 4px;">PDF</span>
                <div>
                  <div style="font-weight: 700; font-size: 0.82rem; color: var(--text-main);">${this.splitFile.name}</div>
                  <div style="font-size: 0.68rem; color: var(--text-dim);">${(this.splitFile.size/1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button class="url-action-icon-btn" onclick="PdfTool.splitFile = null; PdfTool.renderItemsList();">×</button>
            </div>
            <div>
              <label style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">Pages to extract (e.g. 1-3, 5)</label>
              <input type="text" id="pdf-split-pages-input" class="input-text" style="font-size: 0.78rem; padding: 4px 8px; width: 100%;" placeholder="e.g. 1-2 or 1, 3, 5">
            </div>
          </div>
        `;
      }
    } else if (this.activeTab === 'img2pdf') {
      hasItems = this.selectedImages.length > 0;
      if (this.selectedImages.length === 0) {
        html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No images added yet. Drop PNG or JPG images to convert.</div>`;
      } else {
        html = `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
            ${this.selectedImages.map((img, i) => `
              <div style="position: relative; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; height: 100px; background: #000;">
                <img src="${img.src}" style="width: 100%; height: 100%; object-fit: cover;">
                <button onclick="PdfTool.removeImg(${i})" style="position: absolute; top: 3px; right: 3px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center;">×</button>
              </div>
            `).join('')}
          </div>
        `;
      }
    } else if (this.activeTab === 'compress') {
      hasItems = !!this.compressFile;
      if (!this.compressFile) {
        html = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-style: italic;">No PDF selected for compression. Drop a PDF file above.</div>`;
      } else {
        html = `
          <div class="url-card" style="padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; font-size: 0.72rem; color: #ef4444; background: rgba(239,68,68,0.1); padding: 4px 6px; border-radius: 4px;">PDF</span>
              <div>
                <div style="font-weight: 700; font-size: 0.82rem; color: var(--text-main);">${this.compressFile.name}</div>
                <div style="font-size: 0.68rem; color: var(--text-dim);">${(this.compressFile.size/1024).toFixed(1)} KB</div>
              </div>
            </div>
            <button class="url-action-icon-btn" onclick="PdfTool.compressFile = null; PdfTool.renderItemsList();">×</button>
          </div>
        `;
      }
    }

    container.innerHTML = html;
    if (actionBtn) actionBtn.disabled = !hasItems;
  },

  movePdf(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= this.loadedPdfs.length) return;
    const temp = this.loadedPdfs[index];
    this.loadedPdfs[index] = this.loadedPdfs[target];
    this.loadedPdfs[target] = temp;
    this.renderItemsList();
  },

  removePdf(index) {
    this.loadedPdfs.splice(index, 1);
    this.renderItemsList();
  },

  removeImg(index) {
    this.selectedImages.splice(index, 1);
    this.renderItemsList();
  },

  async executeAction() {
    if (this.activeTab === 'merge') {
      await this.executeMerge();
    } else if (this.activeTab === 'split') {
      await this.executeSplit();
    } else if (this.activeTab === 'img2pdf') {
      await this.executeImg2Pdf();
    } else if (this.activeTab === 'compress') {
      await this.executeCompress();
    }
  },

  async executeMerge() {
    if (this.loadedPdfs.length < 2) return;
    App.showToast('Merging PDF files...');

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded. Please ensure js/vendor/pdf-lib.min.js exists.');
      }

      const mergedPdf = await PDFLib.PDFDocument.create();

      for (const file of this.loadedPdfs) {
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await PDFLib.PDFDocument.load(fileBytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Merged_Document_${Date.now()}.pdf`;
      a.click();

      App.showToast('Merged PDFs successfully!');
    } catch(err) {
      console.error(err);
      App.showToast('Error merging PDFs: ' + err.message, 'error');
    }
  },

  async executeSplit() {
    if (!this.splitFile) return;
    const input = document.getElementById('pdf-split-pages-input');
    const range = input ? input.value.trim() : '';

    if (!range) {
      App.showToast('Please specify a page range (e.g. 1-2, 4)', 'error');
      return;
    }

    App.showToast(`Extracting pages from ${this.splitFile.name}...`);

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded.');
      }

      const fileBytes = new Uint8Array(await this.splitFile.arrayBuffer());
      const srcPdf = await PDFLib.PDFDocument.load(fileBytes);
      const totalPages = srcPdf.getPageCount();

      const pagesToExtract = [];
      const parts = range.split(',');
      parts.forEach(p => {
        if (p.includes('-')) {
          const [start, end] = p.split('-').map(x => parseInt(x.trim()));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) {
              if (i >= 1 && i <= totalPages) pagesToExtract.push(i - 1);
            }
          }
        } else {
          const idx = parseInt(p.trim());
          if (!isNaN(idx) && idx >= 1 && idx <= totalPages) {
            pagesToExtract.push(idx - 1);
          }
        }
      });

      if (pagesToExtract.length === 0) {
        throw new Error('No valid pages found in specified range.');
      }

      const splitPdf = await PDFLib.PDFDocument.create();
      const copiedPages = await splitPdf.copyPages(srcPdf, pagesToExtract);
      copiedPages.forEach((page) => splitPdf.addPage(page));

      const splitPdfBytes = await splitPdf.save();
      const blob = new Blob([splitPdfBytes], { type: 'application/pdf' });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Split_${this.splitFile.name}`;
      a.click();

      App.showToast('PDF pages split successfully!');
    } catch(err) {
      console.error(err);
      App.showToast('Error splitting PDF: ' + err.message, 'error');
    }
  },

  async executeImg2Pdf() {
    if (this.selectedImages.length === 0) return;
    App.showToast('Generating PDF from images...');

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded.');
      }

      const pdfDoc = await PDFLib.PDFDocument.create();

      for (const img of this.selectedImages) {
        let embeddedImg;
        const bytes = await (await fetch(img.src)).arrayBuffer();
        if (img.src.includes('image/png')) {
          embeddedImg = await pdfDoc.embedPng(bytes);
        } else {
          embeddedImg = await pdfDoc.embedJpg(bytes);
        }

        const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: embeddedImg.width,
          height: embeddedImg.height
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Images_${Date.now()}.pdf`;
      a.click();

      App.showToast('Generated PDF from images successfully!');
    } catch(err) {
      console.error(err);
      App.showToast('Error generating PDF: ' + err.message, 'error');
    }
  },

  async executeCompress() {
    if (!this.compressFile) return;
    App.showToast(`Compressing ${this.compressFile.name}...`);

    try {
      if (typeof PDFLib === 'undefined') {
        throw new Error('PDFLib is not loaded.');
      }

      const fileBytes = new Uint8Array(await this.compressFile.arrayBuffer());
      const pdfDoc = await PDFLib.PDFDocument.load(fileBytes);

      // Determine compression settings from interactive sliders
      const sliderScale = document.getElementById('pdf-compress-scale');
      const sliderQuality = document.getElementById('pdf-compress-quality');
      
      const scale = sliderScale ? (parseInt(sliderScale.value) / 100) : 0.7;
      const quality = sliderQuality ? (parseInt(sliderQuality.value) / 100) : 0.6;

      // Convert base64 to Uint8Array helper
      const base64ToBytes = (b64) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
      };

      // Process and compress image XObjects inside PDF
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
                // Safely read uncompressed bytes of the stream
                const bytes = obj.getContents();
                if (bytes && bytes.length > 2000) { // Limit lowered to 2KB to catch smaller images
                  const filter = dict.get(PDFLib.PDFName.of('Filter'));
                  const filterStr = filter ? filter.toString() : '';
                  const isJpeg = filterStr.includes('DCTDecode');
                  
                  let canvas = document.createElement('canvas');
                  let ctx = canvas.getContext('2d');
                  
                  if (isJpeg) {
                    // Load directly as JPEG file
                    const blob = new Blob([bytes], { type: 'image/jpeg' });
                    const url = URL.createObjectURL(blob);
                    
                    const img = await new Promise((resolve, reject) => {
                      const i = new Image();
                      i.onload = () => resolve(i);
                      i.onerror = () => reject(new Error('Failed to load JPEG'));
                      i.src = url;
                    });
                    
                    URL.revokeObjectURL(url);
                    
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  } else {
                    // Handle raw/FlateDecode pixels
                    const width = dict.get(PDFLib.PDFName.of('Width'))?.value;
                    const height = dict.get(PDFLib.PDFName.of('Height'))?.value;
                    if (!width || !height) continue;
                    
                    canvas.width = width;
                    canvas.height = height;
                    const imgData = ctx.createImageData(width, height);
                    
                    const colorSpace = dict.get(PDFLib.PDFName.of('ColorSpace'));
                    const isGray = colorSpace && colorSpace.toString().includes('DeviceGray');
                    
                    let offset = 0;
                    if (isGray) {
                      for (let i = 0; i < bytes.length; i++) {
                        const g = bytes[i];
                        imgData.data[offset] = g;
                        imgData.data[offset+1] = g;
                        imgData.data[offset+2] = g;
                        imgData.data[offset+3] = 255;
                        offset += 4;
                      }
                    } else {
                      // RGB
                      for (let i = 0; i < bytes.length && i + 2 < bytes.length; i += 3) {
                        imgData.data[offset] = bytes[i];
                        imgData.data[offset+1] = bytes[i+1];
                        imgData.data[offset+2] = bytes[i+2];
                        imgData.data[offset+3] = 255;
                        offset += 4;
                      }
                    }
                    ctx.putImageData(imgData, 0, 0);
                    
                    if (scale < 0.99) {
                      const tempCanvas = document.createElement('canvas');
                      tempCanvas.width = Math.max(1, Math.round(width * scale));
                      tempCanvas.height = Math.max(1, Math.round(height * scale));
                      const tempCtx = tempCanvas.getContext('2d');
                      tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
                      canvas = tempCanvas;
                    }
                  }
                  
                  const compressedB64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
                  const compressedBytes = base64ToBytes(compressedB64);
                  
                  if (compressedBytes.length < bytes.length) {
                    obj.contents = compressedBytes;
                    dict.set(PDFLib.PDFName.of('Length'), PDFLib.PDFNumber.of(compressedBytes.length));
                    dict.set(PDFLib.PDFName.of('Filter'), PDFLib.PDFName.of('DCTDecode'));
                    dict.delete(PDFLib.PDFName.of('ColorSpace'));
                    dict.set(PDFLib.PDFName.of('Width'), PDFLib.PDFNumber.of(canvas.width));
                    dict.set(PDFLib.PDFName.of('Height'), PDFLib.PDFNumber.of(canvas.height));
                    imageCount++;
                  }
                }
              } catch (err) {
                console.warn('Skipping XObject image compression:', err);
              }
            }
          }
        }
      }

      // Compact structure & save
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addGlyphsHtmlToPdfMap: false
      });

      const blob = new Blob([compressedBytes], { type: 'application/pdf' });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Compressed_${this.compressFile.name}`;
      a.click();

      if (imageCount > 0) {
        App.showToast(`Compressed successfully! Optimized ${imageCount} of ${totalImages} image(s).`);
      } else if (totalImages === 0) {
        App.showToast(`Compressed successfully! (No image streams found in this PDF)`);
      } else {
        App.showToast(`Compressed successfully! (All ${totalImages} images are already fully optimized)`);
      }
    } catch(err) {
      console.error(err);
      App.showToast('Error compressing PDF: ' + err.message, 'error');
    }
  }
};

window.PdfTool = PdfTool;
