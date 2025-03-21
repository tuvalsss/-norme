const aiEngine = require('../core/aiEngine');
const fileManager = require('../core/fileManager');
const { createAgentLogger } = require('../core/logger');
const path = require('path');
const fs = require('fs-extra');
const memoryManager = require('../core/memoryManager');
const agentManager = require('../core/agentManager');
const { v4: uuidv4 } = require('uuid');

// ייבוא סוכנים אחרים לקבלת סטטוס
const devAgent = require('./dev_agent');
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
    this.isRunning = false;
    this.currentSummaryId = null;
    
    logger.info('סוכן סיכום אותחל');
  }

  /**
   * מפעיל את הסוכן
   * @returns {Promise<void>}
   */
  async start() {
    this.active = true;
    this.isRunning = true;
    this.currentSummaryId = `summary_${uuidv4()}`;
    
    // תיעוד במנהל הזיכרון
    if (memoryManager && typeof memoryManager.logAction === 'function') {
      memoryManager.logAction(this.name, 'Summary agent initialized');
    }
    
    logger.info('סוכן סיכום הופעל');
    return true;
  }

  /**
   * מכבה את הסוכן
   * @returns {Promise<void>}
   */
  async stop() {
    this.active = false;
    this.isRunning = false;
    
    // תיעוד במנהל הזיכרון
    if (memoryManager && typeof memoryManager.logAction === 'function') {
      memoryManager.logAction(this.name, 'Summary agent stopped');
    }
    
    logger.info('סוכן סיכום כובה');
    return true;
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
   * יצירת סיכום לפעילות סוכן מסוים
   * @param {string} agentName - שם הסוכן לסיכום
   * @param {object} options - אפשרויות סיכום
   * @param {number} options.timePeriod - תקופת זמן לסיכום בשעות (ברירת מחדל: 24)
   * @param {boolean} options.includeInsights - האם לכלול תובנות (ברירת מחדל: true)
   * @param {string} options.format - פורמט התוצאה (json/text/markdown, ברירת מחדל: markdown)
   * @returns {Promise<object>} - תוצאות הסיכום
   */
  async generateAgentSummary(agentName, options = {}) {
    if (!this.active) {
      await this.start();
    }

    try {
      const timePeriod = options.timePeriod || 24;
      const includeInsights = options.includeInsights !== false;
      const format = options.format || 'markdown';
      
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        memoryManager.logAction(
          this.name, 
          `Generating summary for agent ${agentName} for the last ${timePeriod} hours`
        );
      }

      // טעינת זיכרון הסוכן
      const agentMemory = await memoryManager.loadAgentMemory(agentName);
      if (!agentMemory || !agentMemory.sessions || !agentMemory.actions) {
        throw new Error(`No memory found for agent ${agentName}`);
      }

      // סינון פעולות מהתקופה הרלוונטית
      const cutoffTime = new Date(Date.now() - (timePeriod * 60 * 60 * 1000));
      const recentActions = agentMemory.actions
        .filter(action => new Date(action.timestamp) > cutoffTime)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (recentActions.length === 0) {
        return {
          agent: agentName,
          period: `${timePeriod} hours`,
          timestamp: new Date().toISOString(),
          summary: 'No activity during this period',
          actions: 0
        };
      }

      // חישוב מדדים סטטיסטיים
      const stats = this._calculateStats(recentActions);

      // בניית מסד נתונים לסיכום
      const summaryData = {
        agent: agentName,
        period: `${timePeriod} hours`,
        timestamp: new Date().toISOString(),
        stats,
        actions: recentActions.length,
        firstAction: recentActions[0].timestamp,
        lastAction: recentActions[recentActions.length - 1].timestamp
      };

      // הוספת תובנות אם נדרש
      if (includeInsights) {
        summaryData.insights = await this._generateInsights(agentName, recentActions, stats);
      }

      // פורמט התוצאה
      const formattedSummary = await this._formatSummary(summaryData, format);
      
      // שמירה בזיכרון
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        await memoryManager.logAction(
          this.name, 
          `Generated summary for agent ${agentName}`, 
          true, 
          { summaryId: this.currentSummaryId }
        );
      }

      return formattedSummary;
    } catch (error) {
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        memoryManager.logAction(
          this.name, 
          `Error generating summary for agent ${agentName}: ${error.message}`, 
          false
        );
      }
      throw error;
    }
  }

  /**
   * יצירת סיכום מערכת כולל
   * @param {object} options - אפשרויות סיכום
   * @param {number} options.timePeriod - תקופת זמן לסיכום בשעות (ברירת מחדל: 24)
   * @param {boolean} options.includeInsights - האם לכלול תובנות (ברירת מחדל: true)
   * @param {string} options.format - פורמט התוצאה (json/text/markdown, ברירת מחדל: markdown)
   * @returns {Promise<object>} - תוצאות הסיכום
   */
  async generateSystemSummary(options = {}) {
    if (!this.active) {
      await this.start();
    }

    try {
      const timePeriod = options.timePeriod || 24;
      const includeInsights = options.includeInsights !== false;
      const format = options.format || 'markdown';
      
      // רשימת הסוכנים לסיכום
      const agentNames = ['dev_agent', 'qa_agent', 'executor_agent', 'git_sync_agent'];
      
      // צור סיכום לכל סוכן
      const agentSummaries = {};
      for (const agentName of agentNames) {
        try {
          const agentSummary = await this.generateAgentSummary(
            agentName, 
            { timePeriod, includeInsights, format: 'json' }
          );
          agentSummaries[agentName] = agentSummary;
        } catch (error) {
          logger.warn(`שגיאה בסיכום הסוכן ${agentName}: ${error.message}`);
          agentSummaries[agentName] = { error: error.message };
        }
      }
      
      // בנה סיכום מערכת מלא
      const systemSummary = {
        timestamp: new Date().toISOString(),
        period: `${timePeriod} hours`,
        agents: agentSummaries,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      };
      
      // הוסף תובנות מערכתיות אם נדרש
      if (includeInsights) {
        systemSummary.insights = await this._generateSystemInsights(systemSummary);
      }
      
      // פורמט לפלט הרצוי
      if (format === 'json') {
        return systemSummary;
      } else {
        return this._formatSystemSummary(systemSummary, format);
      }
    } catch (error) {
      logger.error(`שגיאה ביצירת סיכום מערכת: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * מדווח על בעיה או תקלה במערכת
   * @param {string} issueType - סוג הבעיה
   * @param {Object} issueData - נתוני הבעיה
   * @returns {Promise<void>}
   */
  async reportIssue(issueType, issueData) {
    try {
      logger.info(`מדווח על בעיה מסוג: ${issueType}`);
      
      // תיעוד הבעיה בלוג
      const issueReport = {
        type: issueType,
        timestamp: new Date().toISOString(),
        data: issueData
      };
      
      // שמירת הדיווח
      const reportFileName = `issue_${issueType}_${new Date().toISOString().replace(/:/g, '-')}.json`;
      const reportPath = `logs/issues/${reportFileName}`;
      
      // וודא שתיקיית היעד קיימת
      await fs.ensureDir(path.dirname(reportPath));
      
      // שמור את הדוח
      await fs.writeJson(reportPath, issueReport, { spaces: 2 });
      
      // תיעוד בזיכרון
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        await memoryManager.logAction(
          this.name,
          `Reported issue: ${issueType}`,
          false,
          { issueType, reportPath }
        );
      }
      
      logger.info(`דוח בעיה נשמר ב: ${reportPath}`);
    } catch (error) {
      logger.error(`שגיאה בדיווח על בעיה: ${error.message}`);
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
          logFiles.push(item.path);
        }
      }
    }
    
    await scanDir(logDir);
    return logFiles;
  }

  /**
   * מקבל מידע על מבנה פרויקט
   * @param {string} projectDir - תיקיית הפרויקט
   * @returns {Promise<Object>} - מידע על מבנה הפרויקט
   * @private
   */
  async _getProjectStructure(projectDir) {
    try {
      const result = {
        path: projectDir,
        files: [],
        dirs: [],
        summary: {}
      };
      
      // אסוף מידע על קבצים
      async function scanDir(dir, isRoot = false) {
        const items = await fileManager.listFiles(dir);
        
        const fileTypes = {};
        let totalFiles = 0;
        let totalDirs = 0;
        
        for (const item of items) {
          const relativePath = path.relative(projectDir, item.path);
          
          if (item.isDirectory) {
            totalDirs++;
            
            // הוסף את התיקייה לרשימה אם זו תיקיית השורש
            if (isRoot) {
              result.dirs.push({
                name: item.name,
                path: relativePath
              });
            }
            
            // סרוק תיקיות משנה (עד לעומק מסוים)
            if (relativePath.split(path.sep).length < 5) {
              await scanDir(item.path);
            }
          } else {
            totalFiles++;
            
            // ספור את סיומות הקבצים
            const ext = path.extname(item.name).toLowerCase();
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            
            // הוסף קבצים מיוחדים לרשימה
            if (isRoot && (
                item.name === 'README.md' || 
                item.name === 'package.json' || 
                item.name === 'requirements.txt' || 
                item.name === '.gitignore'
              )) {
              result.files.push({
                name: item.name,
                path: relativePath,
                size: item.size
              });
            }
          }
        }
        
        // עדכן את הסיכום
        Object.entries(fileTypes).forEach(([ext, count]) => {
          result.summary[ext] = (result.summary[ext] || 0) + count;
        });
        
        result.summary.totalFiles = (result.summary.totalFiles || 0) + totalFiles;
        result.summary.totalDirs = (result.summary.totalDirs || 0) + totalDirs;
      }
      
      await scanDir(projectDir, true);
      return result;
      
    } catch (error) {
      logger.error(`שגיאה באיסוף מידע על מבנה הפרויקט: ${error.message}`);
      return { error: error.message };
    }
  }
  
  /**
   * חישוב סטטיסטיקות מפעולות הסוכן
   * @param {Array} actions - פעולות הסוכן
   * @returns {Object} - סטטיסטיקות
   * @private
   */
  _calculateStats(actions) {
    const stats = {
      total: actions.length,
      byResult: { success: 0, failure: 0, neutral: 0 },
      byType: {}
    };
    
    for (const action of actions) {
      // ספור לפי תוצאה
      if (action.success === true) {
        stats.byResult.success++;
      } else if (action.success === false) {
        stats.byResult.failure++;
      } else {
        stats.byResult.neutral++;
      }
      
      // ספור לפי סוג פעולה
      const actionDesc = action.description || 'unknown';
      const actionType = this._categorizeAction(actionDesc);
      stats.byType[actionType] = (stats.byType[actionType] || 0) + 1;
    }
    
    return stats;
  }
  
  /**
   * קטגוריזציה של פעולת סוכן לפי תיאור
   * @param {string} description - תיאור הפעולה
   * @returns {string} - קטגוריה
   * @private
   */
  _categorizeAction(description) {
    description = description.toLowerCase();
    
    if (description.includes('initialize') || description.includes('started')) {
      return 'initialization';
    } else if (description.includes('create') || description.includes('generating')) {
      return 'creation';
    } else if (description.includes('analyze') || description.includes('checking')) {
      return 'analysis';
    } else if (description.includes('fix') || description.includes('repair')) {
      return 'fixing';
    } else if (description.includes('test') || description.includes('testing')) {
      return 'testing';
    } else if (description.includes('report') || description.includes('summary')) {
      return 'reporting';
    } else {
      return 'other';
    }
  }
  
  /**
   * יצירת תובנות מפעולות סוכן
   * @param {string} agentName - שם הסוכן
   * @param {Array} actions - פעולות הסוכן
   * @param {Object} stats - סטטיסטיקות
   * @returns {Promise<Array>} - תובנות
   * @private
   */
  async _generateInsights(agentName, actions, stats) {
    try {
      // הכן את ה-prompt לניתוח
      const prompt = `
        אנא נתח את הפעולות הבאות של סוכן ה-AI בשם "${agentName}" וספק עד 5 תובנות משמעותיות.
        
        ## סטטיסטיקות פעולות
        ${JSON.stringify(stats, null, 2)}
        
        ## דוגמאות לפעולות אחרונות (עד 10)
        ${JSON.stringify(actions.slice(-10), null, 2)}
        
        אנא צור רשימה של עד 5 תובנות או מסקנות מנותחות. 
        לכל תובנה ציין:
        1. כותרת התובנה (קצרה וממצה)
        2. תיאור קצר שמסביר את התובנה עם נתונים תומכים מהמידע
        3. רמת חשיבות (HIGH/MEDIUM/LOW)
        
        פורמט JSON בלבד. לדוגמה:
        [
          {
            "title": "פעילות הסוכן מתרכזת בניתוח קוד",
            "description": "70% מהפעולות מתמקדות בניתוח קוד, בעוד רק 20% בתיקון בעיות",
            "importance": "HIGH"
          }
        ]
      `;
      
      // הפעל את מנוע ה-AI לניתוח והפקת תובנות
      const insightsText = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // נסה לפרסר את התשובה כ-JSON
      try {
        return JSON.parse(insightsText);
      } catch (error) {
        logger.warn(`שגיאה בפירסור תובנות: ${error.message}`);
        
        // אם הפירסור נכשל, נסה להחזיר תובנה בסיסית
        return [{
          title: "ניתוח לא זמין",
          description: "לא ניתן לפרסר את התובנות שהופקו",
          importance: "LOW"
        }];
      }
    } catch (error) {
      logger.error(`שגיאה בהפקת תובנות: ${error.message}`);
      return [];
    }
  }
  
  /**
   * יצירת תובנות מערכתיות
   * @param {Object} systemSummary - סיכום מערכת
   * @returns {Promise<Array>} - תובנות מערכתיות
   * @private
   */
  async _generateSystemInsights(systemSummary) {
    try {
      // הכן את ה-prompt לניתוח
      const prompt = `
        אנא נתח את סיכום המערכת הבא וספק עד 5 תובנות מערכתיות חשובות.
        
        ## סיכום מערכת
        ${JSON.stringify(systemSummary, null, 2)}
        
        אנא צור רשימה של עד 5 תובנות או מסקנות ברמה המערכתית.
        לכל תובנה ציין:
        1. כותרת התובנה (קצרה וממצה)
        2. תיאור קצר שמסביר את התובנה עם נתונים תומכים מהמידע
        3. רמת חשיבות (HIGH/MEDIUM/LOW)
        4. המלצות אופציונאליות
        
        פורמט JSON בלבד.
      `;
      
      // הפעל את מנוע ה-AI לניתוח והפקת תובנות
      const insightsText = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // נסה לפרסר את התשובה כ-JSON
      try {
        return JSON.parse(insightsText);
      } catch (error) {
        logger.warn(`שגיאה בפירסור תובנות מערכת: ${error.message}`);
        
        // אם הפירסור נכשל, נסה להחזיר תובנה בסיסית
        return [{
          title: "ניתוח מערכת לא זמין",
          description: "לא ניתן לפרסר את התובנות המערכתיות שהופקו",
          importance: "LOW"
        }];
      }
    } catch (error) {
      logger.error(`שגיאה בהפקת תובנות מערכתיות: ${error.message}`);
      return [];
    }
  }
  
  /**
   * פורמט סיכום לפי הפורמט הרצוי
   * @param {Object} summaryData - נתוני הסיכום
   * @param {string} format - פורמט (json/text/markdown)
   * @returns {Promise<any>} - הסיכום המפורמט
   * @private
   */
  async _formatSummary(summaryData, format) {
    if (format === 'json') {
      return summaryData;
    }
    
    let formattedSummary = '';
    
    if (format === 'markdown') {
      formattedSummary = `# סיכום פעילות סוכן ${summaryData.agent}
      
## מידע כללי
- **תקופה**: ${summaryData.period}
- **זמן**: ${new Date(summaryData.timestamp).toLocaleString()}
- **סך פעולות**: ${summaryData.actions}
- **פעולה ראשונה**: ${new Date(summaryData.firstAction).toLocaleString()}
- **פעולה אחרונה**: ${new Date(summaryData.lastAction).toLocaleString()}

## סטטיסטיקות
- **הצלחות**: ${summaryData.stats.byResult.success} (${Math.round(summaryData.stats.byResult.success / summaryData.stats.total * 100)}%)
- **כשלונות**: ${summaryData.stats.byResult.failure} (${Math.round(summaryData.stats.byResult.failure / summaryData.stats.total * 100)}%)

### לפי סוג פעולה
${Object.entries(summaryData.stats.byType).map(([type, count]) => 
  `- **${type}**: ${count} (${Math.round(count / summaryData.stats.total * 100)}%)`
).join('\n')}
`;

      // הוסף תובנות אם קיימות
      if (summaryData.insights && summaryData.insights.length > 0) {
        formattedSummary += `\n## תובנות\n`;
        
        summaryData.insights.forEach(insight => {
          formattedSummary += `### ${insight.title} (${insight.importance})\n${insight.description}\n\n`;
        });
      }
    } else {
      // פורמט טקסט פשוט
      formattedSummary = `סיכום פעילות סוכן ${summaryData.agent}\n\n`;
      formattedSummary += `תקופה: ${summaryData.period}\n`;
      formattedSummary += `זמן: ${new Date(summaryData.timestamp).toLocaleString()}\n`;
      formattedSummary += `סך פעולות: ${summaryData.actions}\n\n`;
      
      formattedSummary += `סטטיסטיקות:\n`;
      formattedSummary += `- הצלחות: ${summaryData.stats.byResult.success} (${Math.round(summaryData.stats.byResult.success / summaryData.stats.total * 100)}%)\n`;
      formattedSummary += `- כשלונות: ${summaryData.stats.byResult.failure} (${Math.round(summaryData.stats.byResult.failure / summaryData.stats.total * 100)}%)\n\n`;
      
      // הוסף תובנות אם קיימות
      if (summaryData.insights && summaryData.insights.length > 0) {
        formattedSummary += `תובנות:\n`;
        
        summaryData.insights.forEach(insight => {
          formattedSummary += `- ${insight.title} (${insight.importance}): ${insight.description}\n`;
        });
      }
    }
    
    return formattedSummary;
  }
  
  /**
   * פורמט סיכום מערכת לפי הפורמט הרצוי
   * @param {Object} systemSummary - נתוני סיכום המערכת
   * @param {string} format - פורמט (text/markdown)
   * @returns {Promise<string>} - הסיכום המפורמט
   * @private
   */
  async _formatSystemSummary(systemSummary, format) {
    let formattedSummary = '';
    
    if (format === 'markdown') {
      formattedSummary = `# סיכום מערכת
      
## מידע כללי
- **תקופה**: ${systemSummary.period}
- **זמן**: ${new Date(systemSummary.timestamp).toLocaleString()}
- **זמן ריצה מערכת**: ${Math.floor(systemSummary.system.uptime / 3600)} שעות, ${Math.floor((systemSummary.system.uptime % 3600) / 60)} דקות

## סטטוס סוכנים
`;

      // הוסף מידע על כל סוכן
      Object.entries(systemSummary.agents).forEach(([agentName, agentData]) => {
        formattedSummary += `### ${agentName}\n`;
        
        if (agentData.error) {
          formattedSummary += `- **שגיאה**: ${agentData.error}\n`;
        } else {
          formattedSummary += `- **פעולות**: ${agentData.actions || 0}\n`;
          
          if (agentData.stats && agentData.stats.byResult) {
            formattedSummary += `- **הצלחות**: ${agentData.stats.byResult.success || 0}\n`;
            formattedSummary += `- **כשלונות**: ${agentData.stats.byResult.failure || 0}\n`;
          }
        }
        
        formattedSummary += '\n';
      });

      // הוסף תובנות אם קיימות
      if (systemSummary.insights && systemSummary.insights.length > 0) {
        formattedSummary += `## תובנות מערכת\n`;
        
        systemSummary.insights.forEach(insight => {
          formattedSummary += `### ${insight.title} (${insight.importance})\n${insight.description}\n`;
          
          if (insight.recommendations) {
            formattedSummary += `\n**המלצות**: ${insight.recommendations}\n`;
          }
          
          formattedSummary += '\n';
        });
      }
    } else {
      // פורמט טקסט פשוט
      formattedSummary = `סיכום מערכת\n\n`;
      formattedSummary += `תקופה: ${systemSummary.period}\n`;
      formattedSummary += `זמן: ${new Date(systemSummary.timestamp).toLocaleString()}\n\n`;
      
      formattedSummary += `סטטוס סוכנים:\n`;
      
      // הוסף מידע על כל סוכן
      Object.entries(systemSummary.agents).forEach(([agentName, agentData]) => {
        formattedSummary += `- ${agentName}: `;
        
        if (agentData.error) {
          formattedSummary += `שגיאה: ${agentData.error}\n`;
        } else {
          formattedSummary += `${agentData.actions || 0} פעולות`;
          
          if (agentData.stats && agentData.stats.byResult) {
            formattedSummary += `, ${agentData.stats.byResult.success || 0} הצלחות, ${agentData.stats.byResult.failure || 0} כשלונות`;
          }
          
          formattedSummary += '\n';
        }
      });
      
      // הוסף תובנות אם קיימות
      if (systemSummary.insights && systemSummary.insights.length > 0) {
        formattedSummary += `\nתובנות מערכת:\n`;
        
        systemSummary.insights.forEach(insight => {
          formattedSummary += `- ${insight.title} (${insight.importance}): ${insight.description}\n`;
          
          if (insight.recommendations) {
            formattedSummary += `  המלצות: ${insight.recommendations}\n`;
          }
        });
      }
    }
    
    return formattedSummary;
  }
}

module.exports = new SummaryAgent(); 