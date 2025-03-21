const aiEngine = require('../core/aiEngine');
const fileManager = require('../core/fileManager');
const { createAgentLogger } = require('../core/logger');
const path = require('path');
const fs = require('fs-extra');

// ייבוא סוכנים אחרים לקבלת סטטוס
const devAgent = require('./dev');
const qaAgent = require('./qa');
const executorAgent = require('./executor');

// צור logger ייעודי לסוכן הסיכום
const logger = createAgentLogger('summary_agent');

/**
 * סוכן סיכום שאוסף סטטוס, כותב לוגים ודוחות
 */
class SummaryAgent {
  constructor() {
    this.name = 'summary_agent';
    this.active = false;
    this.provider = 'anthropic'; // ספק ברירת מחדל
    this.model = 'claude-3-haiku';  // מודל ברירת מחדל (קל יותר לסיכומים)
    
    logger.info('סוכן סיכום אותחל');
  }

  /**
   * מפעיל את הסוכן
   * @returns {Promise<void>}
   */
  async start() {
    this.active = true;
    logger.info('סוכן סיכום הופעל');
  }

  /**
   * מכבה את הסוכן
   * @returns {Promise<void>}
   */
  async stop() {
    this.active = false;
    logger.info('סוכן סיכום כובה');
  }

  /**
   * אוסף את סטטוס כל הסוכנים
   * @returns {Promise<Object>} - סטטוס כל הסוכנים
   */
  async collectAgentsStatus() {
    logger.info('אוסף סטטוס מכל הסוכנים');
    
    try {
      const status = {
        timestamp: new Date().toISOString(),
        agents: {
          dev: {
            active: devAgent.active,
            provider: devAgent.provider,
            model: devAgent.model
          },
          qa: {
            active: qaAgent.active,
            provider: qaAgent.provider,
            model: qaAgent.model
          },
          executor: await executorAgent.getStatus()
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        }
      };
      
      // שמור את הסטטוס לקובץ לוג
      const logFileName = `status_${new Date().toISOString().replace(/:/g, '-')}.json`;
      const logPath = `logs/summary_agent/${logFileName}`;
      await fileManager.writeFile(logPath, JSON.stringify(status, null, 2));
      
      logger.info(`סטטוס נאסף ונשמר ב: ${logPath}`);
      return status;
      
    } catch (error) {
      logger.error(`שגיאה באיסוף סטטוס: ${error.message}`);
      throw error;
    }
  }

  /**
   * מנתח קבצי לוג וכותב דוח סיכום
   * @param {string} logDir - תיקיית הלוגים לניתוח
   * @param {string} outputFile - קובץ הפלט לדוח
   * @returns {Promise<string>} - תוכן הדוח
   */
  async generateLogSummary(logDir = 'logs', outputFile = 'logs/summary.md') {
    logger.info(`מנתח לוגים בתיקייה: ${logDir}`);
    
    try {
      // אסוף את כל קבצי הלוג
      const logFiles = await this._collectLogFiles(logDir);
      
      // אם אין קבצי לוג, החזר הודעה
      if (logFiles.length === 0) {
        const noLogsMessage = 'לא נמצאו קבצי לוג לניתוח.';
        await fileManager.writeFile(outputFile, noLogsMessage);
        return noLogsMessage;
      }
      
      // קרא תוכן מדגמי מקבצי הלוג (מוגבל לכמה שורות מכל קובץ)
      const logSamples = {};
      const MAX_LINES = 50; // מקסימום שורות לקריאה מכל קובץ
      
      for (const file of logFiles.slice(0, 20)) { // הגבל ל-20 קבצים
        try {
          const content = await fileManager.readFile(file);
          // קח רק את השורות הראשונות
          const lines = content.split('\n').slice(0, MAX_LINES);
          logSamples[file] = lines.join('\n');
        } catch (error) {
          logger.warn(`לא ניתן לקרוא קובץ לוג ${file}: ${error.message}`);
          logSamples[file] = 'שגיאה בקריאת קובץ';
        }
      }
      
      // הכן את ה-prompt לסיכום
      const prompt = `
        אנא נתח את קבצי הלוג הבאים וספק סיכום תמציתי.
        עבור כל קובץ לוג, תן סטטיסטיקות מפתח ומידע רלוונטי.
        
        קבצי לוג לניתוח:
        ${Object.keys(logSamples).map(file => `- ${file}`).join('\n')}
        
        דוגמאות תוכן של קובצי הלוג:
        ${Object.entries(logSamples).map(([file, content]) => 
          `## ${file}\n\`\`\`\n${content}\n\`\`\``
        ).join('\n\n')}
        
        אנא כלול בסיכום:
        1. מספר כולל של קבצי לוג
        2. פעילות עיקרית לפי סוג סוכן
        3. שגיאות או בעיות שזוהו
        4. סטטיסטיקות חשובות (כמו הצלחות/כשלונות)
        5. המלצות להמשך על סמך הממצאים
        
