// Base64 to Media & File Converter Tool
const Base64ConverterTool = {
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
      document.getElementById('b64-preview-area').innerHTML = '<p class="text-muted">Preview will appear here</p>';
      document.getElementById('b64-download-bar').style.display = 'none';
    });

    decodeBtn.addEventListener('click', () => this.decode());
    input.addEventListener('input', () => this.decode());
  },

  decode() {
    let val = document.getElementById('b64-conv-input').value.trim();
    const preview = document.getElementById('b64-preview-area');
    const downloadBar = document.getElementById('b64-download-bar');
    const downloadLink = document.getElementById('b64-download-link');

    if (!val) {
      preview.innerHTML = '<p class="text-muted">Preview will appear here</p>';
      downloadBar.style.display = 'none';
      return;
    }

    let mime = 'application/octet-stream';
    let rawBase64 = val;

    // Check if Data URI
    if (val.startsWith('data:')) {
      const match = val.match(/^data:([^;]+);base64,(.*)$/s);
      if (match) {
        mime = match[1];
        rawBase64 = match[2];
      }
    } else {
      // Guess mime if raw base64
      if (val.startsWith('iVBORw0KGgo')) mime = 'image/png';
      else if (val.startsWith('/9j/')) mime = 'image/jpeg';
      else if (val.startsWith('R0lGOD')) mime = 'image/gif';
      else if (val.startsWith('JVBERi0')) mime = 'application/pdf';
      else if (val.startsWith('UklGR')) mime = 'image/webp';
      else if (val.startsWith('PHN2Zy')) mime = 'image/svg+xml';
      
      val = `data:${mime};base64,${val}`;
    }

    try {
      if (mime.startsWith('image/')) {
        preview.innerHTML = `<img src="${val}" alt="Decoded preview" style="max-width:100%; max-height:260px; border-radius:8px; border:1px solid var(--border-color); object-fit:contain;">`;
      } else if (mime === 'application/pdf') {
        preview.innerHTML = `<iframe src="${val}" style="width:100%; height:280px; border:none; border-radius:8px;"></iframe>`;
      } else if (mime.startsWith('audio/')) {
        preview.innerHTML = `<audio controls src="${val}" style="width:100%;"></audio>`;
      } else {
        const decodedText = atob(rawBase64.replace(/\s/g, ''));
        preview.innerHTML = `<textarea class="code-textarea" readonly style="min-height:160px;">${App.escapeHtml(decodedText)}</textarea>`;
      }

      downloadLink.href = val;
      downloadLink.download = `decoded.${mime.split('/')[1] || 'bin'}`;
      downloadBar.style.display = 'flex';
    } catch (err) {
      preview.innerHTML = `<p style="color:var(--c-red);">Error decoding Base64: ${err.message}</p>`;
      downloadBar.style.display = 'none';
    }
  }
};
