import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Loader2, AlertCircle, Sparkles, Upload, QrCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSubscriptionPlans, uploadPayment, getAdminPayments, approvePayment } from '../services/api';

export default function SubscriptionPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState(null);
  
  // File Upload State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [screenshot, setScreenshot] = useState(null);

  // Admin State
  const [adminPayments, setAdminPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' or 'admin'

  const { user, refreshUser } = useAuth();
  const isAdmin = user?.isAdmin || false; // Ensure isAdmin is handled properly in backend auth

  useEffect(() => {
    fetchPlans();
    if (isAdmin) {
      fetchAdminPayments();
    }
  }, [isAdmin]);

  const fetchPlans = async () => {
    try {
      const data = await getSubscriptionPlans();
      setPlans(data.plans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminPayments = async () => {
    try {
      const data = await getAdminPayments();
      setAdminPayments(data.payments);
    } catch (error) {
      console.error('Failed to fetch admin payments:', error);
    }
  };

  const [API_BASE_URL] = useState(import.meta.env.VITE_API_URL || 'http://localhost:3001');

  const handleUploadPayment = async (e) => {
    e.preventDefault();
    if (!screenshot || !selectedPlan) return;
    
    setProcessing(true);
    setMessage(null);

    try {
      const result = await uploadPayment(selectedPlan, 30, screenshot);
      setMessage({ type: 'success', text: result.message });
      setSelectedPlan(null);
      setScreenshot(null);
      await refreshUser();
    } catch (error) {
      setMessage({ type: 'error', text: error.error || 'Upload failed' });
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async (paymentId, status) => {
    setProcessing(paymentId);
    try {
      await approvePayment(paymentId, status);
      fetchAdminPayments();
    } catch (error) {
      alert('Failed to process');
    } finally {
      setProcessing(null);
    }
  };

  const currentPlan = user?.subscription?.plan || 'free';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-900">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-60" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <button 
             onClick={() => window.location.href = '/dashboard'}
             className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-600 font-semibold shadow-sm transition-all"
          >
             ← Back to Dashboard
          </button>
        </div>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-4 shadow-lg shadow-amber-500/10">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold gradient-text mb-4">Subscription Dashboard</h1>
          <p className="text-slate-600 text-lg font-medium">
            Manage your plans and transactions
          </p>
        </motion.div>

        {isAdmin && (
          <div className="flex justify-center mb-8">
            <div className="bg-slate-200/50 p-1 rounded-xl border border-slate-300/35 flex gap-2">
              <button 
                onClick={() => setActiveTab('plans')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${activeTab === 'plans' ? 'bg-white text-blue-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                My Plans
              </button>
              <button 
                onClick={() => setActiveTab('admin')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${activeTab === 'admin' ? 'bg-white text-blue-600 border border-slate-200 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Admin Approvals
              </button>
            </div>
          </div>
        )}

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 p-4 mb-8 rounded-xl ${
              message.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}
          >
            {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-semibold">{message.text}</span>
          </motion.div>
        )}

        {activeTab === 'plans' && (
          <>
            <div className="grid md:grid-cols-2 gap-8">
              {plans.map((plan, index) => {
                const isCurrentPlan = currentPlan === plan.id;
                const isPremium = plan.id === 'premium';

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative glass-card p-8 flex flex-col bg-white ${
                      isPremium 
                        ? 'border-blue-500/50 shadow-md shadow-blue-500/5' 
                        : ''
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-semibold rounded-full shadow-sm">
                          <Sparkles className="w-4 h-4" />
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold gradient-text">₹{plan.price * 80 || 0}</span>
                        <span className="text-slate-500 font-medium">/month</span>
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8 flex-grow">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            isPremium ? 'bg-blue-100' : 'bg-emerald-100'
                          }`}>
                            <Check className={`w-4 h-4 ${isPremium ? 'text-blue-600' : 'text-emerald-600'}`} />
                          </div>
                          <span className="text-slate-600 font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                       <button disabled className="w-full py-4 rounded-xl font-semibold bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200">
                          Current Plan
                       </button>
                    ) : (
                      selectedPlan === plan.id ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                           <div className="text-center">
                              <QrCode className="w-32 h-32 mx-auto text-slate-800 mb-2" />
                              <p className="text-sm text-slate-600 font-medium">Scan via GPay/PhonePe to pay ₹{plan.price * 80}</p>
                           </div>
                           <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => setScreenshot(e.target.files[0])}
                              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 cursor-pointer"
                           />
                           <div className="flex gap-2">
                              <button onClick={() => setSelectedPlan(null)} className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all">Cancel</button>
                              <button onClick={handleUploadPayment} disabled={!screenshot || processing} className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50 hover:bg-blue-700 transition-all">
                                {processing ? 'Uploading...' : 'Submit'}
                              </button>
                           </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedPlan(plan.id)}
                          className="w-full py-4 btn-primary rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-white"
                        >
                          <Zap className="w-5 h-5" />
                          Upgrade Now
                        </button>
                      )
                    )}
                  </motion.div>
                );
              })}
            </div>

            {user?.subscription?.expiryDate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-12 text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm"
              >
                <p className="text-slate-600 font-medium">
                  Your {user.subscription.plan} plan expires on{' '}
                  <span className="text-slate-900 font-bold">
                    {new Date(user.subscription.expiryDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </p>
              </motion.div>
            )}
          </>
        )}

        {isAdmin && activeTab === 'admin' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-semibold">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Screenshot</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminPayments.length === 0 ? (
                  <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-medium">No pending payments.</td></tr>
                ) : adminPayments.map(payment => (
                  <tr key={payment._id}>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{payment.userEmail}</div>
                    </td>
                    <td className="p-4 text-blue-600 uppercase text-sm font-bold">{payment.planId}</td>
                    <td className="p-4">
                      <a href={`${API_BASE_URL}${payment.screenshotUrl}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm font-semibold">
                        <Upload className="w-4 h-4" /> View Image
                      </a>
                    </td>
                    <td className="p-4 text-slate-600 text-sm font-medium">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right space-x-2">
                       {payment.status === 'pending' ? (
                          <>
                             <button 
                               onClick={() => handleApprove(payment._id, 'approved')}
                               disabled={processing === payment._id}
                               className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-sm font-semibold transition-all"
                             >
                               {processing === payment._id ? '...' : 'Approve'}
                             </button>
                             <button 
                               onClick={() => handleApprove(payment._id, 'rejected')}
                               disabled={processing === payment._id}
                               className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold transition-all"
                             >
                               Reject
                             </button>
                          </>
                       ) : (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${payment.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                             {payment.status.toUpperCase()}
                          </span>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
