import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, RefreshCw, Smartphone, Loader2, Clock } from 'lucide-react';

function QRSection({ qrCode, isGenerating, onRefresh }) {
  const [countdown, setCountdown] = useState(30);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleTriggerRefresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefresh]);

  // Reset countdown when a fresh QR code arrives
  useEffect(() => {
    if (qrCode) {
      setCountdown(30);
    }
  }, [qrCode]);

  const handleTriggerRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setCountdown(30);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error('Failed to trigger QR refresh:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  return (
    <motion.div className="glass-card p-6 md:p-8 bg-white border border-slate-100 shadow-xl rounded-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600">
            <QrCode className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Connect WhatsApp</h2>
            <p className="text-slate-500 text-sm">Scan the QR code to link your phone</p>
          </div>
        </div>

        {/* Refresh Timer & Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Auto-refresh: <strong className="text-blue-600 font-mono text-sm">{countdown}s</strong></span>
          </div>

          <button
            onClick={handleTriggerRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 text-xs font-bold transition-all disabled:opacity-50"
            title="Refresh QR Code now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center">
        {/* QR Code Container */}
        {qrCode ? (
          <motion.div 
            className="relative p-5 bg-white rounded-3xl border-2 border-slate-200 shadow-md flex flex-col items-center"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <img 
              src={qrCode} 
              alt="WhatsApp QR Code" 
              className="w-64 h-64 object-contain rounded-xl select-none"
            />
            <div className="absolute inset-5 border-2 border-dashed border-blue-400/25 rounded-2xl pointer-events-none" />

            {/* Countdown Progress indicator */}
            <div className="w-full mt-3 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(countdown / 30) * 100}%` }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div 
            className="w-64 h-64 p-6 bg-slate-50 border-2 border-dashed border-blue-200 rounded-3xl flex flex-col items-center justify-center text-center shadow-inner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-base font-bold text-slate-800">Generating QR Code...</p>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">Starting WhatsApp engine. Your QR code will appear here automatically.</p>
          </motion.div>
        )}

        <div className="mt-6 flex items-center gap-2 text-slate-600 text-sm font-semibold">
          <Smartphone className="w-4 h-4 text-blue-600" />
          <span>Open WhatsApp → Settings → Linked Devices → Link a Device</span>
        </div>

        <div className="mt-3 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 py-1.5 px-4 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Permanently waiting for scan • Refreshes every 30s</span>
        </div>
      </div>

      {/* Instructions list */}
      <div className="mt-8 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">How to link your WhatsApp:</h3>
        <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside font-medium leading-relaxed">
          <li>Open <strong>WhatsApp</strong> on your mobile phone</li>
          <li>Tap <strong>Settings</strong> (iOS) or <strong>Three Dots Menu</strong> (Android)</li>
          <li>Select <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong></li>
          <li>Point your phone camera at this screen to scan the QR code</li>
        </ol>
      </div>
    </motion.div>
  );
}

export default QRSection;