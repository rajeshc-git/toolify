// HAR Extractor & Inspector Tool
const HarTool = {
  data: null,

  init() {
    const dropzone = document.getElementById('har-dropzone');
    const fileInput = document.getElementById('har-file-input');
    const demoBtn = document.getElementById('har-demo-btn');
    const clearBtn = document.getElementById('har-clear-btn');
    const filterText = document.getElementById('har-filter-text');
    const filterStatus = document.getElementById('har-filter-status');
    const filterMethod = document.getElementById('har-filter-method');
    const closeDetail = document.getElementById('har-close-detail');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', (e) => {
      if (e.target !== fileInput) fileInput.click();
    });
    fileInput.addEventListener('click', (e) => e.stopPropagation());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.loadFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.loadFile(e.target.files[0]);
        fileInput.value = '';
      }
    });

    demoBtn.addEventListener('click', () => this.loadDemo());
    clearBtn.addEventListener('click', () => this.clear());
    filterText.addEventListener('input', () => this.renderTable());
    filterStatus.addEventListener('change', () => this.renderTable());
    filterMethod.addEventListener('change', () => this.renderTable());
    closeDetail.addEventListener('click', () => {
      document.getElementById('har-detail-panel').style.display = 'none';
    });

    // Detail tabs
    document.querySelectorAll('#har-detail-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#har-detail-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderActiveDetailTab(btn.dataset.tab);
      });
    });
  },

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        this.processHar(json);
      } catch (err) {
        App.showToast('Invalid HAR/JSON file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  loadDemo() {
    const demoHar = {
      log: {
        version: "1.2",
        creator: { name: "Toolify HAR Engine", version: "1.0" },
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.github.com/users/octocat",
              headers: [{ name: "Accept", value: "application/vnd.github.v3+json" }, { name: "User-Agent", value: "Toolify/1.0" }],
              queryString: [],
              postData: null
            },
            response: {
              status: 200,
              statusText: "OK",
              headers: [{ name: "Content-Type", value: "application/json; charset=utf-8" }, { name: "X-RateLimit-Limit", value: "60" }],
              content: { mimeType: "application/json", size: 1240, text: JSON.stringify({ login: "octocat", id: 583231, avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4", type: "User", public_repos: 8 }, null, 2) }
            },
            time: 142
          },
          {
            request: {
              method: "POST",
              url: "https://api.example.com/v1/auth/token",
              headers: [{ name: "Content-Type", value: "application/json" }],
              queryString: [],
              postData: { mimeType: "application/json", text: JSON.stringify({ grant_type: "client_credentials", client_id: "dev_app_1" }) }
            },
            response: {
              status: 201,
              statusText: "Created",
              headers: [{ name: "Content-Type", value: "application/json" }],
              content: { mimeType: "application/json", size: 450, text: JSON.stringify({ access_token: "eyJhbGciOiJIUzI1NiIsIn...", token_type: "Bearer", expires_in: 3600 }) }
            },
            time: 89
          },
          {
            request: {
              method: "GET",
              url: "https://api.example.com/v1/users/404_not_found",
              headers: [{ name: "Accept", value: "*/*" }],
              queryString: [],
              postData: null
            },
            response: {
              status: 404,
              statusText: "Not Found",
              headers: [{ name: "Content-Type", value: "application/json" }],
              content: { mimeType: "application/json", size: 92, text: JSON.stringify({ error: "UserNotFound", message: "Requested user does not exist" }) }
            },
            time: 65
          },
          {
            request: {
              method: "GET",
              url: "https://cdn.example.com/assets/logo.png",
              headers: [],
              queryString: [],
              postData: null
            },
            response: {
              status: 304,
              statusText: "Not Modified",
              headers: [{ name: "Cache-Control", value: "max-age=86400" }],
              content: { mimeType: "image/png", size: 0, text: "" }
            },
            time: 18
          }
        ]
      }
    };
    this.processHar(demoHar);
    App.showToast('Loaded sample HAR with 4 entries');
  },

  processHar(har) {
    if (!har || !har.log || !Array.isArray(har.log.entries)) {
      App.showToast('Invalid HAR schema: Missing log.entries', 'error');
      return;
    }
    this.data = har.log.entries;
    document.getElementById('har-dropzone').style.display = 'none';
    document.getElementById('har-dashboard').style.display = 'block';
    this.renderStats();
    this.renderTable();
  },

  clear() {
    this.data = null;
    document.getElementById('har-dropzone').style.display = 'flex';
    document.getElementById('har-dashboard').style.display = 'none';
    document.getElementById('har-detail-panel').style.display = 'none';
    document.getElementById('har-tbody').innerHTML = '';
  },

  renderStats() {
    const total = this.data.length;
    let totalSize = 0;
    let totalTime = 0;
    this.data.forEach(e => {
      totalSize += (e.response && e.response.content && e.response.content.size) || 0;
      totalTime += e.time || 0;
    });

    const statsEl = document.getElementById('har-stats');
    statsEl.innerHTML = `
      <div class="stat-card"><span class="stat-val">${total}</span><span class="stat-lbl">Requests</span></div>
      <div class="stat-card"><span class="stat-val">${(totalSize / 1024).toFixed(1)} KB</span><span class="stat-lbl">Transferred</span></div>
      <div class="stat-card"><span class="stat-val">${totalTime.toFixed(0)} ms</span><span class="stat-lbl">Total Time</span></div>
    `;
  },

  renderTable() {
    const q = document.getElementById('har-filter-text').value.toLowerCase();
    const statusFilter = document.getElementById('har-filter-status').value;
    const methodFilter = document.getElementById('har-filter-method').value;
    const tbody = document.getElementById('har-tbody');
    tbody.innerHTML = '';

    const filtered = this.data.filter(item => {
      const req = item.request || {};
      const res = item.response || {};
      const url = req.url || '';
      const method = req.method || '';
      const status = res.status || 0;

      if (q && !url.toLowerCase().includes(q)) return false;
      if (methodFilter !== 'all' && method !== methodFilter) return false;
      if (statusFilter !== 'all') {
        const prefix = statusFilter[0];
        if (String(status)[0] !== prefix) return false;
      }
      return true;
    });

    filtered.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      const status = entry.response ? entry.response.status : 0;
      const statusClass = status >= 500 ? 'status-5xx' : status >= 400 ? 'status-4xx' : status >= 300 ? 'status-3xx' : 'status-2xx';
      const mime = (entry.response && entry.response.content && entry.response.content.mimeType) || 'unknown';
      const size = (entry.response && entry.response.content && entry.response.content.size) || 0;
      const sizeStr = size > 1024 ? (size / 1024).toFixed(1) + ' KB' : size + ' B';

      tr.innerHTML = `
        <td><span class="badge-status ${statusClass}">${status}</span></td>
        <td><strong>${entry.request.method}</strong></td>
        <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.request.url}">${entry.request.url}</td>
        <td><span style="font-size:0.75rem; color:var(--text-muted);">${mime.split(';')[0]}</span></td>
        <td>${sizeStr}</td>
        <td>${Math.round(entry.time || 0)} ms</td>
        <td><button class="btn-sm" onclick="HarTool.showDetail(${this.data.indexOf(entry)})">Inspect</button></td>
      `;
      tbody.appendChild(tr);
    });
  },

  selectedEntry: null,

  showDetail(index) {
    this.selectedEntry = this.data[index];
    if (!this.selectedEntry) return;

    const panel = document.getElementById('har-detail-panel');
    panel.style.display = 'block';
    document.getElementById('har-detail-title').innerText = `${this.selectedEntry.request.method} ${this.selectedEntry.request.url}`;
    
    // Default to active tab
    const activeTab = document.querySelector('#har-detail-tabs .tab-btn.active').dataset.tab;
    this.renderActiveDetailTab(activeTab);
  },

  renderActiveDetailTab(tab) {
    if (!this.selectedEntry) return;
    const content = document.getElementById('har-tab-content');
    const req = this.selectedEntry.request;
    const res = this.selectedEntry.response;

    if (tab === 'headers') {
      let html = '<h4>Request Headers</h4><table class="data-table"><tbody>';
      (req.headers || []).forEach(h => html += `<tr><td style="font-weight:600; width:30%;">${h.name}</td><td><code>${h.value}</code></td></tr>`);
      html += '</tbody></table><h4 style="margin-top:1.5rem;">Response Headers</h4><table class="data-table"><tbody>';
      (res.headers || []).forEach(h => html += `<tr><td style="font-weight:600; width:30%;">${h.name}</td><td><code>${h.value}</code></td></tr>`);
      html += '</tbody></table>';
      content.innerHTML = html;
    } else if (tab === 'payload') {
      const post = req.postData ? req.postData.text : 'No request payload';
      content.innerHTML = `<textarea class="code-textarea" readonly style="min-height:180px;">${post}</textarea>`;
    } else if (tab === 'response') {
      const resText = (res.content && res.content.text) || 'No response body content';
      content.innerHTML = `<textarea class="code-textarea" readonly style="min-height:220px;">${resText}</textarea>`;
    } else if (tab === 'timings') {
      content.innerHTML = `
        <div style="padding:1rem;">
          <p><strong>Total Duration:</strong> ${Math.round(this.selectedEntry.time || 0)} ms</p>
          <div style="margin-top:10px; background:var(--bg-card); padding:10px; border-radius:8px; border:1px solid var(--border-color);">
            <p style="font-size:0.85rem;">HTTP Connection & Response timing captured from client network layer.</p>
          </div>
        </div>
      `;
    }
  }
};
