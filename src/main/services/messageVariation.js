class MessageVariationService {
  constructor() {
    this.enabled = process.env.ENABLE_MESSAGE_VARIATION === 'true';
    
    this.variations = {
      greetings: [
        'Hello', 'Hi', 'Hey', 'Greetings', 'Hi there', 
        'Good day', 'Hello!', 'Hey there', 'Hi!', 'Greetings!'
      ],
      thanks: [
        'Thank you', 'Thanks', 'Many thanks', 'Thank you so much',
        'Thanks a lot', 'Appreciate it', 'Thank you very much'
      ],
      confirmations: [
        'Got it', 'Understood', 'Sure', 'Okay', 'Yes', 
        'Will do', 'Consider it done', 'Alright'
      ],
    };
  }

  getRandomVariation(type = 'greetings') {
    if (!this.enabled || !this.variations[type]) {
      return null;
    }
    
    const variations = this.variations[type];
    return variations[Math.floor(Math.random() * variations.length)];
  }

  applyVariation(text) {
    if (!this.enabled) return text;

    const patterns = {
      'hello': 'greetings',
      'hi': 'greetings', 
      'hey': 'greetings',
      'thanks': 'thanks',
      'thank you': 'thanks',
      'ok': 'confirmations',
      'okay': 'confirmations',
      'sure': 'confirmations',
    };

    const lowerText = text.toLowerCase().trim();
    
    for (const [pattern, type] of Object.entries(patterns)) {
      if (lowerText === pattern || lowerText.startsWith(pattern + ' ')) {
        const variation = this.getRandomVariation(type);
        if (variation) {
          return text.replace(new RegExp(pattern, 'i'), variation);
        }
      }
    }

    return text;
  }
}

export default new MessageVariationService();