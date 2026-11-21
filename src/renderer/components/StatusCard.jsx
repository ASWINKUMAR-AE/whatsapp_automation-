import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2, CheckCircle, LogOut } from 'lucide-react';
import { useState } from 'react';

function StatusCard({ status, isReady, qrCode, onLogoutDevice }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout this device? This will wipe the session and require scanning a new QR code.')) {
      setIsLoggingOut(true);
      try {
        await onLogoutDevice();
      } catch (err) {
        console.error('Logout failed:', err);
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50 border border-emerald-100',
          label: 'Connected',
          description: 'WhatsApp is ready to use',
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-600',
          bg: 'bg-red-50 border border-red-100',
          label: 'Disconnected',
          description: 'Please refresh to reconnect',
        };
      case 'qr':
        return {
          icon: Loader2,
          color: 'text-amber-600',
          bg: 'bg-amber-50 border border-amber-100',
          label: 'QR Code Ready',
          description: 'Scan to connect your phone',
        };
      default:
        return {
          icon: Loader2,
          color: 'text-blue-600',
          bg: 'bg-blue-50 border border-blue-100',
          label: 'Connecting...',
          description: 'Initializing WhatsApp client',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-4 flex items-center justify-between bg-white"
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl flex items-center justify-center ${config.bg}`}>
          {status === 'connecting' ? (
            <Icon className={`w-6 h-6 ${config.color} animate-spin`} />
          ) : (
            <Icon className={`w-6 h-6 ${config.color}`} />
          )}
        </div>
        <div>
          <p className={`text-lg font-bold ${config.color}`}>{config.label}</p>
          <p className="text-sm text-slate-600 font-medium">{config.description}</p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-all flex items-center gap-2 text-sm border border-red-200 group font-semibold"
        title="Logout device / Switch account"
      >
        {isLoggingOut ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
        )}
        <span className="hidden sm:inline">Logout Device</span>
      </button>
    </motion.div>
  );
}

export default StatusCard;