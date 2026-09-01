// Regex Tester & Debugger Tool
const RegexTool = {
  patternsMap: {
    email: {
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      flags: 'gmi',
      sample: `Contact our engineering team:
- lead.architect@devutility.internal
- support@google.com
- info+newsletter@company.co.uk
- invalid-email-address@com
- john.doe_123@subdomain.example.org`
    },
    url: {
      pattern: 'https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)',
      flags: 'gmi',
      sample: `Check out our public portals:
- https://devutility.local/docs
- http://subdomain.example.org/api/v1/user?id=102
- https://github.com/google/antigravity`
    },
    ipv4: {
      pattern: '\\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\b',
      flags: 'g',
      sample: `Server gateway IP configuration logs:
Primary DNS: 192.168.1.1
Secondary DNS: 10.0.0.254
Loopback: 127.0.0.1
Public IP: 172.217.14.206
Invalid IP: 999.1.1.1`
    },
    hex: {
      pattern: '#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\\b',
      flags: 'gi',
      sample: `CSS Color Tokens:
primary: #7c3aed;
accent: #10b981;
dark: #000;
white: #ffffff;
muted: #6b7280;`
    },
    integer: {
      pattern: '^-?\\d+$',
      flags: 'gm',
      sample: `142
-99
0
3.1415
+420
10000`
    },
    whitespace: {
      pattern: '\\s+',
      flags: 'g',
      sample: `Multiple     spaces    between     words.
Line breaks 
and tabs\t\tare here.`
    },
    uuid: {
      pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
      flags: 'gi',
      sample: `Generated system transaction tokens:
- 123e4567-e89b-12d3-a456-426614174000
- 9b1deb4d-3b7d-4bad-9bd3-2ca800637481
- invalid-uuid-12345`
    }
  },

  init() {
    const pattern = document.getElementById('regex-pattern');
    const flags = document.getElementById('regex-flags');
    const sample = document.getElementById('regex-sample-text');
    const clearBtn = document.getElementById('regex-clear-btn');
    const fileInput = document.getElementById('regex-file-input');
    const copySampleBtn = document.getElementById('regex-copy-sample-btn');

    if (!pattern) return;

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        pattern.value = '';
        sample.value = '';
        this.test();
        App.showToast('Cleared Regex pattern & test text');
      });
    }

    if (copySampleBtn) {
      copySampleBtn.addEventListener('click', () => {
        App.copyToClipboard(sample.value, copySampleBtn);
      });
    }

    // Load file
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          sample.value = evt.target.result;
          this.test();
          App.showToast(`Loaded ${file.name}`);
        };
        reader.readAsText(file);
      });
    }

    // Flag toggle buttons listener
    const flagsGroup = document.getElementById('regex-flags-group');
    if (flagsGroup) {
      flagsGroup.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const flag = btn.dataset.flag;
          let currentFlags = flags.value.split('');
          if (currentFlags.includes(flag)) {
            currentFlags = currentFlags.filter(f => f !== flag);
            btn.classList.remove('active', 'log-info');
          } else {
            currentFlags.push(flag);
            btn.classList.add('active', 'log-info');
          }
          flags.value = currentFlags.join('');
          this.test();
        });
      });
    }

    // Preset pattern buttons listener
    const presetsGroup = document.getElementById('regex-presets-group');
    if (presetsGroup) {
      presetsGroup.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.pattern;
          this.applyPreset(key);
        });
      });
    }

    // Debounced test handler (150ms)
    const debouncedTest = Perf.debounce(() => this.test(), 150);
    pattern.addEventListener('input', debouncedTest);
    flags.addEventListener('input', () => {
      this.syncFlagButtons();
      debouncedTest();
    });
    sample.addEventListener('input', debouncedTest);

    // Start empty
    this.test();
  },

  applyPreset(key) {
    const item = this.patternsMap[key];
    if (!item) return;

    const pattern = document.getElementById('regex-pattern');
    const flags = document.getElementById('regex-flags');
    const sample = document.getElementById('regex-sample-text');

    if (pattern) pattern.value = item.pattern;
    if (flags) flags.value = item.flags;
    if (sample) sample.value = item.sample;

    this.syncFlagButtons();
    this.test();
  },

  syncFlagButtons() {
    const flags = document.getElementById('regex-flags');
    if (!flags) return;
    const currentFlags = flags.value;

    const flagsGroup = document.getElementById('regex-flags-group');
    if (flagsGroup) {
      flagsGroup.querySelectorAll('button').forEach(btn => {
        const flag = btn.dataset.flag;
        const isActive = currentFlags.includes(flag);
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('log-info', isActive);
      });
    }
  },

  test() {
    const patStr = document.getElementById('regex-pattern').value;
    const flagStr = document.getElementById('regex-flags').value;
    const text = document.getElementById('regex-sample-text').value;
    const countEl = document.getElementById('regex-match-count');
    const outView = document.getElementById('regex-highlight-output');
    const groupsList = document.getElementById('regex-groups-list');

    if (!patStr || !text) {
      if (countEl) countEl.innerText = '0';
      if (outView) outView.innerHTML = '<span style="color: var(--text-dim); font-style: italic;">Nothing to match yet</span>';
      if (groupsList) groupsList.innerHTML = '<div style="font-size: 0.74rem; color: var(--text-dim); font-style: italic;">No matches</div>';
      return;
    }

    try {
      const regex = new RegExp(patStr, flagStr);
      let matchCount = 0;
      let matchesList = [];

      let highlighted = '';
      let lastIdx = 0;

      if (flagStr.includes('g')) {
        let match;
        while ((match = regex.exec(text)) !== null) {
          matchCount++;
          highlighted += App.escapeHtml(text.slice(lastIdx, match.index));
          highlighted += `<mark style="background: rgba(124, 58, 237, 0.25); color: var(--c-purple); border-radius: 3px; padding: 1px 4px; font-weight: 700; border: 1px solid rgba(124, 58, 237, 0.4);">${App.escapeHtml(match[0])}</mark>`;
          lastIdx = regex.lastIndex;

          matchesList.push({
            fullMatch: match[0],
            index: match.index,
            groups: match.slice(1)
          });

          if (match[0].length === 0) {
            regex.lastIndex++;
            if (regex.lastIndex > text.length) break;
          }
        }
        highlighted += App.escapeHtml(text.slice(lastIdx));
      } else {
        const match = regex.exec(text);
        if (match) {
          matchCount = 1;
          highlighted = App.escapeHtml(text.slice(0, match.index)) +
            `<mark style="background: rgba(124, 58, 237, 0.25); color: var(--c-purple); border-radius: 3px; padding: 1px 4px; font-weight: 700; border: 1px solid rgba(124, 58, 237, 0.4);">${App.escapeHtml(match[0])}</mark>` +
            App.escapeHtml(text.slice(match.index + match[0].length));

          matchesList.push({
            fullMatch: match[0],
            index: match.index,
            groups: match.slice(1)
          });
        } else {
          highlighted = App.escapeHtml(text);
        }
      }

      if (countEl) countEl.innerText = matchCount;
      if (outView) outView.innerHTML = highlighted || '<span style="color: var(--text-dim); font-style: italic;">Nothing to match yet</span>';

      if (matchesList.length === 0) {
        if (groupsList) groupsList.innerHTML = '<div style="font-size: 0.74rem; color: var(--text-dim); font-style: italic;">No matches</div>';
      } else {
        let html = '';
        matchesList.slice(0, 15).forEach((m, i) => {
          let groupsMarkup = '';
          if (m.groups.length > 0) {
            groupsMarkup = m.groups.map((g, idx) => `
              <span style="font-size: 0.7rem; color: var(--text-muted); background: var(--bg-card); padding: 1px 5px; border-radius: 4px; border: 1px solid var(--border-color);">
                Group ${idx+1}: <code style="color: var(--c-purple); font-weight: 700;">"${App.escapeHtml(g || '')}"</code>
              </span>
            `).join(' ');
          }

          html += `
            <div style="padding: 6px 10px; background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.76rem; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 700; color: var(--text-main);">Match #${i + 1} <span style="font-weight: 400; font-size: 0.68rem; color: var(--text-dim);">(index: ${m.index})</span></span>
                <code style="color: var(--c-purple); font-weight: 700; background: rgba(124, 58, 237, 0.08); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);">${App.escapeHtml(m.fullMatch)}</code>
              </div>
              ${groupsMarkup ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">${groupsMarkup}</div>` : ''}
            </div>
          `;
        });

        if (matchesList.length > 15) {
          html += `<div style="font-size: 0.7rem; color: var(--text-dim); text-align: center; font-style: italic;">Showing first 15 of ${matchesList.length} total matches</div>`;
        }

        if (groupsList) groupsList.innerHTML = html;
      }
    } catch (err) {
      if (countEl) countEl.innerText = 'Err';
      if (outView) outView.innerHTML = `<span style="color: var(--c-red);">Invalid Regex: ${App.escapeHtml(err.message)}</span>`;
      if (groupsList) groupsList.innerHTML = '<div style="font-size: 0.74rem; color: var(--c-red);">Check regular expression syntax</div>';
    }
  }
};
