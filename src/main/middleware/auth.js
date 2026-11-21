import rateLimiter from '../services/rateLimiter.js';

export const sendMessageLimiter = (req, res, next) => {
  const check = rateLimiter.canSend();
  
  if (!check.allowed) {
    return res.status(429).json({
      success: false,
      error: check.dailyRemaining === 0 
        ? 'Daily message limit reached' 
        : 'Hourly message limit reached',
      code: check.dailyRemaining === 0 ? 'DAILY_LIMIT' : 'HOURLY_LIMIT',
      rateLimit: check,
    });
  }
  
  next();
};
