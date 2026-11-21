import path from 'path';
import fs from 'fs';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import db from '../database/db.js';

import {
  whatsappService,
  rateLimiter,
  antiSpamService,
  messageVariationService,
  contactValidationService,
  messageQueue,
} from '../services/index.js';
import { userService } from '../services/userService.js';
import { addSessionAction, incrementSessionSent } from '../services/sessionManager.js';

const stats = {
  totalSent: 0,
  totalFailed: 0,
  sentToday: 0,
  lastReset: new Date().toDateString(),
};

function resetDailyStats() {
  const today = new Date().toDateString();
  if (stats.lastReset !== today) {
    stats.sentToday = 0;
    stats.lastReset = today;
  }
}

async function addLog(entry, userId = null) {
  // Anti-spam message logging disabled for privacy and database cleanliness.
  return;
}

export const getStatus = async (req, res, user = null) => {
  const waStatus = whatsappService.getStatus();
  resetDailyStats();

  const canSend = user ? await userService.canSendMessage(user._id) : { remaining: 100, allowed: true };
  const updatedUser = user ? await userService.getUserById(user._id) : null;
  const mapped = userService.mapUser(updatedUser);

  res.json({
    success: true,
    ...waStatus,
    stats: {
      totalSent: stats.totalSent,
      totalFailed: stats.totalFailed,
      sentToday: mapped ? mapped.subscription.messagesSentToday : stats.sentToday,
      rateLimit: rateLimiter.getStats(),
      subscription: {
        plan: mapped ? mapped.subscription.plan : 'free',
        dailyLimit: mapped ? mapped.subscription.dailyLimit : 100,
        remaining: canSend.remaining,
        canSend: canSend.allowed
      }
    },
    warnings: await getWarnings(mapped),
  });
};

