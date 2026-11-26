import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const dbDir = path.join(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'whatsapp_automation.db');

const sqlite = sqlite3.verbose();
const dbConnection = new sqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err.message);
  } else {
    console.log('SQLite database opened successfully at:', dbPath);
  }
});

// Helper functions to execute SQL queries as Promises
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConnection.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConnection.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConnection.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Table initializations
async function initializeDb() {
  try {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        apiKey TEXT UNIQUE NOT NULL,
        isAdmin INTEGER DEFAULT 0,
        plan TEXT DEFAULT 'free',
        dailyLimit INTEGER DEFAULT 999999,
        messagesSentToday INTEGER DEFAULT 0,
        lastResetDate TEXT DEFAULT NULL,
        isActive INTEGER DEFAULT 1,
        expiryDate TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Ensure all existing free users have unlimited daily messages
    await runQuery(`UPDATE users SET dailyLimit = 999999 WHERE plan = 'free'`);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS user_whitelisted_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        phoneNumber TEXT NOT NULL,
        UNIQUE(userId, phoneNumber),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        userEmail TEXT NOT NULL,
        planId TEXT NOT NULL,
        duration INTEGER DEFAULT 30,
        screenshotUrl TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        loginTime TEXT NOT NULL,
        logoutTime TEXT DEFAULT NULL,
        messagesSent INTEGER DEFAULT 0,
        messagesReceived INTEGER DEFAULT 0,
        actions TEXT DEFAULT '[]'
      )
    `);

    await runQuery(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        recipient TEXT,
        contactName TEXT,
        text TEXT,
        type TEXT,
        status TEXT,
        mediaType TEXT,
        msgId TEXT,
        error TEXT,
        timestamp TEXT NOT NULL
      )
    `);

    console.log('SQLite Database Tables initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize SQLite Database:', err);
  }
}

// Trigger initialization
initializeDb();

