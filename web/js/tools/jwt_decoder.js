// JWT Decoder & Signature Verifier Tool
const JwtTool = {
  init() {
    const input = document.getElementById('jwt-input');
    const sampleBtn = document.getElementById('jwt-sample-btn');
    const clearBtn = document.getElementById('jwt-clear-btn');
    const verifyBtn = document.getElementById('jwt-verify-btn');

    if (!input) return;

    sampleBtn.addEventListener('click', () => {
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payload = btoa(JSON.stringify({
        sub: "usr_94812",
        name: "Antigravity Dev",
        role: "admin",
        iat: now - 3600,
        exp: now + 7200,
        iss: "https://auth.devutility.local",
        aud: ["web", "api"]
      }));
      const sig = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      input.value = `${header}.${payload}.${sig}`;
      this.decode();
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      document.getElementById('jwt-header-out').value = '';
      document.getElementById('jwt-payload-out').value = '';
      document.getElementById('jwt-status-banner').innerHTML = '';
      document.getElementById('jwt-sig-status').innerHTML = '';
    });

    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => this.verifySignature());
    }

    const debouncedDecode = Perf.debounce(() => this.decode(), 150);
    input.addEventListener('input', debouncedDecode);
    this.decode();
  },

  decode() {
    const token = document.getElementById('jwt-input').value.trim();
    const headerOut = document.getElementById('jwt-header-out');
    const payloadOut = document.getElementById('jwt-payload-out');
    const statusBanner = document.getElementById('jwt-status-banner');

    if (!token) {
      headerOut.value = '';
      payloadOut.value = '';
      statusBanner.innerHTML = '';
      return;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      statusBanner.innerHTML = '<div style="color:var(--c-red); background:var(--c-red-light); padding:8px 12px; border-radius:8px; margin-bottom:1rem; font-weight:600;">Invalid JWT: Must have 3 period-separated sections (Header, Payload, Signature)</div>';
      return;
    }

    try {
      const headerJson = JSON.parse(this.base64UrlDecode(parts[0]));
      const payloadJson = JSON.parse(this.base64UrlDecode(parts[1]));

      headerOut.value = JSON.stringify(headerJson, null, 2);
      payloadOut.value = JSON.stringify(payloadJson, null, 2);

      // Check Expiration
      let statusHtml = '';
      if (payloadJson.exp) {
        const expTime = payloadJson.exp * 1000;
        const now = Date.now();
        const isExpired = now > expTime;
        const diffSecs = Math.abs(Math.round((expTime - now) / 1000));
        const diffFormatted = diffSecs > 3600 ? `${(diffSecs/3600).toFixed(1)} hours` : `${Math.round(diffSecs/60)} minutes`;

        if (isExpired) {
          statusHtml = `<div style="color:var(--c-red); background:var(--c-red-light); padding:10px 14px; border-radius:8px; margin-bottom:1rem; font-weight:600; display:flex; justify-content:space-between;">
            <span>⚠️ Token EXPIRED ${diffFormatted} ago</span>
            <span>Expired At: ${new Date(expTime).toLocaleString()}</span>
          </div>`;
        } else {
          statusHtml = `<div style="color:var(--c-green); background:var(--c-green-light); padding:10px 14px; border-radius:8px; margin-bottom:1rem; font-weight:600; display:flex; justify-content:space-between;">
            <span>✓ Token is VALID (Expires in ${diffFormatted})</span>
            <span>Expires At: ${new Date(expTime).toLocaleString()}</span>
          </div>`;
        }
      } else {
        statusHtml = `<div style="color:var(--c-purple); background:var(--c-purple-light); padding:10px 14px; border-radius:8px; margin-bottom:1rem; font-weight:600;">
          ℹ️ Token has no expiration ('exp') claim defined.
        </div>`;
      }

      statusBanner.innerHTML = statusHtml;
    } catch (err) {
      statusBanner.innerHTML = `<div style="color:var(--c-red); background:var(--c-red-light); padding:8px 12px; border-radius:8px; margin-bottom:1rem; font-weight:600;">Failed to parse claims: ${err.message}</div>`;
    }
  },

  async verifySignature() {
    const token = document.getElementById('jwt-input').value.trim();
    const secret = document.getElementById('jwt-secret-input').value.trim();
    const sigStatus = document.getElementById('jwt-sig-status');

    if (!token || !secret) {
      sigStatus.innerHTML = '<span style="color:var(--c-orange);">Please enter both a JWT token and secret key</span>';
      return;
    }

    const parts = token.split('.');
    if (parts.length !== 3) return;

    try {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureData = await crypto.subtle.sign(
        "HMAC",
        key,
        enc.encode(`${parts[0]}.${parts[1]}`)
      );
      const calculatedSig = btoa(String.fromCharCode(...new Uint8Array(signatureData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      if (calculatedSig === parts[2]) {
        sigStatus.innerHTML = '<span style="color:var(--c-green); font-weight:600;">✓ Signature VERIFIED successfully with provided secret key!</span>';
      } else {
        sigStatus.innerHTML = '<span style="color:var(--c-red); font-weight:600;">✗ Signature MISMATCH (Invalid secret key or tampered payload).</span>';
      }
    } catch (e) {
      sigStatus.innerHTML = `<span style="color:var(--c-red);">Verification error: ${e.message}</span>`;
    }
  },

  base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return decodeURIComponent(escape(atob(base64)));
  }
};
