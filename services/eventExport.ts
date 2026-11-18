/**
 * Makes the event page: one HTML file that holds the encrypted event and
 * the code to decrypt it. The page makes no network requests, so it opens
 * on a device with no connection. The decrypt code must match the text
 * format, version 2, in `crypto.ts`.
 */
import { KDF_ITERATIONS } from './crypto';

export interface EventPageLabels {
  pageTitle: string;
  prompt: string;
  passphrase: string;
  unlock: string;
  working: string;
  wrong: string;
  /** Shown when the browser has no Web Crypto in this context. */
  unsupported: string;
  location: string;
  description: string;
  safety: string;
  print: string;
}

const PAYLOAD_FORMAT = /^snj2\.[A-Za-z0-9+/]+={0,2}$/;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const STYLE = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:#0f172a;color:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.5}
main{width:100%;max-width:32rem;background:#1e293b;border:1px solid #334155;border-radius:24px;padding:32px}
h1{margin:0 0 24px;font-size:1.5rem;text-align:center;color:#34d399}
h2{margin:0 0 4px;font-size:1.875rem;color:#fff}
p{margin:0}
.muted{color:#94a3b8;font-size:.875rem;text-align:center;margin-bottom:16px}
input,button{width:100%;padding:16px;border-radius:12px;font:inherit}
input{background:#020617;border:1px solid #334155;color:#fff;margin-bottom:16px}
button{background:#059669;border:0;color:#fff;font-weight:700;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
.error{color:#f87171;text-align:center;font-size:.875rem;margin-top:16px}
.date{color:#34d399;font-size:.875rem;font-weight:600;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #334155}
.label{display:block;font-size:.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-top:16px}
.value{white-space:pre-wrap;overflow-wrap:anywhere}
.safety{margin-top:16px;padding:16px;border-radius:12px;border:1px solid rgba(16,185,129,.3);background:rgba(15,23,42,.5)}
.safety .label{margin-top:0;color:#10b981}
.plain{margin-top:24px;background:transparent;border:1px solid #334155;color:#94a3b8;padding:8px;font-weight:400}
[hidden]{display:none}
@media print{body{background:#fff;color:#000}main{border:0}h2{color:#000}.plain{display:none}}
`;

// This script runs in the exported page, not in the app. Keep it free of
// dependencies. It sets text with textContent only.
const SCRIPT = `
(function () {
  var form = document.getElementById('unlock');
  var error = document.getElementById('error');
  var button = document.getElementById('unlock-button');
  function bytesOf(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function show(id, text) { document.getElementById(id).textContent = text; }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) {
      error.textContent = LABEL_UNSUPPORTED;
      error.hidden = false;
      return;
    }
    var passphrase = document.getElementById('passphrase').value;
    var sealed = bytesOf(PAYLOAD.slice(5));
    button.disabled = true;
    button.textContent = LABEL_WORKING;
    error.textContent = LABEL_WRONG;
    error.hidden = true;
    subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
      .then(function (material) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: sealed.slice(0, 16), iterations: ITERATIONS, hash: 'SHA-256' },
          material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(16, 28) }, key, sealed.slice(28));
      })
      .then(function (plain) {
        var event = JSON.parse(new TextDecoder().decode(plain));
        show('view-title', String(event.title));
        show('view-date', String(event.date));
        show('view-location', String(event.location));
        show('view-description', String(event.description));
        show('view-safety', String(event.safetyInfo));
        form.hidden = true;
        document.getElementById('details').hidden = false;
      })
      .catch(function () {
        error.hidden = false;
        button.disabled = false;
        button.textContent = LABEL_UNLOCK;
      });
  });
  document.getElementById('print').addEventListener('click', function () { window.print(); });
})();
`;

export function buildEventPage(encryptedPayload: string, labels: EventPageLabels): string {
  if (!PAYLOAD_FORMAT.test(encryptedPayload)) {
    throw new Error('The payload is not encrypted text in the version 2 format.');
  }
  const l = Object.fromEntries(Object.entries(labels).map(([key, text]) => [key, escapeHtml(text)])) as unknown as EventPageLabels;
  // JSON.stringify gives a safe JavaScript string. "<" is escaped so that a
  // label cannot close the script element.
  const js = (text: string) => JSON.stringify(text).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer">
<title>${l.pageTitle}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<form id="unlock">
<h1>${l.pageTitle}</h1>
<p class="muted">${l.prompt}</p>
<input type="password" id="passphrase" aria-label="${l.passphrase}" placeholder="${l.passphrase}" autocomplete="off" required>
<button type="submit" id="unlock-button">${l.unlock}</button>
<p id="error" class="error" hidden>${l.wrong}</p>
</form>
<div id="details" hidden>
<h2 id="view-title"></h2>
<p id="view-date" class="date"></p>
<span class="label">${l.location}</span>
<p id="view-location" class="value"></p>
<span class="label">${l.description}</span>
<p id="view-description" class="value"></p>
<div class="safety">
<span class="label">${l.safety}</span>
<p id="view-safety" class="value"></p>
</div>
<button type="button" id="print" class="plain">${l.print}</button>
</div>
</main>
<script>
var PAYLOAD = ${js(encryptedPayload)};
var ITERATIONS = ${KDF_ITERATIONS};
var LABEL_WORKING = ${js(labels.working)};
var LABEL_UNLOCK = ${js(labels.unlock)};
var LABEL_WRONG = ${js(labels.wrong)};
var LABEL_UNSUPPORTED = ${js(labels.unsupported)};
${SCRIPT}</script>
</body>
</html>
`;
}
