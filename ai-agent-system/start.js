#!/usr/bin/env node

const dotenv = require('dotenv');
const { spawn } = require('child_process');
const { logger } = require('./core/logger');
const fs = require('fs');
const path = require('path');

// טען הגדרות סביבה
dotenv.config();

// בדוק אם קיים קובץ .env
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.error('קובץ .env לא נמצא! אנא הרץ npm run install-system תחילה.');
  process.exit(1);
}

// ייבוא הסוכנים
const devAgent = require('./agents/dev');
const qaAgent = require('./agents/qa');
const executorAgent = require('./agents/executor');
const summaryAgent = require('./agents/summary');
const gitSyncAgent = require('./agents/git_sync');

// פונקציה להפעלת כל הסוכנים
async function startAllAgents() {
  logger.info('מפעיל את כל הסוכנים...');
  
  try {
    await devAgent.start();
    logger.info('סוכן הפיתוח הופעל');
    
    await qaAgent.start();
    logger.info('סוכן הבדיקות הופעל');
    
    await executorAgent.start();
    logger.info('סוכן הביצוע הופעל');
    
    await summaryAgent.start();
    logger.info('סוכן הסיכום הופעל');
    
    await gitSyncAgent.start();
    logger.info('סוכן סנכרון Git הופעל');
    
    logger.info('כל הסוכנים הופעלו בהצלחה!');
  } catch (error) {
    logger.error(`שגיאה בהפעלת הסוכנים: ${error.message}`);
    console.error('שגיאה בהפעלת הסוכנים:', error);
  }
}

// הפעל את כל הסוכנים
startAllAgents();

// התחל את השרת
const serverProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  detached: false
});

serverProcess.on('error', (error) => {
  logger.error(`שגיאה בהפעלת השרת: ${error.message}`);
  console.error('שגיאה בהפעלת השרת:', error);
});

// טפל בסיום תהליך
process.on('SIGINT', async () => {
  logger.info('מכבה את המערכת...');
  
  // כבה את כל הסוכנים
  try {
    await devAgent.stop();
    await qaAgent.stop();
    await executorAgent.stop();
    await summaryAgent.stop();
    await gitSyncAgent.stop();
    logger.info('כל הסוכנים כובו בהצלחה');
  } catch (error) {
    logger.error(`שגיאה בכיבוי הסוכנים: ${error.message}`);
  }
  
  // סיים את התהליך
  process.exit(0);
}); 