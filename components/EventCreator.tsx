import React, { useState } from 'react';
import { Save, Copy, Download, Lock, Check, Calendar, MapPin, AlignLeft, ShieldCheck, Info } from 'lucide-react';
import { encryptData } from '../services/crypto';
import { EventDetails } from '../types';

const EventCreator: React.FC = () => {
  const [details, setDetails] = useState<EventDetails>({
    title: '',
    date: '',
    location: '',
    description: '',
    safetyInfo: '',
  });
  const [passphrase, setPassphrase] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) return alert('Passphrase is required for encryption.');
    
    setIsExporting(true);
    try {
      const dataStr = JSON.stringify(details);
      const encrypted = await encryptData(dataStr, passphrase);
      
      // Create a self-contained viewer HTML string
      const viewerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Event Detail</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 flex items-center justify-center min-h-screen p-4">
    <div id="content" class="max-w-lg w-full bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
        <h1 class="text-2xl font-bold mb-6 text-center text-emerald-400">Locked Event Info</h1>
        <div id="unlock-form" class="space-y-4">
            <p class="text-slate-400 text-center text-sm">Enter the passphrase shared with you to view the event details.</p>
            <input type="password" id="passphrase" class="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Passphrase">
            <button onclick="unlock()" class="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-xl font-bold transition-all">Unlock Details</button>
            <p id="error" class="text-red-400 text-center text-sm hidden">Incorrect passphrase.</p>
        </div>
        <div id="details" class="hidden space-y-6">
            <div class="border-b border-slate-700 pb-4">
                <h2 id="view-title" class="text-3xl font-bold text-white mb-2"></h2>
                <div class="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                  <span id="view-date"></span>
                </div>
            </div>
            <div class="space-y-4">
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Location</span>
                  <p id="view-location" class="text-lg"></p>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Description</span>
                  <p id="view-description" class="text-slate-300"></p>
                </div>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-emerald-500/20">
                  <span class="text-xs font-bold text-emerald-500 uppercase tracking-widest block mb-2">Safety & Instructions</span>
                  <p id="view-safety" class="text-emerald-100/80 text-sm"></p>
                </div>
            </div>
            <button onclick="window.print()" class="w-full mt-4 text-slate-500 text-sm border border-slate-700 py-2 rounded-lg hover:bg-slate-700 transition-colors">Print to PDF</button>
        </div>
    </div>

    <script>
        const encrypted = "${encrypted}";
        async function unlock() {
            const pass = document.getElementById('passphrase').value;
            try {
                const combined = new Uint8Array(atob(encrypted).split("").map((c) => c.charCodeAt(0)));
                const salt = combined.slice(0, 16);
                const iv = combined.slice(16, 28);
                const data = combined.slice(28);

                const passwordKey = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(pass), { name: "PBKDF2" }, false, ["deriveKey"]);
                const key = await window.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, passwordKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
                
                const decryptedContent = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
                const result = JSON.parse(new TextDecoder().decode(decryptedContent));

                document.getElementById('view-title').innerText = result.title;
                document.getElementById('view-date').innerText = result.date;
                document.getElementById('view-location').innerText = result.location;
                document.getElementById('view-description').innerText = result.description;
                document.getElementById('view-safety').innerText = result.safetyInfo;

                document.getElementById('unlock-form').classList.add('hidden');
                document.getElementById('details').classList.remove('hidden');
            } catch (e) {
                document.getElementById('error').classList.remove('hidden');
                console.error(e);
            }
        }
    </script>
</body>
</html>
      `;

      const blob = new Blob([viewerHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
    } catch (err) {
      alert('Failed to encrypt data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Secure Event Creator</h2>
          <p className="text-slate-500">Generate an encrypted standalone HTML file for private event coordination.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-semibold">
          <ShieldCheck className="w-4 h-4" /> No server storage
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleExport} className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Event Title</label>
                <input
                  required
                  type="text"
                  value={details.title}
                  onChange={(e) => setDetails({ ...details, title: e.target.value })}
                  placeholder="e.g. Community Gathering"
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Date / Time</label>
                  <input
                    required
                    type="text"
                    value={details.date}
                    onChange={(e) => setDetails({ ...details, date: e.target.value })}
                    placeholder="e.g. Next Tuesday, 6:00 PM"
                    className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Location</label>
                  <input
                    required
                    type="text"
                    value={details.location}
                    onChange={(e) => setDetails({ ...details, location: e.target.value })}
                    placeholder="e.g. Secret Garden, Entrance B"
                    className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Description</label>
                <textarea
                  rows={3}
                  value={details.description}
                  onChange={(e) => setDetails({ ...details, description: e.target.value })}
                  placeholder="What is this event about?"
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Safety & Protocols</label>
                <textarea
                  rows={2}
                  value={details.safetyInfo}
                  onChange={(e) => setDetails({ ...details, safetyInfo: e.target.value })}
                  placeholder="Security protocols, mask policies, contact person..."
                  className="w-full bg-emerald-50/50 border border-emerald-100 p-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-emerald-900 placeholder:text-emerald-300"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Shared Passphrase</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Set a password to encrypt"
                    className="w-full bg-slate-900 text-white border-0 p-3.5 pl-11 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isExporting}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isExporting ? <span className="animate-spin text-xl">⏳</span> : <Download className="w-5 h-5" />}
                Generate Secure HTML
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-400" />
              How it works
            </h3>
            <ol className="space-y-3 text-sm text-slate-300 list-decimal pl-4">
              <li>Fill in event details above.</li>
              <li>Set a strong <strong>passphrase</strong>.</li>
              <li>Click <strong>Generate</strong> to create a file.</li>
              <li>Send the <code>.html</code> file to participants.</li>
              <li>Share the passphrase via a separate channel (e.g. in person or Signal).</li>
            </ol>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              Because the file contains the viewing logic and the encrypted data, participants can open it on any device, even offline.
            </p>
          </div>

          {exportUrl && (
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl animate-in zoom-in duration-300">
              <div className="flex items-center gap-2 text-emerald-700 font-bold mb-3">
                <Check className="w-5 h-5" /> Export Ready
              </div>
              <p className="text-sm text-emerald-600 mb-6 leading-relaxed">
                Your encrypted event page is ready for download.
              </p>
              <a
                href={exportUrl}
                download="secure-event.html"
                className="w-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Download className="w-5 h-5" /> Save File Now
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCreator;