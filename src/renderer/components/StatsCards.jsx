import { motion } from 'framer-motion';
import { Send, AlertCircle, TrendingUp, CheckCircle, Zap } from 'lucide-react';

function StatsCards({ stats, loading }) {
  const subscription = stats?.subscription || {};
  
  const statCards = [
    {
      label: 'Sent Today',
      value: subscription.sentToday || stats?.sentToday || 0,
      icon: TrendingUp,
      gradient: 'from-purple-400 to-pink-500',
      bg: 'bg-purple-50 border border-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Total Sent',
      value: stats?.totalSent || 0,
      icon: Zap,
      gradient: 'from-blue-400 to-indigo-500',
      bg: 'bg-blue-50 border border-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Failed',
      value: stats?.totalFailed || 0,
      icon: AlertCircle,
      gradient: 'from-rose-400 to-red-500',
      bg: 'bg-rose-50 border border-rose-100',
      iconColor: 'text-rose-600',
    },
    {
      label: 'System Status',
      value: 'Active',
      icon: CheckCircle,
      gradient: 'from-emerald-400 to-teal-500',
      bg: 'bg-emerald-50 border border-emerald-100',
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-card p-4 relative overflow-hidden group bg-white"
        >
          <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${card.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
          
          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-slate-600 text-xs font-semibold mb-1">{card.label}</p>
              <p className="text-xl font-bold text-slate-900">
                {loading ? (
                  <span className="animate-pulse bg-slate-200 rounded h-6 w-12 inline-block" />
                ) : (
                  card.value
                )}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default StatsCards;
