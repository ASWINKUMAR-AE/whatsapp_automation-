import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getContacts } from '../services/api';
import { Users, Search, MessageSquare, Phone, Loader2, AlertCircle } from 'lucide-react';

export default function ContactsView({ onSelectContact }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await getContacts();
      if (data.success) {
        setContacts(data.contacts || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load contacts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Deduplicate by contact.id to prevent React duplicate-key warning
  const uniqueContacts = [...new Map(contacts.map(c => [c.id, c])).values()];

  const filteredContacts = uniqueContacts.filter(c => 
    (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
    (c.number && c.number.includes(search))
  );

  return (
    <motion.div className="glass-card p-6 h-full flex flex-col bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">My Contacts</h2>
            <p className="text-slate-600 text-sm">Select a contact to send a message</p>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-full !pl-12"
          style={{ paddingLeft: '3rem' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-655">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-purple-600" />
            <p className="font-semibold">Loading your contacts...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-600 p-4 bg-red-50 border border-red-200 rounded-xl font-semibold">
            <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
            <p>{error}</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 font-semibold">
            <Users className="w-8 h-8 mb-2 opacity-50 text-slate-400" />
            <p>No contacts found.</p>
          </div>
        ) : (
          filteredContacts.map(contact => (
            <div key={contact.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-purple-300 hover:bg-slate-100/50 shadow-sm transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/10">
                  {contact.name ? contact.name.charAt(0).toUpperCase() : <Users className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-slate-800 font-bold">{contact.name || 'Unknown Contact'}</h3>
                  <p className="text-slate-500 text-sm flex items-center gap-1 font-semibold">
                    <Phone className="w-3 h-3 text-slate-450" />
                    {contact.number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSelectContact(contact.number)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors font-semibold shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-semibold hidden sm:inline">Message</span>
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
