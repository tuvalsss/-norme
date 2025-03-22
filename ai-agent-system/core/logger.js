const fs = require('fs-extra');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf, colorize } = format;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
fs.ensureDirSync(logsDir);

// Create custom log format
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

// Create logger with console and file transports
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    }),
    new transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    new transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    })
  ]
});

// Add timestamp to each log entry
logger.timestamp = () => {
  return new Date().toISOString();
};

// Log agent action with optional success status
const logAgentAction = (agentId, action, success = true) => {
  const status = success ? 'SUCCESS' : 'FAILURE';
  const message = `${agentId} | ${action} | ${status}`;
  success ? logger.info(message) : logger.error(message);
  return { timestamp: logger.timestamp(), agentId, action, success };
};

// Log system event
const logSystemEvent = (eventType, message) => {
  logger.info(`SYSTEM | ${eventType} | ${message}`);
  return { timestamp: logger.timestamp(), type: 'system', eventType, message };
};

// Log user interaction
const logUserInteraction = (userId, action, details = {}) => {
  const message = `USER ${userId} | ${action} | ${JSON.stringify(details)}`;
  logger.info(message);
  return { timestamp: logger.timestamp(), type: 'user', userId, action, details };
};

// Export logger functions
module.exports = logger;
module.exports.logAgentAction = logAgentAction;
module.exports.logSystemEvent = logSystemEvent;
module.exports.logUserInteraction = logUserInteraction; 