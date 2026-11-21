class AntiSpamService {
  constructor() {
    this.blockDuplicate = process.env.BLOCK_DUPLICATE_MESSAGES === 'true';
    this.duplicateWindow = parseInt(process.env.DUPLICATE_WINDOW_MS) || 60000;
    this.messageHistory = [];
    this.maxHistorySize = 100;
  }

  addMessage(recipient, text) {
    const message = {
      recipient,
      text: this.normalizeText(text),
      timestamp: Date.now(),
    };
    
    this.messageHistory.push(message);
    
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  normalizeText(text) {
    return (text || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  isDuplicate(recipient, text) {
    if (!this.blockDuplicate) return false;

    const normalizedText = this.normalizeText(text);
    const windowStart = Date.now() - this.duplicateWindow;

    return this.messageHistory.some(
      msg => 
        msg.recipient === recipient && 
        msg.text === normalizedText &&
        msg.timestamp > windowStart
    );
  }

  getRecentMessages(recipient = null) {
    const windowStart = Date.now() - this.duplicateWindow;
    
    if (recipient) {
      return this.messageHistory.filter(
        msg => msg.recipient === recipient && msg.timestamp > windowStart
      );
    }
    
    return this.messageHistory.filter(msg => msg.timestamp > windowStart);
  }

  clearHistory() {
    this.messageHistory = [];
  }
}

export default new AntiSpamService();