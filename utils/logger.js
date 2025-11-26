const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    }));
  },
  
  error: (message, error = null) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      error: error?.message || error,
      stack: error?.stack
    }));
  },
  
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message,
      ...meta
    }));
  },
  
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
        message,
        ...meta
      }));
    }
  }
};

module.exports = {
  logger
};
