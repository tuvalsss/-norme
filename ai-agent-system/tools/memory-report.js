#!/usr/bin/env node
/**
 * כלי דוח זיכרון
 * 
 * חלון פקודה פשוט להצגת דוחות זיכרון של סוכני AI
 * מאפשר לראות סטטיסטיקות וחיפוש בזיכרון
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const memoryManager = require('../core/memoryManager');
const readline = require('readline');

// יצירת ממשק לקלט/פלט
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// תיקיית הזיכרון
const MEMORY_DIR = path.resolve(__dirname, '../memory');

/**
 * הפונקציה הראשית
 */
async function main() {
  console.log(chalk.blue.bold('\n=== דוח זיכרון סוכני AI ===\n'));
  
  try {
    // בדוק שתיקיית הזיכרון קיימת
    if (!(await fs.pathExists(MEMORY_DIR))) {
      console.log(chalk.red('שגיאה: תיקיית הזיכרון לא קיימת.'));
      return;
    }
    
    // הצג תפריט ראשי
    await showMainMenu();
  } catch (err) {
    console.error(chalk.red(`שגיאה: ${err.message}`));
  } finally {
    rl.close();
  }
}

/**
 * הצג תפריט ראשי
 */
async function showMainMenu() {
  console.log(chalk.cyan('בחר פעולה:'));
  console.log('1. הצג סטטיסטיקות זיכרון לכל הסוכנים');
  console.log('2. חפש בזיכרון של סוכן');
  console.log('3. הצג את המפגשים האחרונים של סוכן');
  console.log('4. נקה את הזיכרון של סוכן');
  console.log('0. יציאה');
  
  rl.question('\nבחירה: ', async (choice) => {
    switch (choice) {
      case '1':
        await showAllAgentsStats();
        break;
      case '2':
        await searchAgentMemory();
        break;
      case '3':
        await showRecentSessions();
        break;
      case '4':
        await clearAgentMemory();
        break;
      case '0':
        console.log(chalk.blue('להתראות!'));
        rl.close();
        return;
      default:
        console.log(chalk.yellow('בחירה לא חוקית, נסה שוב.'));
    }
    
    // חזור לתפריט הראשי
    setTimeout(() => {
      console.log('\n');
      showMainMenu();
    }, 1000);
  });
}

/**
 * הצג סטטיסטיקות לכל הסוכנים
 */
async function showAllAgentsStats() {
  console.log(chalk.blue.bold('\n=== סטטיסטיקות זיכרון סוכנים ===\n'));
  
  try {
    // קבל סטטיסטיקות מכל הסוכנים
    const stats = await memoryManager.getAllAgentsMemoryStats();
    
    if (stats.length === 0) {
      console.log(chalk.yellow('לא נמצאו סוכנים עם זיכרון.'));
      return;
    }
    
    // הצג את הסטטיסטיקות בטבלה
    console.log(chalk.cyan('שם סוכן\t\tמפגשים\tפעולות\tעדכון אחרון\t\tגודל זיכרון'));
    console.log(chalk.gray('------------------------------------------------------------'));
    
    stats.forEach(stat => {
      // התאם את שם הסוכן לתצוגה
      const agentName = stat.agent.padEnd(16, ' ');
      
      // הצג שורה בטבלה
      console.log(
        `${agentName}\t${stat.totalSessions}\t${stat.totalActions}\t` +
        `${new Date(stat.lastUpdated).toLocaleString()}\t` +
        `${formatBytes(stat.memorySize || 0)}`
      );
    });
  } catch (err) {
    console.error(chalk.red(`שגיאה בטעינת סטטיסטיקות: ${err.message}`));
  }
}

/**
 * חפש בזיכרון של סוכן
 */
