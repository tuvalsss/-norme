/**
 * מנהל קונטקסט הפרויקט
 * אחראי על שמירה וניהול של קונטקסט לפרויקטים שונים במערכת
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

class ContextManager {
  constructor() {
    this.projectContexts = new Map();
    this.contextDir = path.resolve(__dirname, '../../data/contexts');
    this.ensureContextDir();
  }

  /**
   * וודא שתיקיית הקונטקסטים קיימת
   */
  ensureContextDir() {
    try {
      fs.ensureDirSync(this.contextDir);
      logger.info(`[context_manager] Context directory ensured: ${this.contextDir}`);
    } catch (error) {
      logger.error(`[context_manager] Failed to create context directory: ${error.message}`);
    }
  }

  /**
   * יצירת קונטקסט פרויקט חדש
   * @param {string} projectId - מזהה הפרויקט
   * @param {object} initialContext - קונטקסט התחלתי
   * @returns {string} - מזהה הקונטקסט
   */
  createContext(projectId, initialContext = {}) {
    const contextId = `context_${projectId}_${uuidv4()}`;
    
    const context = {
      id: contextId,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
      data: { ...initialContext },
      history: [],
      metadata: {}
    };
    
    this.projectContexts.set(contextId, context);
    
    // שמירה לדיסק
    this._saveContextToDisk(contextId);
    
    logger.info(`[context_manager] Created new context for project ${projectId}: ${contextId}`);
    
    return contextId;
  }

  /**
   * קבלת קונטקסט פרויקט
   * @param {string} contextId - מזהה הקונטקסט
   * @returns {object} - קונטקסט הפרויקט
   */
  getContext(contextId) {
    // אם הקונטקסט לא טעון בזיכרון, נסה לטעון מהדיסק
    if (!this.projectContexts.has(contextId)) {
      this._loadContextFromDisk(contextId);
    }
    
    if (!this.projectContexts.has(contextId)) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    return this.projectContexts.get(contextId);
  }

  /**
   * עדכון קונטקסט פרויקט
   * @param {string} contextId - מזהה הקונטקסט
   * @param {object} updates - עדכונים לקונטקסט
   * @param {string} source - מקור העדכון (למשל, שם הסוכן)
   * @returns {object} - הקונטקסט המעודכן
   */
  updateContext(contextId, updates, source = 'system') {
    if (!this.projectContexts.has(contextId)) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    const context = this.projectContexts.get(contextId);
    const previousData = { ...context.data };
    
    // עדכון הנתונים
    context.data = { ...context.data, ...updates };
    context.updatedAt = new Date();
    
    // הוספת רשומה להיסטוריה
    context.history.push({
      timestamp: new Date(),
      source,
      changes: this._computeChanges(previousData, context.data)
    });
    
    // גיזום ההיסטוריה אם היא ארוכה מדי
    if (context.history.length > 100) {
      context.history = context.history.slice(-100);
    }
    
    // שמירה לדיסק
    this._saveContextToDisk(contextId);
    
    logger.info(`[context_manager] Updated context ${contextId} from ${source}`);
    
    return context;
  }

  /**
   * קבלת קונטקסט פרויקט לפי מזהה פרויקט
   * @param {string} projectId - מזהה הפרויקט
   * @returns {object} - קונטקסט הפרויקט
   */
  getContextByProjectId(projectId) {
    // חיפוש קונטקסט בזיכרון
    for (const [id, context] of this.projectContexts.entries()) {
      if (context.projectId === projectId) {
        return context;
      }
    }
    
    // אם לא נמצא בזיכרון, נסה לטעון מהדיסק
    this._loadAllContextsFromDisk();
    
    for (const [id, context] of this.projectContexts.entries()) {
      if (context.projectId === projectId) {
        return context;
      }
    }
    
    // אם עדיין לא נמצא, צור קונטקסט חדש
    const contextId = this.createContext(projectId);
    return this.getContext(contextId);
  }

  /**
   * מחיקת קונטקסט פרויקט
   * @param {string} contextId - מזהה הקונטקסט
   * @returns {boolean} - האם המחיקה הצליחה
   */
  deleteContext(contextId) {
    if (!this.projectContexts.has(contextId)) {
      return false;
    }
    
    this.projectContexts.delete(contextId);
    
    // מחיקה מהדיסק
    try {
      const contextFile = path.join(this.contextDir, `${contextId}.json`);
      if (fs.existsSync(contextFile)) {
        fs.unlinkSync(contextFile);
      }
      
      logger.info(`[context_manager] Deleted context: ${contextId}`);
      return true;
    } catch (error) {
      logger.error(`[context_manager] Failed to delete context file for ${contextId}: ${error.message}`);
      return false;
    }
  }

  /**
   * חישוב השינויים בין שני מצבי קונטקסט
   * @param {object} previous - מצב קודם
   * @param {object} current - מצב נוכחי
   * @returns {object} - השינויים
   * @private
   */
  _computeChanges(previous, current) {
    const changes = {
      added: {},
      modified: {},
      removed: []
    };
    
    // מציאת שדות שהתווספו או שונו
    for (const [key, value] of Object.entries(current)) {
      if (!(key in previous)) {
        changes.added[key] = value;
      } else if (JSON.stringify(previous[key]) !== JSON.stringify(value)) {
        changes.modified[key] = {
          from: previous[key],
          to: value
        };
      }
    }
    
    // מציאת שדות שהוסרו
    for (const key of Object.keys(previous)) {
      if (!(key in current)) {
        changes.removed.push(key);
      }
    }
    
    return changes;
  }

  /**
   * שמירת קונטקסט לדיסק
   * @param {string} contextId - מזהה הקונטקסט
   * @private
   */
  _saveContextToDisk(contextId) {
    try {
      const context = this.projectContexts.get(contextId);
      const contextFile = path.join(this.contextDir, `${contextId}.json`);
      
      fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf8');
      logger.info(`[context_manager] Saved context to disk: ${contextId}`);
    } catch (error) {
      logger.error(`[context_manager] Failed to save context to disk: ${error.message}`);
    }
  }

  /**
   * טעינת קונטקסט מהדיסק
   * @param {string} contextId - מזהה הקונטקסט
   * @private
   */
  _loadContextFromDisk(contextId) {
    try {
      const contextFile = path.join(this.contextDir, `${contextId}.json`);
      
      if (!fs.existsSync(contextFile)) {
        logger.warn(`[context_manager] Context file not found: ${contextFile}`);
        return null;
      }
      
      const contextData = fs.readFileSync(contextFile, 'utf8');
      const context = JSON.parse(contextData);
      
      this.projectContexts.set(contextId, context);
      logger.info(`[context_manager] Loaded context from disk: ${contextId}`);
      
      return context;
    } catch (error) {
      logger.error(`[context_manager] Failed to load context from disk: ${error.message}`);
      return null;
    }
  }

  /**
   * טעינת כל הקונטקסטים מהדיסק
   * @private
   */
  _loadAllContextsFromDisk() {
    try {
      if (!fs.existsSync(this.contextDir)) {
        return;
      }
      
      const files = fs.readdirSync(this.contextDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const contextId = file.replace('.json', '');
          this._loadContextFromDisk(contextId);
        }
      }
      
      logger.info(`[context_manager] Loaded ${this.projectContexts.size} contexts from disk`);
    } catch (error) {
      logger.error(`[context_manager] Failed to load contexts from disk: ${error.message}`);
    }
  }

  /**
   * קבלת רשימת כל הקונטקסטים
   * @returns {Array} - רשימת הקונטקסטים
   */
  getAllContexts() {
    // טען קונטקסטים מהדיסק לפני החזרת הרשימה
    this._loadAllContextsFromDisk();
    
    return Array.from(this.projectContexts.values()).map(context => ({
      id: context.id,
      projectId: context.projectId,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt
    }));
  }
}

module.exports = new ContextManager(); 