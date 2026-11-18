/**
 * Makes the locked file: one HTML page that holds an encrypted file and the
 * code to decrypt it. A person opens the page in a browser, types the
 * passphrase, and the browser saves the original file. The page makes no
 * network requests, so it opens on a device with no connection.
 *
 * Format (the same as the published site):
 * - The page holds base64(salt[16] | iv[12] | ciphertext), made by
 *   `encryptBytes` in `crypto.ts`. The script in the page must match it,
 *   with the same passphrase rule (NFKC, then trim).
 * - The plaintext is metaLength[4, big endian] | meta JSON {name, type} | file bytes.
 *   The name of the file is thus encrypted too.
 */
import { KDF_ITERATIONS, bytesToBase64, encryptBytes, type PlainFile } from './crypto';

export const MAX_LOCKED_FILE_MB = 25;
/** The largest file that the tool locks. Base64 makes the page a third larger than the file. */
export const MAX_LOCKED_FILE_BYTES = MAX_LOCKED_FILE_MB * 1024 * 1024;
export const LOCKED_FILE_NAME = 'locked-file.html';

export interface LockedFilePageLabels {
  /** The `lang` value of the language of the labels, for example "pt-BR" (`LOCALES[locale].htmlLang`). */
  lang: string;
  /** The direction of the language of the labels (`LOCALES[locale].dir`). */
  dir: 'ltr' | 'rtl';
  pageTitle: string;
  prompt: string;
  passphrase: string;
  unlock: string;
  working: string;
  wrong: string;
  /** Shown when the browser has no Web Crypto in this context. */
  unsupported: string;
  /** Shown after the file is saved. "{name}" is replaced with the name of the file. */
  done: string;
}

const PAYLOAD_FORMAT = /^[A-Za-z0-9+/]+={0,2}$/;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const STYLE = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:#0f172a;color:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.5}
main{width:100%;max-width:32rem;background:#1e293b;border:1px solid #334155;border-radius:24px;padding:32px}
h1{margin:0 0 24px;font-size:1.5rem;text-align:center;color:#34d399}
p{margin:0}
.muted{color:#94a3b8;font-size:.875rem;text-align:center;margin-bottom:16px}
input,button{width:100%;padding:16px;border-radius:12px;font:inherit}
input{background:#020617;border:1px solid #334155;color:#fff;margin-bottom:16px}
button{background:#059669;border:0;color:#fff;font-weight:700;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
.error{color:#f87171;text-align:center;font-size:.875rem;margin-top:16px}
.done{color:#34d399;text-align:center;font-size:.875rem;margin-top:16px;overflow-wrap:anywhere}
[hidden]{display:none}
`;

// This script runs in the locked file, not in the app. Keep it free of
// dependencies. It sets text with textContent only. The name of the file
// comes from the person who made the page, so the script removes a path and
// hidden characters from it. The file is saved with a generic type, so that
// the browser saves it and never opens it inside the page.
const SCRIPT = `
(function () {
  var form = document.getElementById('unlock');
  var error = document.getElementById('error');
  var done = document.getElementById('done');
  var button = document.getElementById('unlock-button');
  function bytesOf(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function safeName(name) {
    var base = (typeof name === 'string' ? name : '').split(/[\\\\/]/).pop();
    var clean = base.replace(/[\\p{Cc}\\p{Cf}]/gu, '').trim();
    return clean === '' || clean === '.' || clean === '..' ? 'unlocked-file' : clean;
  }
  function save(bytes, name) {
    var url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) {
      error.textContent = LABEL_UNSUPPORTED;
      error.hidden = false;
      return;
    }
    var passphrase = document.getElementById('passphrase').value.normalize('NFKC').trim();
    var sealed = bytesOf(PAYLOAD);
    button.disabled = true;
    button.textContent = LABEL_WORKING;
    error.textContent = LABEL_WRONG;
    error.hidden = true;
    done.textContent = '';
    subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
      .then(function (material) {
        return subtle.deriveKey(
          { name: 'PBKDF2', salt: sealed.slice(0, 16), iterations: ITERATIONS, hash: 'SHA-256' },
          material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(16, 28) }, key, sealed.slice(28));
      })
      .then(function (buffer) {
        var plain = new Uint8Array(buffer);
        var size = new DataView(buffer).getUint32(0);
        var meta = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + size)));
        var name = safeName(meta && meta.name);
        save(plain.subarray(4 + size), name);
        done.textContent = LABEL_DONE.split('{name}').join(name);
      })
      .catch(function () {
        error.hidden = false;
      })
      .then(function () {
        button.disabled = false;
        button.textContent = LABEL_UNLOCK;
      });
  });
})();
`;

/** The data that the tool encrypts: the name and the type of the file, then its bytes. */
export function packFile(file: PlainFile): Uint8Array {
  const meta = new TextEncoder().encode(JSON.stringify({ name: file.name, type: file.type }));
  const packed = new Uint8Array(4 + meta.length + file.bytes.length);
  new DataView(packed.buffer).setUint32(0, meta.length);
  packed.set(meta, 4);
  packed.set(file.bytes, 4 + meta.length);
  return packed;
}

/** `payload` is base64(salt | iv | ciphertext) of a packed file. */
export function buildLockedFilePage(payload: string, labels: LockedFilePageLabels): string {
  if (!PAYLOAD_FORMAT.test(payload)) {
    throw new Error('The payload is not base64 text.');
  }
  const dir = labels.dir === 'rtl' ? 'rtl' : 'ltr';
  const l = Object.fromEntries(Object.entries(labels).map(([key, text]) => [key, escapeHtml(text)])) as unknown as LockedFilePageLabels;
  // JSON.stringify gives a safe JavaScript string. "<" is escaped so that a
  // label cannot close the script element.
  const js = (text: string) => JSON.stringify(text).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="${l.lang}" dir="${dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>${l.pageTitle}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<form id="unlock">
<h1>${l.pageTitle}</h1>
<p class="muted">${l.prompt}</p>
<input type="password" id="passphrase" dir="ltr" aria-label="${l.passphrase}" placeholder="${l.passphrase}" autocomplete="off" required>
<button type="submit" id="unlock-button">${l.unlock}</button>
</form>
<p id="error" class="error" role="alert" hidden>${l.wrong}</p>
<p id="done" class="done" role="status" dir="auto"></p>
</main>
<script>
var PAYLOAD = ${js(payload)};
var ITERATIONS = ${KDF_ITERATIONS};
var LABEL_WORKING = ${js(labels.working)};
var LABEL_UNLOCK = ${js(labels.unlock)};
var LABEL_WRONG = ${js(labels.wrong)};
var LABEL_UNSUPPORTED = ${js(labels.unsupported)};
var LABEL_DONE = ${js(labels.done)};
${SCRIPT}</script>
</body>
</html>
`;
}

/**
 * Encrypts a file and returns the page that holds it. Throws
 * `WeakPassphraseError` for a weak passphrase and `RangeError` for a file
 * over the limit.
 */
export async function lockFile(file: PlainFile, passphrase: string, labels: LockedFilePageLabels): Promise<string> {
  if (file.bytes.length > MAX_LOCKED_FILE_BYTES) {
    throw new RangeError('The file is too large to lock in the browser.');
  }
  const sealed = await encryptBytes(packFile(file), passphrase);
  return buildLockedFilePage(bytesToBase64(sealed), labels);
}
