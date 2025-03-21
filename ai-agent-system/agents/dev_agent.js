const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { EventEmitter } = require('events');
const { logger } = require('../core/logger');
const { v4: uuidv4 } = require('uuid');
const memoryManager = require('../core/memoryManager');
const aiEngine = require('../core/aiEngine');
const agentManager = require('../core/agentManager');

/**
 * סוכן פיתוח
 * אחראי על ניהול משימות פיתוח וכתיבת קוד
 */
class DevAgent {
  constructor() {
    this.active = false;
    this.workingDir = null;
    this.currentTask = null;
    this.events = new EventEmitter();
    this.logPrefix = '[dev_agent]';
    
    // תיקיית ברירת מחדל לעבודה
    this.workspacePath = path.resolve(__dirname, '../workspace');
    
    // מצב עבודה (debug/production)
    this.mode = process.env.DEV_AGENT_MODE || 'debug';
    
    // מזהה המפגש הנוכחי
    this.currentSessionId = null;
    
    // זיכרון סוכן
    this.memory = null;
    
    // תת-סוכנים
    this.subAgents = {
      gpt4: new Gpt4SubAgent(this), // תת-סוכן GPT-4 (coding)
      claude: new ClaudeSubAgent(this) // תת-סוכן Claude (code review)
    };
    
    // האם להשתמש בתת-סוכנים? (ברירת מחדל: כן)
    this.useSubAgents = process.env.USE_SUB_AGENTS !== 'false';
    
    logger.info(`${this.logPrefix} סוכן פיתוח אותחל. שימוש בתת-סוכנים: ${this.useSubAgents ? 'כן' : 'לא'}`);
  }
  
  /**
   * הפעל את הסוכן
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} הסוכן כבר פעיל`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} מפעיל סוכן פיתוח...`);
      
      // יצירת מזהה מפגש חדש
      this.currentSessionId = `session_${uuidv4()}`;
      
      // טען את זיכרון הסוכן
      this.memory = await memoryManager.loadMemory('dev_agent');
      
      // תעד את התחלת המפגש
      await this._logSessionStart();
      
      // ברישום אצל מנהל הסוכנים
      agentManager.registerAgent('dev_agent', this);
      
      // הפעל את תת-הסוכנים (אם צריך)
      if (this.useSubAgents) {
        await Promise.all([
          this.subAgents.gpt4.start(),
          this.subAgents.claude.start()
        ]);
      }
      
      this.active = true;
      logger.info(`${this.logPrefix} סוכן פיתוח הופעל בהצלחה (מפגש: ${this.currentSessionId})`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בהפעלת סוכן פיתוח: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * כבה את הסוכן
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} הסוכן כבר כבוי`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} מכבה סוכן פיתוח...`);
      
      // סגור את המפגש הנוכחי
      await this._logSessionEnd();
      
      // כבה את תת-הסוכנים (אם צריך)
      if (this.useSubAgents) {
        await Promise.all([
          this.subAgents.gpt4.stop(),
          this.subAgents.claude.stop()
        ]);
      }
      
      // הסר רישום ממנהל הסוכנים
      agentManager.unregisterAgent('dev_agent');
      
      this.active = false;
      this.currentSessionId = null;
      
      logger.info(`${this.logPrefix} סוכן פיתוח כובה בהצלחה`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בכיבוי סוכן פיתוח: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * הגדר את נתיב העבודה של הסוכן
   * @param {string} workingDir - נתיב תיקיית העבודה
   */
  async setWorkingDirectory(workingDir) {
    this.workingDir = workingDir;
    
    // וודא שהתיקייה קיימת
    await fs.ensureDir(this.workingDir);
    
    logger.info(`${this.logPrefix} הוגדרה תיקיית עבודה: ${this.workingDir}`);
    
    // רשום פעולת הגדרת תיקייה לזיכרון
    if (this.currentSessionId) {
      await memoryManager.saveAction('dev_agent', this.currentSessionId, {
        title: 'הגדרת תיקיית עבודה',
        description: `הגדרת תיקיית עבודה חדשה: ${workingDir}`,
        params: {
          workingDir
        }
      });
    }
  }
  
