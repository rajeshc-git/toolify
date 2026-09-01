// Document & Folder Keyword Analyzer Tool (DOCX, PDF, CSV, TXT, JSON)
const DocAnalyzerTool = {
  loadedDocs: [],
  currentMode: 'any', // 'any', 'all', 'fuzzy'
  activeDocIndex: -1,
  activeTab: 'preview', // 'preview', 'text', 'json'
  keywords: [],

  // Color palette for keyword chips
  chipColors: [
    { bg: 'rgba(124, 58, 237, 0.12)', border: 'rgba(124, 58, 237, 0.3)', text: '#7c3aed' },
    { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
    { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
    { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
    { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
    { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' },
    { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', text: '#14b8a6' },
    { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' },
  ],

  init() {
    const dropzone = document.getElementById('doc-multi-dropzone');
    const fileInput = document.getElementById('doc-file-input');
    const clearBtn = document.getElementById('doc-clear-btn');
    const clearBtnTop = document.getElementById('doc-clear-btn-top');
    const sampleBtn = document.getElementById('doc-sample-btn');
    const searchKeyword = document.getElementById('doc-search-keyword');

    const importFilesBtn = document.getElementById('doc-import-files-btn');
    const importFolderBtn = document.getElementById('doc-import-folder-btn');

    // Create a dynamic hidden folder input
    const folderInput = document.createElement('input');
    folderInput.type = 'file';
    folderInput.webkitdirectory = true;
    folderInput.directory = true;
    folderInput.multiple = true;
    folderInput.style.display = 'none';
    document.body.appendChild(folderInput);

    if (!dropzone || !fileInput) return;

    // Dropzone bindings
    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput) fileInput.click();
    });
    fileInput.addEventListener('click', (e) => e.stopPropagation());

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.loadFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.loadFiles(e.target.files);
        fileInput.value = '';
      }
    });

    folderInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.loadFiles(e.target.files);
        folderInput.value = '';
      }
    });

    // Import options buttons
    if (importFilesBtn) {
      importFilesBtn.addEventListener('click', () => fileInput.click());
    }
    if (importFolderBtn) {
      importFolderBtn.addEventListener('click', () => folderInput.click());
    }

    // Controls
    if (sampleBtn) sampleBtn.addEventListener('click', () => this.loadSamples());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearAll());
    if (clearBtnTop) clearBtnTop.addEventListener('click', () => this.clearAll());

    // Keyword chips system
    const chipInput = document.getElementById('doc-keyword-input');
    const chipContainer = document.getElementById('doc-keyword-chips-container');
    if (chipInput && chipContainer) {
      // Always start fresh — no localStorage auto-load
      localStorage.removeItem('doc_analyzer_query');

      // Focus ring on container
      chipInput.addEventListener('focus', () => {
        chipContainer.style.borderColor = 'var(--c-purple)';
        chipContainer.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.12)';
      });
      chipInput.addEventListener('blur', () => {
        chipContainer.style.borderColor = 'var(--border-color)';
        chipContainer.style.boxShadow = 'none';
        // Add trailing text as chip on blur
        const val = chipInput.value.trim();
        if (val) {
          this.addKeywordChip(val);
          chipInput.value = '';
        }
      });

      chipInput.addEventListener('keydown', (e) => {
        const val = chipInput.value.trim();
        if ((e.key === 'Enter' || e.key === ',') && val) {
          e.preventDefault();
          this.addKeywordChip(val);
          chipInput.value = '';
        } else if (e.key === 'Backspace' && !chipInput.value && this.keywords.length > 0) {
          e.preventDefault();
          this.keywords.pop();
          this.syncKeywordsToHidden();
          this.renderKeywordChips();
          this.searchDocs();
        } else if (e.key === 'Tab' && val) {
          e.preventDefault();
          this.addKeywordChip(val);
          chipInput.value = '';
        }
      });

      // Handle paste of comma-separated keywords
      chipInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const parts = pasted.split(',').map(k => k.trim()).filter(k => k.length > 0);
        parts.forEach(p => this.addKeywordChip(p));
        chipInput.value = '';
      });
    }

    // Match mode toggles
    ['any', 'all', 'fuzzy'].forEach(mode => {
      const btn = document.getElementById(`doc-match-${mode}`);
      if (btn) {
        btn.addEventListener('click', () => {
          ['any', 'all', 'fuzzy'].forEach(m => {
            const b = document.getElementById(`doc-match-${m}`);
            if (b) b.classList.remove('active', 'log-info');
          });
          btn.classList.add('active', 'log-info');
          this.currentMode = mode;
          
          const lbl = document.getElementById('doc-active-mode-lbl');
          if (lbl) {
            lbl.innerText = mode === 'any' ? 'Any keyword' : mode === 'all' ? 'All keywords' : 'Fuzzy matching';
          }
          this.searchDocs();
        });
      }
    });

    // Modal setup
    this.setupModal();

    // Start empty
    this.searchDocs();
  },

  setupModal() {
    const modal = document.getElementById('doc-detail-modal');
    const closeBtn = document.getElementById('doc-modal-close');
    const addTagBtn = document.getElementById('doc-modal-tag-add');
    const downloadBtn = document.getElementById('doc-modal-download-btn');
    const copyBtn = document.getElementById('doc-modal-copy-btn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        // Clean iframe url to release memory
        const frame = document.getElementById('doc-modal-preview-frame');
        if (frame) frame.src = '';
      });
      // Also close modal when clicking background
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
          const frame = document.getElementById('doc-modal-preview-frame');
          if (frame) frame.src = '';
        }
      });
    }

    // Add keyword tag inside modal
    if (addTagBtn) {
      addTagBtn.addEventListener('click', () => {
        const tagInput = document.getElementById('doc-modal-tag-input');
        if (tagInput && tagInput.value.trim()) {
          this.addKeywordChip(tagInput.value.trim());
          tagInput.value = '';
          this.renderModalTags();
        }
      });
    }

    // Download active file
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (this.activeDocIndex === -1) return;
        const doc = this.loadedDocs[this.activeDocIndex];
        const blob = new Blob([doc.fileObj || doc.content], { type: doc.type || 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = doc.name;
        a.click();
      });
    }

    // Copy text content
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (this.activeDocIndex === -1) return;
        App.copyToClipboard(this.loadedDocs[this.activeDocIndex].content, copyBtn);
      });
    }

    // Tabs transitions
    ['preview', 'text', 'json'].forEach(tab => {
      const btn = document.getElementById(`doc-tab-btn-${tab}`);
      if (btn) {
        btn.addEventListener('click', () => {
          ['preview', 'text', 'json'].forEach(t => {
            const b = document.getElementById(`doc-tab-btn-${t}`);
            const pane = document.getElementById(`doc-modal-tab-${t}`);
            if (b) b.classList.remove('active');
            if (pane) pane.style.display = 'none';
          });
          btn.classList.add('active');
          this.activeTab = tab;
          
          const targetPane = document.getElementById(`doc-modal-tab-${tab}`);
          if (targetPane) targetPane.style.display = 'block';

          this.renderActiveTabContent();
        });
      }
    });
  },

  clearAll() {
    this.loadedDocs = [];
    this.keywords = [];
    this.syncKeywordsToHidden();
    this.renderKeywordChips();
    localStorage.removeItem('doc_analyzer_query');
    this.searchDocs();
    App.showToast('Cleared all loaded documents');
  },

  loadSamples() {
    this.loadedDocs = [
      {
        name: "rajesh-resume-bw.pdf",
        size: 49868,
        type: "application/pdf",
        content: `RAJESH CHOUDHURY Senior Software Engineer (Full Stack & AI)
Professional Summary: Senior Software Engineer with 6+ years of experience building full-stack web applications, backend systems, and AI-powered tooling. Worked on healthcare, government, and enterprise platforms with focus on scalable APIs, database optimization, and secure system design.
Core Competencies: Backend Engineering, RAG Pipelines, Microservices Architecture.
Technical Skills: Go, Python, JavaScript, SQL, Dart, Flutter, C#.`,
        fileObj: new File([new Uint8Array(49868)], "rajesh-resume-bw.pdf", { type: "application/pdf" })
      },
      {
        name: "Security_Audit_Report.docx",
        size: 14200,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        content: `CONFIDENTIAL SECURITY AUDIT REPORT (2026)
Project: Cloud Infrastructure & API Gateway
Author: SecOps Team
Findings:
- Issue #1: Missing rate limiter on /v1/auth/token endpoint. HIGH severity.
- Issue #2: Database pool timeout detected under heavy concurrent load (3000ms).
- Issue #3: JWT tokens missing explicit audience validation. MEDIUM severity.`,
        fileObj: new File(["DOCX Sample Context"], "Security_Audit_Report.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
      },
      {
        name: "Financial_Transactions_Q3.csv",
        size: 8900,
        type: "text/csv",
        content: `tx_id,user_id,amount,currency,status,gateway
tx_89124,usr_102,150.00,USD,SUCCESS,stripe
tx_89125,usr_103,4200.50,EUR,SUCCESS,bank_wire
tx_89126,usr_104,19.99,USD,FAILED,paypal`,
        fileObj: new File(["tx_id,user_id,amount"], "Financial_Transactions_Q3.csv", { type: "text/csv" })
      }
    ];

    this.searchDocs();
  },

  async loadFiles(files) {
    let count = 0;
    const fileArr = Array.from(files);
    const total = fileArr.length;
    Perf.showProgressBar('doc-multi-dropzone', 0);

    for (let idx = 0; idx < total; idx++) {
      const file = fileArr[idx];
      Perf.showProgressBar('doc-multi-dropzone', Math.round(((idx + 1) / total) * 90));
      const ext = file.name.split('.').pop().toLowerCase();
      let text = '';

      try {
        if (ext === 'docx') {
          text = await this.readDocx(file);
        } else if (ext === 'pdf') {
          text = await this.readPdf(file);
        } else {
          text = await file.text();
        }

        this.loadedDocs.push({
          name: file.name,
          size: file.size,
          type: file.type || 'text/plain',
          content: text || `[Empty document: ${file.name}]`,
          fileObj: file
        });
        count++;
      } catch (err) {
        console.error(`Error reading ${file.name}:`, err);
        this.loadedDocs.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          content: `[File Read Error: ${file.name} - ${err.message}]`,
          fileObj: file
        });
        count++;
      }
    }

    Perf.hideProgressBar('doc-multi-dropzone');
    this.searchDocs();
    App.showToast(`Loaded ${count} file(s) for keyword analysis`);
  },


  indexOfBytes(source, target, start) {
    for (let i = start; i < source.length - target.length; i++) {
      let match = true;
      for (let j = 0; j < target.length; j++) {
        if (source[i + j] !== target[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  },

  async decompressDeflate(bytes) {
    try {
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const response = new Response(ds.readable);
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (e) {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const response = new Response(ds.readable);
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } catch (err) {
        return null;
      }
    }
  },

  async readPdf(file) {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const textDecoder = new TextDecoder('latin1');
      const text = textDecoder.decode(bytes);
      
      let extractedText = '';
      
      const streamMarker = [115, 116, 114, 101, 97, 109];
      const endstreamMarker = [101, 110, 100, 115, 116, 114, 101, 97, 109];
      
      let pos = 0;
      while (pos < bytes.length) {
        let streamIdx = this.indexOfBytes(bytes, streamMarker, pos);
        if (streamIdx === -1) break;
        
        let endIdx = this.indexOfBytes(bytes, endstreamMarker, streamIdx);
        if (endIdx === -1) break;
        
        const dictStart = Math.max(0, streamIdx - 300);
        const dictBytes = bytes.slice(dictStart, streamIdx);
        const dictText = textDecoder.decode(dictBytes);
        
        if (dictText.includes('/Type /XObject') || dictText.includes('/Subtype /Image') || dictText.includes('/Subtype /Font')) {
          pos = endIdx + endstreamMarker.length;
          continue;
        }

        let startOffset = streamIdx + streamMarker.length;
        if (bytes[startOffset] === 13) startOffset++;
        if (bytes[startOffset] === 10) startOffset++;
        
        let endOffset = endIdx;
        if (bytes[endOffset - 1] === 10) endOffset--;
        if (bytes[endOffset - 1] === 13) endOffset--;
        
        const streamData = bytes.slice(startOffset, endOffset);
        
        let decompressed = null;
        if (dictText.includes('/FlateDecode') || dictText.includes('/Fl')) {
          decompressed = await this.decompressDeflate(streamData);
        } else {
          decompressed = streamData;
        }
        
        if (decompressed) {
          const decompressedText = new TextDecoder('utf-8').decode(decompressed);
          
          const tjMatches = decompressedText.match(/\(([^)]+)\)\s*Tj/g);
          if (tjMatches) {
            extractedText += tjMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ') + '\n';
          }
          
          const tjArrayMatches = decompressedText.match(/\[([\s\S]*?)\]\s*TJ/g);
          if (tjArrayMatches) {
            tjArrayMatches.forEach(m => {
              const innerText = m.match(/\(([^)]+)\)/g);
              if (innerText) {
                extractedText += innerText.map(it => it.slice(1, -1)).join('') + ' ';
              }
            });
            extractedText += '\n';
          }
        }
        
        pos = endIdx + endstreamMarker.length;
      }
      
      if (!extractedText.trim()) {
        const plainText = text.replace(/[^A-Za-z0-9\s.,!?:;_-]/g, ' ');
        const words = plainText.match(/[A-Za-z0-9_]{3,}/g);
        if (words && words.length > 0) {
          return words.join(' ');
        }
        return `[PDF File: ${file.name}]`;
      }
      
      return extractedText;
    } catch (e) {
      console.error(e);
      return `[PDF Extraction Notice: ${e.message}]`;
    }
  },

  async readDocx(file) {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      let pos = 0;
      while (pos < bytes.length - 30) {
        if (bytes[pos] === 0x50 && bytes[pos+1] === 0x4B && bytes[pos+2] === 0x03 && bytes[pos+3] === 0x04) {
          const fileNameLen = bytes[pos+26] + (bytes[pos+27] << 8);
          const extraFieldLen = bytes[pos+28] + (bytes[pos+29] << 8);
          const compMethod = bytes[pos+8] + (bytes[pos+9] << 8);
          const compSize = bytes[pos+18] + (bytes[pos+19] << 8) + (bytes[pos+20] << 16) + (bytes[pos+21] << 24);
          
          const nameBytes = bytes.slice(pos + 30, pos + 30 + fileNameLen);
          const filename = new TextDecoder('utf-8').decode(nameBytes);
          
          if (filename === 'word/document.xml') {
            const startOffset = pos + 30 + fileNameLen + extraFieldLen;
            const compBytes = bytes.slice(startOffset, startOffset + compSize);
            
            let xmlBytes;
            if (compMethod === 8) {
              xmlBytes = await this.decompressDeflate(compBytes);
            } else {
              xmlBytes = compBytes;
            }
            
            if (xmlBytes) {
              const xmlText = new TextDecoder('utf-8').decode(xmlBytes);
              const wTags = xmlText.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
              if (wTags) {
                return wTags.map(t => t.replace(/<[^>]+>/g, '')).join(' ');
              }
            }
          }
          pos += 30 + fileNameLen + extraFieldLen + compSize;
        } else {
          pos++;
        }
      }
      return `[DOCX: Empty file payload]`;
    } catch (e) {
      console.error(e);
      return `[DOCX Extraction Notice: ${e.message}]`;
    }
  },

  searchDocs() {
    const keywordInput = document.getElementById('doc-search-keyword');
    const query = keywordInput ? keywordInput.value.trim() : '';

    // Split keywords
    const keywords = query.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);

    let docCount = this.loadedDocs.length;
    let pdfCount = 0;
    let docxCount = 0;

    this.loadedDocs.forEach(doc => {
      const ext = doc.name.split('.').pop().toLowerCase();
      if (ext === 'pdf') pdfCount++;
      if (ext === 'docx') docxCount++;

      // Compute matching status
      if (keywords.length === 0) {
        doc.matchedKeywordsCount = 0;
        doc.matchedPct = 0;
        return;
      }

      let matches = 0;
      const lowerContent = doc.content.toLowerCase();

      keywords.forEach(kw => {
        if (this.currentMode === 'fuzzy') {
          // Fuzzy match Levenshtein or substring-based similarity
          if (lowerContent.includes(kw)) {
            matches++;
          } else {
            // Check for minor word shifts
            const words = lowerContent.split(/\s+/);
            const found = words.some(w => this.levenshteinDistance(w, kw) <= 1 || w.includes(kw));
            if (found) matches++;
          }
        } else {
          if (lowerContent.includes(kw)) matches++;
        }
      });

      doc.matchedKeywordsCount = matches;
      doc.matchedPct = Math.round((matches / keywords.length) * 100);
    });

    // Update option stats counters
    const totEl = document.getElementById('stat-total-cnt');
    const pdfEl = document.getElementById('stat-pdf-cnt');
    const docxEl = document.getElementById('stat-docx-cnt');

    if (totEl) totEl.innerText = docCount;
    if (pdfEl) pdfEl.innerText = pdfCount;
    if (docxEl) docxEl.innerText = docxCount;

    // Render list cards
    this.renderFilesList(keywords);
  },

  renderFilesList(keywords) {
    const listContainer = document.getElementById('doc-files-list');
    if (!listContainer) return;

    if (this.loadedDocs.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-dim); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); font-style: italic;">
          No documents imported. Drop files, choose folders, or load samples to begin.
        </div>
      `;
      return;
    }

    listContainer.innerHTML = this.loadedDocs.map((doc, idx) => {
      const ext = doc.name.split('.').pop().toUpperCase();
      let iconColor = 'var(--text-dim)';
      if (ext === 'PDF') iconColor = '#ef4444';
      if (ext === 'DOCX') iconColor = '#3b82f6';
      if (ext === 'CSV') iconColor = '#10b981';

      // Badge style based on matching status
      let badgeHtml = '';
      if (keywords.length > 0) {
        const isMatched = (this.currentMode === 'all' && doc.matchedKeywordsCount === keywords.length) || 
                          (this.currentMode !== 'all' && doc.matchedKeywordsCount > 0);
        const bg = isMatched ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)';
        const textCol = isMatched ? '#10b981' : 'var(--text-dim)';
        const borderCol = isMatched ? '#10b981' : 'var(--border-color)';
        
        badgeHtml = `
          <span style="background: ${bg}; color: ${textCol}; border: 1px solid ${borderCol}; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
            ${doc.matchedKeywordsCount}/${keywords.length} keywords (${doc.matchedPct}%)
          </span>
        `;
      }

      return `
        <div class="url-card" onclick="DocAnalyzerTool.openDetailModal(${idx})" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: var(--transition);">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
            <div style="background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 6px; display: flex; align-items: center; justify-content: center; color: ${iconColor};">
              <span style="font-weight: 800; font-size: 0.68rem; font-family: var(--font-sans);">${ext}</span>
            </div>
            <div style="min-width: 0; flex: 1;">
              <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${doc.name}</div>
              <div style="font-size: 0.68rem; color: var(--text-dim); margin-top: 1px;">${(doc.size/1024).toFixed(1)} KB</div>
            </div>
          </div>
          <div>
            ${badgeHtml}
          </div>
        </div>
      `;
    }).join('');
  },

  openDetailModal(index) {
    this.activeDocIndex = index;
    const doc = this.loadedDocs[index];
    const modal = document.getElementById('doc-detail-modal');
    if (!modal) return;

    modal.style.display = 'flex';

    // Set file stats in modal header
    document.getElementById('doc-modal-filename').innerText = doc.name;
    document.getElementById('doc-modal-filesize').innerText = `${(doc.size/1024).toFixed(1)} KB`;

    // Render tags
    this.renderModalTags();

    // Trigger tab render
    this.renderActiveTabContent();
  },

  renderModalTags() {
    const list = document.getElementById('doc-modal-tags-list');
    if (!list) return;

    if (this.keywords.length === 0) {
      list.innerHTML = '<span style="font-size: 0.7rem; color: var(--text-dim); font-style: italic;">No active search keywords</span>';
      return;
    }

    list.innerHTML = this.keywords.map((kw, idx) => {
      const color = this.chipColors[idx % this.chipColors.length];
      return `
      <span style="background: ${color.bg}; border: 1px solid ${color.border}; color: ${color.text}; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; display: inline-flex; align-items: center; gap: 4px;">
        ${App.escapeHtml(kw)}
        <span onclick="DocAnalyzerTool.removeKeywordByIndex(${idx}); DocAnalyzerTool.renderModalTags(); event.stopPropagation();" style="cursor: pointer; font-weight: 800; font-size: 0.7rem; margin-left: 2px; opacity: 0.6;">×</span>
      </span>`;
    }).join('');
  },

  removeKeyword(idx) {
    this.removeKeywordByIndex(idx);
    this.renderModalTags();
  },

  removeKeywordByIndex(idx) {
    this.keywords.splice(idx, 1);
    this.syncKeywordsToHidden();
    this.renderKeywordChips();
    this.searchDocs();
  },

  addKeywordChip(text) {
    const kw = text.trim();
    if (!kw) return;
    // Avoid duplicates (case-insensitive)
    if (this.keywords.some(k => k.toLowerCase() === kw.toLowerCase())) {
      App.showToast(`"${kw}" is already added`, 'warning');
      return;
    }
    this.keywords.push(kw);
    this.syncKeywordsToHidden();
    this.renderKeywordChips();
    this.searchDocs();
  },

  syncKeywordsToHidden() {
    const hidden = document.getElementById('doc-search-keyword');
    if (hidden) {
      hidden.value = this.keywords.join(', ');
    }
  },

  renderKeywordChips() {
    const container = document.getElementById('doc-keyword-chips-container');
    const input = document.getElementById('doc-keyword-input');
    if (!container || !input) return;

    // Remove existing chips (keep the input)
    const existingChips = container.querySelectorAll('.doc-keyword-chip');
    existingChips.forEach(c => c.remove());

    // Insert chips before the input
    this.keywords.forEach((kw, idx) => {
      const color = this.chipColors[idx % this.chipColors.length];
      const chip = document.createElement('span');
      chip.className = 'doc-keyword-chip';
      chip.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px 4px 12px;
        font-size: 0.78rem; font-weight: 600;
        border-radius: 99px;
        background: ${color.bg};
        border: 1px solid ${color.border};
        color: ${color.text};
        white-space: nowrap;
        animation: chipIn 0.2s ease;
      `;
      chip.innerHTML = `
        ${App.escapeHtml(kw)}
        <span onclick="DocAnalyzerTool.removeKeywordByIndex(${idx}); event.stopPropagation();"
          style="cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%; font-size: 0.72rem; font-weight: 800;
          opacity: 0.5; transition: opacity 0.15s, background 0.15s;"
          onmouseenter="this.style.opacity='1'; this.style.background='${color.border}';"
          onmouseleave="this.style.opacity='0.5'; this.style.background='transparent';"
        >×</span>
      `;
      container.insertBefore(chip, input);
    });

    // Update layout based on chip presence
    if (this.keywords.length > 0) {
      container.style.justifyContent = 'flex-start';
      input.style.textAlign = 'left';
      input.placeholder = 'Add more…';
    } else {
      container.style.justifyContent = 'center';
      input.style.textAlign = 'center';
      input.placeholder = 'Type a keyword…';
    }
  },

  renderActiveTabContent() {
    if (this.activeDocIndex === -1) return;
    const doc = this.loadedDocs[this.activeDocIndex];

    const frame = document.getElementById('doc-modal-preview-frame');
    const textView = document.getElementById('doc-modal-text-view');
    const jsonView = document.getElementById('doc-modal-json-view');

    if (this.activeTab === 'preview') {
      if (frame) {
        // Release previous url to prevent leakage
        if (frame.src) URL.revokeObjectURL(frame.src);

        if (doc.fileObj) {
          frame.src = URL.createObjectURL(doc.fileObj);
        } else {
          // Render HTML page as preview fallback
          const blob = new Blob([doc.content], { type: doc.type || 'text/plain' });
          frame.src = URL.createObjectURL(blob);
        }
      }
    } else if (this.activeTab === 'text') {
      if (textView) textView.value = doc.content;
    } else if (this.activeTab === 'json') {
      if (jsonView) {
        const metadata = {
          name: doc.name,
          sizeBytes: doc.size,
          type: doc.type,
          words: doc.content.split(/\s+/).filter(w => w.length > 0).length,
          chars: doc.content.length,
          matchedKeywordsCount: doc.matchedKeywordsCount,
          matchingPercent: doc.matchedPct
        };
        jsonView.value = JSON.stringify(metadata, null, 2);
      }
    }
  },

  levenshteinDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }
    return dp[a.length][b.length];
  }
};
