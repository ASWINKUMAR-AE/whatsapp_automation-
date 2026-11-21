class RateLimiter {
  constructor() {
    this.hourlyLimit = parseInt(process.env.MAX_MESSAGES_PER_HOUR) || 999999;
    this.dailyLimit = parseInt(process.env.MAX_MESSAGES_PER_DAY) || 999999;
    
    this.hourlyMessages = [];
    this.dailyMessages = [];
    this.dailyResetTime = this.getResetTime();
  }

  getResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  resetDailyIfNeeded() {
    const now = new Date();
    if (now >= this.dailyResetTime) {
      this.dailyMessages = [];
      this.dailyResetTime = this.getResetTime();
    }
  }

  cleanupOldMessages() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.hourlyMessages = this.hourlyMessages.filter(time => time > oneHourAgo);
  }

  canSend() {
    return {
      allowed: true,
      hourlyLimit: 'Unlimited',
      dailyLimit: 'Unlimited',
      hourlyRemaining: 'Unlimited',
      dailyRemaining: 'Unlimited',
    };
  }

  recordMessage() {
    const now = Date.now();
    this.hourlyMessages.push(now);
    this.dailyMessages.push(now);
  }

  getStats() {
    this.cleanupOldMessages();
    this.resetDailyIfNeeded();

    return {
      hourlyLimit: 'Unlimited',
      dailyLimit: 'Unlimited',
      sentThisHour: this.hourlyMessages.length,
      sentToday: this.dailyMessages.length,
      hourlyRemaining: 'Unlimited',
      dailyRemaining: 'Unlimited',
    };
  }
}

export default new RateLimiter();