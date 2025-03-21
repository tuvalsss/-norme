const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./logger');

/**
 * מנהל קבצים שמאפשר קריאה וכתיבה בטוחה של קבצים
 */
class FileManager {
  constructor(baseDir = '../workspace') {
    // נתיב בסיס לתיקיית העבודה
    this.baseDir = path.resolve(__dirname, baseDir);
    
    // וודא שהתיקייה קיימת
    fs.ensureDirSync(this.baseDir);
    
    logger.info(`מנהל קבצים אותחל עם תיקיית בסיס: ${this.baseDir}`);
  }

  /**
   * מנרמל נתיב יחסי לנתיב מלא ומוודא שהוא בתוך תיקיית העבודה
   * @param {string} relativePath - נתיב יחסי לקובץ
   * @returns {string} - נתיב מלא
   */
  _normalizePath(relativePath) {
    // מנרמל את הנתיב ומוודא שאין יציאה מתיקיית העבודה
    const normalizedPath = path.normalize(relativePath);
    
    if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
      throw new Error('אין גישה לקבצים מחוץ לתיקיית העבודה');
    }
    
    return path.join(this.baseDir, normalizedPath);
  }

  /**
   * קורא קובץ מתיקיית העבודה
   * @param {string} relativePath - נתיב יחסי לקובץ
   * @returns {Promise<string>} - תוכן הקובץ
   */
  async readFile(relativePath) {
    try {
      const fullPath = this._normalizePath(relativePath);
      logger.info(`קורא קובץ: ${relativePath}`);
      
      return await fs.readFile(fullPath, 'utf8');
    } catch (error) {
      logger.error(`שגיאה בקריאת קובץ ${relativePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * כותב לקובץ בתיקיית העבודה
   * @param {string} relativePath - נתיב יחסי לקובץ
   * @param {string} content - תוכן הקובץ
   * @returns {Promise<void>}
   */
  async writeFile(relativePath, content) {
    try {
      const fullPath = this._normalizePath(relativePath);
      logger.info(`כותב לקובץ: ${relativePath}`);
      
      // וודא שתיקיית האב קיימת
      await fs.ensureDir(path.dirname(fullPath));
      
      await fs.writeFile(fullPath, content);
    } catch (error) {
      logger.error(`שגיאה בכתיבה לקובץ ${relativePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * בודק אם קובץ קיים
   * @param {string} relativePath - נתיב יחסי לקובץ
   * @returns {Promise<boolean>} - האם הקובץ קיים
   */
  async fileExists(relativePath) {
    try {
      const fullPath = this._normalizePath(relativePath);
      return await fs.pathExists(fullPath);
    } catch (error) {
      logger.error(`שגיאה בבדיקת קיום קובץ ${relativePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * מחזיר רשימה של קבצים בתיקייה
   * @param {string} relativeDirPath - נתיב יחסי לתיקייה
   * @returns {Promise<string[]>} - רשימת הקבצים בתיקייה
   */
  async listFiles(relativeDirPath = '') {
    try {
      const fullPath = this._normalizePath(relativeDirPath);
      logger.info(`מציג רשימת קבצים בתיקייה: ${relativeDirPath}`);
      
      const items = await fs.readdir(fullPath);
      
      const stats = await Promise.all(
        items.map(async (item) => {
          const itemPath = path.join(fullPath, item);
          const stat = await fs.stat(itemPath);
          return {
            name: item,
            isDirectory: stat.isDirectory(),
            path: path.join(relativeDirPath, item)
          };
        })
      );
      
      return stats;
    } catch (error) {
      logger.error(`שגיאה בקריאת תיקייה ${relativeDirPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * מוחק קובץ מתיקיית העבודה
   * @param {string} relativePath - נתיב יחסי לקובץ
   * @returns {Promise<void>}
   */
  async deleteFile(relativePath) {
    try {
      const fullPath = this._normalizePath(relativePath);
      logger.info(`מוחק קובץ: ${relativePath}`);
      
      await fs.remove(fullPath);
    } catch (error) {
      logger.error(`שגיאה במחיקת קובץ ${relativePath}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new FileManager(); 