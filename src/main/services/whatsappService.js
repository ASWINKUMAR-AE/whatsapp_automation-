import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia, Presence } = pkg;
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_PATH = process.env.SESSION_PATH || './wwebjs_auth';

function getChromePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.qrCodeData = null;
    this.connectionStatus = 'disconnected';
    this.autoReconnect = process.env.AUTO_RECONNECT === 'true';
    this.reconnectInterval = parseInt(process.env.RECONNECT_INTERVAL) || 5000;
    this.reconnectTimer = null;
    this.listeners = new Set();
    this.activeSessionPath = SESSION_PATH; 
    this.clientId = null;
  }

  initialize(clientId = 'whatsapp-automation') {
    this.clientId = clientId;
    if (!fs.existsSync(this.activeSessionPath)) {
      fs.mkdirSync(this.activeSessionPath, { recursive: true });
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: this.activeSessionPath,
        clientId: this.clientId,
      }),
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1055733463-alpha.html',
      },
      puppeteer: {
        headless: true,
        executablePath: getChromePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        protocolTimeout: 120000,
        timeout: 120000,
      },
    });

    this.setupEventHandlers();
    // Wrap in catch so puppeteer errors don't crash as UnhandledPromiseRejection
    this.client.initialize().catch(err => {
      console.error('WhatsApp client initialize error:', err.message);
      this.connectionStatus = 'disconnected';
      this.emit('disconnected', 'INIT_ERROR');
    });
  }

  /**
   * Kills the underlying Chrome/Chromium OS process forcefully.
   * client.destroy() only closes the puppeteer WS connection;
   * on Windows the Chrome process stays alive and holds file locks.
   */
  async killBrowser() {
    try {
      if (this.client && this.client.pupBrowser) {
        const browserProcess = this.client.pupBrowser.process();
        if (browserProcess && !browserProcess.killed) {
          const pid = browserProcess.pid;
          console.log(`Killing Chrome process tree (pid: ${pid})...`);
          if (process.platform === 'win32') {
            try {
              execSync(`taskkill /F /PID ${pid} /T`);
            } catch (e) {}
          } else {
            try {
              browserProcess.kill('SIGKILL');
            } catch (e) {}
          }
          console.log('Chrome process tree killed.');
        }
      }
    } catch (err) {
      console.warn('killBrowser error (non-fatal):', err.message);
    }
    // Clean up any stale lockfile if browser is killed
    if (this.activeSessionPath && this.clientId) {
      const lockfilePath = path.join(this.activeSessionPath, `session-${this.clientId}`, 'lockfile');
      try {
        if (fs.existsSync(lockfilePath)) {
          fs.unlinkSync(lockfilePath);
        }
      } catch (e) {}
    }
    // Extra breathing room for Windows to release file locks
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  setupEventHandlers() {
    this.client.on('ready', () => {
      console.log('WhatsApp Client is ready!');
      this.isReady = true;
      this.connectionStatus = 'connected';
      this.qrCodeData = null;
      this.clearReconnectTimer();
      this.emit('ready');
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp Client disconnected:', reason);
      // Only treat it as disconnected if the user was actually logged out.
      if (reason === 'LOGOUT') {
        this.isReady = false;
        this.connectionStatus = 'disconnected';
        this.emit('disconnected', reason);
      } else {
        console.log('Ignoring non-logout disconnection event (likely a navigation/reload issue).');
      }
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp authenticated successfully');
      this.connectionStatus = 'connected';
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp authentication failed:', msg);
      this.connectionStatus = 'disconnected';
      this.emit('auth_failure', msg);
    });

    this.client.on('message', (message) => {
      this.emit('message', message);
    });

    this.client.on('qr', async (qr) => {
      console.log('QR Code received, generating image...');
      try {
        const url = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        this.qrCodeData = url;
        this.connectionStatus = 'qr';
        this.emit('qr', url);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    });

    this.client.on('change_state', (state) => {
      console.log('Connection state changed:', state);
      this.emit('change_state', state);
    });

    this.client.on('failure', (failure) => {
      console.error('WhatsApp failure:', failure);
      this.emit('failure', failure);
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    console.log(`Scheduling reconnect in ${this.reconnectInterval}ms...`);
    this.reconnectTimer = setTimeout(() => {
      console.log('Auto reconnecting...');
      this.reconnectTimer = null;
      this.reconnect();
    }, this.reconnectInterval);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  formatPhoneNumber(phone) {
    if (!phone) return '';
    phone = String(phone).trim();
    if (phone.endsWith('@g.us') || phone.endsWith('@c.us')) {
      return phone;
    }
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = '91' + cleaned;
    }
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned + '@c.us';
  }

  async sendMessage(recipient, text, media = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(recipient);

    if (media) {
      if (text) {
        return await this.client.sendMessage(chatId, media, { caption: text });
      }
      return await this.client.sendMessage(chatId, media);
    }

    return await this.client.sendMessage(chatId, text);
  }

  async simulateTyping(recipient, callback) {
    const minDelay = parseInt(process.env.TYPING_MIN_DELAY) || 2000;
    const maxDelay = parseInt(process.env.TYPING_MAX_DELAY) || 5000;
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;

    const chatId = this.formatPhoneNumber(recipient);
    
    try {
      await this.client.sendPresenceAvailable(chatId);
      await this.client.sendTyping(chatId);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      await callback();
      
      await this.client.sendPaused(chatId);
    } catch (error) {
      await this.client.sendPaused(chatId);
      throw error;
    }
  }

  async getChats() {
    if (!this.isReady) return [];
    try {
      const chats = await this.client.getChats();
      // Filter out internal/linked identifiers (LIDs) which cause duplicates and history errors
      return chats.filter(chat => chat.id && !chat.id._serialized.endsWith('@lid'));
    } catch (err) {
      console.error('Error fetching chats:', err);
      return [];
    }
  }

  async getContactName(chatId) {
    if (!this.isReady || !chatId) return null;
    try {
      if (chatId.endsWith('@g.us')) {
        const chat = await this.client.getChatById(chatId);
        return chat ? (chat.name || 'Group') : 'Group';
      }
      const contact = await this.client.getContactById(chatId);
      return contact ? (contact.name || contact.pushname || contact.number) : null;
    } catch (err) {
      return null;
    }
  }

  async logoutDevice() {
    console.log('Logging out device and wiping session...');
    try {
      // 1. KILL CHROME PROCESS — destroy() alone doesn't kill Chrome on Windows
      await this.killBrowser();
      if (this.client) {
        try { await this.client.destroy(); } catch (_) {}
        this.client = null;
      }
      console.log('WhatsApp client fully stopped.');

      // 2. WIPE DATABASE (Privacy Priority)
      try {
        console.log('Wiping local database logs and contacts...');
        await db.message_logs.remove({}, { multi: true });
        await db.whitelisted_contacts.remove({}, { multi: true });
        this.emit('data_cleared');
      } catch (dbErr) {
        console.error('Error wiping database:', dbErr);
      }

      // 3. DELETE ALL SESSION FOLDERS
      const sessionFolders = [
        path.join(this.activeSessionPath, `session-${this.clientId}`),
        path.join(this.activeSessionPath, 'session-whatsapp-automation')
      ];
      for (const sPath of sessionFolders) {
        if (sPath && fs.existsSync(sPath)) {
          console.log('Deleting session folder:', sPath);
          for (let i = 1; i <= 3; i++) {
            try {
              fs.rmSync(sPath, { recursive: true, force: true });
              console.log('Session folder deleted successfully:', sPath);
              break;
            } catch (err) {
              console.warn(`Deletion attempt ${i} failed (${err.code}), retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }

      // 4. UPDATE STATUS TO CONNECTING (WAITING FOR NEW QR)
      this.isReady = false;
      this.connectionStatus = 'connecting';
      this.qrCodeData = null;
      this.emit('change_state', 'connecting');

      // 5. RE-INITIALIZE (Chrome is dead, session cleared — start fresh to generate new QR immediately)
      console.log('Re-initializing WhatsApp client for new QR...');
      this.initialize(this.clientId);

      return true;
    } catch (outerErr) {
      console.error('Critical error during logoutDevice:', outerErr);
      this.connectionStatus = 'connecting';
      this.isReady = false;
      this.qrCodeData = null;
      this.initialize(this.clientId);
      return false;
    }
  }

  async syncRecentHistory(limit = 20) {
    if (!this.isReady) return;
    console.log(`Syncing recent history (limit: ${limit} chats)...`);
    try {
      const chats = await this.client.getChats();
      const recentChats = chats.slice(0, limit);
      
      for (const chat of recentChats) {
        try {
          const messages = await chat.fetchMessages({ limit: 1 });
          if (messages && messages.length > 0) {
            const lastMsg = messages[0];
            const contact = await lastMsg.getContact();
            const contactName = contact.name || contact.pushname || contact.number;
            
            this.emit('sync_message', {
              message: lastMsg,
              contactName
            });
          }
        } catch (msgErr) {
          console.warn(`Could not fetch last message for chat ${chat.id._serialized}:`, msgErr.message);
        }
      }
      console.log('History sync complete');
    } catch (err) {
      console.error('Error syncing history:', err);
    }
  }

  async getGroups() {
    if (!this.isReady) return [];
    try {
      const chats = await this.getChats();
      return chats.filter(chat => chat && (chat.isGroup || (chat.id && chat.id._serialized && chat.id._serialized.endsWith('@g.us'))));
    } catch (err) {
      console.error('Error fetching groups:', err);
      return [];
    }
  }

  async getContacts() {
    if (!this.isReady) return [];
    try {
      const contacts = await this.client.getContacts();
      // Filter out groups, broadcasts, and internal identities (LIDs)
      // Keeping only regular users save in the user's phone.
      return contacts.filter(c => 
        c.isUser && 
        c.isMyContact && 
        !c.id._serialized.endsWith('@lid')
      );
    } catch (err) {
      console.error('Error fetching contacts:', err);
      return [];
    }
  }

  async getChatMessages(chatId, limit = 50) {
    if (!this.isReady || !chatId || chatId === '0@c.us') return [];
    try {
      const chat = await this.client.getChatById(chatId);
      if (!chat) return [];
      
      // Some chats might not support fetchMessages or crash due to internal library issues
      const messages = await chat.fetchMessages({ limit }).catch(err => {
        console.warn(`Could not fetch messages for ${chatId}:`, err.message);
        return [];
      });
      return messages || [];
    } catch (err) {
      console.error(`Error fetching messages for chat ${chatId}:`, err.message);
      return [];
    }
  }

  on(event, callback) {
    this.listeners.add({ event, callback });
  }

  off(event, callback) {
    this.listeners = [...this.listeners].filter(
      l => l.event !== event || l.callback !== callback
    );
  }

  emit(event, data) {
    this.listeners.forEach(listener => {
      if (listener.event === event) {
        listener.callback(data);
      }
    });
  }

  getStatus() {
    return {
      status: this.connectionStatus,
      isReady: this.isReady,
      qrCode: this.qrCodeData,
    };
  }

  async refreshQR() {
    if (this.isReady) {
      return { success: false, reason: 'Already connected' };
    }

    try {
      if (this.client && this.client.pupPage) {
        const page = this.client.pupPage;
        if (!page.isClosed()) {
          // Check for WhatsApp Web's click-to-reload QR code button
          const clicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, div[role="button"], span'));
            for (const el of elements) {
              const text = (el.textContent || '').toLowerCase();
              if (text.includes('click to reload') || text.includes('reload qr') || text.includes('click to refresh')) {
                el.click();
                return true;
              }
            }
            return false;
          });

          if (clicked) {
            console.log('Clicked WhatsApp Web reload QR button');
            return { success: true, method: 'button_click' };
          }

          console.log('Reloading WhatsApp Web page for fresh QR code...');
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
          return { success: true, method: 'page_reload' };
        }
      }
    } catch (err) {
      console.warn('In-page QR refresh failed, soft reconnecting:', err.message);
    }

    await this.reconnect();
    return { success: true, method: 'reconnect' };
  }

  async reconnect() {
    if (this.isReconnecting) {
      console.log('Reconnection already in progress, skipping duplicate.');
      return;
    }
    this.isReconnecting = true;
    console.log('Manual reconnect requested. Restarting client...');
    try {
      await this.destroy();
      this.connectionStatus = 'connecting';
      this.qrCodeData = null;
      this.emit('change_state', 'connecting');
      this.initialize(this.clientId);
    } finally {
      setTimeout(() => { this.isReconnecting = false; }, 3000);
    }
  }

  async destroy() {
    this.clearReconnectTimer();
    await this.killBrowser();
    if (this.client) {
      await this.client.destroy().catch(() => {});
      this.client = null;
    }
  }
}

export default new WhatsAppService();