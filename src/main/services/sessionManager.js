import db from '../database/db.js';

export let currentSession = {
  id: null,
  userId: null,
  loginTime: null,
  messagesSent: 0,
  messagesReceived: 0,
  actions: []
};

export async function startSession(userId) {
  // If there's an existing session for a different user, or we are starting fresh:
  if (currentSession.userId === userId && currentSession.id) {
    return; // Already active
  }
  
  // Close previous session if exists
  if (currentSession.id) {
    await endSession();
  }

  currentSession.userId = userId;
  currentSession.loginTime = new Date().toISOString();
  currentSession.messagesSent = 0;
  currentSession.messagesReceived = 0;
  currentSession.actions = ['User initialized bulkflow session'];

  try {
    const res = await db.session_logs.insert({
      userId,
      loginTime: currentSession.loginTime,
      messagesSent: currentSession.messagesSent,
      messagesReceived: currentSession.messagesReceived,
      actions: currentSession.actions
    });
    currentSession.id = res.id;
    console.log('Started new SQLite session log. ID:', currentSession.id);
  } catch (err) {
    console.error('Failed to start session log in DB:', err);
  }
}

export async function addSessionAction(action) {
  if (!currentSession.id) return;
  
  currentSession.actions.push(`[${new Date().toLocaleTimeString()}] ${action}`);
  try {
    await db.session_logs.update(currentSession.id, {
      actions: currentSession.actions
    });
  } catch (err) {
    console.error('Failed to update session actions in DB:', err);
  }
}

export async function incrementSessionSent() {
  if (!currentSession.id) return;
  currentSession.messagesSent += 1;
  try {
    await db.session_logs.update(currentSession.id, {
      messagesSent: currentSession.messagesSent
    });
  } catch (err) {
    console.error('Failed to update messagesSent count:', err);
  }
}

export async function incrementSessionReceived() {
  if (!currentSession.id) return;
  currentSession.messagesReceived += 1;
  try {
    await db.session_logs.update(currentSession.id, {
      messagesReceived: currentSession.messagesReceived
    });
  } catch (err) {
    console.error('Failed to update messagesReceived count:', err);
  }
}

export async function endSession() {
  if (!currentSession.id) return;
  
  currentSession.actions.push('User closed session or logged out');
  try {
    await db.session_logs.update(currentSession.id, {
      logoutTime: new Date().toISOString(),
      actions: currentSession.actions
    });
  } catch (err) {
    console.error('Failed to end session log in DB:', err);
  }
  
  currentSession.id = null;
  currentSession.userId = null;
  currentSession.loginTime = null;
  currentSession.messagesSent = 0;
  currentSession.messagesReceived = 0;
  currentSession.actions = [];
}
