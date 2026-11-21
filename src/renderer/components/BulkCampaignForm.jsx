import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Upload, FileText, Image as ImageIcon, Send, Play, Pause, 
  Trash2, X, Users, AlertCircle, CheckCircle2, RefreshCw, Layers,
  Search
} from 'lucide-react';
import { getContacts, sendMessage, sendLocalMedia, getGroupInfo } from '../services/api';

export default function BulkCampaignForm({ isConnected, rateLimit, onCampaignComplete }) {
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [whitelistSearch, setWhitelistSearch] = useState('');

  const filteredWhitelistedContacts = contacts.filter(c => 
    (c.name && c.name.toLowerCase().includes(whitelistSearch.toLowerCase())) ||
    (c.number && c.number.includes(whitelistSearch))
  );
  
  // Input fields
  const [contactSource, setContactSource] = useState('list'); // 'list' | 'manual' | 'csv' | 'groups'
  const [manualNumbers, setManualNumbers] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [parsedCsvCount, setParsedCsvCount] = useState(0);
  const [parsedCsvNumbers, setParsedCsvNumbers] = useState([]);
  
  // WhatsApp Groups
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  const filteredGroups = groups.filter(g => 
    (g.name && g.name.toLowerCase().includes(groupSearch.toLowerCase())) ||
    (g.id && g.id.toLowerCase().includes(groupSearch.toLowerCase()))
  );

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
    if (isConnected && contactSource === 'groups' && groups.length === 0) {
      loadGroups();
    }
  }, [isConnected, contactSource]);

  const handleSelectAllGroups = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(groups.map(g => g.id));
    }
  };

  const handleToggleGroupSelection = (groupId) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
    } else {
      setSelectedGroups(prev => [...prev, groupId]);
    }
  };
  
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'image' | 'document'
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [useAntiSpamRef, setUseAntiSpamRef] = useState(true);
  const [safetyDelay, setSafetyDelay] = useState(2); // in seconds
  
  // Campaign Execution State
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [campaignPaused, setCampaignPaused] = useState(false);
  const [currentRecipientIndex, setCurrentRecipientIndex] = useState(0);
  const [recipientsList, setRecipientsList] = useState([]);
  const [campaignLogs, setCampaignLogs] = useState([]); // [{ number, status, error }]
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const abortControllerRef = useRef(null);
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const delayRef = useRef(2);

  // Sync safety delay ref
  useEffect(() => {
    delayRef.current = safetyDelay;
  }, [safetyDelay]);

  // Load contacts
  const loadWhitelistedContacts = async () => {
    if (!isConnected) return;
    setLoadingContacts(true);
    try {
      const data = await getContacts();
      if (data.success) {
        // Deduplicate by contact.id to prevent React duplicate-key warning
        const unique = [...new Map((data.contacts || []).map(c => [c.id, c])).values()];
        setContacts(unique);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    loadWhitelistedContacts();
  }, [isConnected]);

  // File parsing (CSV or TXT)
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      // Parse out numbers matching standard lengths (e.g. 10 to 15 digits)
      const matches = text.match(/\b(?:\+?91)?[6789]\d{9}\b/g) || [];
      const uniqueNumbers = [...new Set(matches.map(num => {
        // Clean up formatting
        let cleaned = num.replace(/[^0-9]/g, '');
        if (!cleaned.startsWith('91') && cleaned.length === 10) {
          cleaned = '91' + cleaned;
        }
        return cleaned;
      }))];
      
      setParsedCsvNumbers(uniqueNumbers);
      setParsedCsvCount(uniqueNumbers.length);
    };
    reader.readAsText(file);
  };

  // Select all whitelisted contacts
  const handleSelectAllContacts = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.number));
    }
  };

  const handleToggleContactSelection = (num) => {
    if (selectedContacts.includes(num)) {
      setSelectedContacts(prev => prev.filter(n => n !== num));
    } else {
      setSelectedContacts(prev => [...prev, num]);
    }
  };

  // Compile final recipient list
  const getCompiledRecipients = () => {
    if (contactSource === 'list') {
      return selectedContacts;
    } else if (contactSource === 'groups') {
      return selectedGroups;
    } else if (contactSource === 'manual') {
      const parsed = manualNumbers.match(/\b(?:\+?91)?[6789]\d{9}\b/g) || [];
      return [...new Set(parsed.map(num => {
        let cleaned = num.replace(/[^0-9]/g, '');
        if (!cleaned.startsWith('91') && cleaned.length === 10) {
          cleaned = '91' + cleaned;
        }
        return cleaned;
      }))];
    } else {
      return parsedCsvNumbers;
    }
  };

  // Run Delay helper
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Run Campaign Loops
  const startCampaign = async () => {
    const list = getCompiledRecipients();
    if (list.length === 0) {
      alert('Please select or upload at least one valid recipient.');
      return;
    }

    if (!message && activeTab === 'text') {
      alert('Please enter a message body.');
      return;
    }

    if (!selectedFile && activeTab !== 'text') {
      alert('Please upload a media file.');
      return;
    }

    setRecipientsList(list);
    setCampaignLogs(list.map(num => ({ number: num, status: 'pending' })));
    setSuccessCount(0);
    setFailedCount(0);
    setCurrentRecipientIndex(0);
    setCampaignRunning(true);
    setCampaignPaused(false);

    isRunningRef.current = true;
    isPausedRef.current = false;

    // Prepare Base64 payload if media campaign
    let base64File = null;
    if (selectedFile) {
      base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
      });
    }

    // Abort controller
    abortControllerRef.current = new AbortController();

    // Execute sequential campaign sending
    executeSendingLoop(list, base64File);
  };

  const executeSendingLoop = async (list, base64File) => {
    let index = currentRecipientIndex;
    let localSuccess = successCount;
    let localFailed = failedCount;

    while (index < list.length && isRunningRef.current) {
      // Check pause state
      if (isPausedRef.current) {
        setCurrentRecipientIndex(index);
        setSuccessCount(localSuccess);
        setFailedCount(localFailed);
        return;
      }

      const recipient = list[index];
      
      // Update individual row status to 'sending'
      setCampaignLogs(prev => prev.map((log, i) => i === index ? { ...log, status: 'sending' } : log));
      
      try {
        if (activeTab === 'text') {
          const finalMessage = useAntiSpamRef 
            ? message + `\n\n[Ref: ${Math.floor(1000 + Math.random() * 9000)}]`
            : message;
          await sendMessage(recipient, finalMessage);
        } else {
          // Send media with POST
          await sendLocalMedia(
            recipient,
            message,
            base64File,
            selectedFile.name,
            selectedFile.type
          );
        }

        localSuccess++;
        setSuccessCount(localSuccess);
        setCampaignLogs(prev => prev.map((log, i) => i === index ? { ...log, status: 'success' } : log));
      } catch (err) {
        localFailed++;
        setFailedCount(localFailed);
        setCampaignLogs(prev => prev.map((log, i) => i === index ? { ...log, status: 'failed', error: err.error || err.message || 'Send error' } : log));
      }

      index++;
      setCurrentRecipientIndex(index);

      // Add safety delay interval before next number
      if (index < list.length && isRunningRef.current && !isPausedRef.current) {
        await wait(delayRef.current * 1000);
      }
    }

    // Complete campaign state
    if (index >= list.length) {
      setCampaignRunning(false);
      isRunningRef.current = false;
      if (onCampaignComplete) onCampaignComplete();
    }
  };

  const pauseCampaign = () => {
    isPausedRef.current = true;
    setCampaignPaused(true);
  };

  const resumeCampaign = async () => {
    isPausedRef.current = false;
    setCampaignPaused(false);
    
    // Prepare Base64 payload if media campaign
    let base64File = null;
    if (selectedFile) {
      base64File = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
      });
    }

    executeSendingLoop(recipientsList, base64File);
  };

  const cancelCampaign = () => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    setCampaignRunning(false);
    setCampaignPaused(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // UI Helpers
  const getLogStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'failed':
        return 'text-rose-600 bg-rose-50 border-rose-100';
      case 'sending':
        return 'text-blue-600 bg-blue-50 border-blue-100 animate-pulse';
      default:
        return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  const activeRecipientsCount = getCompiledRecipients().length;
  const progressPercent = recipientsList.length > 0 ? Math.round((currentRecipientIndex / recipientsList.length) * 100) : 0;

  return (
    <motion.div className="glass-card p-6 bg-white shadow-lg rounded-2xl border border-slate-100">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bulk Connect Campaign</h2>
            <p className="text-slate-600 text-sm">Send rich broadcasts safely with smart rate limiters</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!campaignRunning ? (
          <motion.div
            key="config"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* 1. Contact Source selection tabs */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">1. Choose Recipient Source</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  onClick={() => setContactSource('list')}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${contactSource === 'list' ? 'bg-white text-emerald-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Users className="w-4 h-4" /> Whitelist
                </button>
                <button
                  onClick={() => { setContactSource('groups'); loadGroups(); }}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${contactSource === 'groups' ? 'bg-white text-emerald-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Users className="w-4 h-4" /> Groups ({groups.length})
                </button>
                <button
                  onClick={() => setContactSource('manual')}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${contactSource === 'manual' ? 'bg-white text-emerald-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Send className="w-4 h-4" /> Custom List
                </button>
                <button
                  onClick={() => setContactSource('csv')}
                  className={`py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${contactSource === 'csv' ? 'bg-white text-emerald-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <Upload className="w-4 h-4" /> Upload CSV/TXT
                </button>
              </div>
            </div>

            {/* Source configurations */}
            <div className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl">
              {contactSource === 'list' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Whitelisted Contacts ({contacts.length})</span>
                    <button
                      onClick={handleSelectAllContacts}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                    >
                      {selectedContacts.length === contacts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search contacts by name or number..."
                      value={whitelistSearch}
                      onChange={(e) => setWhitelistSearch(e.target.value)}
                      className="input-field w-full pl-10 text-xs py-1.5"
                    />
                  </div>
                  
                  {loadingContacts ? (
                    <div className="flex items-center justify-center p-4">
                      <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                    </div>
                  ) : filteredWhitelistedContacts.length === 0 ? (
                    <div className="text-center p-6 text-slate-500 text-sm bg-white border border-slate-100 rounded-lg">
                      No matching contacts found.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {filteredWhitelistedContacts.map((contact) => (
                        <label
                          key={contact.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedContacts.includes(contact.number)
                              ? 'bg-emerald-50/40 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.number)}
                            onChange={() => handleToggleContactSelection(contact.number)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 w-4 h-4"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{contact.name}</p>
                            <p className="text-xs text-slate-500 font-mono">+{contact.number}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {contactSource === 'groups' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">WhatsApp Groups ({groups.length})</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={loadGroups}
                        disabled={loadingGroups || !isConnected}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                      <button
                        onClick={handleSelectAllGroups}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                      >
                        {selectedGroups.length === groups.length && groups.length > 0 ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search groups by name..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      className="input-field w-full pl-10 text-xs py-1.5"
                    />
                  </div>
                  
                  {loadingGroups ? (
                    <div className="flex items-center justify-center p-6 text-sm text-slate-500 gap-2">
                      <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                      Loading WhatsApp groups...
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="text-center p-6 text-slate-500 text-sm bg-white border border-slate-100 rounded-lg">
                      {groups.length === 0 
                        ? 'No groups found. Please make sure WhatsApp is connected.' 
                        : 'No groups match your search filter.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                      {filteredGroups.map((group) => {
                        const isChecked = selectedGroups.includes(group.id);
                        return (
                          <label
                            key={group.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-emerald-50/50 border-emerald-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleGroupSelection(group.id)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 w-4 h-4"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{group.name}</p>
                              <p className="text-xs text-slate-500">{group.participants} participants</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {contactSource === 'manual' && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Enter Phone Numbers</label>
                  <textarea
                    value={manualNumbers}
                    onChange={(e) => setManualNumbers(e.target.value)}
                    placeholder="Enter phone numbers separated by comma or new lines (e.g. +919876543210, +919988776655)"
                    rows={4}
                    className="input-field w-full text-sm font-mono"
                  />
                  <p className="text-xs text-slate-500">Provide complete numbers with country code (+91 for India).</p>
                </div>
              )}

              {contactSource === 'csv' && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">Upload Database File</label>
                  <div className="border-2 border-dashed border-slate-300/80 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors cursor-pointer relative bg-white">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleCsvUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">Click to upload or drag & drop CSV / TXT</p>
                    <p className="text-xs text-slate-500 mt-1">Accepts comma or newline separated files. Numbers are parsed automatically.</p>
                  </div>
                  {csvFile && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">{csvFile.name}</p>
                          <p className="text-xs text-emerald-600 font-bold">{parsedCsvCount} unique numbers loaded</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setCsvFile(null); setParsedCsvNumbers([]); setParsedCsvCount(0); }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Rich Campaign Message editor */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">2. Compose Campaign Broadcast</label>
              
              <div className="flex gap-2">
                <button
                  onClick={() => { setActiveTab('text'); setSelectedFile(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'text' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'}`}
                >
                  <FileText className="w-4 h-4" /> Text Message
                </button>
                <button
                  onClick={() => { setActiveTab('image'); setSelectedFile(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'image' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'}`}
                >
                  <ImageIcon className="w-4 h-4" /> Image Broadcast
                </button>
                <button
                  onClick={() => { setActiveTab('document'); setSelectedFile(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'document' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'}`}
                >
                  <FileText className="w-4 h-4" /> PDF/Doc Broadcast
                </button>
              </div>

              <div className="space-y-4">
                {activeTab !== 'text' && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Attach {activeTab === 'image' ? 'Image' : 'Document'}</label>
                    <input
                      type="file"
                      accept={activeTab === 'image' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.txt'}
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      className="input-field w-full file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-600 hover:file:bg-emerald-100 cursor-pointer"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{activeTab === 'text' ? 'Message Body' : 'Caption / Description'}</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter broadcast message. TIP: Spintax or variation codes are supported..."
                    rows={4}
                    className="input-field w-full resize-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 3. Anti-Spam Safety controls */}
            <div className="p-4 border border-amber-200/50 bg-amber-50/20 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-bold">Anti-Spam Safety Buffer</span>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">{safetyDelay} seconds</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={safetyDelay}
                onChange={(e) => setSafetyDelay(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <p className="text-xs text-slate-600 mt-2">
                We will enforce a {safetyDelay}s randomized delay between each message send cycle to secure your connection and completely avoid automated flag detection.
              </p>
              <div className="mt-4 pt-3 border-t border-amber-200/40 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="antiSpamRef"
                  checked={useAntiSpamRef}
                  onChange={(e) => setUseAntiSpamRef(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 border-amber-300 w-4 h-4 mt-0.5"
                />
                <label htmlFor="antiSpamRef" className="text-xs text-slate-700 font-medium select-none cursor-pointer">
                  <span className="font-bold text-amber-850">Add Smart Reference Tag:</span> Appends a unique, randomized `[Ref: XXXX]` identifier to each text message. This keeps your broadcasts looking unique to WhatsApp's server algorithms, significantly reducing spam detection rates!
                </label>
              </div>
            </div>

            {/* Execute Launch Button */}
            <button
              onClick={startCampaign}
              disabled={!isConnected || activeRecipientsCount === 0}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
                (!isConnected || activeRecipientsCount === 0)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              <Send className="w-5 h-5" />
              Launch Broadcast Campaign to {activeRecipientsCount} Contacts
            </button>
          </motion.div>
        ) : (
          /* Live campaign execution console */
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Progress metric ring */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 border border-slate-100 rounded-2xl bg-slate-50/50">
              <div className="flex items-center gap-6">
                {/* SVG circular loader */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="40" cy="40" r="34" className="stroke-slate-200" strokeWidth="6" fill="transparent" />
                    <circle cx="40" cy="40" r="34" className="stroke-emerald-500 transition-all duration-300" strokeWidth="6" strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - progressPercent / 100)} strokeLinecap="round" fill="transparent" />
                  </svg>
                  <span className="absolute text-sm font-extrabold text-slate-800">{progressPercent}%</span>
                </div>
                
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-800">
                    {campaignPaused ? 'Campaign Paused' : currentRecipientIndex >= recipientsList.length ? 'Campaign Completed' : 'Sending Broadcast...'}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Processed {currentRecipientIndex} of {recipientsList.length} numbers</p>
                </div>
              </div>

              {/* Status grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="px-5 py-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl text-center">
                  <p className="text-xs font-semibold text-emerald-600 uppercase">Success</p>
                  <p className="text-xl font-black text-emerald-700">{successCount}</p>
                </div>
                <div className="px-5 py-2.5 bg-rose-50/60 border border-rose-100 rounded-xl text-center">
                  <p className="text-xs font-semibold text-rose-600 uppercase">Failed</p>
                  <p className="text-xl font-black text-rose-700">{failedCount}</p>
                </div>
              </div>
            </div>

            {/* Campaign Logs terminal window */}
            <div className="space-y-2 text-left">
              <label className="block text-sm font-semibold text-slate-700">Campaign Activity Console</label>
              <div className="h-60 overflow-y-auto border border-slate-200 rounded-xl p-4 bg-slate-900 text-slate-200 font-mono text-xs space-y-1.5">
                {campaignLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-800/40 pb-1 flex-wrap gap-2">
                    <span className="text-slate-400">
                      [Row {idx + 1}] <span className="text-white font-bold">+{log.number}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold ${getLogStatusBadge(log.status)}`}>
                        {log.status}
                      </span>
                      {log.error && (
                        <span className="text-rose-400 max-w-[200px] truncate text-[10px]">
                          ({log.error})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaign controls bar */}
            <div className="flex gap-2">
              {campaignPaused ? (
                <button
                  onClick={resumeCampaign}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
                >
                  <Play className="w-5 h-5" /> Resume Campaign
                </button>
              ) : currentRecipientIndex < recipientsList.length ? (
                <button
                  onClick={pauseCampaign}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/10"
                >
                  <Pause className="w-5 h-5" /> Pause Campaign
                </button>
              ) : null}

              <button
                onClick={cancelCampaign}
                className="py-3 px-6 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" /> Close Console
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
