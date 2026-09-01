// Text Diff Tool — Side-by-Side Real-Time Diff Editor
const TextDiffTool = {
  activeView: 'split', // 'split', 'left', 'right', 'unified'
  activeFilter: 'all', // 'all', 'diffs', 'matches'
  currentDiffIndex: -1,
  diffLineIndices: [],
  syncScrollEnabled: true,
  isScrolling: false,
  _opsCache: [],
  _leftLinesCache: [],
  _rightLinesCache: [],
  _activeLineIdx: 0,

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadInitialData();
  },

  cacheElements() {
    this.leftEditor = document.getElementById('diff-text-left');
    this.rightEditor = document.getElementById('diff-text-right');
    this.leftGutter = document.getElementById('diff-gutter-left');
    this.rightGutter = document.getElementById('diff-gutter-right');
    this.leftBackdrop = document.getElementById('diff-backdrop-left');
    this.rightBackdrop = document.getElementById('diff-backdrop-right');
    this.unifiedPanel = document.getElementById('diff-unified-panel');
    this.sbsContainer = document.getElementById('diff-sbs-container');

    this.sampleBtn = document.getElementById('diff-sample-btn');
    this.swapBtn = document.getElementById('diff-swap-btn');
    this.clearBtn = document.getElementById('diff-clear-btn');
    this.prevDiffBtn = document.getElementById('diff-prev-btn');
    this.nextDiffBtn = document.getElementById('diff-next-btn');
    this.mergeL2RBtn = document.getElementById('diff-merge-l2r');
    this.mergeR2LBtn = document.getElementById('diff-merge-r2l');

    this.fileInputLeft = document.getElementById('diff-file-input-left');
    this.fileInputRight = document.getElementById('diff-file-input-right');
    this.copyLeft = document.getElementById('diff-copy-left');
    this.copyRight = document.getElementById('diff-copy-right');
    this.downloadLeft = document.getElementById('diff-download-left');
    this.downloadRight = document.getElementById('diff-download-right');
    this.btnFullscreenLeft = document.getElementById('diff-fullscreen-left');
    this.btnFullscreenRight = document.getElementById('diff-fullscreen-right');

    this.statAdd = document.getElementById('diff-stat-add');
    this.statDel = document.getElementById('diff-stat-del');
    this.statMod = document.getElementById('diff-stat-mod');
    this.statEq = document.getElementById('diff-stat-eq');
    this.statMatch = document.getElementById('diff-stat-match');

    this.viewModeBtns = document.querySelectorAll('[data-diff-view]');
    this.filterModeBtns = document.querySelectorAll('[data-diff-filter]');

    this.detailLineNum = document.getElementById('diff-detail-line-num');
    this.detailContentLeft = document.getElementById('diff-detail-content-left');
    this.detailContentRight = document.getElementById('diff-detail-content-right');
  },

  bindEvents() {
    if (!this.leftEditor || !this.rightEditor) return;

    // Debounced input handler (150ms) for high performance typing
    const debouncedCompare = Perf.debounce(() => this.compare(), 150);
    this.leftEditor.addEventListener('input', debouncedCompare);
    this.rightEditor.addEventListener('input', debouncedCompare);

    // Track active line on click/keyup for line detail inspector
    const trackCursor = (textarea, side) => {
      const pos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, pos);
      const lineNum = textBefore.split('\n').length;
      this.updateLineDetail(lineNum - 1, side);
    };

    this.leftEditor.addEventListener('keyup', () => trackCursor(this.leftEditor, 'left'));
    this.leftEditor.addEventListener('click', () => trackCursor(this.leftEditor, 'left'));
    this.rightEditor.addEventListener('keyup', () => trackCursor(this.rightEditor, 'right'));
    this.rightEditor.addEventListener('click', () => trackCursor(this.rightEditor, 'right'));

    // Tab Key Indentation
    const handleKeydown = (e, textarea) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        this.compare();
      }
    };

    this.leftEditor.addEventListener('keydown', (e) => handleKeydown(e, this.leftEditor));
    this.rightEditor.addEventListener('keydown', (e) => handleKeydown(e, this.rightEditor));

    // Fullscreen Toggles (Toggles both Left & Right streams side-by-side)
    if (this.btnFullscreenLeft) {
      this.btnFullscreenLeft.addEventListener('click', () => this.toggleFullscreen());
    }
    if (this.btnFullscreenRight) {
      this.btnFullscreenRight.addEventListener('click', () => this.toggleFullscreen());
    }
    const mainFsBtn = document.getElementById('diff-fullscreen-main-btn');
    if (mainFsBtn) {
      mainFsBtn.addEventListener('click', () => this.toggleFullscreen());
    }


    // Exit fullscreen on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.exitFullscreen();
      }
    });

    // Synchronized scrolling using RAF
    const rafScrollLeft = Perf.throttleRAF(() => this.handleScroll('left'));
    const rafScrollRight = Perf.throttleRAF(() => this.handleScroll('right'));
    this.leftEditor.addEventListener('scroll', rafScrollLeft);
    this.rightEditor.addEventListener('scroll', rafScrollRight);

    // Sample Diff
    if (this.sampleBtn) {
      this.sampleBtn.addEventListener('click', () => {
        this.loadSample();
        if (window.App && App.showToast) App.showToast('Sample diff loaded');
      });
    }

    // Swap Sides
    if (this.swapBtn) {
      this.swapBtn.addEventListener('click', () => {
        const tmp = this.leftEditor.value;
        this.leftEditor.value = this.rightEditor.value;
        this.rightEditor.value = tmp;
        this.compare();
        if (window.App && App.showToast) App.showToast('Swapped Left and Right comparison streams');
      });
    }

    // Clear Both
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.leftEditor.value = '';
        this.rightEditor.value = '';
        this.compare();
        if (window.App && App.showToast) App.showToast('Cleared comparison streams');
      });
    }

    // Merge Operations
    if (this.mergeL2RBtn) {
      this.mergeL2RBtn.addEventListener('click', () => {
        this.rightEditor.value = this.leftEditor.value;
        this.compare();
        if (window.App && App.showToast) App.showToast('Merged Left → Right (Exact Copy)');
      });
    }

    if (this.mergeR2LBtn) {
      this.mergeR2LBtn.addEventListener('click', () => {
        this.leftEditor.value = this.rightEditor.value;
        this.compare();
        if (window.App && App.showToast) App.showToast('Merged Right → Left (Exact Copy)');
      });
    }

    // Difference Navigation
    if (this.prevDiffBtn) {
      this.prevDiffBtn.addEventListener('click', () => this.navigateDiff(-1));
    }
    if (this.nextDiffBtn) {
      this.nextDiffBtn.addEventListener('click', () => this.navigateDiff(1));
    }

    // View Mode Switcher
    this.viewModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-diff-view');
        this.setViewMode(mode);
      });
    });

    // Filter Mode Switcher
    this.filterModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-diff-filter');
        this.setFilterMode(filter);
      });
    });

    // File input handlers
    if (this.fileInputLeft) {
      this.fileInputLeft.addEventListener('change', (e) => this.loadFile(e, 'left'));
    }
    if (this.fileInputRight) {
      this.fileInputRight.addEventListener('change', (e) => this.loadFile(e, 'right'));
    }

    // Copy & Download actions
    if (this.copyLeft) {
      this.copyLeft.addEventListener('click', () => {
        if (window.App && App.copyToClipboard) App.copyToClipboard(this.leftEditor.value);
      });
    }
    if (this.copyRight) {
      this.copyRight.addEventListener('click', () => {
        if (window.App && App.copyToClipboard) App.copyToClipboard(this.rightEditor.value);
      });
    }
    if (this.downloadLeft) {
      this.downloadLeft.addEventListener('click', () => this.triggerDownload(this.leftEditor.value, 'original_left.txt'));
    }
    if (this.downloadRight) {
      this.downloadRight.addEventListener('click', () => this.triggerDownload(this.rightEditor.value, 'modified_right.txt'));
    }
  },

  toggleFullscreen() {
    const sbs = document.getElementById('diff-sbs-container');
    const unified = document.getElementById('diff-card-unified');
    const btnL = document.getElementById('diff-fullscreen-left');
    const btnR = document.getElementById('diff-fullscreen-right');
    const btnMain = document.getElementById('diff-fullscreen-main-btn');

    const targetEl = this.activeView === 'unified' ? unified : sbs;
    if (!targetEl) return;

    const isMax = targetEl.classList.contains('fullscreen-maximized');

    const iconExpand = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
    const iconCompress = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;

    if (isMax) {
      this.exitFullscreen();
    } else {
      targetEl.classList.add('fullscreen-maximized');
      if (btnL) { btnL.innerHTML = iconCompress; btnL.title = 'Exit Fullscreen (Esc)'; }
      if (btnR) { btnR.innerHTML = iconCompress; btnR.title = 'Exit Fullscreen (Esc)'; }
      if (btnMain) { btnMain.innerHTML = `⛶ Exit Fullscreen`; }
      if (window.App && App.showToast) App.showToast('Side-by-Side Comparison Maximized to Full Screen (Press Esc to Exit)');
    }
  },

  exitFullscreen() {
    const sbs = document.getElementById('diff-sbs-container');
    const unified = document.getElementById('diff-card-unified');
    const btnL = document.getElementById('diff-fullscreen-left');
    const btnR = document.getElementById('diff-fullscreen-right');
    const btnMain = document.getElementById('diff-fullscreen-main-btn');

    const iconExpand = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;

    if (sbs) sbs.classList.remove('fullscreen-maximized');
    if (unified) unified.classList.remove('fullscreen-maximized');
    if (btnL) { btnL.innerHTML = iconExpand; btnL.title = 'Fullscreen Both Streams'; }
    if (btnR) { btnR.innerHTML = iconExpand; btnR.title = 'Fullscreen Both Streams'; }
    if (btnMain) { btnMain.innerHTML = `⛶ Fullscreen`; }
  },


  handleScroll(source) {
    if (!this.syncScrollEnabled || this.isScrolling) return;
    this.isScrolling = true;

    if (source === 'left') {
      const top = this.leftEditor.scrollTop;
      const left = this.leftEditor.scrollLeft;
      if (this.leftBackdrop) { this.leftBackdrop.scrollTop = top; this.leftBackdrop.scrollLeft = left; }
      if (this.leftGutter) this.leftGutter.scrollTop = top;

      if (this.rightEditor && this.activeView === 'split') {
        this.rightEditor.scrollTop = top;
        this.rightEditor.scrollLeft = left;
        if (this.rightBackdrop) { this.rightBackdrop.scrollTop = top; this.rightBackdrop.scrollLeft = left; }
        if (this.rightGutter) this.rightGutter.scrollTop = top;
      }
    } else {
      const top = this.rightEditor.scrollTop;
      const left = this.rightEditor.scrollLeft;
      if (this.rightBackdrop) { this.rightBackdrop.scrollTop = top; this.rightBackdrop.scrollLeft = left; }
      if (this.rightGutter) this.rightGutter.scrollTop = top;

      if (this.leftEditor && this.activeView === 'split') {
        this.leftEditor.scrollTop = top;
        this.leftEditor.scrollLeft = left;
        if (this.leftBackdrop) { this.leftBackdrop.scrollTop = top; this.leftBackdrop.scrollLeft = left; }
        if (this.leftGutter) this.leftGutter.scrollTop = top;
      }
    }

    setTimeout(() => { this.isScrolling = false; }, 20);
  },


  setViewMode(mode) {
    this.activeView = mode;
    this.viewModeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-diff-view') === mode);
    });

    const leftCard = document.getElementById('diff-card-left');
    const rightCard = document.getElementById('diff-card-right');
    const unifiedCard = document.getElementById('diff-card-unified');

    if (!this.sbsContainer || !leftCard || !rightCard) return;

    if (mode === 'split') {
      this.sbsContainer.style.display = 'grid';
      leftCard.style.display = 'flex';
      rightCard.style.display = 'flex';
      if (unifiedCard) unifiedCard.style.display = 'none';
    } else if (mode === 'left') {
      this.sbsContainer.style.display = 'grid';
      leftCard.style.display = 'flex';
      rightCard.style.display = 'none';
      if (unifiedCard) unifiedCard.style.display = 'none';
    } else if (mode === 'right') {
      this.sbsContainer.style.display = 'grid';
      leftCard.style.display = 'none';
      rightCard.style.display = 'flex';
      if (unifiedCard) unifiedCard.style.display = 'none';
    } else if (mode === 'unified') {
      this.sbsContainer.style.display = 'none';
      if (unifiedCard) unifiedCard.style.display = 'flex';
    }

    this.compare();
  },

  setFilterMode(filter) {
    this.activeFilter = filter;
    this.filterModeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-diff-filter') === filter);
    });
    this.compare();
  },

  loadInitialData() {
    if (!this.leftEditor || !this.rightEditor) return;
    this.compare();
  },

  loadSample() {
    if (!this.leftEditor || !this.rightEditor) return;
    this.leftEditor.value = `// Live Diff Demo - Stream A
function calculateInvoiceTotal(items, discountRate, taxPercent) {
  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    subtotal += item.price * item.quantity;
  }

  // Apply flat discount
  const discount = subtotal * discountRate;
  const taxableAmount = subtotal - discount;

  // Compute total
  const tax = taxableAmount * (taxPercent / 100);
  const grandTotal = taxableAmount + tax;

  return {
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    tax: tax.toFixed(2),
    total: grandTotal.toFixed(2)
  };
}

module.exports = { calculateInvoiceTotal };`;

    this.rightEditor.value = `// Live Diff Demo - Stream B (Enhanced)
function calculateInvoiceTotal(items = [], discountRate = 0, taxPercent = 0) {
  if (!Array.isArray(items) || items.length === 0) {
    return { subtotal: '0.00', discount: '0.00', tax: '0.00', total: '0.00' };
  }

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Apply tiered promotional discount
  const discount = Math.min(subtotal * discountRate, 500);
  const taxableAmount = Math.max(0, subtotal - discount);

  // Compute final tax & grand total
  const tax = taxableAmount * (taxPercent / 100);
  const grandTotal = taxableAmount + tax;

  return {
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    tax: tax.toFixed(2),
    total: grandTotal.toFixed(2),
    itemCount: items.length
  };
}

module.exports = { calculateInvoiceTotal };`;

    this.compare();
  },

  loadFile(event, side) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (side === 'left' && this.leftEditor) {
        this.leftEditor.value = e.target.result;
      } else if (side === 'right' && this.rightEditor) {
        this.rightEditor.value = e.target.result;
      }
      this.compare();
      if (window.App && App.showToast) App.showToast(`Loaded ${file.name} into ${side} pane`);
    };
    reader.readAsText(file);
  },

  compare() {
    if (!this.leftEditor || !this.rightEditor) return;

    const leftVal = this.leftEditor.value;
    const rightVal = this.rightEditor.value;

    if (!leftVal && !rightVal) {
      if (this.leftGutter) this.leftGutter.innerHTML = '<div class="diff-gutter-row diff-gutter-eq"><span class="diff-line-num">1</span><span class="diff-diff-sign">=</span></div>';
      if (this.rightGutter) this.rightGutter.innerHTML = '<div class="diff-gutter-row diff-gutter-eq"><span class="diff-line-num">1</span><span class="diff-diff-sign">=</span></div>';
      if (this.leftBackdrop) this.leftBackdrop.innerHTML = '<div class="diff-line-row diff-line-eq"></div>';
      if (this.rightBackdrop) this.rightBackdrop.innerHTML = '<div class="diff-line-row diff-line-eq"></div>';
      if (this.unifiedPanel) this.unifiedPanel.innerHTML = '<div class="diff-empty-msg">Type or paste text in Stream A & Stream B, or click "Sample Diff" above.</div>';
      this.updateStats(0, 0, 0, 0);
      this.updateLineDetail(0);
      return;
    }

    const leftLines = leftVal ? leftVal.split('\n') : [];
    const rightLines = rightVal ? rightVal.split('\n') : [];
    this._leftLinesCache = leftLines;
    this._rightLinesCache = rightLines;

    // Show progress bar for large files
    const isLarge = leftLines.length > 500 || rightLines.length > 500;
    if (isLarge) Perf.showProgressBar('diff-stats-bar', 30, true);

    const ops = this.computeOps(leftLines, rightLines);
    this._opsCache = ops;

    // Map line statuses and word diffs directly to individual editor lines
    const leftStatus = new Array(leftLines.length).fill('eq');
    const rightStatus = new Array(rightLines.length).fill('eq');
    const leftWordDiffs = new Array(leftLines.length).fill('');
    const rightWordDiffs = new Array(rightLines.length).fill('');

    this.diffLineIndices = [];
    let addCount = 0, delCount = 0, modCount = 0, eqCount = 0;
    let unifiedHtml = '';

    let lIdx = 0;
    let rIdx = 0;

    ops.forEach((op) => {
      if (op.type === 'eq') {
        eqCount++;
        if (lIdx < leftStatus.length) leftStatus[lIdx] = 'eq';
        if (rIdx < rightStatus.length) rightStatus[rIdx] = 'eq';

        const esc = this.escape(op.text);
        unifiedHtml += `<div class="diff-unified-row diff-unified-eq"><span class="diff-un-num">${lIdx + 1}</span><span class="diff-un-num">${rIdx + 1}</span><span class="diff-un-sign"> </span><code>${esc || '&nbsp;'}</code></div>`;

        lIdx++;
        rIdx++;
      } else if (op.type === 'del') {
        delCount++;
        if (lIdx < leftStatus.length) {
          leftStatus[lIdx] = 'del';
          leftWordDiffs[lIdx] = `<mark class="diff-diff-del-word">${this.escape(op.left)}</mark>`;
        }
        this.diffLineIndices.push(lIdx);

        const esc = this.escape(op.left);
        unifiedHtml += `<div class="diff-unified-row diff-unified-del"><span class="diff-un-num">${lIdx + 1}</span><span class="diff-un-num"></span><span class="diff-un-sign">−</span><code>${esc || '&nbsp;'}</code></div>`;

        lIdx++;
      } else if (op.type === 'add') {
        addCount++;
        if (rIdx < rightStatus.length) {
          rightStatus[rIdx] = 'add';
          rightWordDiffs[rIdx] = `<mark class="diff-diff-add-word">${this.escape(op.right)}</mark>`;
        }
        this.diffLineIndices.push(rIdx);

        const esc = this.escape(op.right);
        unifiedHtml += `<div class="diff-unified-row diff-unified-add"><span class="diff-un-num"></span><span class="diff-un-num">${rIdx + 1}</span><span class="diff-un-sign">+</span><code>${esc || '&nbsp;'}</code></div>`;

        rIdx++;
      } else if (op.type === 'mod') {
        modCount++;
        const wordDiff = this.computeWordDiff(op.left, op.right);

        if (lIdx < leftStatus.length) {
          leftStatus[lIdx] = 'mod';
          leftWordDiffs[lIdx] = wordDiff.left;
        }
        if (rIdx < rightStatus.length) {
          rightStatus[rIdx] = 'mod';
          rightWordDiffs[rIdx] = wordDiff.right;
        }
        this.diffLineIndices.push(lIdx);

        unifiedHtml += `<div class="diff-unified-row diff-unified-del"><span class="diff-un-num">${lIdx + 1}</span><span class="diff-un-num"></span><span class="diff-un-sign">−</span><code>${wordDiff.left || '&nbsp;'}</code></div>`;
        unifiedHtml += `<div class="diff-unified-row diff-unified-add"><span class="diff-un-num"></span><span class="diff-un-num">${rIdx + 1}</span><span class="diff-un-sign">+</span><code>${wordDiff.right || '&nbsp;'}</code></div>`;

        lIdx++;
        rIdx++;
      }
    });

    // 1-to-1 Left Gutter and Backdrop Rows with syntax & character word highlighting
    let leftGutterHtml = '';
    let leftBackdropHtml = '';
    const leftCount = Math.max(1, leftLines.length);
    for (let i = 0; i < leftCount; i++) {
      const status = leftLines.length > 0 ? (leftStatus[i] || 'eq') : 'eq';
      const sign = status === 'del' ? '−' : status === 'mod' ? '~' : '=';
      const content = leftWordDiffs[i] || this.escape(leftLines[i] || '');
      leftGutterHtml += `<div class="diff-gutter-row diff-gutter-${status}"><span class="diff-line-num">${i + 1}</span><span class="diff-diff-sign">${sign}</span></div>`;
      leftBackdropHtml += `<div class="diff-line-row diff-line-${status}"><span class="diff-line-content">${content || '&nbsp;'}</span></div>`;
    }

    // 1-to-1 Right Gutter and Backdrop Rows with syntax & character word highlighting
    let rightGutterHtml = '';
    let rightBackdropHtml = '';
    const rightCount = Math.max(1, rightLines.length);
    for (let j = 0; j < rightCount; j++) {
      const status = rightLines.length > 0 ? (rightStatus[j] || 'eq') : 'eq';
      const sign = status === 'add' ? '+' : status === 'mod' ? '~' : '=';
      const content = rightWordDiffs[j] || this.escape(rightLines[j] || '');
      rightGutterHtml += `<div class="diff-gutter-row diff-gutter-${status}"><span class="diff-line-num">${j + 1}</span><span class="diff-diff-sign">${sign}</span></div>`;
      rightBackdropHtml += `<div class="diff-line-row diff-line-${status}"><span class="diff-line-content">${content || '&nbsp;'}</span></div>`;
    }


    if (this.leftGutter) this.leftGutter.innerHTML = leftGutterHtml;
    if (this.rightGutter) this.rightGutter.innerHTML = rightGutterHtml;
    if (this.leftBackdrop) this.leftBackdrop.innerHTML = leftBackdropHtml;
    if (this.rightBackdrop) this.rightBackdrop.innerHTML = rightBackdropHtml;
    if (this.unifiedPanel) this.unifiedPanel.innerHTML = unifiedHtml || '<div class="diff-empty-msg">No differences found between streams.</div>';

    if (isLarge) Perf.hideProgressBar('diff-stats-bar');

    this.updateStats(addCount, delCount, modCount, eqCount);
    this.updateLineDetail(this._activeLineIdx);
  },

  // Line-by-Line Word Detail Inspector
  updateLineDetail(lineIdx, side = 'left') {
    this._activeLineIdx = lineIdx;
    if (!this.detailLineNum || !this.detailContentLeft || !this.detailContentRight) return;

    const leftLine = (this._leftLinesCache && this._leftLinesCache[lineIdx]) || '';
    const rightLine = (this._rightLinesCache && this._rightLinesCache[lineIdx]) || '';

    this.detailLineNum.textContent = `Inspecting Line ${lineIdx + 1}`;

    if (leftLine === rightLine) {
      const esc = this.escape(leftLine) || '<span style="color:var(--text-dim); font-style:italic;">(empty line)</span>';
      this.detailContentLeft.innerHTML = esc;
      this.detailContentRight.innerHTML = esc;
    } else {
      const wordDiff = this.computeWordDiff(leftLine, rightLine);
      this.detailContentLeft.innerHTML = wordDiff.left || '<span style="color:var(--text-dim); font-style:italic;">(line removed on left)</span>';
      this.detailContentRight.innerHTML = wordDiff.right || '<span style="color:var(--text-dim); font-style:italic;">(line added on right)</span>';
    }
  },

  updateStats(add, del, mod, eq) {
    if (this.statAdd) this.statAdd.textContent = `+ ${add} Added`;
    if (this.statDel) this.statDel.textContent = `− ${del} Removed`;
    if (this.statMod) this.statMod.textContent = `~ ${mod} Modified`;
    if (this.statEq) this.statEq.textContent = `= ${eq} Unchanged`;

    const total = add + del + mod + eq;
    let matchPct = total === 0 ? 100 : Math.round((eq / total) * 100);
    if (this.statMatch) {
      this.statMatch.textContent = `${matchPct}% Match`;
      if (matchPct === 100) {
        this.statMatch.className = 'diff-match-badge diff-match-100';
      } else if (matchPct >= 70) {
        this.statMatch.className = 'diff-match-badge diff-match-high';
      } else {
        this.statMatch.className = 'diff-match-badge diff-match-low';
      }
    }
  },

  navigateDiff(direction) {
    if (this.diffLineIndices.length === 0) {
      if (window.App && App.showToast) App.showToast('No differences found to navigate');
      return;
    }

    this.currentDiffIndex += direction;
    if (this.currentDiffIndex >= this.diffLineIndices.length) {
      this.currentDiffIndex = 0;
    } else if (this.currentDiffIndex < 0) {
      this.currentDiffIndex = this.diffLineIndices.length - 1;
    }

    const targetLineIndex = this.diffLineIndices[this.currentDiffIndex];
    const lineHeight = 22;
    const scrollPos = Math.max(0, (targetLineIndex * lineHeight) - 100);

    if (this.leftEditor) this.leftEditor.scrollTop = scrollPos;
    if (this.rightEditor) this.rightEditor.scrollTop = scrollPos;

    this.updateLineDetail(targetLineIndex);

    if (window.App && App.showToast) {
      App.showToast(`Difference ${this.currentDiffIndex + 1} of ${this.diffLineIndices.length}`);
    }
  },

  computeOps(a, b) {
    const n = a.length, m = b.length;
    if (n === 0 && m === 0) return [];
    if (n === 0) return b.map(line => ({ type: 'add', right: line }));
    if (m === 0) return a.map(line => ({ type: 'del', left: line }));

    // 1. Common Prefix (Top-down natural match)
    let start = 0;
    const prefix = [];
    while (start < n && start < m && a[start] === b[start]) {
      prefix.push({ type: 'eq', text: a[start] });
      start++;
    }

    // 2. Common Suffix (Bottom-up match)
    let endA = n - 1;
    let endB = m - 1;
    const suffix = [];
    while (endA >= start && endB >= start && a[endA] === b[endB]) {
      suffix.push({ type: 'eq', text: a[endA] });
      endA--;
      endB--;
    }
    suffix.reverse();

    // 3. Middle segment LCS
    const midA = a.slice(start, endA + 1);
    const midB = b.slice(start, endB + 1);
    const midN = midA.length;
    const midM = midB.length;

    let middleOps = [];
    if (midN > 0 || midM > 0) {
      if (midN === 0) {
        middleOps = midB.map(line => ({ type: 'add', right: line }));
      } else if (midM === 0) {
        middleOps = midA.map(line => ({ type: 'del', left: line }));
      } else {
        const dp = Array.from({ length: midN + 1 }, () => new Int32Array(midM + 1));
        for (let i = 0; i < midN; i++) {
          for (let j = 0; j < midM; j++) {
            dp[i + 1][j + 1] = midA[i] === midB[j] ? dp[i][j] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
          }
        }

        let i = midN, j = midM;
        const raw = [];
        while (i > 0 || j > 0) {
          if (i > 0 && j > 0 && midA[i - 1] === midB[j - 1]) {
            raw.push({ type: 'eq', text: midA[i - 1] });
            i--; j--;
          } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            raw.push({ type: 'add', right: midB[j - 1] });
            j--;
          } else {
            raw.push({ type: 'del', left: midA[i - 1] });
            i--;
          }
        }
        raw.reverse();
        middleOps = raw;
      }
    }

    const combined = [...prefix, ...middleOps, ...suffix];

    // Group adjacent del + add into mod
    const ops = [];
    let k = 0;
    while (k < combined.length) {
      if (combined[k].type === 'del' && k + 1 < combined.length && combined[k + 1].type === 'add') {
        ops.push({
          type: 'mod',
          left: combined[k].left,
          right: combined[k + 1].right
        });
        k += 2;
      } else {
        ops.push(combined[k]);
        k++;
      }
    }
    return ops;
  },

  computeWordDiff(oldStr, newStr) {
    const esc = (s) => this.escape(s);
    if (!oldStr && !newStr) return { left: '', right: '' };
    if (!oldStr) return { left: '', right: `<mark class="diff-diff-add-word">${esc(newStr)}</mark>` };
    if (!newStr) return { left: `<mark class="diff-diff-del-word">${esc(oldStr)}</mark>`, right: '' };

    const tokenize = (str) => str.match(/(\s+|[a-zA-Z0-9_]+|[^\s\w])/g) || [];
    const oldTokens = tokenize(oldStr);
    const newTokens = tokenize(newStr);

    const n = oldTokens.length, m = newTokens.length;

    // Common Prefix
    let start = 0;
    const prefix = [];
    while (start < n && start < m && oldTokens[start] === newTokens[start]) {
      prefix.push({ type: 'eq', text: oldTokens[start] });
      start++;
    }

    // Common Suffix
    let endA = n - 1;
    let endB = m - 1;
    const suffix = [];
    while (endA >= start && endB >= start && oldTokens[endA] === newTokens[endB]) {
      suffix.push({ type: 'eq', text: oldTokens[endA] });
      endA--;
      endB--;
    }
    suffix.reverse();

    const midA = oldTokens.slice(start, endA + 1);
    const midB = newTokens.slice(start, endB + 1);
    const midN = midA.length;
    const midM = midB.length;

    let middleDiffs = [];
    if (midN > 0 || midM > 0) {
      if (midN === 0) {
        middleDiffs = midB.map(t => ({ type: 'add', text: t }));
      } else if (midM === 0) {
        middleDiffs = midA.map(t => ({ type: 'del', text: t }));
      } else {
        const dp = Array.from({ length: midN + 1 }, () => new Int32Array(midM + 1));
        for (let i = 0; i < midN; i++) {
          for (let j = 0; j < midM; j++) {
            dp[i + 1][j + 1] = midA[i] === midB[j] ? dp[i][j] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
          }
        }

        let i = midN, j = midM;
        const raw = [];
        while (i > 0 || j > 0) {
          if (i > 0 && j > 0 && midA[i - 1] === midB[j - 1]) {
            raw.push({ type: 'eq', text: midA[i - 1] });
            i--; j--;
          } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            raw.push({ type: 'add', text: midB[j - 1] });
            j--;
          } else {
            raw.push({ type: 'del', text: midA[i - 1] });
            i--;
          }
        }
        raw.reverse();
        middleDiffs = raw;
      }
    }

    const diffs = [...prefix, ...middleDiffs, ...suffix];

    let leftHtml = '';
    let rightHtml = '';

    diffs.forEach(d => {
      if (d.type === 'eq') {
        leftHtml += esc(d.text);
        rightHtml += esc(d.text);
      } else if (d.type === 'del') {
        leftHtml += `<mark class="diff-diff-del-word" style="background: rgba(239, 68, 68, 0.25); color: #ef4444; font-weight: 700; border-radius: 2px; padding: 1px 2px;">${esc(d.text)}</mark>`;
      } else if (d.type === 'add') {
        rightHtml += `<mark class="diff-diff-add-word" style="background: rgba(16, 185, 129, 0.25); color: #10b981; font-weight: 700; border-radius: 2px; padding: 1px 2px;">${esc(d.text)}</mark>`;
      }
    });

    return { left: leftHtml, right: rightHtml };
  },

  escape(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  triggerDownload(text, filename) {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
};

window.TextDiffTool = TextDiffTool;


