// Timestamp & Epoch Converter Tool
const TimestampTool = {
  unit: 'sec', // 'sec' or 'ms'
  liveInterval: null,

  init() {
    const epochInput = document.getElementById('ts-input-epoch');
    const dateInput = document.getElementById('ts-input-date');
    const setNowBtn = document.getElementById('ts-set-now-btn');
    const unitSec = document.getElementById('ts-unit-sec');
    const unitMs = document.getElementById('ts-unit-ms');

    if (!epochInput || !dateInput) return;

    // Toggle unit buttons
    if (unitSec && unitMs) {
      unitSec.addEventListener('click', () => {
        this.unit = 'sec';
        unitSec.classList.add('active');
        unitMs.classList.remove('active');
        const label = document.getElementById('ts-input-epoch-label');
        if (label) label.innerText = 'Epoch (seconds)';
        this.setNow();
      });

      unitMs.addEventListener('click', () => {
        this.unit = 'ms';
        unitMs.classList.add('active');
        unitSec.classList.remove('active');
        const label = document.getElementById('ts-input-epoch-label');
        if (label) label.innerText = 'Epoch (milliseconds)';
        this.setNow();
      });
    }

    if (setNowBtn) {
      setNowBtn.addEventListener('click', () => this.setNow());
    }

    // Quick adjustment event listeners
    const bindAdjust = (id, deltaMs) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          const val = epochInput.value.trim();
          if (!val) return;
          let num = parseInt(val, 10);
          if (isNaN(num)) return;
          
          let delta = deltaMs;
          if (this.unit === 'sec') {
            delta = Math.floor(deltaMs / 1000);
          }
          epochInput.value = num + delta;
          this.fromEpoch();
        });
      }
    };

    bindAdjust('ts-adj-sub-hour', -3600000);
    bindAdjust('ts-adj-add-hour', 3600000);
    bindAdjust('ts-adj-sub-day', -86400000);
    bindAdjust('ts-adj-add-day', 86400000);

    epochInput.addEventListener('input', () => this.fromEpoch());
    dateInput.addEventListener('input', () => this.fromDate());

    this.startLiveClock();
    this.setNow();
  },

  startLiveClock() {
    if (this.liveInterval) clearInterval(this.liveInterval);

    const update = () => {
      const now = new Date();
      const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      const dateStr = now.toLocaleDateString('en-GB', options);
      const headerDate = document.getElementById('ts-live-header-date');
      if (headerDate) {
        headerDate.innerText = dateStr;
      }
    };

    update();
    this.liveInterval = setInterval(update, 1000);
  },

  setNow() {
    const epochInput = document.getElementById('ts-input-epoch');
    if (!epochInput) return;

    const now = Date.now();
    epochInput.value = this.unit === 'sec' ? Math.floor(now / 1000) : now;
    this.fromEpoch();
  },

  fromEpoch() {
    const epochInput = document.getElementById('ts-input-epoch');
    const dateInput = document.getElementById('ts-input-date');
    if (!epochInput || !dateInput) return;

    const val = epochInput.value.trim();
    if (!val) return;

    let num = parseInt(val, 10);
    if (isNaN(num)) return;

    let dateMs = num;
    if (this.unit === 'sec') {
      dateMs = num * 1000;
    }

    const date = new Date(dateMs);
    if (isNaN(date.getTime())) return;

    // Convert Date object to datetime-local local string format (YYYY-MM-DDTHH:MM:SS)
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
    dateInput.value = localISOTime.split('.')[0];
    
    this.renderDetails(date);
  },

  fromDate() {
    const epochInput = document.getElementById('ts-input-epoch');
    const dateInput = document.getElementById('ts-input-date');
    if (!epochInput || !dateInput) return;

    const val = dateInput.value;
    if (!val) return;

    const date = new Date(val);
    if (isNaN(date.getTime())) return;

    const now = date.getTime();
    epochInput.value = this.unit === 'sec' ? Math.floor(now / 1000) : now;
    this.renderDetails(date);
  },

  renderDetails(date) {
    const isoVal = document.getElementById('ts-val-iso');
    const utcVal = document.getElementById('ts-val-utc');
    const localVal = document.getElementById('ts-val-local');
    const secVal = document.getElementById('ts-val-sec');
    const msVal = document.getElementById('ts-val-ms');
    const relativeVal = document.getElementById('ts-val-relative');

    const tsSeconds = Math.floor(date.getTime() / 1000);
    const tsMs = date.getTime();

    if (isoVal) isoVal.innerText = date.toISOString();
    if (utcVal) utcVal.innerText = date.toUTCString();
    if (localVal) localVal.innerText = date.toString();
    if (secVal) secVal.innerText = tsSeconds;
    if (msVal) msVal.innerText = tsMs;

    if (relativeVal) {
      const diffMs = Date.now() - date.getTime();
      const diffSecs = Math.round(diffMs / 1000);
      let rel = '';
      if (Math.abs(diffSecs) < 5) rel = 'now';
      else if (Math.abs(diffSecs) < 60) rel = `${Math.abs(diffSecs)} seconds ${diffSecs >= 0 ? 'ago' : 'from now'}`;
      else if (Math.abs(diffSecs) < 3600) rel = `${Math.round(Math.abs(diffSecs)/60)} minutes ${diffSecs >= 0 ? 'ago' : 'from now'}`;
      else if (Math.abs(diffSecs) < 86400) rel = `${(Math.abs(diffSecs)/3600).toFixed(1)} hours ${diffSecs >= 0 ? 'ago' : 'from now'}`;
      else rel = `${Math.round(Math.abs(diffSecs)/86400)} days ${diffSecs >= 0 ? 'ago' : 'from now'}`;
      relativeVal.innerText = rel;
    }
  }
};
