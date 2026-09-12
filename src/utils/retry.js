const logger = require('./logger');

const withRetry = async (fn, options = {}) => {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 1000;
  const onRetry = options.onRetry;

  let attempt = 1;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt > maxRetries) {
        throw error;
      }

      if (onRetry) {
        onRetry(error, attempt);
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.info(`Retry attempt ${attempt} failed. Retrying in ${delay}ms... Error: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
};

module.exports = { withRetry };
