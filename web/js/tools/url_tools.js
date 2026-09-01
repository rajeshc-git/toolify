// URL Tools: Bidirectional real-time encoder/decoder with options & stats
const UrlTool = {
  mode: 'component', // 'component' or 'full'
  historyKey: 'url-encoder',

  init() {
    const plainText = document.getElementById('url-plain-text');
    const encodedText = document.getElementById('url-encoded-text');
    const modeCompBtn = document.getElementById('url-mode-component');
    const modeFullBtn = document.getElementById('url-mode-full');
    const modeDesc = document.getElementById('url-mode-desc');
    const clearBtn = document.getElementById('url-clear-btn');
    const fileInput = document.getElementById('url-plain-file-input');

    const copyPlain = document.getElementById('url-plain-copy');
    const copyEncoded = document.getElementById('url-encoded-copy');
    const downloadPlain = document.getElementById('url-plain-download');
    const downloadEncoded = document.getElementById('url-encoded-download');

    if (!plainText || !encodedText) return;

    // Real-time bidirectional bindings with 150ms debounce
    const debouncedPlain = Perf.debounce(() => this.handlePlainInput(), 150);
    const debouncedEncoded = Perf.debounce(() => this.handleEncodedInput(), 150);

    plainText.addEventListener('input', debouncedPlain);
    encodedText.addEventListener('input', debouncedEncoded);

    // Toggle Modes
    if (modeCompBtn && modeFullBtn) {
      modeCompBtn.addEventListener('click', () => {
        this.mode = 'component';
        modeCompBtn.classList.add('active');
        modeFullBtn.classList.remove('active');
        if (modeDesc) modeDesc.innerText = 'encodeURIComponent — escapes reserved URL characters (&, ?, /, =, ...)';
        this.handlePlainInput();
      });

      modeFullBtn.addEventListener('click', () => {
        this.mode = 'full';
        modeFullBtn.classList.add('active');
        modeCompBtn.classList.remove('active');
        if (modeDesc) modeDesc.innerText = 'encodeURI — preserves standard protocol structure (keeps http://, query param signs, fragments)';
        this.handlePlainInput();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }

    // Load file helper
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          plainText.value = evt.target.result;
          this.handlePlainInput();
        };
        reader.readAsText(file);
      });
    }

    // Copy actions
    if (copyPlain) copyPlain.addEventListener('click', () => App.copyToClipboard(plainText.value));
    if (copyEncoded) copyEncoded.addEventListener('click', () => App.copyToClipboard(encodedText.value));

    // Download actions
    if (downloadPlain) downloadPlain.addEventListener('click', () => this.download(plainText.value, 'plain_url.txt'));
    if (downloadEncoded) downloadEncoded.addEventListener('click', () => this.download(encodedText.value, 'encoded_url.txt'));

    // Start empty
    plainText.value = '';
    this.handlePlainInput();
  },

  handlePlainInput() {
    const plainText = document.getElementById('url-plain-text');
    const encodedText = document.getElementById('url-encoded-text');
    if (!plainText || !encodedText) return;

    const val = plainText.value;
    if (!val) {
      encodedText.value = '';
      this.updateStats(0, 0);
      return;
    }

    let encoded = '';
    try {
      encoded = this.mode === 'component' ? encodeURIComponent(val) : encodeURI(val);
    } catch (e) {
      encoded = 'Error: Cannot encode input';
    }

    encodedText.value = encoded;
    this.updateStats(val.length, encoded.length);
  },

  handleEncodedInput() {
    const plainText = document.getElementById('url-plain-text');
    const encodedText = document.getElementById('url-encoded-text');
    if (!plainText || !encodedText) return;

    const val = encodedText.value;
    if (!val) {
      plainText.value = '';
      this.updateStats(0, 0);
      return;
    }

    let decoded = '';
    try {
      decoded = this.mode === 'component' ? decodeURIComponent(val) : decodeURI(val);
    } catch (e) {
      decoded = 'Error: Cannot decode input';
    }

    plainText.value = decoded;
    this.updateStats(decoded.length, val.length);
  },

  updateStats(lenIn, lenOut) {
    const statIn = document.getElementById('url-stat-in');
    const statOut = document.getElementById('url-stat-out');
    if (statIn) statIn.innerText = `${lenIn} chars in`;
    if (statOut) statOut.innerText = `${lenOut} chars out`;
  },

  clearAll() {
    const plainText = document.getElementById('url-plain-text');
    const encodedText = document.getElementById('url-encoded-text');
    if (plainText) plainText.value = '';
    if (encodedText) encodedText.value = '';
    this.updateStats(0, 0);
  },

  download(text, filename) {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