async function searchAgentMemory() {
  console.log(chalk.blue.bold('\n=== חיפוש בזיכרון סוכן ===\n'));
  
  try {
    // קבל רשימת סוכנים
    const agents = await getAgentsList();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('לא נמצאו סוכנים עם זיכרון.'));
      return;
    }
    
    // הצג רשימת סוכנים
    console.log(chalk.cyan('בחר סוכן:'));
    agents.forEach((agent, idx) => {
      console.log(`${idx + 1}. ${agent}`);
    });
    
    rl.question('\nבחירה (מספר): ', (agentIdx) => {
      const idx = parseInt(agentIdx) - 1;
      
      if (isNaN(idx) || idx < 0 || idx >= agents.length) {
        console.log(chalk.yellow('בחירה לא חוקית.'));
        return;
      }
      
      const selectedAgent = agents[idx];
      
      // שאל על מילת מפתח לחיפוש
      rl.question('הזן מילת מפתח לחיפוש: ', async (keyword) => {
        if (!keyword.trim()) {
          console.log(chalk.yellow('מילת מפתח ריקה, חיפוש בוטל.'));
          return;
        }
        
        // בצע חיפוש
        const results = await memoryManager.searchMemory(selectedAgent, keyword);
        
        if (results.length === 0) {
          console.log(chalk.yellow(`לא נמצאו תוצאות ל-"${keyword}" בזיכרון של ${selectedAgent}.`));
          return;
        }
        
        // הצג תוצאות
        console.log(chalk.green(`\nנמצאו ${results.length} תוצאות:`));
        results.forEach((result, idx) => {
          const timestamp = new Date(result.timestamp || result.startTime).toLocaleString();
          
          if (result.action) {
            // פעולה
            console.log(chalk.white(`\n${idx + 1}. [${timestamp}] ${result.action.title}`));
            console.log(chalk.gray(`   ${result.action.description || ''}`));
            
            if (result.action.result) {
              const resultStr = typeof result.action.result === 'object' ? 
                JSON.stringify(result.action.result, null, 2) : result.action.result;
              console.log(chalk.gray(`   תוצאה: ${resultStr.substring(0, 100)}${resultStr.length > 100 ? '...' : ''}`));
            }
            
            if (result.action.error) {
              console.log(chalk.red(`   שגיאה: ${result.action.error}`));
            }
          } else if (result.summary) {
            // סיכום מפגש
            console.log(chalk.white(`\n${idx + 1}. [${timestamp}] סיכום מפגש ${result.sessionId}`));
            console.log(chalk.gray(`   ${JSON.stringify(result.summary)}`));
          }
        });
      });
    });
  } catch (err) {
    console.error(chalk.red(`שגיאה בחיפוש: ${err.message}`));
  }
}

/**
 * הצג מפגשים אחרונים
 */
async function showRecentSessions() {
  console.log(chalk.blue.bold('\n=== מפגשים אחרונים ===\n'));
  
  try {
    // קבל רשימת סוכנים
    const agents = await getAgentsList();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('לא נמצאו סוכנים עם זיכרון.'));
      return;
    }
    
    // הצג רשימת סוכנים
    console.log(chalk.cyan('בחר סוכן:'));
    agents.forEach((agent, idx) => {
      console.log(`${idx + 1}. ${agent}`);
    });
    
    rl.question('\nבחירה (מספר): ', async (agentIdx) => {
      const idx = parseInt(agentIdx) - 1;
      
      if (isNaN(idx) || idx < 0 || idx >= agents.length) {
        console.log(chalk.yellow('בחירה לא חוקית.'));
        return;
      }
      
      const selectedAgent = agents[idx];
      
      // טען את זיכרון הסוכן
      const memory = await memoryManager.loadMemory(selectedAgent);
      
      if (!memory || !memory.sessions || memory.sessions.length === 0) {
        console.log(chalk.yellow(`לא נמצאו מפגשים לסוכן ${selectedAgent}.`));
        return;
      }
      
      // מיין מהחדש לישן
      const sortedSessions = [...memory.sessions].sort((a, b) => 
        new Date(b.startTime) - new Date(a.startTime)
      );
      
      // הגבל ל-10 מפגשים אחרונים
      const recentSessions = sortedSessions.slice(0, 10);
      
      // הצג מפגשים
      console.log(chalk.green(`\nמפגשים אחרונים לסוכן ${selectedAgent}:`));
      
      recentSessions.forEach((session, idx) => {
        const startTime = new Date(session.startTime).toLocaleString();
        const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'פעיל';
        const status = session.status === 'active' ? chalk.green('פעיל') : 
                      session.status === 'completed' ? chalk.blue('הושלם') : 
                      session.status === 'failed' ? chalk.red('נכשל') : 
                      chalk.gray(session.status);
        
        console.log(chalk.white(`\n${idx + 1}. מפגש ${session.id}`));
        console.log(chalk.gray(`   התחלה: ${startTime}`));
        console.log(chalk.gray(`   סיום: ${endTime}`));
        console.log(chalk.gray(`   סטטוס: ${status}`));
        console.log(chalk.gray(`   פעולות: ${session.actions.length}`));
        
        if (session.summary) {
          console.log(chalk.gray(`   סיכום: ${typeof session.summary === 'object' ? 
            JSON.stringify(session.summary) : session.summary}`));
        }
      });
      
      // הצג אפשרות לפרטים נוספים על מפגש ספציפי
      rl.question('\nהזן מספר מפגש לפרטים נוספים (או Enter לחזרה): ', (sessionIdx) => {
        if (!sessionIdx.trim()) {
          return;
        }
        
        const sIdx = parseInt(sessionIdx) - 1;
        
        if (isNaN(sIdx) || sIdx < 0 || sIdx >= recentSessions.length) {
          console.log(chalk.yellow('בחירה לא חוקית.'));
          return;
        }
        
        const selectedSession = recentSessions[sIdx];
        
        // הצג פעולות במפגש
        console.log(chalk.green(`\nפעולות במפגש ${selectedSession.id}:`));
        
        if (!selectedSession.actions || selectedSession.actions.length === 0) {
          console.log(chalk.yellow('  אין פעולות במפגש זה.'));
          return;
        }
        
        selectedSession.actions.forEach((action, idx) => {
          const timestamp = new Date(action.timestamp).toLocaleString();
          
          console.log(chalk.white(`\n  ${idx + 1}. [${timestamp}] ${action.title}`));
          console.log(chalk.gray(`     ${action.description || ''}`));
          
          if (action.params && Object.keys(action.params).length > 0) {
            console.log(chalk.gray(`     פרמטרים: ${JSON.stringify(action.params)}`));
          }
          
          if (action.result) {
            const resultStr = typeof action.result === 'object' ? 
              JSON.stringify(action.result, null, 2) : action.result;
            console.log(chalk.gray(`     תוצאה: ${resultStr.substring(0, 100)}${resultStr.length > 100 ? '...' : ''}`));
          }
          
          if (action.error) {
            console.log(chalk.red(`     שגיאה: ${action.error}`));
          }
        });
      });
    });
  } catch (err) {
    console.error(chalk.red(`שגיאה בהצגת מפגשים: ${err.message}`));
  }
}

