class RateLimiter {
  constructor() {
    this.hourlyLimit = parseInt(process.env.MAX_MESSAGES_PER_HOUR) || 50;
    this.dailyLimit = parseInt(process.env.MAX_MESSAGES_PER_DAY) || 100;
    
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
    this.cleanupOldMessages();
    this.resetDailyIfNeeded();

    const hourlyCount = this.hourlyMessages.length;
    const dailyCount = this.dailyMessages.length;

    return {
      allowed: hourlyCount < this.hourlyLimit && dailyCount < this.dailyLimit,
      hourlyLimit: this.hourlyLimit,
      dailyLimit: this.dailyLimit,
      hourlyRemaining: Math.max(0, this.hourlyLimit - hourlyCount),
      dailyRemaining: Math.max(0, this.dailyLimit - dailyCount),
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
      hourlyLimit: this.hourlyLimit,
      dailyLimit: this.dailyLimit,
      sentThisHour: this.hourlyMessages.length,
      sentToday: this.dailyMessages.length,
      hourlyRemaining: Math.max(0, this.hourlyLimit - this.hourlyMessages.length),
      dailyRemaining: Math.max(0, this.dailyLimit - this.dailyMessages.length),
    };
  }
}

export default new RateLimiter();