import datastore from 'nedb-promises';
import path from 'path';
import fs from 'fs';
import db from './db.js';

// Try both possible data directories
const potentialPaths = [
  path.join(process.cwd(), 'src', 'main', 'data'),
  path.join(process.cwd(), 'data')
];

// Helper to find the actual active path for a file
function findDbFile(filename) {
  for (const dir of potentialPaths) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
      return filePath;
    }
  }
  // Fallback to first path if none exist or none are non-empty
  return path.join(potentialPaths[0], filename);
}

async function runMigration() {
  console.log('--- STARTING NEDB TO MYSQL MIGRATION ---');

  // 1. Migrate Users
  const usersDbFile = findDbFile('users.db');
  if (fs.existsSync(usersDbFile) && fs.statSync(usersDbFile).size > 0) {
    console.log(`Loading users from NeDB file: ${usersDbFile}...`);
    const usersStore = datastore.create(usersDbFile);
    await usersStore.load();
    const users = await usersStore.find({});
    console.log(`Found ${users.length} users in NeDB.`);

    for (const u of users) {
      try {
        // Check if user already exists in MySQL
        const existing = await db.users.findOne({ id: u._id });
        if (existing) {
          console.log(`User "${u.name}" (${u.email}) already exists in MySQL. Skipping.`);
          continue;
        }

        console.log(`Migrating user: "${u.name}" (${u.email})...`);
        await db.users.insert({
          _id: u._id,
          name: u.name,
          email: u.email,
          password: u.password,
          apiKey: u.apiKey,
          isAdmin: u.isAdmin,
          subscription: u.subscription,
          whitelistedContacts: u.whitelistedContacts,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        });
      } catch (err) {
        console.error(`Failed to migrate user: ${u.email}`, err);
      }
    }
  } else {
    console.log('No non-empty users.db file found. Skipping.');
  }

  // 2. Migrate Message Logs
  const logsDbFile = findDbFile('logs.db');
  if (fs.existsSync(logsDbFile) && fs.statSync(logsDbFile).size > 0) {
    console.log(`Loading message logs from NeDB file: ${logsDbFile}...`);
    const logsStore = datastore.create(logsDbFile);
    await logsStore.load();
    const logs = await logsStore.find({});
    console.log(`Found ${logs.length} logs in NeDB.`);

    let migratedLogsCount = 0;
    for (const l of logs) {
      try {
        // Check if log already exists in MySQL
        const existing = await db.message_logs.findOne({ msgId: l.msgId || l._id });
        if (existing) {
          continue;
        }

        await db.message_logs.insert({
          user_id: l.user_id || l.userId || null,
          msgId: l.msgId || l._id,
          type: l.type,
          recipient: l.recipient,
          contactName: l.contactName,
          text: l.text,
          mediaType: l.mediaType,
          status: l.status,
          error: l.error,
          timestamp: l.timestamp,
          is_history: l.is_history
        });
        migratedLogsCount++;
      } catch (err) {
        console.error(`Failed to migrate log: ${l._id}`, err.message);
      }
    }
    console.log(`Migrated ${migratedLogsCount} new message logs.`);
  } else {
    console.log('No non-empty logs.db file found. Skipping.');
  }

  // 3. Migrate Payments
  const paymentsDbFile = findDbFile('payments.db');
  if (fs.existsSync(paymentsDbFile) && fs.statSync(paymentsDbFile).size > 0) {
    console.log(`Loading payments from NeDB file: ${paymentsDbFile}...`);
    const paymentsStore = datastore.create(paymentsDbFile);
    await paymentsStore.load();
    const payments = await paymentsStore.find({});
    console.log(`Found ${payments.length} payments in NeDB.`);

    for (const p of payments) {
      try {
        const existing = await db.payments.findOne({ id: p._id });
        if (existing) {
          console.log(`Payment ID ${p._id} already exists in MySQL. Skipping.`);
          continue;
        }

        console.log(`Migrating payment ID: ${p._id}...`);
        await db.payments.insert({
          _id: p._id,
          userId: p.userId,
          userEmail: p.userEmail,
          planId: p.planId,
          duration: p.duration,
          screenshotUrl: p.screenshotUrl,
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        });
      } catch (err) {
        console.error(`Failed to migrate payment ID ${p._id}`, err);
      }
    }
  } else {
    console.log('No non-empty payments.db file found. Skipping.');
  }

  console.log('--- MIGRATION COMPLETE ---');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
