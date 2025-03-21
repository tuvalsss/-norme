const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { format } = winston;

// יצירת תיקיית לוגים אם היא לא קיימת
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// פורמט רגיל ללוגים
const defaultFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// פורמט ללוגים קונסוליים
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, agent, ...meta }) => {
    const agentPrefix = agent ? `[${agent}]` : '';
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level} ${agentPrefix} ${message} ${metaStr}`;
  })
);

// לוגר מערכת כללי
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: defaultFormat,
  defaultMeta: { service: 'ai-agent-system' },
  transports: [
    // לוג שגיאות לקובץ
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // לוג של כל הרמות לקובץ
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    // פלט לקונסול (רק בסביבת פיתוח)
    process.env.NODE_ENV !== 'production' ? 
      new winston.transports.Console({
        format: consoleFormat
      }) : null
  ].filter(Boolean)
});

/**
 * יוצר לוגר עבור סוכן ספציפי
 * @param {string} agentName - שם הסוכן
 * @returns {winston.Logger} - מופע לוגר ייעודי לסוכן
 */
function createAgentLogger(agentName) {
  // יצירת תיקיית לוגים ייעודית לסוכן
  const agentLogDir = path.join(logDir, agentName);
  if (!fs.existsSync(agentLogDir)) {
    fs.mkdirSync(agentLogDir, { recursive: true });
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: defaultFormat,
    defaultMeta: { agent: agentName },
    transports: [
      // לוג שגיאות לקובץ של הסוכן
      new winston.transports.File({ 
        filename: path.join(agentLogDir, 'error.log'), 
        level: 'error' 
      }),
      // לוג של כל הרמות לקובץ ייעודי לסוכן
      new winston.transports.File({ 
        filename: path.join(agentLogDir, 'agent.log') 
      }),
      // לוג לקובץ המשולב של המערכת
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log') 
      }),
      // פלט לקונסול (רק בסביבת פיתוח)
      process.env.NODE_ENV !== 'production' ? 
        new winston.transports.Console({
          format: consoleFormat
        }) : null
    ].filter(Boolean)
  });
}

module.exports = {
  logger,
  createAgentLogger
}; 