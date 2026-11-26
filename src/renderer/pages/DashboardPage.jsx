import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import logoUrl from '../../assets/wp_logo.svg';
import { 
  MessageSquare, 
  User, 
  Shield, 
  Crown, 
  CreditCard, 
  XCircle, 
  Zap, 
  Loader2,
  CheckCircle,
  MessageCircle,
  Activity,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getStatus, getLogs, reconnectWhatsApp, logoutDevice, refreshQR } from '../services/api';
import socketService from '../services/socket';
import StatusCard from '../components/StatusCard';
import QRSection from '../components/QRSection';
import SendMessageForm from '../components/SendMessageForm';
import LogsPanel from '../components/LogsPanel';
import StatsCards from '../components/StatsCards';
import WarningBanner from '../components/WarningBanner';
import RateLimitIndicator from '../components/RateLimitIndicator';
import ContactsView from '../components/ContactsView';
import BulkCampaignForm from '../components/BulkCampaignForm';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState({
    status: 'connecting',
    isReady: false,
    qrCode: null,
    stats: { 
      totalSent: 0, 
      totalFailed: 0,
      sentToday: 0,
      subscription: {
        plan: 'free',
        dailyLimit: 'Unlimited',
        remaining: 'Unlimited',
        canSend: true
      },
      rateLimit: { hourlyLimit: 'Unlimited', dailyLimit: 'Unlimited', hourlyRemaining: 'Unlimited', dailyRemaining: 'Unlimited' }
    },
    warnings: []
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFeatureTab, setActiveFeatureTab] = useState('compose');
  const [initialRecipient, setInitialRecipient] = useState('');

  // Auto-Updater status states
  const [updateStatus, setUpdateStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateErrorMsg, setUpdateErrorMsg] = useState('');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable((info) => {
        setUpdateStatus('available');
        setUpdateInfo(info);
      });
      window.electronAPI.onUpdateNotAvailable((info) => {
        setUpdateStatus('not-available');
        setUpdateInfo(info);
      });
      window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateStatus('downloaded');
        setUpdateInfo(info);
      });
      window.electronAPI.onUpdateError((err) => {
        setUpdateStatus('error');
        setUpdateErrorMsg(err || 'Update check failed');
      });
    }
  }, []);

  const handleCheckForUpdates = () => {
    if (window.electronAPI) {
      setUpdateStatus('checking');
      window.electronAPI.checkForUpdates();
    } else {
      setUpdateStatus('error');
      setUpdateErrorMsg('Not running inside desktop shell.');
    }
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI) {
      window.electronAPI.installUpdate();
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getStatus();
      setStatus(prev => ({
        ...prev,
        ...data,
        stats: { ...prev.stats, ...data.stats }
      }));
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await getLogs();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchLogs();

    socketService.connect();

    socketService.on('ready', () => {
      fetchStatus();
    });

    socketService.on('disconnected', () => {
      fetchStatus();
    });

    socketService.on('qr', ({ qr }) => {
      setStatus(prev => ({ ...prev, qrCode: qr, status: 'qr' }));
    });

    socketService.on('message', (message) => {
      setLogs(prev => [message, ...prev].slice(0, 50));
      fetchStatus();
    });

    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 5000);

    return () => {
      clearInterval(interval);
      socketService.disconnect();
    };
  }, [fetchStatus, fetchLogs]);

  const handleReconnect = async () => {
    try {
      setStatus(prev => ({ ...prev, status: 'connecting' }));
      await reconnectWhatsApp();
    } catch (error) {
      console.error('Failed to reconnect:', error);
      setStatus(prev => ({ ...prev, status: 'disconnected' }));
    }
  };

  const handleRefreshQR = async () => {
    try {
      const data = await refreshQR();
      if (data && data.qrCode) {
        setStatus(prev => ({ ...prev, qrCode: data.qrCode, status: 'qr' }));
      } else {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Failed to refresh QR:', err);
      handleReconnect();
    }
  };

  const handleLogoutDevice = async () => {
    try {
      setStatus(prev => ({ 
        ...prev, 
        isReady: false,
        status: 'connecting',
        qrCode: null,
      }));
      // Clear logs immediately for better UX
      setLogs([]);
      await logoutDevice();
      setTimeout(fetchStatus, 1500);
    } catch (error) {
      console.error('Failed to logout device:', error);
      fetchStatus();
    }
  };

  const handleMessageSent = () => {
    fetchStatus();
    fetchLogs();
  };

  const getConnectionDisplay = () => {
    const statusMap = {
      connected: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Connected', icon: CheckCircle },
      disconnected: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Disconnected', icon: XCircle },
      qr: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Scan QR', icon: Loader2 },
      connecting: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Connecting...', icon: Loader2 },
    };
    return statusMap[status.status] || statusMap.connecting;
  };

  const connStatus = getConnectionDisplay();
  const StatusIcon = connStatus.icon;
  
  const currentPlan = user?.subscription?.plan || 'free';
  const isPremium = currentPlan === 'premium';

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-900">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-60" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-sky-100 rounded-full blur-3xl opacity-40" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between mb-6"
        >
          <div className="flex items-center gap-3.5">
            <img 
              src={logoUrl} 
              alt="WhatsApp Automation" 
              className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-2xl shadow-md shadow-emerald-500/15 shrink-0" 
            />
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl md:text-3xl font-extrabold gradient-text tracking-tight leading-tight">
                WhatsApp Automation
              </h1>
              <p className="text-slate-500 text-xs md:text-sm font-medium">
                Desktop Automation
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 border border-slate-200">
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">{user?.name || 'Local User'}</span>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {status.warnings?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              {status.warnings.map((warning, index) => (
                <WarningBanner key={index} warning={warning} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <StatsCards stats={status.stats} loading={loading} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {!status.isReady ? (
                <motion.div
                  key="qr-section"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                >
                  <QRSection 
                    qrCode={status.qrCode} 
                    isGenerating={!status.qrCode || status.status === 'connecting'}
                    onRefresh={handleRefreshQR}
                  />
                </motion.div>
              ) : (
                <div key="features" className="space-y-4">
                    {status.isReady && (
                      <StatusCard 
                        status={status.status} 
                        isReady={status.isReady} 
                        qrCode={status.qrCode}
                        onLogoutDevice={handleLogoutDevice}
                      />
                    )}
                    
                    <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-300/35 w-fit flex-wrap gap-1">
                    <button 
                      onClick={() => setActiveFeatureTab('compose')} 
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeFeatureTab === 'compose' ? 'bg-white text-blue-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      <MessageCircle className="w-4 h-4" /> Compose
                    </button>
                    <button 
                      onClick={() => setActiveFeatureTab('bulk')} 
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeFeatureTab === 'bulk' ? 'bg-white text-emerald-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      <Zap className="w-4 h-4" /> Bulk Campaign
                    </button>
                    <button 
                      onClick={() => setActiveFeatureTab('contacts')} 
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeFeatureTab === 'contacts' ? 'bg-white text-indigo-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      <User className="w-4 h-4" /> My Contacts
                    </button>
                    <button 
                      onClick={() => setActiveFeatureTab('sessions')} 
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeFeatureTab === 'sessions' ? 'bg-white text-cyan-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      <Activity className="w-4 h-4" /> Session Logs
                    </button>
                  </div>
                  
                  <AnimatePresence mode="wait">
                    {activeFeatureTab === 'compose' && (
                      <motion.div
                        key="compose"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <SendMessageForm 
                          onMessageSent={handleMessageSent} 
                          isConnected={status.isReady}
                          rateLimit={status.stats?.subscription}
                          initialRecipient={initialRecipient}
                          onLogoutDevice={handleLogoutDevice}
                        />
                      </motion.div>
                    )}
                    
                    {activeFeatureTab === 'contacts' && (
                      <motion.div
                        key="contacts"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="h-[600px]"
                      >
                        <ContactsView onSelectContact={(number) => {
                          setInitialRecipient(number);
                          setActiveFeatureTab('compose');
                        }} />
                      </motion.div>
                    )}

                    {activeFeatureTab === 'sessions' && (
                      <motion.div
                        key="sessions"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <SessionLogsView />
                      </motion.div>
                    )}

                    {activeFeatureTab === 'bulk' && (
                      <motion.div
                        key="bulk"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <BulkCampaignForm 
                          isConnected={status.isReady}
                          rateLimit={status.stats?.subscription}
                          onCampaignComplete={handleMessageSent}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <LogsPanel logs={logs} onRefresh={fetchLogs} />
            
            {/* App Updater Section */}
            <div className="glass-card p-6 shadow-xl bg-white border border-slate-100 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Update Center</h3>
                  <p className="text-xs text-slate-500">Keep WhatsApp Automation updated</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold">Current Version</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-150 text-slate-700 font-bold">v1.0.0</span>
                </div>

                {updateStatus === 'checking' && (
                  <div className="text-xs text-slate-650 flex items-center gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Checking for updates...</span>
                  </div>
                )}

                {updateStatus === 'available' && (
                  <div className="text-xs text-slate-650 flex items-center gap-2 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <CheckCircle className="w-4 h-4 text-emerald-500 animate-bounce" />
                    <span>Update available! Downloading...</span>
                  </div>
                )}

                {updateStatus === 'not-available' && (
                  <div className="text-xs text-slate-650 flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>Application is up to date!</span>
                  </div>
                )}

                {updateStatus === 'downloaded' && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-150 space-y-3">
                    <p className="text-xs text-indigo-700 font-medium animate-pulse">New update is ready!</p>
                    <button
                      onClick={handleInstallUpdate}
                      className="w-full py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition-colors"
                    >
                      Restart & Update Now
                    </button>
                  </div>
                )}

                {updateStatus === 'error' && (
                  <div className="text-xs text-red-600 p-3 bg-red-50/50 rounded-xl border border-red-100 break-words space-y-2">
                    <p className="font-semibold">Update check failed:</p>
                    <p className="opacity-90">{updateErrorMsg}</p>
                    <button 
                      onClick={() => setUpdateStatus('idle')}
                      className="text-xs text-blue-600 hover:underline block font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {updateStatus === 'idle' && (
                  <button
                    onClick={handleCheckForUpdates}
                    className="w-full py-3 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Check for Updates
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-slate-500 text-sm font-medium"
        >
          <p className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Production Ready • Rate Limited • Anti-Spam Protected
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
