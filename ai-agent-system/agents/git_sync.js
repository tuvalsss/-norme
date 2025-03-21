const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { EventEmitter } = require('events');
const { logger } = require('../core/logger');
const { v4: uuidv4 } = require('uuid');
const memoryManager = require('../core/memoryManager');

// יבוא סוכן הסיכום לצורך דיווח על שגיאות
const summaryAgent = require('./summary');

/**
 * סוכן סנכרון Git
 * אחראי על סנכרון הפרויקט עם GitHub באופן אוטומטי
 */
class GitSyncAgent {
  constructor() {
    this.active = false;
    this.intervalId = null;
    this.events = new EventEmitter();
    this.logPrefix = '[git_sync_agent]';
    
    // תיקיית ברירת מחדל לעבודה
    this.workspacePath = path.resolve(__dirname, '../workspace');
    
    // פרטי GitHub
    this.gitUsername = process.env.GIT_USERNAME;
    this.gitEmail = process.env.GIT_EMAIL;
    this.gitToken = process.env.GIT_TOKEN;
    
    // זמן בדקות בין סנכרונים
    this.syncInterval = 10;
    
    // פרויקט פעיל
    this.activeProject = null;
    
    // מזהה המפגש הנוכחי
    this.currentSessionId = null;
    
    // זיכרון סוכן
    this.memory = null;
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
      logger.info(`${this.logPrefix} מפעיל סוכן סנכרון Git`);
      
      // יצירת מזהה מפגש חדש
      this.currentSessionId = `session_${uuidv4()}`;
      
      // טען את זיכרון הסוכן
      this.memory = await memoryManager.loadMemory('git_sync_agent');
      
      // רשום פעולת התחלה לזיכרון
      await memoryManager.saveAction('git_sync_agent', this.currentSessionId, {
        title: 'הפעלת סוכן',
        description: 'הפעלת סוכן סנכרון Git',
        params: {
          timestamp: new Date().toISOString()
        }
      });
      
      // בדוק אם קיימים פרטי התחברות ל-Git
      this._validateGitCredentials();
      
      // הגדר את תצורת ה-Git
      await this._configureGit();
      
      // נסה לבצע סנכרון ראשוני
      await this.syncRepository();
      
      // הגדר סנכרון תקופתי כל X דקות
      this.intervalId = setInterval(() => {
        this.syncRepository().catch(err => {
          logger.error(`${this.logPrefix} שגיאה בסנכרון תקופתי: ${err.message}`);
        });
      }, this.syncInterval * 60 * 1000);
      
      this.active = true;
      logger.info(`${this.logPrefix} סוכן סנכרון Git הופעל בהצלחה. סנכרון יתבצע כל ${this.syncInterval} דקות`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בהפעלת הסוכן: ${error.message}`);
      
      // רשום שגיאה לזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('git_sync_agent', this.currentSessionId, {
          title: 'שגיאה בהפעלה',
          description: `שגיאה בהפעלת הסוכן: ${error.message}`,
          error: error.message
        });
      }
      
      throw error;
    }
  }
  
  /**
   * הפסק את פעילות הסוכן
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} הסוכן כבר כבוי`);
      return;
    }
    
    logger.info(`${this.logPrefix} מכבה את סוכן סנכרון Git`);
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // רשום פעולת סיום לזיכרון
    if (this.currentSessionId) {
      await memoryManager.saveAction('git_sync_agent', this.currentSessionId, {
        title: 'כיבוי סוכן',
        description: 'כיבוי סוכן סנכרון Git',
        params: {
          timestamp: new Date().toISOString()
        }
      });
      
      // סיים את המפגש הנוכחי
      await memoryManager.completeSession('git_sync_agent', this.currentSessionId, {
        description: 'סיום מפגש עבודה עם סוכן הסנכרון',
        status: 'completed'
      });
    }
    