async function getWarnings(user = null) {
  const warnings = [];
  const rateStats = rateLimiter.getStats();

  if (user) {
    const canSend = await userService.canSendMessage(user._id || user.id);
    
    if (!user.subscription.isActive) {
      warnings.push({
        type: 'subscription',
        message: 'Your subscription has expired. Please renew to continue.',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }
    
    if (!canSend.allowed && canSend.reason === 'Daily limit reached') {
      warnings.push({
        type: 'limit',
        message: `Daily message limit (${user.subscription.dailyLimit}) reached. Upgrade to Premium for more.`,
        code: 'DAILY_LIMIT_REACHED'
      });
    }
  } else {
    if (rateStats.hourlyRemaining === 0) {
      warnings.push({
        type: 'limit',
        message: 'Hourly message limit reached. Please wait.',
        code: 'HOURLY_LIMIT_REACHED',
      });
    }

    if (rateStats.dailyRemaining === 0) {
      warnings.push({
        type: 'limit',
        message: 'Daily message limit reached. Try again tomorrow.',
        code: 'DAILY_LIMIT_REACHED',
      });
    }
  }

  return warnings;
}

export const getLogs = async (req, res, user = null) => {
  try {
    const { type, search } = req.query;
    const userId = user ? (user._id || user.id) : null;
    
    const query = {};

    if (userId) {
      query.user_id = userId;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { text: new RegExp(search, 'i') },
        { recipient: new RegExp(search, 'i') }
      ];
    }

    const logs = await db.message_logs.find(query)
      .sort({ timestamp: -1 })
      .limit(50);

    res.json({
      success: true,
      logs: logs,
    });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
};

export const sendMessage = async (req, res, user = null) => {
  try {
    const {
      recipient,
      text,
      file,
      document,
      localimg,
      localdoc,
    } = req.query;

    const bodyRecipient = req.body.recipient;
    const bodyText = req.body.text;
    const base64File = req.body.base64File;
    const fileName = req.body.fileName;
    const mimeType = req.body.mimeType;

    const finalRecipient = recipient || bodyRecipient;
    const finalTextBody = text || bodyText;

    if (!finalRecipient) {
      return res.status(400).json({
        success: false,
        error: 'Recipient phone number is required',
        code: 'MISSING_RECIPIENT',
      });
    }

    if (!finalTextBody && !file && !document && !localimg && !localdoc && !base64File) {
      return res.status(400).json({
        success: false,
        error: 'Message text or media is required',
        code: 'MISSING_CONTENT',
      });
    }

    if (user) {
      const canSend = await userService.canSendMessage(user._id || user.id);
      
      if (!user.subscription.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Subscription expired. Please renew.',
          code: 'SUBSCRIPTION_EXPIRED',
          subscription: { isActive: false }
        });
      }
      
      if (!canSend.allowed) {
        return res.status(429).json({
          success: false,
          error: canSend.reason || 'Daily limit reached',
          code: canSend.reason === 'Daily limit reached' ? 'DAILY_LIMIT' : 'LIMIT_EXCEEDED',
          subscription: {
            sentToday: user.subscription.messagesSentToday,
            dailyLimit: user.subscription.dailyLimit,
            remaining: 0
          }
        });
      }

      if (!finalRecipient.endsWith('@g.us') && !contactValidationService.isValidContact(finalRecipient) && user.whitelistedContacts?.length > 0) {
        const normalized = finalRecipient.replace(/[^0-9]/g, '');
        if (!user.whitelistedContacts.some(c => normalized.includes(c) || c.includes(normalized))) {
          return res.status(403).json({
            success: false,
            error: 'Recipient not in whitelist',
            code: 'CONTACT_NOT_VALIDATED',
          });
        }
      }
    } else {
      const rateCheck = rateLimiter.canSend();
      if (!rateCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: rateCheck.dailyRemaining === 0 
            ? 'Daily message limit reached' 
            : 'Hourly message limit reached',
          code: rateCheck.dailyRemaining === 0 ? 'DAILY_LIMIT' : 'HOURLY_LIMIT',
          rateLimit: rateCheck,
        });
      }
    }

    const finalText = messageVariationService.applyVariation(finalTextBody || '');

    if (antiSpamService.isDuplicate(finalRecipient, finalText)) {
      return res.status(429).json({
        success: false,
        error: 'Duplicate message detected. Please wait before sending similar message.',
        code: 'DUPLICATE_MESSAGE',
      });
    }

    const waStatus = whatsappService.getStatus();
    if (!waStatus.isReady) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp client is not ready. Please scan QR code first.',
        code: 'CLIENT_NOT_READY',
      });
    }

    let media = null;
    let mediaType = null;

    if (localimg) {
      const filePath = path.join(process.cwd(), localimg);
      if (fs.existsSync(filePath)) {
        media = MessageMedia.fromFilePath(filePath);
        mediaType = 'image';
      } else {
        return res.status(400).json({
          success: false,
          error: 'Local image file not found',
          code: 'FILE_NOT_FOUND',
        });
      }
    } else if (localdoc) {
      const filePath = path.join(process.cwd(), localdoc);
      if (fs.existsSync(filePath)) {
        media = MessageMedia.fromFilePath(filePath);
        mediaType = 'document';
      } else {
        return res.status(400).json({
          success: false,
          error: 'Local document file not found',
          code: 'FILE_NOT_FOUND',
        });
      }
    } else if (base64File) {
      media = new MessageMedia(mimeType || 'application/octet-stream', base64File, fileName || 'file');
      mediaType = mimeType?.startsWith('image/') ? 'image' : 'document';
    } else if (file) {
      try {
        const response = await fetch(file);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = file.split('.').pop().split('?')[0];
        const mimeType = ext.match(/jpg|jpeg|png|gif|webp/i)
          ? `image/${ext}`
          : ext.match(/pdf/i)
            ? 'application/pdf'
            : 'application/octet-stream';

        media = new MessageMedia(mimeType, buffer.toString('base64'), `file.${ext}`);
        mediaType = 'image';
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Failed to fetch remote file: ' + err.message,
          code: 'FETCH_ERROR',
        });
      }
    } else if (document) {
      try {
        const response = await fetch(document);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = document.split('.').pop().split('?')[0] || 'pdf';

        media = new MessageMedia('application/pdf', buffer.toString('base64'), `document.${ext}`);
        mediaType = 'document';
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Failed to fetch remote document: ' + err.message,
          code: 'FETCH_ERROR',
        });
      }
    }

    const isBulk = req.query.isBulk === 'true' || req.body.isBulk === true;
    const minDelay = parseInt(process.env.MIN_MESSAGE_DELAY) || 5000;
    const maxDelay = parseInt(process.env.MAX_MESSAGE_DELAY) || 15000;
    const delay = isBulk ? (Math.random() * (maxDelay - minDelay) + minDelay) : 0;

    const messageResult = await new Promise((resolve, reject) => {
      messageQueue.enqueue({
        task: async () => {
          const result = await whatsappService.sendMessage(finalRecipient, finalText, media);
          return result;
        },
        delay: delay,
      }).then(resolve).catch(reject);
    });

    rateLimiter.recordMessage();
    antiSpamService.addMessage(finalRecipient, finalText);

    if (user) {
      await userService.recordMessage(user._id || user.id);
    }

    stats.totalSent++;
    stats.sentToday++;

    // Try to get contact or group name for better logging
    const isGroup = finalRecipient.endsWith('@g.us');
    const contactName = await whatsappService.getContactName(whatsappService.formatPhoneNumber(finalRecipient));

    await incrementSessionSent();
    await addSessionAction(isGroup 
      ? `Sent message to Group "${contactName || finalRecipient}"` 
      : (isBulk 
        ? `Sent campaign message to ${finalRecipient} (${contactName || ''})` 
        : `Sent single message to ${finalRecipient} (${contactName || ''})`)
    );

    await addLog({
      msgId: messageResult.id?._serialized,
      type: 'sent',
      to: finalRecipient,
      contactName,
      text: finalText,
      mediaType,
      status: 'success',
    }, user ? (user._id || user.id) : null);

    res.json({
      success: true,
      message: 'Message sent successfully',
      messageId: messageResult.id?._serialized || messageResult.id,
      rateLimit: rateLimiter.getStats(),
      subscription: user ? {
        sentToday: user.subscription.messagesSentToday,
        dailyLimit: user.subscription.dailyLimit,
        remaining: user.subscription.dailyLimit - user.subscription.messagesSentToday
      } : undefined
    });

  } catch (error) {
    console.error('Error sending message:', error);
    stats.totalFailed++;

    await addSessionAction(`Failed to send message to ${finalRecipient || req.query.recipient}: ${error.message}`);

    await addLog({
      type: 'sent',
      to: req.query.recipient,
      text: req.query.text,
      status: 'failed',
      error: error.message,
    }, user ? (user._id || user.id) : null);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message',
      code: 'SEND_FAILED',
    });
  }
};

