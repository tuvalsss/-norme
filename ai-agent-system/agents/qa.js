const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../core/logger');
const aiEngine = require('../core/aiEngine');
const memoryManager = require('../core/memoryManager');
const agentManager = require('../core/agentManager');
const { v4: uuidv4 } = require('uuid');

/**
 * סוכן QA - אחראי על בדיקות איכות
 */
class QaAgent {
  constructor() {
    this.active = false;
    this.name = 'qa_agent';
    this.logPrefix = '[qa_agent]';
    this.currentSessionId = null;
    this.memory = null;
    
    // הספק והמודל המועדפים לסוכן QA
    // Claude 3.7 מצטיין בהבנת שגיאות מורכבות וניתוח קוד 
    this.preferredProvider = 'anthropic';
    this.preferredModel = 'claude-3.7-sonnet';
    
    logger.info(`${this.logPrefix} סוכן QA אותחל`);
  }
  
  /**
   * הפעלת הסוכן
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} הסוכן כבר פעיל`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} מפעיל סוכן QA...`);
      
      // יצירת מזהה מפגש חדש
      this.currentSessionId = `session_${uuidv4()}`;
      
      // טען את זיכרון הסוכן
      this.memory = await memoryManager.loadMemory(this.name);
      
      // תעד את התחלת המפגש
      await this._logSessionStart();
      
      // רישום אצל מנהל הסוכנים
      agentManager.registerAgent(this.name, this);
      
      this.active = true;
      logger.info(`${this.logPrefix} סוכן QA הופעל בהצלחה (מפגש: ${this.currentSessionId})`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בהפעלת סוכן QA: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * כיבוי הסוכן
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} הסוכן כבר כבוי`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} מכבה סוכן QA...`);
      
      // תעד את סיום המפגש
      await this._logSessionEnd();
      
      // הסר רישום אצל מנהל הסוכנים
      agentManager.unregisterAgent(this.name);
      
      this.active = false;
      this.currentSessionId = null;
      
      logger.info(`${this.logPrefix} סוכן QA כובה בהצלחה`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בכיבוי סוכן QA: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * בדיקת קוד באופן אוטומטי
   * @param {string} filePath - נתיב לקובץ או תיקייה לבדיקה
   * @param {Object} options - אפשרויות נוספות
   * @returns {Promise<Object>} - תוצאות הבדיקה
   */
  async analyzeCode(filePath, options = {}) {
    if (!this.active) {
      throw new Error('סוכן QA לא פעיל');
    }
    
    logger.info(`${this.logPrefix} מנתח קוד: ${filePath}`);
    
    try {
      const startTime = Date.now();
      let results = {};
      
      // בדוק אם מדובר בקובץ בודד או תיקייה
      const isDirectory = (await fs.stat(filePath)).isDirectory();
      
      if (isDirectory) {
        // אם זו תיקייה, עבור על כל הקבצים בתיקייה (בעומק 1)
        const files = await fs.readdir(filePath);
        
        for (const file of files) {
          const fullPath = path.join(filePath, file);
          
          // דלג על קבצים שאינם טקסט (קבצי בינארי, תמונות וכו')
          if (this._shouldSkipFile(fullPath)) {
            continue;
          }
          
          const stat = await fs.stat(fullPath);
          
          // דלג על תיקיות (אם לא צוינה אפשרות רקורסיבית)
          if (stat.isDirectory() && !options.recursive) {
            continue;
          }
          
          if (stat.isFile()) {
            results[file] = await this._analyzeFile(fullPath);
          }
        }
      } else {
        // אם זה קובץ בודד, נתח אותו
        const fileName = path.basename(filePath);
        results[fileName] = await this._analyzeFile(filePath);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // תעד את פעולת הניתוח
      await this._logAction('analyze_code', {
        filePath,
        options
      }, {
        success: true,
        duration,
        issuesFound: this._countTotalIssues(results)
      });
      
      logger.info(`${this.logPrefix} ניתוח קוד הושלם ל: ${filePath}, משך זמן: ${duration}ms`);
      
      return {
        results,
        duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // תעד את הכישלון
      await this._logAction('analyze_code', {
        filePath,
        options
      }, {
        success: false,
        error: error.message
      });
      
      logger.error(`${this.logPrefix} שגיאה בניתוח קוד: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * ניתוח קובץ בודד באמצעות AI
   * @param {string} filePath - נתיב לקובץ
   * @returns {Promise<Object>} - תוצאות הניתוח
   */
  async _analyzeFile(filePath) {
    // וודא שמדובר בקובץ טקסט
    if (this._shouldSkipFile(filePath)) {
      return { skipped: true, reason: 'קובץ לא רלוונטי לניתוח' };
    }
    
    try {
      const code = await fs.readFile(filePath, 'utf-8');
      const fileExtension = path.extname(filePath).toLowerCase();
      const language = this._mapExtensionToLanguage(fileExtension);
      
      // הכן prompt לניתוח
      const prompt = `
        אנא נתח את הקוד הבא ב-${language || 'שפה לא ידועה'} וזהה בעיות אפשריות:
        
        \`\`\`${fileExtension}
        ${code}
        \`\`\`
        
        זהה ותאר את הבעיות הבאות (אם קיימות):
        1. באגים ושגיאות לוגיות
        2. בעיות ביצועים
        3. בעיות אבטחה
        4. בעיות מבניות ותכנון
        5. סטיה מקונבנציות קוד מקובלות
        
        עבור כל בעיה, אנא ציין:
        - תיאור מפורט של הבעיה
        - מספר שורה (מספרים) בקוד
        - רמת חומרה (נמוכה/בינונית/גבוהה/קריטית)
        - פתרון מוצע עם דוגמת קוד
        
        החזר תשובה בפורמט JSON במבנה הבא:
        {
          "issues": [
            {
              "description": "תיאור הבעיה",
              "lines": [מספרי שורות],
              "severity": "חומרה",
              "solution": "פתרון מוצע עם קוד"
            },
            ...
          ],
          "summary": "סיכום ממצאי הניתוח",
          "score": מספר_בין_0_ל_100
        }
      `;
      
      // קבל מודל מומלץ ממנהל הסוכנים
      const { provider, model } = agentManager.getRecommendedModel(this.name);
      
      // שלח לניתוח ע"י AI
      let response = await aiEngine.query(prompt, {
        provider: provider || this.preferredProvider,
        model: model || this.preferredModel
      });
      
      // נסה לחלץ JSON מהתשובה
      try {
        // חפש אחר בלוק JSON
        const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          response = jsonMatch[1];
        }
        
        // נקה תווים מיותרים ונסה לפרסר
        response = response.trim();
        const result = JSON.parse(response);
        
        return {
          ...result,
          fileSize: code.length,
          lineCount: code.split('\n').length,
          language: language || 'unknown'
        };
      } catch (parseError) {
        logger.warn(`${this.logPrefix} שגיאה בפרסור תשובת ה-AI לקובץ ${filePath}: ${parseError.message}`);
        
        // אם פרסור ה-JSON נכשל, נסה לייצר תוצאה בסיסית
        return {
          issues: [],
          summary: "לא ניתן היה לפרסר את תשובת ה-AI",
          score: 50,
          error: "שגיאת פרסור JSON",
          rawResponse: response.substring(0, 1000) + (response.length > 1000 ? '...' : ''),
          fileSize: code.length,
          lineCount: code.split('\n').length,
          language: language || 'unknown'
        };
      }
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בניתוח קובץ ${filePath}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * בדיקה אם יש לדלג על קובץ
   * @param {string} filePath - נתיב לקובץ
   * @returns {boolean} - האם יש לדלג
   */
  _shouldSkipFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const skipExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
      '.mp3', '.wav', '.mp4', '.avi', '.mov',
      '.zip', '.tar', '.gz', '.rar',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.bin', '.exe', '.dll', '.so', '.dylib',
      '.ttf', '.woff', '.woff2', '.eot',
      '.lock', '.map'
    ];
    
    // דלג על קבצים עם סיומות ידועות שאינן טקסט
    if (skipExtensions.includes(ext)) {
      return true;
    }
    
    // דלג על קבצים שמתחילים בנקודה (למשל .git, .DS_Store)
    const baseName = path.basename(filePath);
    if (baseName.startsWith('.')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * ממפה סיומת קובץ לשפת תכנות
   * @param {string} extension - סיומת הקובץ
   * @returns {string} - שם שפת התכנות
   */
  _mapExtensionToLanguage(extension) {
    const map = {
      '.js': 'JavaScript',
      '.jsx': 'React JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'React TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.c': 'C',
      '.cpp': 'C++',
      '.cs': 'C#',
      '.go': 'Go',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.sh': 'Bash',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.xml': 'XML',
      '.sql': 'SQL'
    };
    
    return map[extension] || null;
  }
  
  /**
   * ספירת סך כל הבעיות שנמצאו בתוצאות
   * @param {Object} results - תוצאות הניתוח
   * @returns {number} - מספר הבעיות
   */
  _countTotalIssues(results) {
    let totalIssues = 0;
    
    for (const fileName in results) {
      const fileResult = results[fileName];
      if (fileResult && fileResult.issues && Array.isArray(fileResult.issues)) {
        totalIssues += fileResult.issues.length;
      }
    }
    
    return totalIssues;
  }
  
  /**
   * תיעוד התחלת מפגש חדש
   */
  async _logSessionStart() {
    if (!this.memory) return;
    
    if (!this.memory.sessions) {
      this.memory.sessions = {};
    }
    
    const startTime = new Date().toISOString();
    
    this.memory.sessions[this.currentSessionId] = {
      startTime,
      endTime: null,
      actions: [],
      status: 'active',
      summary: null
    };
    
    this.memory.stats = this.memory.stats || {};
    this.memory.stats.totalSessions = Object.keys(this.memory.sessions).length;
    this.memory.lastUpdated = startTime;
    
    await memoryManager.saveMemory(this.name, this.memory);
    
    logger.debug(`${this.logPrefix} נפתח מפגש חדש (${this.currentSessionId})`);
  }
  
  /**
   * תיעוד סיום מפגש
   */
  async _logSessionEnd() {
    if (!this.memory || !this.currentSessionId) return;
    
    const session = this.memory.sessions[this.currentSessionId];
    if (!session) return;
    
    const endTime = new Date().toISOString();
    session.endTime = endTime;
    session.status = 'completed';
    
    // חישוב סטטיסטיקות
    const actions = session.actions || [];
    const actionsCount = actions.length;
    const successCount = actions.filter(a => a.result && a.result.success).length;
    const failureCount = actionsCount - successCount;
    
    // יצירת סיכום מפגש
    session.summary = {
      actionsCount,
      successCount,
      failureCount,
      duration: this._calculateDuration(session.startTime, endTime)
    };
    
    this.memory.lastUpdated = endTime;
    
    // עדכן סטטיסטיקות כלליות
    if (!this.memory.stats.lastSuccess && successCount > 0) {
      this.memory.stats.lastSuccess = endTime;
    }
    
    if (!this.memory.stats.lastFailure && failureCount > 0) {
      this.memory.stats.lastFailure = endTime;
    }
    
    await memoryManager.saveMemory(this.name, this.memory);
    
    logger.debug(`${this.logPrefix} מפגש נסגר (${this.currentSessionId}): ${actionsCount} פעולות`);
  }
  
  /**
   * תיעוד פעולה
   */
  async _logAction(actionType, parameters, result) {
    if (!this.memory || !this.currentSessionId) return;
    
    const session = this.memory.sessions[this.currentSessionId];
    if (!session) return;
    
    if (!session.actions) {
      session.actions = [];
    }
    
    const timestamp = new Date().toISOString();
    
    const action = {
      id: `action_${uuidv4()}`,
      type: actionType,
      parameters,
      timestamp,
      result
    };
    
    session.actions.push(action);
    this.memory.lastUpdated = timestamp;
    
    // עדכן סטטיסטיקות
    this.memory.stats = this.memory.stats || {};
    this.memory.stats.totalActions = (this.memory.stats.totalActions || 0) + 1;
    
    if (result && result.success) {
      this.memory.stats.lastSuccess = timestamp;
    } else {
      this.memory.stats.lastFailure = timestamp;
    }
    
    await memoryManager.saveMemory(this.name, this.memory);
    
    logger.debug(`${this.logPrefix} פעולה ${actionType} תועדה (מפגש: ${this.currentSessionId})`);
  }
  
  /**
   * חישוב משך זמן בין שני תאריכים
   * @param {string} startTime - זמן התחלה ISO
   * @param {string} endTime - זמן סיום ISO
   * @returns {number} - משך זמן במילישניות
   */
  _calculateDuration(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return end - start;
  }
}

module.exports = new QaAgent(); 