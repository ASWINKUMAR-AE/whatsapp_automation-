class MessageQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.processing = false;
  }

  async enqueue(message) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...message,
        id: Date.now() + Math.random(),
        resolve,
        reject,
        timestamp: Date.now(),
      });
      this.processNext();
    });
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      
      try {
        await this.executeTask(item);
        item.resolve({ success: true, ...item.result });
      } catch (error) {
        item.reject(error);
      }
      
      this.queue.shift();
      
      if (this.queue.length > 0) {
        await this.delay(1000);
      }
    }

    this.isProcessing = false;
  }

  async executeTask(item) {
    const { task, delay } = item;
    
    if (delay) {
      await this.delay(delay);
    }
    
    return await task();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueLength() {
    return this.queue.length;
  }

  clearQueue() {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

export default new MessageQueue();