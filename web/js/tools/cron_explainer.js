// Cron Explainer & Predictor Tool
const CronTool = {
  history: [],

  init() {
    const input = document.getElementById('cron-input');
    if (!input) return;

    input.addEventListener('input', Perf.debounce(() => {
      this.explain();
    }, 150));

    // Start clean with no history auto-load
    this.history = [];
    this.explain();
  },

  loadPreset(expr) {
    const input = document.getElementById('cron-input');
    if (input) {
      input.value = expr;
      this.explain();
      this.saveToHistory(expr);
    }
  },

  clearInput() {
    const input = document.getElementById('cron-input');
    if (input) {
      input.value = '';
      this.explain();
    }
  },

  saveToHistoryDelayed() {
    if (this.historyTimeout) clearTimeout(this.historyTimeout);
    this.historyTimeout = setTimeout(() => {
      const input = document.getElementById('cron-input');
      if (input && input.value.trim()) {
        this.saveToHistory(input.value.trim());
      }
    }, 1500);
  },

  saveToHistory(expr) {
    if (!expr || expr === '* * * * *') return;
    this.history = this.history.filter(h => h !== expr);
    this.history.unshift(expr);
    if (this.history.length > 5) this.history.pop();
    
    try {
      localStorage.setItem('devutility_cron_history', JSON.stringify(this.history));
    } catch (e) {
      console.error(e);
    }
    
    this.renderHistory();
  },

  clearHistory() {
    this.history = [];
    try {
      localStorage.removeItem('devutility_cron_history');
    } catch (e) {
      console.error(e);
    }
    this.renderHistory();
    App.showToast('Cron history cleared');
  },

  renderHistory() {
    const container = document.getElementById('cron-history-list');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = `<div style="font-size: 0.68rem; color: var(--text-dim); text-align: center; padding: 6px; font-style: italic;">No history yet</div>`;
      return;
    }

    container.innerHTML = this.history.map(h => `
      <button class="log-filter-btn" style="text-align: left; padding: 6px 10px; font-family: var(--font-mono); font-size: 0.72rem; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onclick="CronTool.loadPreset('${h}')" title="${h}">
        ${h}
      </button>
    `).join('');
  },

  explain() {
    const input = document.getElementById('cron-input');
    const descEl = document.getElementById('cron-human-output');
    const datesContainer = document.getElementById('cron-dates-container');
    if (!input || !descEl || !datesContainer) return;

    const expr = input.value.trim();
    this.highlightActivePreset(expr);

    if (!expr) {
      descEl.innerText = 'Enter a valid cron expression';
      datesContainer.innerHTML = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; font-style: italic;">Provide an expression to calculate trigger runs</div>`;
      return;
    }

    const parts = expr.split(/\s+/);
    if (parts.length < 5) {
      descEl.innerText = 'Invalid format: Must have 5 fields (minute hour day-of-month month day-of-week)';
      datesContainer.innerHTML = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; font-style: italic;">Invalid format (requires minute, hour, day-of-month, month, day-of-week)</div>`;
      return;
    }

    // Explain
    const humanDesc = this.explainCron(expr);
    descEl.innerText = humanDesc;

    // Calculate runs
    const nextRuns = this.getNextRuns(expr, 5);
    if (nextRuns.length === 0) {
      datesContainer.innerHTML = `<div style="font-size: 0.76rem; color: var(--text-dim); text-align: center; padding: 1.5rem; font-style: italic;">Could not calculate trigger runs (check bounds)</div>`;
      return;
    }

    this.lastCalculatedRuns = nextRuns;

    datesContainer.innerHTML = nextRuns.map((date, idx) => {
      const dateStr = date.toString();
      return `
        <div style="background: var(--bg-pane); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-main);">${dateStr}</span>
          <button class="url-action-icon-btn" onclick="CronTool.copyRunDate('${dateStr}', this)" title="Copy run date">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      `;
    }).join('');

    this.renderHistory();
  },

  highlightActivePreset(expr) {
    document.querySelectorAll('#view-cron-explainer .log-filter-btn').forEach(btn => {
      // Find buttons containing loadPreset or loading preset
      const onclickAttr = btn.getAttribute('onclick') || '';
      if (onclickAttr.includes(`loadPreset('${expr}')`)) {
        btn.classList.add('active', 'log-info');
      } else {
        btn.classList.remove('active', 'log-info');
      }
    });
  },

  explainCron(expr) {
    const parts = expr.trim().split(/\s+/);
    const [min, hour, dom, mon, dow] = parts;

    const explainField = (val, type) => {
      if (val === '*') {
        if (type === 'minute') return 'every minute';
        if (type === 'hour') return 'every hour';
        if (type === 'dom') return 'every day of the month';
        if (type === 'mon') return 'every month';
        if (type === 'dow') return 'every weekday';
      }

      const formatVal = (v) => {
        if (type === 'dow') {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          return days[parseInt(v, 10)] || v;
        }
        if (type === 'mon') {
          const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          return months[parseInt(v, 10)] || v;
        }
        return v;
      };

      if (val.startsWith('*/')) {
        const step = val.slice(2);
        return `every ${step} ${type === 'minute' ? 'minutes' : (type === 'hour' ? 'hours' : type + 's')}`;
      }

      if (val.includes('-')) {
        const [start, end] = val.split('-');
        return `between ${formatVal(start)} and ${formatVal(end)}`;
      }

      if (val.includes(',')) {
        return `at ${val.split(',').map(formatVal).join(', ')}`;
      }

      if (type === 'minute') return `at minute ${val}`;
      if (type === 'hour') return `at ${val.padStart(2, '0')}:00`;
      if (type === 'dom') return `on day ${val}`;
      if (type === 'mon') return `in ${formatVal(val)}`;
      if (type === 'dow') return `on ${formatVal(val)}`;
      return val;
    };

    return `${explainField(min, 'minute')}, ${explainField(hour, 'hour')}, ${explainField(dom, 'dom')}, ${explainField(mon, 'mon')}, ${explainField(dow, 'dow')}`;
  },

  getNextRuns(expr, count = 5) {
    const dates = [];
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) return dates;

    const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;

    const matchesField = (val, expr, minVal, maxVal) => {
      if (expr === '*') return true;
      const partsList = expr.split(',');
      if (partsList.length > 1) {
        return partsList.some(p => matchesField(val, p, minVal, maxVal));
      }
      let step = 1;
      let baseExpr = expr;
      if (expr.includes('/')) {
        const slashParts = expr.split('/');
        step = parseInt(slashParts[1], 10);
        baseExpr = slashParts[0];
      }
      let rangeStart = minVal;
      let rangeEnd = maxVal;
      if (baseExpr === '*') {
        // Range stays full
      } else if (baseExpr.includes('-')) {
        const hyphenParts = baseExpr.split('-');
        rangeStart = parseInt(hyphenParts[0], 10);
        rangeEnd = parseInt(hyphenParts[1], 10);
      } else {
        const exactVal = parseInt(baseExpr, 10);
        if (!isNaN(exactVal)) return exactVal === val;
        return false;
      }
      if (val < rangeStart || val > rangeEnd) return false;
      return (val - rangeStart) % step === 0;
    };

    let current = new Date();
    current.setSeconds(0);
    current.setMilliseconds(0);
    current.setMinutes(current.getMinutes() + 1);

    let limit = 0;
    while (dates.length < count && limit < 100000) {
      limit++;
      const min = current.getMinutes();
      const hr = current.getHours();
      const dom = current.getDate();
      const mon = current.getMonth() + 1;
      const dow = current.getDay();

      if (
        matchesField(min, minExpr, 0, 59) &&
        matchesField(hr, hourExpr, 0, 23) &&
        matchesField(dom, domExpr, 1, 31) &&
        matchesField(mon, monExpr, 1, 12) &&
        matchesField(dow, dowExpr, 0, 6)
      ) {
        dates.push(new Date(current.getTime()));
      }
      current.setMinutes(current.getMinutes() + 1);
    }
    return dates;
  },

  copyExpression() {
    const input = document.getElementById('cron-input');
    if (input && input.value) {
      navigator.clipboard.writeText(input.value);
      if (navigator.vibrate) navigator.vibrate(15);
      App.showToast('Copied cron expression');
    }
  },

  copyRunDate(dateStr, btn) {
    navigator.clipboard.writeText(dateStr);
    if (navigator.vibrate) navigator.vibrate(15);
    
    // Haptic visual feedback tick
    const svg = btn.innerHTML;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    setTimeout(() => {
      btn.innerHTML = svg;
    }, 1000);
    
    App.showToast('Copied run date to clipboard');
  },

  downloadRuns() {
    if (!this.lastCalculatedRuns || this.lastCalculatedRuns.length === 0) return;
    const content = this.lastCalculatedRuns.map((d, i) => `${i + 1}. ${d.toString()}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cron_runs.txt`;
    a.click();
    App.showToast('Downloaded predicted trigger runs');
  }
};

window.CronTool = CronTool;
