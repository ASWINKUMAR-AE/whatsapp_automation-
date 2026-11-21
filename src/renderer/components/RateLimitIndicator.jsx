import { motion } from 'framer-motion';
import { Clock, Zap, Crown, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

function RateLimitIndicator({ rateLimit, subscription }) {
  const sub = subscription || rateLimit;
  
  if (!sub) return null;

  const dailyLimit = sub.dailyLimit || 50;
  const remaining = sub.remaining !== undefined ? sub.remaining : (dailyLimit - (sub.sentToday || 0));
  const dailyPercent = ((dailyLimit - remaining) / dailyLimit) * 100;
  const canSend = sub.canSend !== false;

  const getColor = (percent) => {
    if (percent < 50) return 'bg-emerald-500';
    if (percent < 80) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 rounded-xl glass-card bg-white"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {sub.plan === 'premium' ? (
            <Crown className="w-4 h-4 text-amber-600" />
          ) : (
            <Zap className="w-4 h-4 text-blue-600" />
          )}
          <span className="text-sm font-bold text-slate-800">
            {sub.plan === 'premium' ? 'Premium Plan' : 'Free Plan'} Limits
          </span>
        </div>
        
        {!canSend && (
          <Link 
            to="/subscription" 
            className="flex items-center gap-1 text-xs text-amber-650 hover:text-amber-700 font-semibold"
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Upgrade to continue
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <div className="flex justify-between text-xs text-slate-650 mb-1 font-semibold">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-500" />
              Daily Messages
            </span>
            <span className="text-slate-800 font-bold">{remaining} / {dailyLimit}</span>
          </div>
          <div className="h-2.5 bg-slate-100 border border-slate-200/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dailyPercent}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full ${getColor(dailyPercent)} rounded-full`}
            />
          </div>
        </div>
      </div>

      {sub.plan !== 'premium' && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <Link 
            to="/subscription" 
            className="text-xs text-blue-650 hover:text-blue-700 flex items-center gap-1 font-semibold"
          >
            <Crown className="w-3 h-3 text-amber-500" />
            Upgrade to Premium for 500 messages/day
          </Link>
        </div>
      )}
    </motion.div>
  );
}

export default RateLimitIndicator;