  /**
   * נתח פרויקט קיים
   * @param {string} projectPath - נתיב הפרויקט לניתוח
   * @returns {Promise<object>} - תוצאות הניתוח
   */
  async analyzeProject(projectPath) {
    if (!this.active) {
      throw new Error('הסוכן אינו פעיל, יש להפעיל את הסוכן תחילה');
    }
    
    logger.info(`${this.logPrefix} מנתח פרויקט בנתיב: ${projectPath}`);
    
    try {
      // בדוק אם הנתיב קיים
      if (!await fs.pathExists(projectPath)) {
        throw new Error(`נתיב הפרויקט ${projectPath} אינו קיים`);
      }
      
      // נסה לאתר קבצי תצורה נפוצים כדי לזהות את סוג הפרויקט
      const hasPackageJson = await fs.pathExists(path.join(projectPath, 'package.json'));
      const hasPythonFiles = await fs.pathExists(path.join(projectPath, 'requirements.txt')) || 
                            await fs.pathExists(path.join(projectPath, 'setup.py'));
      const hasDockerfile = await fs.pathExists(path.join(projectPath, 'Dockerfile'));
      
      // חפש קבצי קוד משמעותיים
      let fileTypes = {};
      const files = await this._scanDirectory(projectPath);
      
      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        if (ext) {
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      });
      
      // זיהוי אוטומטי של סוג הפרויקט
      let projectType = 'unknown';
      let framework = 'unknown';
      
      if (hasPackageJson) {
        const packageJson = await fs.readJson(path.join(projectPath, 'package.json'));
        
        // נסה לזהות את הסביבה (Node.js, React, Vue, Angular, וכו')
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.react) {
          projectType = 'frontend';
          framework = 'react';
        } else if (deps.vue) {
          projectType = 'frontend';
          framework = 'vue';
        } else if (deps.angular) {
          projectType = 'frontend';
          framework = 'angular';
        } else if (deps.express || deps.koa || deps.hapi) {
          projectType = 'backend';
          framework = deps.express ? 'express' : deps.koa ? 'koa' : 'hapi';
        } else {
          projectType = 'nodejs';
          framework = 'nodejs';
        }
      } else if (hasPythonFiles) {
        projectType = 'backend';
        framework = 'python';
      }
      
      // צור דוח ניתוח
      const analysis = {
        projectPath,
        projectType,
        framework,
        fileCount: files.length,
        fileTypes,
        hasDockerfile,
        timestamp: new Date().toISOString()
      };
      