// NeDB-compatible API Wrapper for SQLite
const db = {
  users: {
    async insert(doc) {
      const id = doc._id || doc.id || uuidv4();
      const name = doc.name;
      const email = doc.email;
      const password = doc.password;
      const apiKey = doc.apiKey || uuidv4();
      const isAdmin = doc.isAdmin ? 1 : 0;
      
      const sub = doc.subscription || {};
      const plan = sub.plan || 'free';
      const dailyLimit = sub.dailyLimit !== undefined ? sub.dailyLimit : 999999;
      const messagesSentToday = sub.messagesSentToday || 0;
      const lastResetDate = sub.lastResetDate || new Date().toISOString();
      const isActive = sub.isActive !== undefined ? (sub.isActive ? 1 : 0) : 1;
      const expiryDate = sub.expiryDate || null;
      
      const createdAt = doc.createdAt || new Date().toISOString();
      const updatedAt = doc.updatedAt || new Date().toISOString();

      await runQuery(
        `INSERT INTO users (id, name, email, password, apiKey, isAdmin, plan, dailyLimit, messagesSentToday, lastResetDate, isActive, expiryDate, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, email, password, apiKey, isAdmin, plan, dailyLimit, messagesSentToday, lastResetDate, isActive, expiryDate, createdAt, updatedAt]
      );

      // Handle whitelistedContacts
      if (doc.whitelistedContacts && Array.isArray(doc.whitelistedContacts)) {
        for (const phone of doc.whitelistedContacts) {
          await runQuery(
            `INSERT OR IGNORE INTO user_whitelisted_contacts (userId, phoneNumber) VALUES (?, ?)`,
            [id, phone]
          );
        }
      }

      return { ...doc, _id: id, id };
    },

    async findOne(filter) {
      let sql = 'SELECT * FROM users WHERE 1=1';
      const params = [];

      if (filter.email) {
        sql += ' AND email = ?';
        params.push(filter.email);
      }
      if (filter._id || filter.id) {
        sql += ' AND id = ?';
        params.push(filter._id || filter.id);
      }
      if (filter.apiKey) {
        sql += ' AND apiKey = ?';
        params.push(filter.apiKey);
      }

      const user = await getQuery(sql, params);
      if (!user) return null;

      // Fetch whitelisted contacts
      const contacts = await allQuery('SELECT phoneNumber FROM user_whitelisted_contacts WHERE userId = ?', [user.id]);
      
      return {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        apiKey: user.apiKey,
        isAdmin: !!user.isAdmin,
        subscription: {
          plan: user.plan,
          dailyLimit: user.plan === 'free' || !user.dailyLimit || user.dailyLimit >= 999999 ? 'Unlimited' : user.dailyLimit,
          messagesSentToday: user.messagesSentToday,
          lastResetDate: user.lastResetDate,
          isActive: !!user.isActive,
          expiryDate: user.expiryDate
        },
        whitelistedContacts: contacts.map(c => c.phoneNumber),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    },

    async update(filter, updateDoc) {
      const userId = filter._id || filter.id;
      if (!userId) return 0;

      // 1. Process $addToSet (for whitelisted contacts)
      if (updateDoc.$addToSet && updateDoc.$addToSet.whitelistedContacts) {
        const phone = updateDoc.$addToSet.whitelistedContacts;
        await runQuery(
          `INSERT OR IGNORE INTO user_whitelisted_contacts (userId, phoneNumber) VALUES (?, ?)`,
          [userId, phone]
        );
        return 1;
      }

      // 2. Process $pull (for whitelisted contacts)
      if (updateDoc.$pull && updateDoc.$pull.whitelistedContacts) {
        const phone = updateDoc.$pull.whitelistedContacts;
        await runQuery(
          `DELETE FROM user_whitelisted_contacts WHERE userId = ? AND phoneNumber = ?`,
          [userId, phone]
        );
        return 1;
      }

      // 3. Process $set and $inc
      const setClauses = [];
      const params = [];

      if (updateDoc.$set) {
        const set = updateDoc.$set;
        Object.keys(set).forEach(key => {
          if (key === 'subscription.messagesSentToday') {
            setClauses.push('messagesSentToday = ?');
            params.push(set[key]);
          } else if (key === 'subscription.lastResetDate') {
            setClauses.push('lastResetDate = ?');
            params.push(set[key]);
          } else if (key === 'subscription.isActive') {
            setClauses.push('isActive = ?');
            params.push(set[key] ? 1 : 0);
          } else if (key === 'subscription.plan') {
            setClauses.push('plan = ?');
            params.push(set[key]);
          } else if (key === 'subscription.dailyLimit') {
            setClauses.push('dailyLimit = ?');
            params.push(set[key]);
          } else if (key === 'subscription.expiryDate') {
            setClauses.push('expiryDate = ?');
            params.push(set[key]);
          } else if (key === 'updatedAt') {
            setClauses.push('updatedAt = ?');
            params.push(set[key]);
          } else if (key === 'name') {
            setClauses.push('name = ?');
            params.push(set[key]);
          } else if (key === 'email') {
            setClauses.push('email = ?');
            params.push(set[key]);
          }
        });
      }

      if (updateDoc.$inc) {
        const inc = updateDoc.$inc;
        Object.keys(inc).forEach(key => {
          if (key === 'subscription.messagesSentToday') {
            setClauses.push('messagesSentToday = messagesSentToday + ?');
            params.push(inc[key]);
          }
        });
      }

      if (setClauses.length === 0) return 0;

      params.push(userId);
      const res = await runQuery(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
      return res.changes;
    }
  },

  payments: {
    async insert(doc) {
      const id = doc._id || doc.id || uuidv4();
      const userId = doc.userId;
      const userEmail = doc.userEmail;
      const planId = doc.planId;
      const duration = doc.duration || 30;
      const screenshotUrl = doc.screenshotUrl;
      const status = doc.status || 'pending';
      const createdAt = doc.createdAt || new Date().toISOString();
      const updatedAt = doc.updatedAt || new Date().toISOString();

      await runQuery(
        `INSERT INTO payments (id, userId, userEmail, planId, duration, screenshotUrl, status, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, userEmail, planId, duration, screenshotUrl, status, createdAt, updatedAt]
      );

      return { ...doc, _id: id, id };
    },

    async findOne(filter) {
      let sql = 'SELECT * FROM payments WHERE 1=1';
      const params = [];

      if (filter._id || filter.id) {
        sql += ' AND id = ?';
        params.push(filter._id || filter.id);
      }

      const row = await getQuery(sql, params);
      if (!row) return null;

      return {
        _id: row.id,
        id: row.id,
        userId: row.userId,
        userEmail: row.userEmail,
        planId: row.planId,
        duration: row.duration,
        screenshotUrl: row.screenshotUrl,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    },

    find(filter) {
      const chain = {
        sortObj: null,
        sort(s) {
          this.sortObj = s;
          return this;
        },
        async then(resolve, reject) {
          try {
            let sql = 'SELECT * FROM payments WHERE 1=1';
            const params = [];

            if (filter.userId) {
              sql += ' AND userId = ?';
              params.push(filter.userId);
            }

            if (this.sortObj) {
              const sortKey = Object.keys(this.sortObj)[0];
              const sortDir = this.sortObj[sortKey] === -1 ? 'DESC' : 'ASC';
              sql += ` ORDER BY ${sortKey} ${sortDir}`;
            }

            const rows = await allQuery(sql, params);
            const payments = rows.map(row => ({
              _id: row.id,
              id: row.id,
              userId: row.userId,
              userEmail: row.userEmail,
              planId: row.planId,
              duration: row.duration,
              screenshotUrl: row.screenshotUrl,
              status: row.status,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt
            }));

            resolve(payments);
          } catch (err) {
            reject(err);
          }
        }
      };
      return chain;
    },

    async update(filter, updateDoc) {
      const paymentId = filter._id || filter.id;
      if (!paymentId) return 0;

      const setClauses = [];
      const params = [];

      if (updateDoc.$set) {
        const set = updateDoc.$set;
        Object.keys(set).forEach(key => {
          setClauses.push(`\`${key}\` = ?`);
          params.push(set[key]);
        });
      }

      if (setClauses.length === 0) return 0;

      params.push(paymentId);
      const res = await runQuery(
        `UPDATE payments SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
      return res.changes;
    }
  },

  // Persistent SQLite message_logs table
  message_logs: {
    async insert(doc) {
      const userId = doc.user_id || doc.userId || null;
      const recipient = doc.recipient || doc.to || doc.from || '';
      const contactName = doc.contactName || '';
      const text = doc.text || '';
      const type = doc.type || 'sent';
      const status = doc.status || 'success';
      const mediaType = doc.mediaType || null;
      const msgId = doc.msgId || null;
      const error = doc.error || null;
      const timestamp = doc.timestamp || new Date().toISOString();

      const res = await runQuery(
        `INSERT INTO message_logs (user_id, recipient, contactName, text, type, status, mediaType, msgId, error, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, recipient, contactName, text, type, status, mediaType, msgId, error, timestamp]
      );

      return {
        ...doc,
        id: res.lastID,
        _id: res.lastID,
        user_id: userId,
        recipient,
        to: recipient,
        from: recipient,
        contactName,
        text,
        type,
        status,
        mediaType,
        msgId,
        error,
        timestamp
      };
    },

    async findOne(filter) {
      let sql = 'SELECT * FROM message_logs WHERE 1=1';
      const params = [];
      if (filter.id || filter._id) {
        sql += ' AND id = ?';
        params.push(filter.id || filter._id);
      }
      if (filter.msgId) {
        sql += ' AND msgId = ?';
        params.push(filter.msgId);
      }
      const row = await getQuery(sql, params);
      if (!row) return null;
      return { ...row, _id: row.id, to: row.recipient, from: row.recipient };
    },

    find(filter = {}) {
      let sortDesc = true;
      let limitCount = 50;

      const chain = {
        sort(sortObj) {
          if (sortObj && sortObj.timestamp === 1) sortDesc = false;
          return this;
        },
        limit(num) {
          if (num) limitCount = num;
          return this;
        },
        async then(resolve, reject) {
          try {
            let sql = 'SELECT * FROM message_logs WHERE 1=1';
            const params = [];

            if (filter.type && filter.type !== 'all') {
              sql += ' AND type = ?';
              params.push(filter.type);
            }
            if (filter.user_id) {
              sql += ' AND (user_id = ? OR user_id IS NULL)';
              params.push(filter.user_id);
            }
            if (filter.search) {
              sql += ' AND (text LIKE ? OR recipient LIKE ? OR contactName LIKE ?)';
              const term = `%${filter.search}%`;
              params.push(term, term, term);
            }

            sql += ` ORDER BY id ${sortDesc ? 'DESC' : 'ASC'} LIMIT ?`;
            params.push(limitCount);

            const rows = await allQuery(sql, params);
            const logs = rows.map(r => ({
              ...r,
              _id: r.id,
              to: r.recipient,
              from: r.recipient
            }));
            resolve(logs);
          } catch (err) {
            reject(err);
          }
        }
      };
      return chain;
    },

    async remove(filter) {
      if (filter && (filter.id || filter._id)) {
        const res = await runQuery('DELETE FROM message_logs WHERE id = ?', [filter.id || filter._id]);
        return res.changes;
      }
      const res = await runQuery('DELETE FROM message_logs');
      return res.changes;
    }
  },

  // Session activity auditing logs [NEW]
  session_logs: {
    async insert(doc) {
      const userId = doc.userId;
      const loginTime = doc.loginTime || new Date().toISOString();
      const logoutTime = doc.logoutTime || null;
      const messagesSent = doc.messagesSent || 0;
      const messagesReceived = doc.messagesReceived || 0;
      const actions = JSON.stringify(doc.actions || []);

      const res = await runQuery(
        `INSERT INTO session_logs (userId, loginTime, logoutTime, messagesSent, messagesReceived, actions) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, loginTime, logoutTime, messagesSent, messagesReceived, actions]
      );

      return { ...doc, id: res.lastID, _id: res.lastID };
    },

    async update(sessionId, updateDoc) {
      const setClauses = [];
      const params = [];

      if (updateDoc.logoutTime) {
        setClauses.push('logoutTime = ?');
        params.push(updateDoc.logoutTime);
      }
      if (updateDoc.messagesSent !== undefined) {
        setClauses.push('messagesSent = ?');
        params.push(updateDoc.messagesSent);
      }
      if (updateDoc.messagesReceived !== undefined) {
        setClauses.push('messagesReceived = ?');
        params.push(updateDoc.messagesReceived);
      }
      if (updateDoc.actions) {
        setClauses.push('actions = ?');
        params.push(JSON.stringify(updateDoc.actions));
      }

      if (setClauses.length === 0) return 0;

      params.push(sessionId);
      const res = await runQuery(
        `UPDATE session_logs SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
      return res.changes;
    },

    find(filter = {}) {
      const chain = {
        async then(resolve, reject) {
          try {
            let sql = 'SELECT * FROM session_logs WHERE 1=1';
            const params = [];

            if (filter && filter.userId) {
              sql += ' AND (userId = ? OR userId IS NULL)';
              params.push(filter.userId);
            }

            sql += ' ORDER BY id DESC LIMIT 100';

            const rows = await allQuery(sql, params);
            const sessions = rows.map(row => ({
              id: row.id,
              _id: row.id,
              userId: row.userId,
              loginTime: row.loginTime,
              logoutTime: row.logoutTime,
              messagesSent: row.messagesSent,
              messagesReceived: row.messagesReceived,
              actions: JSON.parse(row.actions || '[]')
            }));

            resolve(sessions);
          } catch (err) {
            reject(err);
          }
        }
      };
      return chain;
    }
  },

  whitelisted_contacts: {
    async remove(filter, options) {
      return 0;
    }
  }
};

export default db;
