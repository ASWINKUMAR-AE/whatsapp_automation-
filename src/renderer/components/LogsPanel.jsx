import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, Send, Clock, Filter, Search, 
  ArrowUpRight, ArrowDownLeft, RefreshCw
} from 'lucide-react';

function LogsPanel({ logs }) {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.type !== filter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        (log.text || '').toLowerCase().includes(search) ||
        (log.contactName || '').toLowerCase().includes(search) ||
        (log.recipient || '').toLowerCase().includes(search) ||
        (log.from || '').toLowerCase().includes(search) ||
        (log.to || '').toLowerCase().includes(search)
      );
    }
    return true;
  });

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const getDisplayName = (log) => {
    if (log.contactName) return log.contactName;
    
    const number = log.recipient || log.from || log.to || 'Unknown';
    if (typeof number === 'string') {
      return number.replace('@c.us', '').replace('@g.us', '');
    }
    return 'Unknown';
  };

  return (
    <motion.div
      className="glass-card p-5 h-full bg-white"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-50 border border-purple-100">
            <MessageCircle className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Live Logs</h3>
            <p className="text-xs text-slate-600 font-semibold">{logs.length} messages</p>
          </div>
        </div>
        <button className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search messages..."
            className="input-field w-full pl-10 py-2 text-sm"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4">
        {['all', 'sent', 'received'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === f
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {filteredLogs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-slate-500"
            >
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-400" />
              <p className="text-sm font-semibold">No messages yet</p>
            </motion.div>
          ) : (
            filteredLogs.map((log, index) => (
              <motion.div
                key={log._id || `${log.id}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className={`p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                  log.type === 'sent'
                    ? 'bg-blue-50/30 border-blue-100 hover:bg-blue-50/60'
                    : 'bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      log.type === 'sent' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {log.type === 'sent' ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownLeft className="w-3 h-3" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                        {getDisplayName(log)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold">
                        {formatDate(log.timestamp)} • {formatTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    log.type === 'sent' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {log.type}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700 font-semibold line-clamp-2">
                  {log.text || '[Media Message]'}
                </p>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {filteredLogs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 font-semibold">
          <span>Showing {filteredLogs.length} of {logs.length}</span>
          <button 
            onClick={() => { setFilter('all'); setSearchTerm(''); }}
            className="hover:text-blue-600 font-semibold transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default LogsPanel;