      // שמור את הניתוח בזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('dev_agent', this.currentSessionId, {
          title: 'ניתוח פרויקט',
          description: `ניתוח פרויקט בנתיב: ${projectPath}`,
          params: {
            projectPath
          },
          result: analysis
        });
      }
      
      logger.info(`${this.logPrefix} ניתוח הפרויקט הושלם: זוהה פרויקט ${projectType} (${framework})`);
      
      return analysis;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בניתוח הפרויקט: ${error.message}`);
      
      // רשום שגיאה לזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('dev_agent', this.currentSessionId, {
          title: 'שגיאה בניתוח פרויקט',
          description: `שגיאה בניתוח פרויקט בנתיב: ${projectPath}`,
          params: {
            projectPath
          },
          error: error.message
        });
      }
      
      throw error;
    }
  }
  
  /**
   * כתוב קובץ קוד חדש
   * @param {string} filePath - נתיב הקובץ
   * @param {string} content - תוכן הקובץ
   * @param {object} options - אפשרויות נוספות
   * @returns {Promise<boolean>} - האם הפעולה הצליחה
   */
  async writeFile(filePath, content, options = {}) {
    if (!this.active) {
      throw new Error('הסוכן אינו פעיל, יש להפעיל את הסוכן תחילה');
    }
    
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDir, filePath);
      
      logger.info(`${this.logPrefix} כותב קובץ: ${fullPath}`);
      
      // וודא שתיקיית היעד קיימת
      await fs.ensureDir(path.dirname(fullPath));
      
      // אם הקובץ קיים וה-flag לא מוגדר לדריסה, זרוק שגיאה
      if (await fs.pathExists(fullPath) && !options.overwrite) {
        throw new Error(`הקובץ ${fullPath} כבר קיים ו-overwrite לא מוגדר`);
      }
      
      // כתוב את הקובץ
      await fs.writeFile(fullPath, content, 'utf8');
      
      const stats = {
        size: Buffer.byteLength(content, 'utf8'),
        lines: content.split('\n').length,
        path: fullPath,
        extension: path.extname(fullPath)
      };
      
      // שמור את פעולת הכתיבה בזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('dev_agent', this.currentSessionId, {
          title: 'כתיבת קובץ',
          description: `כתיבת קובץ: ${filePath}`,
          params: {
            filePath,
            overwrite: !!options.overwrite,
            extension: path.extname(filePath)
          },
          result: stats
        });
      }
      
      logger.info(`${this.logPrefix} הקובץ נכתב בהצלחה: ${stats.lines} שורות, ${stats.size} בתים`);
      
      return true;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בכתיבת הקובץ: ${error.message}`);
      
      // רשום שגיאה לזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('dev_agent', this.currentSessionId, {
          title: 'שגיאה בכתיבת קובץ',
          description: `שגיאה בכתיבת קובץ: ${filePath}`,
          params: {
            filePath
          },
          error: error.message
        });
      }
      
      throw error;
    }
  }
  
  /**
   * קרא קובץ מתיקיית העבודה
   * @param {string} filePath - נתיב הקובץ
   * @returns {Promise<string>} - תוכן הקובץ
   */
  async readFile(filePath) {
    if (!this.active) {
      throw new Error('הסוכן אינו פעיל, יש להפעיל את הסוכן תחילה');
    }
    
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDir, filePath);
      
      logger.info(`${this.logPrefix} קורא קובץ: ${fullPath}`);
      
      // בדוק אם הקובץ קיים
      if (!await fs.pathExists(fullPath)) {
        throw new Error(`הקובץ ${fullPath} אינו קיים`);
      }
      
      // קרא את הקובץ
      const content = await fs.readFile(fullPath, 'utf8');
      
      // שמור את פעולת הקריאה בזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('dev_agent', this.currentSessionId, {
          title: 'קריאת קובץ',
          description: `קריאת קובץ: ${filePath}`,
          params: {
            filePath
          },
          result: {
            size: Buffer.byteLength(content, 'utf8'),
            lines: content.split('\n').length
          }
        });
      }
      
      return content;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בקריאת הקובץ: ${error.message}`);
      
      // רשום שגיאה לזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('dev_agent', this.currentSessionId, {
          title: 'שגיאה בקריאת קובץ',
          description: `שגיאה בקריאת קובץ: ${filePath}`,
          params: {
            filePath
          },
          error: error.message
        });
      }
      
      throw error;
    }
  }
  
  /**
   * חפש במאגר הזיכרון של הסוכן
   * @param {string} keyword - מילת מפתח לחיפוש
   * @returns {Promise<Array>} - תוצאות החיפוש
   */
  async searchMemory(keyword) {
    if (!this.active) {
      throw new Error('הסוכן אינו פעיל, יש להפעיל את הסוכן תחילה');
    }
    
    try {
      logger.info(`${this.logPrefix} מחפש בזיכרון: ${keyword}`);
      
      const results = await memoryManager.searchMemory('dev_agent', keyword);
      
      // שמור את פעולת החיפוש בזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('dev_agent', this.currentSessionId, {
          title: 'חיפוש בזיכרון',
          description: `חיפוש בזיכרון: ${keyword}`,
          params: {
            keyword
          },
          result: {
            count: results.length
          }
        });
      }
      
      return results;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בחיפוש בזיכרון: ${error.message}`);
      return [];
    }
  }
  
  /**
   * סרוק תיקייה וקבל רשימת קבצים
   * @param {string} dirPath - נתיב התיקייה
   * @returns {Promise<Array>} - רשימת קבצים
   * @private
   */
  async _scanDirectory(dirPath) {
    try {
      const files = [];
      
      async function scan(currentPath) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          // התעלם מתיקיות node_modules ו-.git
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git') {
              await scan(fullPath);
            }
          } else {
            files.push(fullPath);
          }
        }
      }
      
      await scan(dirPath);
      return files;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בסריקת תיקייה: ${error.message}`);
      return [];
    }
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
    
    this.memory.stats.totalSessions = Object.keys(this.memory.sessions).length;
    this.memory.lastUpdated = startTime;
    
    await memoryManager.saveMemory('dev_agent', this.memory);
    
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
    
    await memoryManager.saveMemory('dev_agent', this.memory);
    
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
    this.memory.stats.totalActions = (this.memory.stats.totalActions || 0) + 1;
    
    if (result && result.success) {
      this.memory.stats.lastSuccess = timestamp;
    } else {
      this.memory.stats.lastFailure = timestamp;
    }
    
    await memoryManager.saveMemory('dev_agent', this.memory);
    
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

/**
 * תת-סוכן GPT-4 המשמש לכתיבת קוד ויצירת פיתוח
 */
class Gpt4SubAgent {
  constructor(parentAgent) {
    this.active = false;
    this.parentAgent = parentAgent;
    this.preferredModel = 'gpt-4-turbo';
    this.provider = 'openai';
    this.logPrefix = '[dev_gpt4]';
    
    logger.info(`${this.logPrefix} תת-סוכן GPT-4 אותחל`);
  }
  
  /**
   * הפעלת תת-הסוכן
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} תת-סוכן כבר פעיל`);
      return;
    }
    
    this.active = true;
    logger.info(`${this.logPrefix} תת-סוכן GPT-4 הופעל`);
  }
  
  /**
   * כיבוי תת-הסוכן
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} תת-סוכן כבר כבוי`);
      return;
    }
    
    this.active = false;
    logger.info(`${this.logPrefix} תת-סוכן GPT-4 כובה`);
  }
  
  /**
   * יצירת קוד חדש באמצעות GPT-4
   */
  async generateCode(filePath, requirements, options = {}) {
    logger.info(`${this.logPrefix} יוצר קוד עבור: ${filePath}`);
    
    try {
      const language = this._detectLanguage(filePath);
      
      // הכן את ה-prompt
      const prompt = `
        צור קוד ב-${language} עבור הקובץ: ${filePath}
        
        הנה הדרישות:
        ${requirements}
        
        יש לספק קוד איכותי ומקצועי שמיישם את הדרישות האלה.
        הקוד צריך להיות מתועד, לעקוב אחר העקרונות של קוד נקי, ולהיות יעיל.
        השתמש בתבניות תכנות מודרניות ובפרקטיקות מומלצות ל-${language}.
        
        החזר את הקוד בלבד, ללא הסברים נוספים.
      `;
      
      // קבל מודל מומלץ ממנהל הסוכנים
      const { provider, model } = agentManager.getRecommendedModel('dev_agent', 'coding');
      
      // שלח לקבלת קוד מה-AI
      const code = await aiEngine.query(prompt, {
        provider: provider,
        model: model
      });
      
      // הוצא את הקוד מתוך התשובה
      const cleanCode = this._extractCode(code, language);
      
      // שמור לקובץ
      await this._saveToFile(filePath, cleanCode);
      
      logger.info(`${this.logPrefix} נוצר קוד עבור ${filePath} (${cleanCode.split('\n').length} שורות)`);
      return cleanCode;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה ביצירת קוד: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * יעזור לסוכן ה-Claude בתיקון באגים אם צריך
   */
  async fixBugs(filePath, bugReport, options = {}) {
    logger.info(`${this.logPrefix} מתקן באגים באמצעות GPT-4 עבור: ${filePath}`);
    
    try {
      const language = this._detectLanguage(filePath);
      const code = await fs.readFile(filePath, 'utf-8');
      
      // הכן את ה-prompt
      const prompt = `
        תקן את הבאגים בקובץ ${filePath} בשפת ${language}.
        
        קוד נוכחי:
        \`\`\`${language}
        ${code}
        \`\`\`
        
        דוח באגים:
        ${bugReport}
        
        אנא תקן את הבאגים ושפר את הקוד. החזר את הקוד המתוקן בלבד, ללא הסברים נוספים.
      `;
      
      // קבל מודל מומלץ ממנהל הסוכנים
      const { provider, model } = agentManager.getRecommendedModel('dev_agent', 'coding');
      
      // שלח לקבלת קוד מתוקן מה-AI
      const fixedCode = await aiEngine.query(prompt, {
        provider: provider,
        model: model
      });
      
      // הוצא את הקוד מתוך התשובה
      const cleanCode = this._extractCode(fixedCode, language);
      
      // שמור לקובץ
      await this._saveToFile(filePath, cleanCode);
      
      logger.info(`${this.logPrefix} תוקנו באגים בקובץ ${filePath}`);
      return cleanCode;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בתיקון באגים: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * מיצוי קוד נקי מתוך תשובת ה-AI
   */
  _extractCode(aiResponse, language) {
    // ניסיון למצוא קוד בין סימני קוד
    const codeRegex = /```(?:[\w-]*\n)?([\s\S]*?)```/;
    const match = aiResponse.match(codeRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // אם אין סימני קוד, החזר את כל התוכן
    return aiResponse.trim();
  }
  
  /**
   * שמירת קוד לקובץ
   */
  async _saveToFile(filePath, code) {
    // וודא שהתיקייה קיימת
    const dirname = path.dirname(filePath);
    await fs.ensureDir(dirname);
    
    // שמור את הקוד
    await fs.writeFile(filePath, code, 'utf-8');
  }
  
  /**
   * זיהוי שפת תכנות לפי סיומת
   */
  _detectLanguage(filePath) {
    const extension = path.extname(filePath).toLowerCase().slice(1);
    
    const langMap = {
      'js': 'JavaScript',
      'jsx': 'React JavaScript',
      'ts': 'TypeScript',
      'tsx': 'React TypeScript',
      'py': 'Python',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'cs': 'C#',
      'go': 'Go',
      'rb': 'Ruby',
      'php': 'PHP',
      'rs': 'Rust',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'sh': 'Bash',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'json': 'JSON',
      'md': 'Markdown',
      'xml': 'XML',
      'sql': 'SQL'
    };
    
    return langMap[extension] || 'Unknown';
  }
}

/**
 * תת-סוכן Claude המשמש לסקירת קוד ובדיקת איכות
 */
class ClaudeSubAgent {
  constructor(parentAgent) {
    this.active = false;
    this.parentAgent = parentAgent;
    this.preferredModel = 'claude-3.7-sonnet';
    this.provider = 'anthropic';
    this.logPrefix = '[dev_claude]';
    
    logger.info(`${this.logPrefix} תת-סוכן Claude אותחל`);
  }
  
  /**
   * הפעלת תת-הסוכן
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} תת-סוכן כבר פעיל`);
      return;
    }
    
    this.active = true;
    logger.info(`${this.logPrefix} תת-סוכן Claude הופעל`);
  }
  
  /**
   * כיבוי תת-הסוכן
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} תת-סוכן כבר כבוי`);
      return;
    }
    
    this.active = false;
    logger.info(`${this.logPrefix} תת-סוכן Claude כובה`);
  }
  
  /**
   * סקירת קוד באמצעות Claude
   */
  async reviewCode(filePath, options = {}) {
    logger.info(`${this.logPrefix} מבצע סקירת קוד באמצעות Claude עבור: ${filePath}`);
    
    try {
      const language = this._detectLanguage(filePath);
      const code = await fs.readFile(filePath, 'utf-8');
      
      // הכן את ה-prompt
      const prompt = `
        סקור את הקוד הבא בשפת ${language}:
        
        \`\`\`${language}
        ${code}
        \`\`\`
        
        אנא בצע סקירת קוד מקיפה המתייחסת ל:
        1. איכות קוד וקריאות
        2. עקרונות תכנות נכונים
        3. ביצועים ויעילות
        4. אבטחה ובאגים פוטנציאליים
        5. תאימות ואמינות
        
        עבור כל בעיה, ספק הסבר והמלצה לתיקון עם דוגמת קוד.
      `;
      
      // קבל מודל מומלץ ממנהל הסוכנים
      const { provider, model } = agentManager.getRecommendedModel('dev_agent', 'review');
      
      // שלח לקבלת סקירה מה-AI
      const review = await aiEngine.query(prompt, {
        provider: provider,
        model: model
      });
      
      // בדוק אם יש בעיות חמורות שדורשות תיקון
      const severity = this._assessReviewSeverity(review);
      
      // צור קובץ סקירה בצד הקובץ
      await this._saveReview(filePath, review, severity);
      
      // אם יש בעיות חמורות, הפעל את תת-סוכן ה-GPT-4 לתיקון
      if (severity === 'high' && options.autoFix !== false) {
        logger.info(`${this.logPrefix} נמצאו בעיות חמורות, מפעיל תיקון אוטומטי`);
        await this.parentAgent.subAgents.gpt4.fixBugs(filePath, review);
      }
      
      logger.info(`${this.logPrefix} סקירת קוד הושלמה עבור ${filePath} (חומרה: ${severity})`);
      return { review, severity };
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בסקירת קוד: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * הערכת חומרת הבעיות בסקירה
   */
  _assessReviewSeverity(review) {
    const lowKeywords = ['קל לשפר', 'המלצה', 'שיפור קטן', 'שיקול'];
    const mediumKeywords = ['יש לשפר', 'רצוי לשנות', 'בעיה', 'שיפור נדרש'];
    const highKeywords = ['באג קריטי', 'בעיה חמורה', 'פגיעות אבטחה', 'כשל', 'שגיאה חמורה', 'דליפת זיכרון'];
    
    // בדוק אם יש מילות מפתח של בעיות חמורות
    if (highKeywords.some(keyword => review.includes(keyword))) {
      return 'high';
    }
    
    // בדוק אם יש מילות מפתח של בעיות בינוניות
    if (mediumKeywords.some(keyword => review.includes(keyword))) {
      return 'medium';
    }
    
    // אחרת, זו בעיה קלה/המלצה
    return 'low';
  }
  
  /**
   * שמירת סקירת הקוד לקובץ
   */
  async _saveReview(filePath, review, severity) {
    const reviewPath = `${filePath}.review.md`;
    
    const content = `# סקירת קוד: ${path.basename(filePath)}\n\n` +
                    `**תאריך:** ${new Date().toISOString()}\n` +
                    `**חומרת בעיות:** ${severity}\n\n` +
                    `## סיכום הסקירה\n\n${review}`;
    
    await fs.writeFile(reviewPath, content, 'utf-8');
  }
  
  /**
   * זיהוי שפת תכנות לפי סיומת
   */
  _detectLanguage(filePath) {
    const extension = path.extname(filePath).toLowerCase().slice(1);
    
    const langMap = {
      'js': 'JavaScript',
      'jsx': 'React JavaScript',
      'ts': 'TypeScript',
      'tsx': 'React TypeScript',
      'py': 'Python',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'cs': 'C#',
      'go': 'Go',
      'rb': 'Ruby',
      'php': 'PHP',
      'rs': 'Rust',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'sh': 'Bash',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'json': 'JSON',
      'md': 'Markdown',
      'xml': 'XML',
      'sql': 'SQL'
    };
    
    return langMap[extension] || 'Unknown';
  }
}

module.exports = new DevAgent(); 