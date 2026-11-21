import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Send, Image, FileText, Loader2, CheckCircle, 
  AlertCircle, Phone, MessageSquare, Upload, X, Clock,
  Users, Search, RefreshCw, Check
} from 'lucide-react';
import { sendMessage, sendLocalMedia, getGroupInfo } from '../services/api';

function SendMessageForm({ onMessageSent, isConnected, rateLimit, initialRecipient = '' }) {
  const [destinationType, setDestinationType] = useState('contact'); // 'contact' | 'group'
  const [recipient, setRecipient] = useState(initialRecipient);
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('text');
  const [countdown, setCountdown] = useState(0);

  // Group states
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (initialRecipient) {
      setRecipient(initialRecipient);
      if (initialRecipient.endsWith('@g.us')) {
        setDestinationType('group');
      }
    }
  }, [initialRecipient]);

  const loadGroups = async () => {
    if (!isConnected) return;
    setLoadingGroups(true);
    try {
      const data = await getGroupInfo();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (isConnected && destinationType === 'group' && groups.length === 0) {
      loadGroups();
    }
  }, [isConnected, destinationType]);

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setRecipient(group.id);
  };

  const filteredGroups = groups.filter(g => 
    (g.name && g.name.toLowerCase().includes(groupSearch.toLowerCase())) ||
    (g.id && g.id.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  const canSend = () => {
    if (!isConnected) return { allowed: false, reason: 'WhatsApp not connected. Scan QR first.' };
    if (rateLimit?.canSend === false) return { allowed: false, reason: rateLimit.reason || 'Daily limit reached.' };
    if (rateLimit?.remaining !== undefined && rateLimit.remaining <= 0) {
      return { allowed: false, reason: 'Daily message limit reached.' };
    }
    return { allowed: true };
  };

  const handleSendText = async () => {
    if (!recipient.trim()) {
      setResult({ 
        success: false, 
        message: destinationType === 'group' ? 'Please select a WhatsApp group' : 'Please enter recipient number', 
        type: 'error' 
      });
      return;
    }

    const check = canSend();
    if (!check.allowed) {
      setResult({ success: false, message: check.reason, type: 'limit' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await sendMessage(recipient, message);
      const isGroup = recipient.endsWith('@g.us');
      const targetLabel = isGroup && selectedGroup ? `Group "${selectedGroup.name}"` : recipient;
      setResult({ 
        success: true, 
        message: `Message sent successfully to ${targetLabel}!`, 
        type: 'success',
        rateLimit: response.rateLimit
      });
      setMessage('');
      onMessageSent();
    } catch (error) {
      const errorMsg = error.error || 'Failed to send message';
      const errorType = error.code === 'DUPLICATE_MESSAGE' ? 'spam' : 
                        error.code === 'CONTACT_NOT_VALIDATED' ? 'validation' :
                        error.code === 'SUBSCRIPTION_EXPIRED' || error.subscription?.isActive === false ? 'subscription' : 'error';
      setResult({ success: false, message: errorMsg, type: errorType });
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  const handleSendMedia = async (type) => {
    if (!recipient.trim() || !selectedFile) {
      setResult({ 
        success: false, 
        message: `Please ${destinationType === 'group' ? 'select a group' : 'enter recipient'} and select a ${type}`, 
        type: 'error' 
      });
      return;
    }

    const check = canSend();
    if (!check.allowed) {
      setResult({ success: false, message: check.reason, type: 'limit' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
      });

      await sendLocalMedia(
        recipient,
        message,
        base64File,
        selectedFile.name,
        selectedFile.type
      );
      
      const isGroup = recipient.endsWith('@g.us');
      const targetLabel = isGroup && selectedGroup ? `Group "${selectedGroup.name}"` : recipient;
      setResult({ success: true, message: `${type} sent successfully to ${targetLabel}!`, type: 'success' });
      setSelectedFile(null);
      setMessage('');
      onMessageSent();
    } catch (error) {
      setResult({ success: false, message: error.error || `Failed to send ${type}`, type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  const tabs = [
    { id: 'text', label: 'Text', icon: MessageSquare },
    { id: 'image', label: 'Image', icon: Image },
    { id: 'document', label: 'Document', icon: FileText },
  ];

  const getResultStyle = (type) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-600 font-medium';
      case 'limit':
      case 'subscription':
        return 'bg-amber-50 border-amber-200 text-amber-600 font-medium';
      case 'spam':
        return 'bg-red-50 border-red-200 text-red-600 font-medium';
      case 'validation':
        return 'bg-blue-50 border-blue-200 text-blue-600 font-medium';
      default:
        return 'bg-red-50 border-red-200 text-red-600 font-medium';
    }
  };

  return (
    <motion.div className="glass-card p-6 bg-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <Send className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Send Message</h2>
            <p className="text-slate-600 text-sm">Send to individual contacts or WhatsApp groups</p>
          </div>
        </div>
        
        {rateLimit && (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg font-medium">
            <Clock className="w-3 h-3" />
            <span>{rateLimit.remaining !== undefined ? `${rateLimit.remaining} messages left today` : `${rateLimit.dailyRemaining || 0} left today`}</span>
          </div>
        )}
      </div>

      {/* Target Destination Toggle: Contact vs Group */}
      <div className="mb-4">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Send Target</label>
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setDestinationType('contact');
              setSelectedGroup(null);
              setRecipient('');
            }}
            className={`py-2 px-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              destinationType === 'contact'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Phone className="w-4 h-4" />
            Individual Contact
          </button>
          <button
            type="button"
            onClick={() => {
              setDestinationType('group');
              setRecipient('');
              loadGroups();
            }}
            className={`py-2 px-3 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              destinationType === 'group'
                ? 'bg-white text-emerald-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            WhatsApp Group
          </button>
        </div>
      </div>

      {/* Media Type Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setResult(null); setSelectedFile(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {destinationType === 'contact' ? (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Recipient Phone Number</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                <Phone className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="+919876543210"
                className="input-field w-full pl-14"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Include country code (e.g., +1, +91)</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">Select WhatsApp Group</label>
              <button
                type="button"
                onClick={loadGroups}
                disabled={loadingGroups || !isConnected}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
                Refresh Groups
              </button>
            </div>

            {selectedGroup && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-950">{selectedGroup.name}</p>
                    <p className="text-xs text-emerald-700">{selectedGroup.participants} participants</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup(null);
                    setRecipient('');
                  }}
                  className="text-emerald-700 hover:text-emerald-900 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Search groups..."
                  className="input-field w-full pl-10 text-sm"
                />
              </div>

              <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                {loadingGroups ? (
                  <div className="p-4 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    Loading WhatsApp groups...
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    {groups.length === 0 
                      ? 'No groups found. Make sure WhatsApp is connected and you are in at least one group.'
                      : 'No groups match your search.'}
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const isSelected = selectedGroup?.id === group.id || recipient === group.id;
                    return (
                      <div
                        key={group.id}
                        onClick={() => handleSelectGroup(group)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                            <p className="text-xs text-slate-500">{group.participants} participants</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'text' && (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={destinationType === 'group' ? 'Type your group message here...' : 'Type your message here...'}
                  rows={4}
                  className="input-field w-full resize-none"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'image' && (
            <motion.div
              key="image"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Image</label>
                <div className="relative">
                  <Upload className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="input-field w-full pl-12 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Caption (optional)</label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a caption..."
                  className="input-field w-full"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'document' && (
            <motion.div
              key="document"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Document</label>
                <div className="relative">
                  <Upload className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="input-field w-full pl-12 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a description..."
                  className="input-field w-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-center gap-2 p-3 rounded-lg border ${getResultStyle(result.type)}`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm flex-1 font-semibold">{result.message}</span>
              {result.type === 'subscription' && (
                <button 
                  onClick={() => navigate('/subscription')}
                  className="text-xs underline hover:text-blue-800 font-bold"
                >
                  Upgrade
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            if (activeTab === 'text') handleSendText();
            else if (activeTab === 'image') handleSendMedia('image');
            else handleSendMedia('document');
          }}
          disabled={loading || !isConnected || countdown > 0}
          className={`w-full btn-primary flex items-center justify-center gap-2 ${
            (loading || !isConnected || countdown > 0) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : countdown > 0 ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              Wait {countdown}s
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send {activeTab === 'text' ? 'Message' : activeTab} to {destinationType === 'group' ? 'Group' : 'Contact'}
            </>
          )}
        </button>

        {!isConnected && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm">
            <span>⚠️ WhatsApp not connected. Please scan QR code first.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default SendMessageForm;
