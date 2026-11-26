import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

class UserService {
    async createUser({ name, email, password, isAdmin = false }) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const apiKey = uuidv4();
        
        const user = {
            name,
            email,
            password: hashedPassword,
            apiKey,
            isAdmin: !!isAdmin,
            subscription: {
                plan: 'free',
                dailyLimit: 999999, // Unlimited
                messagesSentToday: 0,
                lastResetDate: new Date().toISOString(),
                isActive: true
            },
            whitelistedContacts: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        return await db.users.insert(user);
    }

    async getUserByEmail(email) {
        return await db.users.findOne({ email });
    }

    async getUserById(id) {
        const user = await db.users.findOne({ _id: id });
        return user;
    }

    async getUserByApiKey(apiKey) {
        return await db.users.findOne({ apiKey });
    }

    async getDefaultUser() {
        const user = await db.users.findOne({});
        if (user) return user;
        return await this.createUser({
            name: 'Local User',
            email: 'admin@local.app',
            password: 'local-password',
            isAdmin: true
        });
    }

    async comparePassword(user, password) {
        return await bcrypt.compare(password, user.password);
    }

    mapUser(user) {
        if (!user) return null;
        // NeDB uses _id instead of id. We'll map it to avoid breaking changes.
        const mapped = { ...user, id: user._id };
        delete mapped.password;
        delete mapped.apiKey;
        return mapped;
    }

    async resetDailyMessageCount(userId) {
        const user = await db.users.findOne({ _id: userId });
        if (!user) return;

        const today = new Date().toDateString();
        const lastReset = user.subscription.lastResetDate ? new Date(user.subscription.lastResetDate).toDateString() : null;

        if (today !== lastReset) {
            await db.users.update(
                { _id: userId },
                { 
                    $set: { 
                        'subscription.messagesSentToday': 0, 
                        'subscription.lastResetDate': new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    } 
                }
            );
        }
    }

    async canSendMessage(userId) {
        return {
            allowed: true,
            remaining: 'Unlimited',
            limit: 'Unlimited'
        };
    }

    async recordMessage(userId) {
        await this.resetDailyMessageCount(userId);
        await db.users.update(
            { _id: userId },
            { 
                $inc: { 'subscription.messagesSentToday': 1 },
                $set: { updatedAt: new Date().toISOString() }
            }
        );
        return await this.getUserById(userId);
    }

    async upgradeToPremium(userId, durationDays = 30) {
        const user = await this.getUserById(userId);
        if (!user) return null;

        const now = new Date();
        let expiryDate;
        
        if (user.subscription.expiryDate && new Date(user.subscription.expiryDate) > now) {
            expiryDate = new Date(new Date(user.subscription.expiryDate).getTime() + durationDays * 24 * 60 * 60 * 1000);
        } else {
            expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        }

        await db.users.update(
            { _id: userId },
            { 
                $set: { 
                    'subscription.plan': 'premium',
                    'subscription.dailyLimit': 500,
                    'subscription.isActive': true,
                    'subscription.expiryDate': expiryDate.toISOString(),
                    updatedAt: new Date().toISOString()
                } 
            }
        );

        return await this.getUserById(userId);
    }

    async addWhitelistedContact(userId, phoneNumber) {
        const normalized = phoneNumber.replace(/[^0-9]/g, '');
        await db.users.update(
            { _id: userId },
            { $addToSet: { whitelistedContacts: normalized } }
        );
        return await this.getUserById(userId);
    }

    async removeWhitelistedContact(userId, phoneNumber) {
        const normalized = phoneNumber.replace(/[^0-9]/g, '');
        await db.users.update(
            { _id: userId },
            { $pull: { whitelistedContacts: normalized } }
        );
        return await this.getUserById(userId);
    }
}

export const userService = new UserService();
