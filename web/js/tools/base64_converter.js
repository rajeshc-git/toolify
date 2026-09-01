// Base64 to Media & File Converter Tool - High Performance Async Engine
const Base64ConverterTool = {
  _previewBlobUrl: null,
  _decodeToken: 0,

  init() {
    const input = document.getElementById('b64-conv-input');
    const decodeBtn = document.getElementById('b64-decode-btn');
    const sampleImgBtn = document.getElementById('b64-sample-img-btn');
    const clearBtn = document.getElementById('b64-clear-btn');

    if (!input) return;

    sampleImgBtn.addEventListener('click', () => {
      // 1x1 transparent PNG / gradient dot
      input.value = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgc3Ryb2tlPSIjN2MzYWVkIiBzdHJva2Utd2lkdGg9IjQiIGZpbGw9IiNhODU1ZjciIC8+PC9zdmc+";
      this.decode();
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      this._revokePreviewBlob();
      document.getElementById('b64-preview-area').innerHTML = '<p class="text-muted">Preview will appear here</p>';
      document.getElementById('b64-download-bar').style.display = 'none';
    });

    decodeBtn.addEventListener('click', () => this.decode());

    // Debounced input — auto-decodes small/medium payloads, prompts for massive ones
    const debouncedDecode = Perf.debounce(() => {
      const len = input.value.trim().length;
      if (len > 0 && len < 500 * 1024) {
        this.decode();
      } else if (len >= 500 * 1024) {
        // For very large inputs (>500KB), show ready status without freezing on input
        const preview = document.getElementById('b64-preview-area');
        preview.innerHTML = `
          <div style="text-align:center; padding:1.5rem 1rem;">
            <p style="font-weight:600; color:var(--text-main); margin-bottom:0.4rem;">
              Large payload ready (${Perf.formatBytes(len)})
            </p>
            <p class="text-muted" style="font-size:0.85rem; margin-bottom:1rem;">
              Click "Decode Base64" or press the button below to process smoothly without freezing.
            </p>
            <button class="btn btn-primary" onclick="Base64ConverterTool.decode()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Decode Now
            </button>
          </div>
        `;
      }
    }, 300);

    input.addEventListener('input', debouncedDecode);
  },

  _revokePreviewBlob() {
    if (this._previewBlobUrl) {
      URL.revokeObjectURL(this._previewBlobUrl);
      this._previewBlobUrl = null;
    }
  },

  // Fast O(1) pointer parsing avoiding large string cloning & heavy regex
  _parseInput(val) {
    let mime = 'application/octet-stream';
    let rawBase64 = val;
    let isDataUri = false;

    if (val.startsWith('data:')) {
      isDataUri = true;
      const commaIdx = val.indexOf(',');
      if (commaIdx !== -1) {
        const header = val.substring(5, commaIdx);
        const semiIdx = header.indexOf(';');
        mime = (semiIdx !== -1 ? header.substring(0, semiIdx) : header).trim() || 'application/octet-stream';
        rawBase64 = val.substring(commaIdx + 1);
      }
    } else {
      // Guess mime if raw base64 by magic header bytes
      const sample = val.substring(0, 32).trim();
      if (sample.startsWith('iVBORw0KGgo')) mime = 'image/png';
      else if (sample.startsWith('/9j/')) mime = 'image/jpeg';
      else if (sample.startsWith('R0lGOD')) mime = 'image/gif';
      else if (sample.startsWith('JVBERi0')) mime = 'application/pdf';
      else if (sample.startsWith('UklGR')) mime = 'image/webp';
      else if (sample.startsWith('PHN2Zy')) mime = 'image/svg+xml';
      else if (sample.startsWith('AAAA')) mime = 'video/mp4';
      else if (sample.startsWith('SUQz') || sample.startsWith('//uQ')) mime = 'audio/mp3';
    }

    return { mime, rawBase64, isDataUri };
  },

  // Asynchronous non-blocking decode
  async decode() {
    const currentToken = ++this._decodeToken;
    const inputEl = document.getElementById('b64-conv-input');
    let val = inputEl ? inputEl.value.trim() : '';
    const preview = document.getElementById('b64-preview-area');
    const downloadBar = document.getElementById('b64-download-bar');
    const downloadLink = document.getElementById('b64-download-link');

    if (!val) {
      this._revokePreviewBlob();
      preview.innerHTML = '<p class="text-muted">Preview will appear here</p>';
      downloadBar.style.display = 'none';
      return;
    }

    const { mime, rawBase64, isDataUri } = this._parseInput(val);
    const inputSizeStr = Perf.formatBytes(val.length);

    // Render loading spinner and yield to let browser paint
    Perf.showSpinner('b64-preview-area', `Decoding ${inputSizeStr}…`);
    await new Promise(resolve => setTimeout(resolve, 20));

    // Abort if another decode request was triggered during yield
    if (currentToken !== this._decodeToken) return;

    try {
      let blob = null;

      // PRIMARY FAST-PATH: Native C++ Data URI decoding via fetch()
      // Runs outside V8 heap, zero string duplication, virtually instantaneous
      try {
        const dataUrlToFetch = isDataUri ? val : `data:${mime};base64,${rawBase64.replace(/\s+/g, '')}`;
        const res = await fetch(dataUrlToFetch);
        if (res.ok) {
          blob = await res.blob();
        }
      } catch (_) {
        // Fall back to chunked typed array decoder below
        blob = null;
      }

      // SECONDARY FALLBACK: Chunked non-blocking JS decoding
      if (!blob || blob.size === 0) {
        const cleanBase64 = rawBase64.replace(/\s+/g, '');
        const binaryStr = atob(cleanBase64);
        const totalBytes = binaryStr.length;
        const bytes = new Uint8Array(totalBytes);

        // Chunk processing to keep event loop alive on huge files
        const CHUNK_SIZE = 131072; // 128KB chunks
        for (let i = 0; i < totalBytes; i += CHUNK_SIZE) {
          const end = Math.min(i + CHUNK_SIZE, totalBytes);
          for (let j = i; j < end; j++) {
            bytes[j] = binaryStr.charCodeAt(j);
          }
          if (end < totalBytes && totalBytes > 500 * 1024) {
            await new Promise(r => setTimeout(r, 0));
            if (currentToken !== this._decodeToken) return;
          }
        }
        blob = new Blob([bytes], { type: mime });
      }

      if (currentToken !== this._decodeToken) return;

      this._revokePreviewBlob();
      const blobUrl = URL.createObjectURL(blob);
      this._previewBlobUrl = blobUrl;

      Perf.hideSpinner('b64-preview-area');

      // Render based on MIME type with DOM protection
      if (mime.startsWith('image/')) {
        preview.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:0.75rem;">
            <img src="${blobUrl}" alt="Decoded preview" loading="lazy" style="max-width:100%; max-height:280px; border-radius:8px; border:1px solid var(--border-color); object-fit:contain; background: repeating-conic-gradient(var(--bg-card) 0% 25%, var(--bg-hover) 0% 50%) 50% / 16px 16px;">
            <span class="toolify-status-pill" style="font-size:0.75rem;">${mime} • ${Perf.formatBytes(blob.size)}</span>
          </div>
        `;
      } else if (mime === 'application/pdf') {
        preview.innerHTML = `<iframe src="${blobUrl}" style="width:100%; height:300px; border:none; border-radius:8px;"></iframe>`;
      } else if (mime.startsWith('audio/')) {
        preview.innerHTML = `<audio controls src="${blobUrl}" style="width:100%; margin-top:1rem;"></audio>`;
      } else if (mime.startsWith('video/')) {
        preview.innerHTML = `<video controls src="${blobUrl}" style="max-width:100%; max-height:280px; border-radius:8px;"></video>`;
      } else {
        // Safe Text preview with byte slice to prevent DOM freeze
        const slice = blob.slice(0, 102400);
        const safeText = await slice.text();
        const isTruncated = blob.size > 102400;
        const displayText = isTruncated
          ? safeText + `\n\n… [Preview truncated (${Perf.formatBytes(blob.size)} total) — click Download below for full file]`
          : safeText;

        preview.innerHTML = `<textarea class="code-textarea" readonly style="min-height:180px;">${App.escapeHtml(displayText)}</textarea>`;
      }

      // Configure download button
      const ext = mime.split('/')[1]?.split('+')[0] || 'bin';
      downloadLink.href = blobUrl;
      downloadLink.download = `decoded.${ext}`;
      downloadBar.style.display = 'flex';

      App.showToast(`Decoded ${Perf.formatBytes(blob.size)} (${mime})`);
    } catch (err) {
      if (currentToken !== this._decodeToken) return;
      Perf.hideSpinner('b64-preview-area');
      preview.innerHTML = `<p style="color:var(--c-red); padding:1rem;">Error decoding Base64: ${App.escapeHtml(err.message)}</p>`;
      downloadBar.style.display = 'none';
    }
  }
};
