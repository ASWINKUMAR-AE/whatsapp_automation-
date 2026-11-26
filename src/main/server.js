import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import messageRoutes from './routes/messageRoutes.js';
import authRoutes from './routes/authRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import { whatsappService } from './services/index.js';
import db from './database/db.js'; // Import db directly
import { addLog } from './controllers/messageController.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Payload limits must be defined BEFORE any other middleware or routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  if (whatsappService.isReady) {
    socket.emit('whatsapp:ready');
  } else if (whatsappService.qrCodeData) {
    socket.emit('whatsapp:qr', { qr: whatsappService.qrCodeData });
  }
});

import path from 'path';
import fs from 'fs';
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

import { addSessionAction, incrementSessionReceived } from './services/sessionManager.js';

const PORT = process.env.PORT || 3001;

whatsappService.on('ready', () => {
  io.emit('whatsapp:ready');
  addSessionAction('WhatsApp connection established successfully');
});

whatsappService.on('disconnected', (reason) => {
  io.emit('whatsapp:disconnected', { reason });
  addSessionAction(`WhatsApp disconnected: ${reason}`);
});

whatsappService.on('data_cleared', () => {
  io.emit('whatsapp:data_cleared');
  addSessionAction('WhatsApp local session data cleared');
});

whatsappService.on('qr', (qr) => {
  io.emit('whatsapp:qr', { qr });
});

whatsappService.on('message', async (message) => {
  try {
    const contact = await message.getContact();
    const contactName = contact.name || contact.pushname || contact.number;

    // Increment session message stats
    await incrementSessionReceived();
    await addSessionAction(`Received incoming WhatsApp message from ${contactName} (${message.from})`);

    const logItem = await addLog({
      type: 'received',
      from: message.from,
      recipient: message.from,
      contactName: contactName,
      text: message.body,
      status: 'received',
      msgId: message.id?._serialized,
      timestamp: new Date().toISOString(),
    });

    io.emit('whatsapp:message', logItem || {
      id: Date.now(),
      type: 'received',
      from: message.from,
      recipient: message.from,
      contactName: contactName,
      text: message.body,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error handling incoming message:', err);
  }
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api', messageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Automation API - SQLite Edition',
    version: '2.0.0',
    endpoints: {
      health: 'GET /api/health',
      status: 'GET /api/status',
      send: 'POST /api/send?apikey=KEY&recipient=PHONE&text=MESSAGE',
      logs: 'GET /api/logs?apikey=KEY',
      'group-info': 'GET /api/group-info?apikey=KEY',
      webhook: 'POST /api/receive',
    },
    features: [
      'SQLite Persistence',
      'Message Queue System',
      'Smart Delay (5-15s)',
      'Rate Limiting',
      'Anti-Spam Protection',
      'Message Variation',
      'Contact Validation',
      'Typing Simulation',
      'Auto Reconnect',
    ],
  });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

process.on('uncaughtException', (err) => {
  console.error('Handled uncaughtException:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Handled unhandledRejection:', reason?.message || reason);
});

httpServer.listen(PORT, () => {
  console.log(`WhatsApp Automation Server v2.0.0 running on port ${PORT}`);
  console.log(`WebSocket enabled for real-time updates`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await whatsappService.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await whatsappService.destroy();
  process.exit(0);
});