        פלט בפורמט Markdown.
      `;
      
      // הפעל את מנוע ה-AI לסיכום
      const summary = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // הוסף כותרת וזמן
      const fullSummary = `# סיכום לוגים
תאריך: ${new Date().toLocaleDateString()}
זמן: ${new Date().toLocaleTimeString()}

${summary}`;
      
      // שמור את הסיכום
      await fileManager.writeFile(outputFile, fullSummary);
      
      logger.info(`סיכום לוגים נוצר ונשמר ב: ${outputFile}`);
      return fullSummary;
      
    } catch (error) {
      logger.error(`שגיאה ביצירת סיכום לוגים: ${error.message}`);
      throw error;
    }
  }

  /**
   * יוצר דוח סטטוס פרויקט מלא
   * @param {string} projectPath - נתיב לתיקיית הפרויקט
   * @param {string} outputFile - קובץ הפלט לדוח
   * @returns {Promise<string>} - תוכן הדוח
   */
  async generateProjectReport(projectPath = 'workspace', outputFile = 'logs/project_report.md') {
    logger.info(`מייצר דוח פרויקט עבור: ${projectPath}`);
    
    try {
      // אסוף מידע על מבנה הפרויקט
      const filesInfo = await this._getProjectStructure(projectPath);
      
      // אסוף סטטוס סוכנים
      const agentsStatus = await this.collectAgentsStatus();
      
      // הכן את ה-prompt
      const prompt = `
        אנא צור דוח סטטוס פרויקט מפורט בהתבסס על המידע הבא:
        
        ## מבנה הפרויקט
        ${JSON.stringify(filesInfo, null, 2)}
        
        ## סטטוס סוכנים
        ${JSON.stringify(agentsStatus, null, 2)}
        
        הדוח צריך לכלול:
        1. סקירה כללית של הפרויקט
        2. מידע על הקבצים והתיקיות העיקריים
        3. סטטוס עדכני של הסוכנים השונים
        4. בעיות ידועות או אתגרים
        5. צעדים מומלצים להמשך
        
        פלט בפורמט Markdown עם כותרות, סעיפים ובליטים.
      `;
      
      // הפעל את מנוע ה-AI ליצירת הדוח
      const report = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // הוסף כותרת ראשית ומידע על זמן
      const fullReport = `# דוח סטטוס פרויקט
תאריך: ${new Date().toLocaleDateString()}
זמן: ${new Date().toLocaleTimeString()}

${report}`;
      
      // שמור את הדוח
      await fileManager.writeFile(outputFile, fullReport);
      
      logger.info(`דוח פרויקט נוצר ונשמר ב: ${outputFile}`);
      return fullReport;
      
    } catch (error) {
      logger.error(`שגיאה ביצירת דוח פרויקט: ${error.message}`);
      throw error;
    }
  }

  /**
   * אוסף את כל קבצי הלוג מתיקייה
   * @param {string} logDir - תיקיית הלוגים
   * @returns {Promise<string[]>} - רשימת נתיבים לקבצי הלוג
   * @private
   */
  async _collectLogFiles(logDir) {
    const logFiles = [];
    
    async function scanDir(dir) {
      const items = await fileManager.listFiles(dir);
      
      for (const item of items) {
        if (item.isDirectory) {
          // סרוק תיקיות משנה
          await scanDir(item.path);
        } else if (item.name.endsWith('.log') || 
                  item.name.endsWith('.json') || 
                  item.name.endsWith('.md')) {
          // הוסף רק קבצי לוג רלוונטיים
          logFiles.push(item.path);
        }
      }
    }
    
    await scanDir(logDir);
    return logFiles;
  }

  /**
   * מקבל מידע על מבנה הפרויקט
   * @param {string} projectPath - נתיב לתיקיית הפרויקט
   * @returns {Promise<Object>} - מידע על מבנה הפרויקט
   * @private
   */
  async _getProjectStructure(projectPath) {
    // ספור קבצים לפי סוג
    const counts = {};
    const MAX_DEPTH = 3; // עומק מקסימלי לסריקה
    
    async function scanDir(dir, depth = 0) {
      if (depth > MAX_DEPTH) return;
      
      const items = await fileManager.listFiles(dir);
      
      for (const item of items) {
        if (item.isDirectory) {
          // סרוק תיקיות משנה
          await scanDir(item.path, depth + 1);
        } else {
          // ספור לפי סיומת
          const ext = path.extname(item.name).toLowerCase();
          counts[ext] = (counts[ext] || 0) + 1;
        }
      }
    }
    
    await scanDir(projectPath);
    
    // קבל רשימה של הקבצים החשובים
    const keyFiles = [];
    try {
      const items = await fileManager.listFiles(projectPath);
      for (const item of items) {
        if (!item.isDirectory && 
            (item.name === 'package.json' || 
             item.name === 'README.md' || 
             item.name.startsWith('index.') || 
             item.name === 'config.json')) {
          keyFiles.push(item.path);
        }
      }
    } catch (error) {
      logger.warn(`שגיאה בקריאת קבצים חשובים: ${error.message}`);
    }
    
    return {
      fileCounts: counts,
      keyFiles,
      totalFiles: Object.values(counts).reduce((a, b) => a + b, 0)
    };
  }
}

module.exports = new SummaryAgent(); 