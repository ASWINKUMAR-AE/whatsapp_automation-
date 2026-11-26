import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Activity, ChevronDown, ChevronUp, RefreshCw, 
  CheckCircle, MessageSquare, Shield, Send, Inbox, Database, ChevronLeft
} from 'lucide-react';
import { getStatus } from '../services/api';

export default function SessionLogsView({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  const fetchSessionLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/sessions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions || []);
      } else {
        setError(data.error || 'Failed to fetch session history');
      }
    } catch (err) {
      console.error(err);
      setError('Network error loading session logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionLogs();
  }, []);

  const toggleSession = (id) => {
    if (expandedSessionId === id) {
      setExpandedSessionId(null);
    } else {
      setExpandedSessionId(id);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Active Session';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' at ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDuration = (start, end) => {
    if (!end) return 'Ongoing';
    const diffMs = new Date(end) - new Date(start);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Less than a minute';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  };

  return (
    <div className="glass-card p-6 shadow-xl bg-white border border-slate-100 rounded-3xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-850">Session Activity Logs</h2>
            <p className="text-sm text-slate-500">Self-contained local SQLite audit audit trail</p>
          </div>
        </div>

        <button
          onClick={fetchSessionLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <RefreshCw className="w-10 h-10 animate-spin mb-4 text-blue-500" />
          <p className="font-medium text-slate-500">Querying SQLite session history...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Clock className="w-12 h-12 text-slate-350 mb-3" />
          <h3 className="font-semibold text-slate-700">No Sessions Found</h3>
          <p className="text-sm text-slate-500 max-w-xs mt-1">Your session logs will be logged locally as you interact with WhatsApp Automation.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
          {sessions.map((session) => {
            const isExpanded = expandedSessionId === session.id;
            const isActive = !session.logoutTime;

            return (
              <div 
                key={session.id}
                className={`border rounded-2xl transition-all duration-250 ${
                  isActive 
                    ? 'border-emerald-250 bg-emerald-50/10 shadow-sm' 
                    : isExpanded 
                      ? 'border-blue-200 bg-blue-50/5' 
                      : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                {/* Header Clickable Row */}
                <div 
                  onClick={() => toggleSession(session.id)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer select-none gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
                      isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-150 text-slate-500'
                    }`}>
                      <Activity className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">
                          {formatDate(session.loginTime)}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Active Now
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>Duration: {getDuration(session.loginTime, session.logoutTime)}</span>
                        <span>•</span>
                        <span>Session ID: #{session.id}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-end md:self-auto">
                    {/* Sent & Received Counters */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-650" title="Messages Sent">
                        <Send className="w-3 h-3 text-blue-500" />
                        <span>Sent: {session.messagesSent}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-650" title="Messages Received">
                        <Inbox className="w-3 h-3 text-indigo-500" />
                        <span>Recv: {session.messagesReceived}</span>
                      </div>
                    </div>

                    <div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Session Audit Panel */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-dashed border-slate-100"
                    >
                      <div className="p-4 bg-slate-50/50">
                        <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Audit Action Trail</span>
                        </div>

                        {session.actions?.length === 0 ? (
                          <p className="text-sm text-slate-450 italic p-2">No auditable actions recorded in this session.</p>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto font-mono text-xs text-slate-600 bg-slate-900 text-slate-200 p-4 rounded-xl shadow-inner leading-relaxed">
                            {session.actions.map((action, i) => (
                              <div key={i} className="flex gap-2 hover:bg-slate-800 p-0.5 rounded transition-colors">
                                <span className="text-blue-400 select-none">&gt;</span>
                                <span className="break-all">{action}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
