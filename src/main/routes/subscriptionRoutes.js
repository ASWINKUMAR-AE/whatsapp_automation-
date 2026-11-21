import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { userService } from '../services/userService.js';
import multer from 'multer';
import path from 'path';
import db from '../database/db.js';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), 'uploads'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-automation-secret-key-change-in-production';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await userService.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: [
      {
        id: 'free',
        name: 'Free Plan',
        price: 0,
        dailyLimit: 'Unlimited',
        features: [
          'Unlimited messages per day',
          'Basic anti-spam protection',
          'Email support',
          'WhatsApp client management',
          'Group messaging support'
        ],
        popular: true
      },
      {
        id: 'premium',
        name: 'Premium Plan',
        price: 9.99,
        dailyLimit: 500,
        features: [
          '500 messages per day',
          'Advanced anti-spam protection',
          'Priority support',
          'WhatsApp client management',
          'Analytics dashboard',
          'API access'
        ],
        popular: true
      }
    ]
  });
});

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const canSend = await userService.canSendMessage(user._id);
    const updatedUser = await userService.getUserById(user._id);
    
    const mapped = userService.mapUser(updatedUser);
    res.json({
      success: true,
      subscription: {
        plan: mapped.subscription.plan,
        dailyLimit: mapped.subscription.dailyLimit,
        messagesSentToday: mapped.subscription.messagesSentToday,
        remaining: canSend.remaining,
        canSend: canSend.allowed,
        reason: canSend.reason,
        expiryDate: mapped.subscription.expiryDate,
        isActive: mapped.subscription.isActive
      }
    });
  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription status',
      code: 'SUBSCRIPTION_ERROR'
    });
  }
});

router.post('/upgrade', authMiddleware, async (req, res) => {
  try {
    const { plan, duration } = req.body;
    
    if (!plan || !['premium'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan',
        code: 'INVALID_PLAN'
      });
    }

    const durationDays = duration || 30;
    const updatedUser = await userService.upgradeToPremium(req.user._id, durationDays);
    const mapped = userService.mapUser(updatedUser);

    res.json({
      success: true,
      message: `Successfully upgraded to ${plan} plan`,
      subscription: {
        plan: mapped.subscription.plan,
        dailyLimit: mapped.subscription.dailyLimit,
        expiryDate: mapped.subscription.expiryDate,
        isActive: mapped.subscription.isActive
      }
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade subscription',
      code: 'UPGRADE_FAILED'
    });
  }
});

// Admin Middleware Map
const adminMiddleware = async (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required', code: 'UNAUTHORIZED' });
  }
  next();
};

router.post('/upload-payment', authMiddleware, upload.single('screenshot'), async (req, res) => {
  try {
    const { planId, duration } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Screenshot is required', code: 'NO_FILE' });
    }

    const paymentEntry = {
      userId: req.user._id,
      userEmail: req.user.email,
      planId,
      duration: duration || 30,
      screenshotUrl: `/uploads/${req.file.filename}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const inserted = await db.payments.insert(paymentEntry);
    res.json({
      success: true,
      message: 'Payment screenshot uploaded successfully. Waiting for admin approval.',
      payment: inserted
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, error: 'Failed to process payment upload', code: 'UPLOAD_FAILED' });
  }
});

router.get('/admin/payments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const payments = await db.payments.find({}).sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
});

router.post('/admin/payments/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { paymentId, status } = req.body; // status: 'approved' | 'rejected'
    const payment = await db.payments.findOne({ _id: paymentId });
    
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ success: false, error: 'Payment already processed' });

    await db.payments.update({ _id: paymentId }, { $set: { status, updatedAt: new Date().toISOString() } });

    if (status === 'approved') {
      await userService.upgradeToPremium(payment.userId, payment.duration);
    }
    
    res.json({ success: true, message: `Payment ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to process approval' });
  }
});

router.get('/usage', authMiddleware, async (req, res) => {
  try {
    const canSend = await userService.canSendMessage(req.user._id);
    const updatedUser = await userService.getUserById(req.user._id);
    const mapped = userService.mapUser(updatedUser);
    
    res.json({
      success: true,
      usage: {
        sentToday: mapped.subscription.messagesSentToday,
        dailyLimit: mapped.subscription.dailyLimit,
        remaining: canSend.remaining,
        canSend: canSend.allowed,
        resetDate: mapped.subscription.resetDate
      }
    });
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage',
      code: 'USAGE_ERROR'
    });
  }
});


export default router;