/**
 * נקה את הזיכרון של סוכן
 */
async function clearAgentMemory() {
  console.log(chalk.blue.bold('\n=== ניקוי זיכרון סוכן ===\n'));
  
  try {
    // קבל רשימת סוכנים
    const agents = await getAgentsList();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('לא נמצאו סוכנים עם זיכרון.'));
      return;
    }
    
    // הצג רשימת סוכנים
    console.log(chalk.cyan('בחר סוכן:'));
    agents.forEach((agent, idx) => {
      console.log(`${idx + 1}. ${agent}`);
    });
    
    console.log(`${agents.length + 1}. כל הסוכנים`);
    
    rl.question('\nבחירה (מספר): ', (agentIdx) => {
      const idx = parseInt(agentIdx) - 1;
      
      if (isNaN(idx) || idx < 0 || idx > agents.length) {
        console.log(chalk.yellow('בחירה לא חוקית.'));
        return;
      }
      
      // שאל לאישור
      const confirmMessage = idx === agents.length ? 
        'האם אתה בטוח שברצונך לנקות את הזיכרון של כל הסוכנים? (כן/לא): ' :
        `האם אתה בטוח שברצונך לנקות את הזיכרון של ${agents[idx]}? (כן/לא): `;
      
      rl.question(chalk.red(confirmMessage), async (answer) => {
        if (answer.toLowerCase() !== 'כן' && answer.toLowerCase() !== 'yes') {
          console.log(chalk.yellow('הפעולה בוטלה.'));
          return;
        }
        
        // בצע ניקוי
        if (idx === agents.length) {
          // נקה את הזיכרון של כל הסוכנים
          let successCount = 0;
          
          for (const agent of agents) {
            const success = await memoryManager.clearMemory(agent);
            if (success) successCount++;
          }
          
          console.log(chalk.green(`זיכרון נוקה בהצלחה ל-${successCount} מתוך ${agents.length} סוכנים.`));
        } else {
          // נקה את הזיכרון של סוכן ספציפי
          const selectedAgent = agents[idx];
          const success = await memoryManager.clearMemory(selectedAgent);
          
          if (success) {
            console.log(chalk.green(`זיכרון הסוכן ${selectedAgent} נוקה בהצלחה.`));
          } else {
            console.log(chalk.red(`שגיאה בניקוי זיכרון הסוכן ${selectedAgent}.`));
          }
        }
      });
    });
  } catch (err) {
    console.error(chalk.red(`שגיאה בניקוי זיכרון: ${err.message}`));
  }
}

/**
 * קבל רשימת סוכנים מתיקיית הזיכרון
 * @returns {Promise<string[]>} רשימת סוכנים
 */
async function getAgentsList() {
  try {
    const files = await fs.readdir(MEMORY_DIR);
    return files
      .filter(file => file.endsWith('.json') && !file.includes('.backup.'))
      .map(file => file.replace('.json', ''));
  } catch (err) {
    console.error(chalk.red(`שגיאה בקבלת רשימת סוכנים: ${err.message}`));
    return [];
  }
}

/**
 * פורמט גודל בבתים למחרוזת קריאה
 * @param {number} bytes - גודל בבתים
 * @returns {string} מחרוזת מפורמטת
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// הפעל את הסקריפט
main(); 