
import React, { useState } from 'react';
import { FileLock, Lock, Unlock, Copy, Check, FileText } from 'lucide-react';
import { encryptData, decryptData } from '../services/crypto';

const SecureShare: React.FC = () => {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [input, setInput] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [output, setOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const process = async () => {
    if (!input || !passphrase) return;
    setIsProcessing(true);
    try {
      if (mode === 'encrypt') {
        const result = await encryptData(input, passphrase);
        setOutput(result);
      } else {
        const result = await decryptData(input, passphrase);
        setOutput(result);
      }
    } catch (e) {
      alert('Operation failed. Check your passphrase.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Secure Text Exchange</h2>
        <p className="text-slate-500">Encrypt text or small files for safe transport via USB or insecure channels.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Side */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm space-y-6">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => { setMode('encrypt'); setOutput(''); setInput(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'encrypt' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'
              }`}
            >
              Encrypt
            </button>
            <button
              onClick={() => { setMode('decrypt'); setOutput(''); setInput(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'decrypt' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
              }`}
            >
              Decrypt
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">
              {mode === 'encrypt' ? 'Message to Encrypt' : 'Encrypted String'}
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-40 bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
              placeholder={mode === 'encrypt' ? "Type your secret message here..." : "Paste the encrypted string here..."}
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Passphrase</label>
            <div className="relative">
               <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input
                 type="password"
                 value={passphrase}
                 onChange={(e) => setPassphrase(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
               />
            </div>
          </div>

          <button
            onClick={process}
            disabled={isProcessing || !input || !passphrase}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              mode === 'encrypt' 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20'
            } disabled:opacity-50 disabled:shadow-none`}
          >
            {isProcessing ? 'Processing...' : (mode === 'encrypt' ? 'Lock Message' : 'Unlock Message')}
            {mode === 'encrypt' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
        </div>

        {/* Output Side */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <FileLock className="w-5 h-5 text-emerald-400" /> Output
            </h3>
            {output && (
              <button 
                onClick={copyToClipboard}
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>

          <div className="flex-1 bg-slate-950/50 rounded-2xl p-4 border border-slate-800 relative z-10">
             {output ? (
               <p className="font-mono text-xs text-slate-300 break-all leading-relaxed whitespace-pre-wrap">{output}</p>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
                 <FileText className="w-8 h-8 opacity-50" />
                 <p className="text-sm">Result will appear here</p>
               </div>
             )}
          </div>

          <div className="mt-6 text-xs text-slate-500 leading-relaxed relative z-10">
            <strong className="text-slate-400">Security Note:</strong> We use AES-GCM (256-bit) encryption derived from your passphrase via PBKDF2 (100k iterations). This happens entirely in your browser memory.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureShare;
