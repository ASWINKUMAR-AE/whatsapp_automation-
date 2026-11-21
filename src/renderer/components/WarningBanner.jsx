import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

function WarningBanner({ warning }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const getWarningStyle = (type) => {
    switch (type) {
      case 'limit':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          icon: 'text-amber-600',
          text: 'text-amber-700',
        };
      case 'spam':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          text: 'text-red-700',
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          text: 'text-red-700',
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          text: 'text-blue-700',
        };
    }
  };

  const style = getWarningStyle(warning.type);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`flex items-center justify-between p-4 rounded-xl ${style.bg} border ${style.border}`}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className={`w-5 h-5 ${style.icon}`} />
        <div>
          <p className={`text-sm font-semibold ${style.text}`}>{warning.message}</p>
          {warning.code && (
            <p className="text-xs text-slate-505 mt-0.5">Code: {warning.code}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
      >
        <X className="w-4 h-4 text-slate-500" />
      </button>
    </motion.div>
  );
}

export default WarningBanner;