// Text Diff Tool — Beyond Compare Style Side-by-Side Real-Time Diff
const TextDiffTool = {
  init() {
    const leftTextarea = document.getElementById('diff-text-left');
    const rightTextarea = document.getElementById('diff-text-right');
    
    const fileInputLeft = document.getElementById('diff-file-input-left');
    const fileInputRight = document.getElementById('diff-file-input-right');

    const copyLeft = document.getElementById('diff-copy-left');
    const copyRight = document.getElementById('diff-copy-right');
    const downloadLeft = document.getElementById('diff-download-left');
    const downloadRight = document.getElementById('diff-download-right');

    const sampleBtn = document.getElementById('diff-sample-btn');
    const swapBtn = document.getElementById('diff-swap-btn');
    const clearBtn = document.getElementById('diff-clear-btn');

    const btnFullscreenLeft = document.getElementById('diff-fullscreen-left');
    const btnFullscreenRight = document.getElementById('diff-fullscreen-right');

    if (!leftTextarea || !rightTextarea) return;

    // Start empty
    this.updateLineNumbers('left');
    this.updateLineNumbers('right');

    // Input events
    leftTextarea.addEventListener('input', () => {
      this.updateLineNumbers('left');
      this.compare();
    });
    rightTextarea.addEventListener('input', () => {
      this.updateLineNumbers('right');
      this.compare();
    });

    // Sample, Swap & Clear
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        this.loadSample();
        App.showToast('Sample comparison loaded');
      });
    }

    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        const tmp = leftTextarea.value;
        leftTextarea.value = rightTextarea.value;
        rightTextarea.value = tmp;
        
        this.updateLineNumbers('left');
        this.updateLineNumbers('right');
        this.compare();
        App.showToast('Swapped left and right text streams');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        leftTextarea.value = '';
        rightTextarea.value = '';
        this.updateLineNumbers('left');
        this.updateLineNumbers('right');
        this.compare();
        App.showToast('Cleared comparison streams');
      });
    }

    // Fullscreen Toggles
    if (btnFullscreenLeft) {
      btnFullscreenLeft.addEventListener('click', () => this.toggleFullscreen('left'));
    }
    if (btnFullscreenRight) {
      btnFullscreenRight.addEventListener('click', () => this.toggleFullscreen('right'));
    }

    // Left File Loader
    if (fileInputLeft) {
      fileInputLeft.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          leftTextarea.value = evt.target.result;
          this.updateLineNumbers('left');
          this.compare();
          App.showToast(`Loaded ${file.name} (left)`);
        };
        reader.readAsText(file);
      });
    }

    // Right File Loader
    if (fileInputRight) {
      fileInputRight.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          rightTextarea.value = evt.target.result;
          this.updateLineNumbers('right');
          this.compare();
          App.showToast(`Loaded ${file.name} (right)`);
        };
        reader.readAsText(file);
      });
    }

    // Left Copy & Download
    if (copyLeft) {
      copyLeft.addEventListener('click', () => App.copyToClipboard(leftTextarea.value));
    }
    if (downloadLeft) {
      downloadLeft.addEventListener('click', () => this.triggerDownload(leftTextarea.value, 'original_diff.txt'));
    }

    // Right Copy & Download
    if (copyRight) {
      copyRight.addEventListener('click', () => App.copyToClipboard(rightTextarea.value));
    }
    if (downloadRight) {
      downloadRight.addEventListener('click', () => this.triggerDownload(rightTextarea.value, 'modified_diff.txt'));
    }

    // Synchronized scroll between output panels
    const panelL = document.getElementById('diff-panel-left');
    const panelR = document.getElementById('diff-panel-right');
    if (panelL && panelR) {
      panelL.addEventListener('scroll', () => { panelR.scrollTop = panelL.scrollTop; });
      panelR.addEventListener('scroll', () => { panelL.scrollTop = panelL.scrollTop; });
    }

    this.updateLineNumbers('left');
    this.updateLineNumbers('right');
    this.compare();
  },

  toggleFullscreen(side) {
    const container = document.getElementById('diff-sbs-container');
    const leftCard = document.getElementById('diff-card-left');
    const rightCard = document.getElementById('diff-card-right');
    const btnLeft = document.getElementById('diff-fullscreen-left');
    const btnRight = document.getElementById('diff-fullscreen-right');
    if (!container || !leftCard || !rightCard) return;

    const isLeftFull = leftCard.classList.contains('fullscreen-active');
    const isRightFull = rightCard.classList.contains('fullscreen-active');

    const iconNormal = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
    const iconActive = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

    if (side === 'left') {
      if (isLeftFull) {
        container.style.gridTemplateColumns = '1fr 1fr';
        rightCard.style.display = 'flex';
        leftCard.classList.remove('fullscreen-active');
        if (btnLeft) {
          btnLeft.innerHTML = iconNormal;
          btnLeft.title = "Fullscreen Left";
        }
      } else {
        container.style.gridTemplateColumns = '1fr';
        rightCard.style.display = 'none';
        leftCard.classList.add('fullscreen-active');
        if (btnLeft) {
          btnLeft.innerHTML = iconActive;
          btnLeft.title = "Exit Fullscreen";
        }
      }
    } else if (side === 'right') {
      if (isRightFull) {
        container.style.gridTemplateColumns = '1fr 1fr';
        leftCard.style.display = 'flex';
        rightCard.classList.remove('fullscreen-active');
        if (btnRight) {
          btnRight.innerHTML = iconNormal;
          btnRight.title = "Fullscreen Right";
        }
      } else {
        container.style.gridTemplateColumns = '1fr';
        leftCard.style.display = 'none';
        rightCard.classList.add('fullscreen-active');
        if (btnRight) {
          btnRight.innerHTML = iconActive;
          btnRight.title = "Exit Fullscreen";
        }
      }
    }
  },

  updateLineNumbers(side) {
    const textarea = document.getElementById(`diff-text-${side}`);
    const numbersEl = document.getElementById(`diff-line-numbers-${side}`);
    if (!textarea || !numbersEl) return;

    const lines = textarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) {
      html += `${i}<br>`;
    }
    numbersEl.innerHTML = html;
  },

  loadSample() {
    const leftTextarea = document.getElementById('diff-text-left');
    const rightTextarea = document.getElementById('diff-text-right');
    if (!leftTextarea || !rightTextarea) return;

    leftTextarea.value = `// Authentication Handler v1.0
function handleLogin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send("Missing credentials");
  }
  const user = db.findUser(username);
  if (user && user.password === password) {
    const token = generateToken(user);
    return res.json({ token });
  }
  return res.status(401).send("Invalid credentials");
}

module.exports = { handleLogin };`;

    rightTextarea.value = `// Authentication Handler v2.0 — Security Hardened
async function handleLogin(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }
  const user = await db.findUser(username);
  const isValid = await bcrypt.compare(password, user.hash);
  if (user && isValid) {
    const token = await generateToken(user, { expiresIn: '2h' });
    return res.json({ token, role: user.role });
  }
  logger.warn('Failed login attempt', { username, ip: req.ip });
  return res.status(401).json({ error: "Invalid credentials" });
}

module.exports = { handleLogin };`;

    this.updateLineNumbers('left');
    this.updateLineNumbers('right');
    this.compare();
  },

  compare() {
    const leftTextarea = document.getElementById('diff-text-left');
    const rightTextarea = document.getElementById('diff-text-right');
    const panelL = document.getElementById('diff-panel-left');
    const panelR = document.getElementById('diff-panel-right');
    if (!leftTextarea || !rightTextarea || !panelL || !panelR) return;

    const leftVal = leftTextarea.value;
    const rightVal = rightTextarea.value;

    const leftLines = leftVal.split('\n');
    const rightLines = rightVal.split('\n');

    if (!leftVal && !rightVal) {
      panelL.innerHTML = '<div class="diff-empty">Paste or type original text above</div>';
      panelR.innerHTML = '<div class="diff-empty">Paste or type modified text above</div>';
      this.updateStats(0, 0, 0, 0);
      return;
    }

    // LCS-based diff
    const ops = this.computeOps(leftLines, rightLines);

    let htmlL = '';
    let htmlR = '';
    let addCount = 0, delCount = 0, modCount = 0, eqCount = 0;

    ops.forEach(op => {
      if (op.type === 'eq') {
        eqCount++;
        htmlL += this.renderLine(op.leftNum, op.left, 'eq');
        htmlR += this.renderLine(op.rightNum, op.right, 'eq');
      } else if (op.type === 'del') {
        delCount++;
        htmlL += this.renderLine(op.leftNum, op.left, 'del');
        htmlR += this.renderLine('', '', 'del-empty');
      } else if (op.type === 'add') {
        addCount++;
        htmlL += this.renderLine('', '', 'add-empty');
        htmlR += this.renderLine(op.rightNum, op.right, 'add');
      } else if (op.type === 'mod') {
        modCount++;
        htmlL += this.renderLine(op.leftNum, op.left, 'mod-old', op.charDiffLeft);
        htmlR += this.renderLine(op.rightNum, op.right, 'mod-new', op.charDiffRight);
      }
    });

    panelL.innerHTML = htmlL;
    panelR.innerHTML = htmlR;
    this.updateStats(addCount, delCount, modCount, eqCount);
  },

  renderLine(num, text, type, charHighlights) {
    const esc = App.escapeHtml(text || '');
    let content = charHighlights || esc;
    const cls = 'diff-row diff-' + type;
    const sign = type === 'del' ? '−' : type === 'add' ? '+' : type === 'mod-old' ? '~' : type === 'mod-new' ? '~' : ' ';
    const signCls = type.startsWith('mod') ? 'diff-sign-mod' : 'diff-sign-' + type.split('-')[0];
    return `<div class="${cls}"><span class="diff-num">${num}</span><span class="diff-sgn ${signCls}">${sign}</span><code class="diff-code">${content}</code></div>`;
  },

  updateStats(add, del, mod, eq) {
    const sa = document.getElementById('diff-stat-add');
    const sd = document.getElementById('diff-stat-del');
    const sm = document.getElementById('diff-stat-mod');
    const se = document.getElementById('diff-stat-eq');
    if (sa) sa.textContent = `+ ${add} Added`;
    if (sd) sd.textContent = `− ${del} Removed`;
    if (sm) sm.textContent = `~ ${mod} Modified`;
    if (se) se.textContent = `= ${eq} Unchanged`;
  },

  computeOps(a, b) {
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        dp[i+1][j+1] = a[i] === b[j] ? dp[i][j] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
      }
    }

    // Backtrack LCS
    let i = n, j = m;
    const raw = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
        raw.push({ type: 'eq', left: a[i-1], right: b[j-1], leftNum: i, rightNum: j });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        raw.push({ type: 'add', right: b[j-1], rightNum: j });
        j--;
      } else {
        raw.push({ type: 'del', left: a[i-1], leftNum: i });
        i--;
      }
    }
    raw.reverse();

    // Merge adjacent del+add into 'mod' (modified) lines for side-by-side view
    const ops = [];
    let k = 0;
    while (k < raw.length) {
      if (raw[k].type === 'del' && k + 1 < raw.length && raw[k+1].type === 'add') {
        const oldLine = raw[k].left;
        const newLine = raw[k+1].right;
        const charDiff = this.charDiff(oldLine, newLine);
        ops.push({
          type: 'mod',
          left: oldLine,
          right: newLine,
          leftNum: raw[k].leftNum,
          rightNum: raw[k+1].rightNum,
          charDiffLeft: charDiff.left,
          charDiffRight: charDiff.right
        });
        k += 2;
      } else {
        ops.push(raw[k]);
        k++;
      }
    }
    return ops;
  },

  charDiff(oldStr, newStr) {
    const oldChars = oldStr.split('');
    const newChars = newStr.split('');
    const n = oldChars.length, m = newChars.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++)
        dp[i+1][j+1] = oldChars[i] === newChars[j] ? dp[i][j] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);

    let i = n, j = m;
    const seq = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldChars[i-1] === newChars[j-1]) {
        seq.push({ type: 'eq', oldC: oldChars[i-1], newC: newChars[j-1] }); i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        seq.push({ type: 'add', newC: newChars[j-1] }); j--;
      } else {
        seq.push({ type: 'del', oldC: oldChars[i-1] }); i--;
      }
    }
    seq.reverse();

    let leftHtml = '', rightHtml = '';
    seq.forEach(s => {
      if (s.type === 'eq') {
        leftHtml += App.escapeHtml(s.oldC);
        rightHtml += App.escapeHtml(s.newC);
      } else if (s.type === 'del') {
        leftHtml += '<mark class="diff-char-del">' + App.escapeHtml(s.oldC) + '</mark>';
      } else if (s.type === 'add') {
        rightHtml += '<mark class="diff-char-add">' + App.escapeHtml(s.newC) + '</mark>';
      }
    });
    return { left: leftHtml, right: rightHtml };
  },

  triggerDownload(text, filename) {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
};

window.TextDiffTool = TextDiffTool;
