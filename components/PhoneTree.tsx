
import React, { useState } from 'react';
import { Plus, Trash2, Download, Upload, Share2, Users, Network, Save, Info } from 'lucide-react';
import { Contact } from '../types';

const PhoneTree: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState({ name: '', contact: '', role: 'Member', notes: '' });

  const addContact = () => {
    if (!newContact.name || !newContact.contact) return;
    setContacts([...contacts, { ...newContact, id: crypto.randomUUID() }]);
    setNewContact({ name: '', contact: '', role: 'Member', notes: '' });
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
  };

  const exportTree = () => {
    const dataStr = JSON.stringify(contacts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'emergency-tree-export.json';
    link.click();
  };

  const importTree = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        setContacts(imported);
      } catch (err) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  // Generate a simple tree visualization logic (1-to-2 distribution)
  const renderTreeInfo = () => {
    if (contacts.length < 2) return null;
    const leads = contacts.filter(c => c.role === 'Lead');
    const others = contacts.filter(c => c.role !== 'Lead');
    
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mt-6">
        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Network className="w-5 h-5 text-emerald-500" /> Distribution Logic
        </h4>
        <div className="space-y-2 text-sm text-slate-600">
          <p>Total size: <strong>{contacts.length}</strong> people</p>
          <p>Leads: <strong>{leads.length}</strong></p>
          <p>Recommended tree: Each person contacts <strong>2</strong> others.</p>
          <div className="mt-4 p-4 bg-white rounded-xl border border-slate-200">
            <p className="font-mono text-xs">
              ROOT &rarr; {leads.map(l => l.name).join(', ')} <br/>
              {leads[0]?.name || '...'} &rarr; {others.slice(0, 2).map(o => o.name).join(', ')} <br/>
              {others[0]?.name || '...'} &rarr; {others.slice(2, 4).map(o => o.name).join(', ')}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Emergency Phone Tree</h2>
          <p className="text-slate-500">Manage community contacts securely for rapid distribution of critical info.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-bold cursor-pointer transition-colors">
            <Upload className="w-4 h-4" /> Import
            <input type="file" className="hidden" onChange={importTree} />
          </label>
          <button onClick={exportTree} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors">
            <Download className="w-4 h-4" /> Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" /> Contact Directory
              </h3>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{contacts.length} Contacts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] border-b border-slate-100">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No contacts added yet.</td>
                    </tr>
                  ) : (
                    contacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-900">{contact.name}</td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-sm">{contact.contact}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            contact.role === 'Lead' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {contact.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => removeContact(contact.id)} className="text-slate-300 hover:text-red-500 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={newContact.name}
                  onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                  className="bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <input
                  type="text"
                  placeholder="Phone/Signal"
                  value={newContact.contact}
                  onChange={e => setNewContact({ ...newContact, contact: e.target.value })}
                  className="bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <select
                  value={newContact.role}
                  onChange={e => setNewContact({ ...newContact, role: e.target.value })}
                  className="bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option>Member</option>
                  <option>Lead</option>
                </select>
                <button
                  onClick={addContact}
                  className="bg-slate-900 hover:bg-black text-white p-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Network className="w-5 h-5 text-emerald-400" />
              Privacy Principles
            </h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>No Central DB:</strong> This app stores zero data. Everything is in your current browser session.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Compartmentalization:</strong> Use roles to decide who gets full tree access.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Export Often:</strong> Keep your "source of truth" as an encrypted JSON file on a local drive.</span>
              </li>
            </ul>
          </div>

          {renderTreeInfo()}

          <div className="p-6 bg-amber-50 border border-amber-100 rounded-3xl space-y-2">
            <h4 className="font-bold text-amber-900 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Info className="w-4 h-4" /> Security Tip
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              When sending alerts, use pre-established codes (e.g., "Level Blue") rather than specific details to minimize metadata exposure if a message is intercepted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneTree;
