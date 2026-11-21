import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { userService } from '../services/userService.js';
import { startSession } from '../services/sessionManager.js';
import {
  getStatus,
  getLogs,
  sendMessage,
  getGroupInfo,
  getContacts,
  getChats,
  getChatMessages,
  receiveWebhook,
  healthCheck,
  logoutDevice,
  getSessionLogs,
} from '../controllers/messageController.js';
import { sendMessageLimiter } from '../middleware/auth.js';
import { whatsappService } from '../services/index.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-automation-secret-key-change-in-production';

let isSwitchingSession = false;
let sessionSwitchPromise = null;

async function switchSessionSafely(targetUserId) {
  if (whatsappService.clientId === targetUserId && whatsappService.client) {
    return;
  }
  if (isSwitchingSession && sessionSwitchPromise) {
    return await sessionSwitchPromise;
  }
  isSwitchingSession = true;
  sessionSwitchPromise = (async () => {
    try {
      if (whatsappService.clientId && whatsappService.clientId !== targetUserId) {
        console.log(`Switching active WhatsApp session from user ${whatsappService.clientId} to user ${targetUserId}...`);
        await whatsappService.destroy();
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log(`Binding initial WhatsApp session to user ${targetUserId}...`);
      }
      whatsappService.initialize(targetUserId);
    } catch (err) {
      console.error('Error in switchSessionSafely:', err.message || err);
    } finally {
      isSwitchingSession = false;
      sessionSwitchPromise = null;
    }
  })();
  return await sessionSwitchPromise;
}

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

    if (!user.subscription.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Subscription expired. Please renew.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    req.user = user;
    await startSession(user.id || user._id);

    // Dynamic Multi-User WhatsApp Session Separation
    const activeUserId = String(user.id || user._id);
    if (!whatsappService.clientId || whatsappService.clientId !== activeUserId) {
      await switchSessionSafely(activeUserId);
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

router.get('/health', healthCheck);

router.get('/status', authMiddleware, (req, res) => {
  getStatus(req, res, req.user);
});

router.get('/logs', authMiddleware, (req, res) => {
  getLogs(req, res, req.user);
});

router.get('/sessions', authMiddleware, (req, res) => {
  getSessionLogs(req, res, req.user);
});

router.post('/send', authMiddleware, sendMessageLimiter, (req, res) => {
  sendMessage(req, res, req.user);
});

router.get('/group-info', authMiddleware, getGroupInfo);

router.get('/contacts', authMiddleware, getContacts);

router.get('/chats', authMiddleware, getChats);

router.get('/chats/:chatId/messages', authMiddleware, getChatMessages);

router.post('/receive', receiveWebhook);

router.post('/reconnect', authMiddleware, async (req, res) => {
  try {
    await whatsappService.reconnect();
    res.json({ success: true, message: 'Reconnection requested' });
  } catch (error) {
    console.error("RECONNECT CRASH:", error);
    res.status(500).json({ success: false, error: error.message || 'Failed to reconnect' });
  }
});

router.post('/logout-device', authMiddleware, logoutDevice);

export default router;