    this.active = false;
    logger.info(`${this.logPrefix} סוכן סנכרון Git כובה בהצלחה`);
  }
  
  /**
   * הגדר את נתיב הפרויקט הפעיל
   * @param {string} projectPath - נתיב לפרויקט
   */
  async setProjectPath(projectPath) {
    this.activeProject = projectPath;
    logger.info(`${this.logPrefix} הוגדר פרויקט פעיל: ${projectPath}`);
    
    // רשום פעולת הגדרת פרויקט לזיכרון
    if (this.currentSessionId) {
      await memoryManager.saveAction('git_sync_agent', this.currentSessionId, {
        title: 'הגדרת פרויקט',
        description: `הגדרת פרויקט פעיל: ${projectPath}`,
        params: {
          projectPath
        }
      });
    }
    
    // בדוק אם יש רפוזיטורי בנתיב זה
    const isGitRepo = await this._isGitRepository(projectPath);
    
    if (!isGitRepo) {
      logger.warn(`${this.logPrefix} הנתיב ${projectPath} אינו מכיל רפוזיטורי Git`);
    }
  }
  
  /**
   * סנכרן את הרפוזיטורי עם GitHub
   */
  async syncRepository() {
    if (!this.activeProject) {
      logger.warn(`${this.logPrefix} לא נבחר פרויקט פעיל לסנכרון`);
      return;
    }
    
    // וודא שיש פרטי התחברות מינימליים
    if (!this.gitUsername || !this.gitToken) {
      logger.warn(`${this.logPrefix} חסרים פרטי התחברות לGitHub (username או token), לא ניתן לסנכרן`);
      return;
    }
    
    logger.info(`${this.logPrefix} מתחיל סנכרון Git עבור ${this.activeProject}`);
    
    try {
      // בדוק אם יש ריפוזיטורי Git
      const isGitRepo = await this._isGitRepository(this.activeProject);
      
      if (!isGitRepo) {
        logger.warn(`${this.logPrefix} הנתיב ${this.activeProject} אינו מכיל רפוזיטורי Git`);
        return;
      }
      
      // בדוק בזיכרון אם היה סנכרון מוצלח אחרון
      let lastSuccessfulSync = null;
      
      if (this.memory && this.memory.sessions) {
        // חפש את הפעם האחרונה שבוצע סנכרון מוצלח על אותו פרויקט
        for (const session of this.memory.sessions) {
          for (const action of session.actions) {
            if (action.title === 'סנכרון Git' && 
                action.result && 
                action.result.success && 
                action.params && 
                action.params.projectPath === this.activeProject) {
              lastSuccessfulSync = action;
              break;
            }
          }
          if (lastSuccessfulSync) break;
        }
      }
      
      if (lastSuccessfulSync) {
        logger.info(`${this.logPrefix} נמצא סנכרון מוצלח קודם מ-${new Date(lastSuccessfulSync.timestamp).toLocaleString()}`);
      }
      
      // משוך שינויים מהריפוזיטורי המרוחק
      await this._gitPull();
      
      // בדוק אם יש שינויים מקומיים
      const hasChanges = await this._hasLocalChanges();
      
      // מידע לזיכרון
      const syncResult = {
        projectPath: this.activeProject,
        timestamp: new Date().toISOString(),
        changes: {
          pulled: 0, // יש להחליף בפועל עם מספר שינויים שנמשכו
          added: 0,
          modified: 0,
          deleted: 0
        }
      };
      
      if (hasChanges) {
        // קבל רשימת שינויים
        const changes = await this._getChanges();
        
        // עדכון מידע על השינויים
        syncResult.changes.added = (changes.match(/^\?\?/gm) || []).length;
        syncResult.changes.modified = (changes.match(/^ M|^M /gm) || []).length;
        syncResult.changes.deleted = (changes.match(/^ D|^D /gm) || []).length;
        
        // יצירת הודעת commit מתאימה
        const commitMessage = this._generateCommitMessage(changes);
        syncResult.commitMessage = commitMessage;
        
        // הוסף את השינויים ל-staging
        await this._gitAdd();
        
        // בצע commit עם ההודעה
        await this._gitCommit(commitMessage);
        
        // דחוף לריפוזיטורי המרוחק
        await this._gitPush();
        
        logger.info(`${this.logPrefix} סנכרון הושלם בהצלחה. קומיט נדחף לשרת.`);
        
        // עדכון תוצאות הסנכרון
        syncResult.success = true;
        syncResult.pushed = true;
      } else {
        logger.info(`${this.logPrefix} אין שינויים מקומיים, הפרויקט מעודכן`);
        
        // עדכון תוצאות הסנכרון
        syncResult.success = true;
        syncResult.pushed = false;
      }
      
      // רשום פעולת סנכרון לזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('git_sync_agent', this.currentSessionId, {
          title: 'סנכרון Git',
          description: `ביצוע סנכרון Git עבור פרויקט ${this.activeProject}`,
          params: {
            projectPath: this.activeProject
          },
          result: syncResult
        });
      }
      
      return syncResult;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בסנכרון: ${error.message}`);
      
      // רשום שגיאת סנכרון לזיכרון
      if (this.currentSessionId) {
        await memoryManager.saveAction('git_sync_agent', this.currentSessionId, {
          title: 'שגיאת סנכרון',
          description: `שגיאה בסנכרון Git עבור פרויקט ${this.activeProject}`,
          params: {
            projectPath: this.activeProject
          },
          error: error.message
        });
      }
      
      // בדוק אם מדובר בקונפליקט merge
      if (error.message.includes('CONFLICT') || error.message.includes('merge conflict')) {
        await this._reportMergeConflict(error.message);
      }
      
      throw error;
    }
  }
  
  /**
   * אתחל רפוזיטורי Git בפרויקט
   */
  async initRepository(remoteUrl, branch = 'main') {
    if (!this.activeProject) {
      throw new Error('לא נבחר פרויקט פעיל');
    }
    
    logger.info(`${this.logPrefix} מאתחל רפוזיטורי Git בפרויקט ${this.activeProject}`);
    
    try {
      // בדוק אם כבר יש רפוזיטורי Git
      const isGitRepo = await this._isGitRepository(this.activeProject);
      
      if (isGitRepo) {
        logger.info(`${this.logPrefix} רפוזיטורי Git כבר קיים בפרויקט`);
        return;
      }
      
      // אתחל רפוזיטורי Git חדש
      await this._executeGitCommand(['init']);
      
      // הגדר תצורת משתמש מקומית
      await this._executeGitCommand(['config', 'user.name', this.gitUsername]);
      await this._executeGitCommand(['config', 'user.email', this.gitEmail]);
      
      // שנה את שם הענף הראשי אם צריך
      await this._executeGitCommand(['branch', '-M', branch]);
      
      // הוסף את כל הקבצים
      await this._gitAdd();
      
      // בצע commit ראשוני
      await this._gitCommit('קומיט ראשוני');
      
      // הוסף remote אם סופק URL
      if (remoteUrl) {
        // החלף את ה-URL עם הטוקן
        const authenticatedUrl = this._getAuthenticatedUrl(remoteUrl);
        await this._executeGitCommand(['remote', 'add', 'origin', authenticatedUrl]);
        
        // דחוף לריפוזיטורי המרוחק
        await this._gitPush('--set-upstream', 'origin', branch);
      }
      
      logger.info(`${this.logPrefix} רפוזיטורי Git אותחל בהצלחה`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה באתחול רפוזיטורי Git: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * וודא שקיימים פרטי התחברות ל-Git
   * @private
   */
  _validateGitCredentials() {
    const missingCredentials = [];
    
    if (!this.gitUsername) missingCredentials.push('GIT_USERNAME');
    if (!this.gitEmail) missingCredentials.push('GIT_EMAIL');
    if (!this.gitToken) missingCredentials.push('GIT_TOKEN');
    
    if (missingCredentials.length > 0) {
      logger.warn(`${this.logPrefix} חסרים פרטי התחברות לGit: ${missingCredentials.join(', ')}`);
      logger.warn(`${this.logPrefix} יתכן שיהיו בעיות בסנכרון עם GitHub`);
    }
  }
  
  /**
   * הגדר את תצורת ה-Git
   * @private
   */
  async _configureGit() {
    try {
      // וודא שה-Git מוגדר כראוי - הגדרות מקומיות לפרויקט ספציפי
      if (this.gitUsername) {
        await this._executeGitCommand(['config', 'user.name', this.gitUsername]);
      }
      
      if (this.gitEmail) {
        await this._executeGitCommand(['config', 'user.email', this.gitEmail]);
      }
      
      // הגדר credential helper לשמירת הטוקן
      if (this.gitToken) {
        await this._executeGitCommand(['config', 'credential.helper', 'store']);
      }
      
      logger.info(`${this.logPrefix} תצורת Git הוגדרה בהצלחה`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בהגדרת תצורת Git: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * החלף URL של GitHub ל-URL עם אימות
   * @param {string} remoteUrl - URL של ריפוזיטורי GitHub
   * @returns {string} URL עם אימות
   * @private
   */
  _getAuthenticatedUrl(remoteUrl) {
    // החלף SSH URL ב-HTTPS URL
    let url = remoteUrl;
    if (url.startsWith('git@github.com:')) {
      url = url.replace('git@github.com:', 'https://github.com/');
    }
    
    // הוסף אימות לURL HTTPS
    if (url.startsWith('https://github.com/') && this.gitUsername && this.gitToken) {
      url = url.replace('https://github.com/', `https://${this.gitUsername}:${this.gitToken}@github.com/`);
    }
    
    return url;
  }
  
  /**
   * בדוק אם התיקייה מכילה רפוזיטורי Git
   * @param {string} dirPath - נתיב התיקייה
   * @returns {Promise<boolean>} האם מכיל רפוזיטורי Git
   * @private
   */
  async _isGitRepository(dirPath) {
    try {
      const gitDir = path.join(dirPath, '.git');
      return await fs.pathExists(gitDir);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * הרץ פקודת git pull
   * @private
   */
  async _gitPull() {
    try {
      logger.info(`${this.logPrefix} מושך שינויים מהשרת המרוחק...`);
      await this._executeGitCommand(['pull']);
    } catch (error) {
      // בדוק אם יש קונפליקטים
      if (error.message.includes('CONFLICT') || error.message.includes('merge conflict')) {
        logger.error(`${this.logPrefix} נמצאו קונפליקטים במיזוג: ${error.message}`);
        await this._reportMergeConflict(error.message);
      }
      throw error;
    }
  }
  
  /**
   * בדוק אם יש שינויים מקומיים
   * @returns {Promise<boolean>} האם יש שינויים
   * @private
   */
  async _hasLocalChanges() {
    try {
      const result = await this._executeGitCommand(['status', '--porcelain']);
      return result.trim().length > 0;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בבדיקת שינויים מקומיים: ${error.message}`);
      return false;
    }
  }
  
  /**
   * קבל רשימת שינויים
   * @returns {Promise<string>} רשימת שינויים
   * @private
   */
  async _getChanges() {
    try {
      return await this._executeGitCommand(['status', '--porcelain']);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בקבלת רשימת שינויים: ${error.message}`);
      return '';
    }
  }
  
  /**
   * הוסף את כל השינויים ל-staging
   * @private
   */
  async _gitAdd() {
    try {
      await this._executeGitCommand(['add', '.']);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בהוספת קבצים לstaging: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * בצע commit עם הודעה
   * @param {string} message - הודעת הקומיט
   * @private
   */
  async _gitCommit(message) {
    try {
      await this._executeGitCommand(['commit', '-m', message]);
    } catch (error) {
      // אם אין מה לעשות commit, זה לא שגיאה אמיתית
      if (error.message.includes('nothing to commit')) {
        logger.info(`${this.logPrefix} אין שינויים לביצוע commit`);
        return;
      }
      
      logger.error(`${this.logPrefix} שגיאה בביצוע commit: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * דחוף את השינויים לשרת המרוחק
   * @param {...string} args - ארגומנטים נוספים לפקודה
   * @private
   */
  async _gitPush(...args) {
    try {
      // קבל את הremote URL
      const remoteUrl = await this._executeGitCommand(['remote', 'get-url', 'origin']);
      
      // החלף ל-URL עם אימות
      const authenticatedUrl = this._getAuthenticatedUrl(remoteUrl.trim());
      
      // שנה את ה-remote URL
      await this._executeGitCommand(['remote', 'set-url', 'origin', authenticatedUrl]);
      
      // דחוף לשרת
      const pushArgs = ['push', ...args].filter(Boolean);
      await this._executeGitCommand(pushArgs);
      
      logger.info(`${this.logPrefix} דחיפה לשרת המרוחק הצליחה`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בדחיפה לשרת המרוחק: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * יצור הודעת commit אוטומטית מתאימה לשינויים
   * @param {string} changes - רשימת שינויים מgit status --porcelain
   * @returns {string} הודעת commit
   * @private
   */
  _generateCommitMessage(changes) {
    // ספור את סוגי השינויים
    const addedCount = (changes.match(/^\?\?/gm) || []).length;
    const modifiedCount = (changes.match(/^ M|^M /gm) || []).length;
    const deletedCount = (changes.match(/^ D|^D /gm) || []).length;
    
    // צור הודעה בהתאם לשינויים
    if (addedCount > 0 && modifiedCount === 0 && deletedCount === 0) {
      return `נוספו ${addedCount} ${addedCount > 1 ? 'קבצים חדשים' : 'קובץ חדש'}`;
    } else if (modifiedCount > 0 && addedCount === 0 && deletedCount === 0) {
      return `עודכנו ${modifiedCount} ${modifiedCount > 1 ? 'קבצים' : 'קובץ'}`;
    } else if (deletedCount > 0 && addedCount === 0 && modifiedCount === 0) {
      return `נמחקו ${deletedCount} ${deletedCount > 1 ? 'קבצים' : 'קובץ'}`;
    } else {
      const total = addedCount + modifiedCount + deletedCount;
      return `שינויים: ${addedCount > 0 ? `+${addedCount} ` : ''}${modifiedCount > 0 ? `~${modifiedCount} ` : ''}${deletedCount > 0 ? `-${deletedCount} ` : ''}(${total} קבצים)`;
    }
  }
  
  /**
   * דווח על קונפליקט מיזוג לסוכן הסיכום
   * @param {string} errorMessage - הודעת השגיאה
   * @private
   */
  async _reportMergeConflict(errorMessage) {
    try {
      // קבל רשימת קבצים עם קונפליקטים
      const conflictingFiles = await this._executeGitCommand(['diff', '--name-only', '--diff-filter=U']);
      
      // ודא שסוכן הסיכום פעיל
      if (!summaryAgent.active) {
        await summaryAgent.start();
      }
      
      // הכן את דוח הקונפליקט
      const conflictReport = {
        type: 'merge_conflict',
        timestamp: new Date().toISOString(),
        repositoryPath: this.activeProject,
        conflictingFiles: conflictingFiles.trim().split('\n').filter(Boolean),
        errorMessage: errorMessage
      };
      
      // שלח את הדוח לסוכן הסיכום
      if (typeof summaryAgent.reportIssue === 'function') {
        await summaryAgent.reportIssue('git_merge_conflict', conflictReport);
      }
      
      logger.warn(`${this.logPrefix} דווח על קונפליקט מיזוג לסוכן הסיכום. קבצים מושפעים: ${conflictingFiles}`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בדיווח על קונפליקט מיזוג: ${error.message}`);
    }
  }
  
  /**
   * הרץ פקודת Git ומחזיר את הפלט שלה
   * @param {string[]} args - ארגומנטים לפקודת git
   * @returns {Promise<string>} הפלט של הפקודה
   * @private
   */
  _executeGitCommand(args) {
    return new Promise((resolve, reject) => {
      // וודא שיש פרויקט פעיל
      if (!this.activeProject) {
        return reject(new Error('לא הוגדר פרויקט פעיל'));
      }
      
      const git = spawn('git', args, {
        cwd: this.activeProject,
        env: { ...process.env },
        shell: true
      });
      
      let stdout = '';
      let stderr = '';
      
      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`));
        }
      });
      
      git.on('error', (err) => {
        reject(new Error(`Failed to execute git command: ${err.message}`));
      });
    });
  }
  
  /**
   * חפש בזיכרון אם היו קונפליקטים קודמים בקבצים מסוימים
   * @param {string[]} filePaths - רשימת נתיבי קבצים לבדיקה
   * @returns {Promise<Array>} רשימת קונפליקטים קודמים
   */
  async findPreviousConflicts(filePaths) {
    if (!this.memory || !this.memory.sessions || !filePaths.length) {
      return [];
    }
    
    const previousConflicts = [];
    
    // חפש קונפליקטים קודמים במפגשים
    for (const session of this.memory.sessions) {
      for (const action of session.actions) {
        if (action.title === 'שגיאת סנכרון' && action.error && action.error.includes('CONFLICT')) {
          // אם יש מידע על קבצים עם קונפליקטים
          if (action.result && action.result.conflictingFiles) {
            const conflictingFiles = action.result.conflictingFiles;
            
            // בדוק אם יש חפיפה בין הקבצים הנוכחיים לקבצים קודמים
            const overlappingFiles = filePaths.filter(file => 
              conflictingFiles.includes(file)
            );
            
            if (overlappingFiles.length > 0) {
              previousConflicts.push({
                timestamp: action.timestamp,
                sessionId: session.id,
                files: overlappingFiles
              });
            }
          }
        }
      }
    }
    
    return previousConflicts;
  }
}

module.exports = new GitSyncAgent(); 