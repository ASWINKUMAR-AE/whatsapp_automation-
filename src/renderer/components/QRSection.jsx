import { motion } from 'framer-motion';
import { QrCode, RefreshCw, Smartphone } from 'lucide-react';

function QRSection({ qrCode }) {
  return (
    <motion.div
      className="glass-card p-8 bg-white"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
          <QrCode className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Connect WhatsApp</h2>
          <p className="text-slate-600 text-sm">Scan the QR code to login</p>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <motion.div 
          className="relative p-4 bg-white rounded-2xl border border-slate-200 shadow-sm"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <img 
            src={qrCode} 
            alt="WhatsApp QR Code" 
            className="w-64 h-64 object-contain"
          />
          <div className="absolute inset-4 border-2 border-dashed border-blue-500/20 rounded-xl" />
        </motion.div>

        <motion.div 
          className="mt-6 flex items-center gap-2 text-slate-600 text-sm font-semibold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Smartphone className="w-4 h-4 text-slate-500" />
          <span>Open WhatsApp on your phone → Settings → Linked Devices</span>
        </motion.div>

        <motion.div 
          className="mt-4 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 py-1.5 px-3 rounded-xl text-sm font-semibold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
          <span>Keep this page open while scanning</span>
        </motion.div>
      </div>

      <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Instructions:</h3>
        <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside font-medium">
          <li>Open WhatsApp on your smartphone</li>
          <li>Go to Settings → Linked Devices</li>
          <li>Tap on "Link a Device"</li>
          <li>Scan the QR code above</li>
          <li>Your device will be connected automatically</li>
        </ol>
      </div>
    </motion.div>
  );
}

export default QRSection;