export const getGroupInfo = async (req, res) => {
  try {
    const waStatus = whatsappService.getStatus();
    if (!waStatus.isReady) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp client is not ready. Please connect WhatsApp first.',
        code: 'CLIENT_NOT_READY',
      });
    }

    const groups = await whatsappService.getGroups();

    res.json({
      success: true,
      groups: groups.map(g => ({
        id: g.id?._serialized || g.id,
        name: g.name || 'Unnamed Group',
        participants: Array.isArray(g.participants) ? g.participants.length : (g.groupMetadata?.participants?.length || 0),
        unreadCount: g.unreadCount || 0,
      })),
    });
  } catch (error) {
    console.error('Error getting groups:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get group info',
      code: 'GROUP_FETCH_FAILED',
    });
  }
};

export const getContacts = async (req, res) => {
  try {
    const waStatus = whatsappService.getStatus();
    if (!waStatus.isReady) {
      return res.status(503).json({ success: false, error: 'WhatsApp client is not ready' });
    }
    const contacts = await whatsappService.getContacts();
    res.json({
      success: true,
      contacts: contacts.map(c => ({
        id: c.id._serialized,
        name: c.name || c.pushname || c.number,
        number: c.number,
      })),
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
};

export const getChats = async (req, res) => {
  try {
    const waStatus = whatsappService.getStatus();
    if (!waStatus.isReady) {
      return res.status(503).json({ success: false, error: 'WhatsApp client is not ready' });
    }
    const chats = await whatsappService.getChats();
    res.json({
      success: true,
      chats: chats.map(c => ({
        id: c.id._serialized,
        name: c.name,
        isGroup: c.isGroup,
        unreadCount: c.unreadCount,
        timestamp: c.timestamp,
      })),
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chats' });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const waStatus = whatsappService.getStatus();
    
    if (!waStatus.isReady) {
      return res.status(503).json({ success: false, error: 'WhatsApp client is not ready' });
    }

    // 1. Get real-time messages from client
    const clientMessages = await whatsappService.getChatMessages(chatId, limit);
    const mappedClientMessages = clientMessages.map(m => ({
      id: m.id?._serialized || Date.now().toString(),
      body: m.body || '',
      from: m.from,
      to: m.to,
      fromMe: m.fromMe,
      timestamp: m.timestamp,
      type: m.type,
      hasMedia: m.hasMedia,
    }));

    // 2. Get history from local database
    const dbLogs = await db.message_logs.find({ 
      recipient: chatId 
    }).sort({ timestamp: -1 }).limit(limit);

    const mappedDbMessages = dbLogs.map(log => ({
      id: log.msgId || log._id,
      body: log.text || '',
      from: log.type === 'received' ? log.recipient : 'me',
      to: log.type === 'sent' ? log.recipient : 'me',
      fromMe: log.type === 'sent',
      timestamp: Math.floor(new Date(log.timestamp).getTime() / 1000),
      type: 'chat',
      hasMedia: !!log.mediaType,
      is_history: true
    }));

    // 3. Merge and deduplicate
    const combined = [...mappedClientMessages];
    const clientIds = new Set(mappedClientMessages.map(m => m.id));
    
    for (const dbMsg of mappedDbMessages) {
      if (!clientIds.has(dbMsg.id)) {
        combined.push(dbMsg);
      }
    }

    // Sort by timestamp
    combined.sort((a, b) => a.timestamp - b.timestamp);

    res.json({
      success: true,
      messages: combined
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.json({ success: false, messages: [], error: 'Failed to fetch messages' });
  }
};

export const receiveWebhook = async (req, res) => {
  const { from, text } = req.body;

  if (!from || !text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: from, text',
      code: 'MISSING_FIELDS',
    });
  }

  const contactName = await whatsappService.getContactName(from);

  await addLog({
    type: 'received',
    from,
    contactName,
    text,
  });

  const today = new Date().toDateString();
  if (stats.lastReset !== today) {
    stats.sentToday = 0;
    stats.lastReset = today;
  }
  stats.receivedToday = (stats.receivedToday || 0) + 1;

  res.json({
    success: true,
    message: 'Message logged',
  });
};

export const logoutDevice = async (req, res) => {
  try {
    const success = await whatsappService.logoutDevice();
    res.json({ success, message: 'Device logout successful. Fresh QR will be generated.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Failed to logout device' });
  }
};

export const healthCheck = (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

export const getSessionLogs = async (req, res, user = null) => {
  try {
    const userId = user ? (user._id || user.id) : null;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const sessions = await db.session_logs.find({ userId });
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Error fetching session logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session logs' });
  }
};