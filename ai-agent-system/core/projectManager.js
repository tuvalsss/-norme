const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { logger } = require('./logger');
const fileManager = require('./fileManager');

/**
 * מנהל פרויקטים שמטפל בסריקה, בחירה ופתיחה של פרויקטים
 */
class ProjectManager {
  constructor() {
    // נתיב ברירת מחדל להחזקת קבצי הפרויקט
    this.projectsRoot = path.resolve(process.env.PROJECTS_ROOT || path.join(__dirname, '../projects'));
    
    // נתיב לתיקיית workspace
    this.workspacePath = path.resolve(__dirname, '../workspace');
    
    // פרויקט פעיל
    this.activeProject = null;
    
    // וודא שהתיקיות קיימות
    fs.ensureDirSync(this.projectsRoot);
    fs.ensureDirSync(this.workspacePath);
    
    logger.info(`מנהל הפרויקטים אותחל. תיקיית פרויקטים: ${this.projectsRoot}`);
  }

  /**
   * סורק ומחזיר רשימה של כל הפרויקטים הזמינים
   * 
   * @returns {Promise<Array>} רשימה של פרויקטים זמינים
   */
  async getProjects() {
    try {
      const projects = [];
      
      // קרא את כל התיקיות בתיקיית הפרויקטים
      const dirs = await fs.readdir(this.projectsRoot);
      
      for (const dir of dirs) {
        const fullPath = path.join(this.projectsRoot, dir);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          projects.push({
            name: dir,
            path: fullPath,
            isActive: this.activeProject === dir
          });
        }
      }
      
      return projects;
    } catch (error) {
      logger.error(`שגיאה בקבלת רשימת פרויקטים: ${error.message}`);
      throw error;
    }
  }

  /**
   * בוחר פרויקט פעיל ויוצר קישור סימבולי בתיקיית העבודה
   * 
   * @param {string} projectName שם הפרויקט
   * @returns {Promise<Object>} מידע על הפרויקט שנבחר
   */
  async selectProject(projectName) {
    try {
      const projectPath = path.join(this.projectsRoot, projectName);
      
      // בדוק אם הפרויקט קיים
      const exists = await fs.pathExists(projectPath);
      if (!exists) {
        throw new Error(`פרויקט ${projectName} לא קיים`);
      }
      
      // עדכן את הפרויקט הפעיל
      this.activeProject = projectName;
      
      // עדכן את הקישור הסימבולי בתיקיית העבודה
      const workspaceLink = path.join(this.workspacePath, 'current');
      
      // מחק קישור קודם אם קיים
      if (await fs.pathExists(workspaceLink)) {
        await fs.remove(workspaceLink);
      }
      
      // צור קישור חדש
      await fs.ensureSymlink(projectPath, workspaceLink, 'dir');
      
      logger.info(`פרויקט "${projectName}" נבחר בהצלחה. נתיב: ${projectPath}`);
      
      return {
        name: projectName,
        path: projectPath,
        workspaceLink
      };
    } catch (error) {
      logger.error(`שגיאה בבחירת פרויקט ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * מחזיר מידע על הפרויקט הפעיל
   * 
   * @returns {Promise<Object|null>} מידע על הפרויקט הפעיל או null אם אין פרויקט פעיל
   */
  async getActiveProject() {
    if (!this.activeProject) {
      return null;
    }
    
    const projectPath = path.join(this.projectsRoot, this.activeProject);
    const exists = await fs.pathExists(projectPath);
    
    if (!exists) {
      this.activeProject = null;
      return null;
    }
    
    return {
      name: this.activeProject,
      path: projectPath
    };
  }

  /**
   * סורק את מבנה הקבצים של פרויקט
   * 
   * @param {string} projectName שם הפרויקט (אם לא צוין, משתמש בפרויקט הפעיל)
   * @returns {Promise<Object>} מבנה קבצים ותיקיות של הפרויקט
   */
  async getProjectFiles(projectName = null) {
    try {
      const targetProject = projectName || this.activeProject;
      
      if (!targetProject) {
        throw new Error('לא נבחר פרויקט');
      }
      
      const projectPath = path.join(this.projectsRoot, targetProject);
      
      // בדוק אם הפרויקט קיים
      const exists = await fs.pathExists(projectPath);
      if (!exists) {
        throw new Error(`פרויקט ${targetProject} לא קיים`);
      }
      
      // הפונקציה הרקורסיבית לקבלת מבנה הקבצים
      const getFilesRecursive = async (dirPath, relativePath = '') => {
        const files = await fs.readdir(dirPath);
        const result = [];
        
        for (const file of files) {
          // דלג על תיקיות הגיט ונראה ותיקיות מוחבאות
          if (file === '.git' || file === 'node_modules' || file.startsWith('.')) {
            continue;
          }
          
          const filePath = path.join(dirPath, file);
          const relPath = path.join(relativePath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isDirectory()) {
            const children = await getFilesRecursive(filePath, relPath);
            result.push({
              name: file,
              path: relPath,
              type: 'directory',
              children
            });
          } else {
            result.push({
              name: file,
              path: relPath,
              type: 'file',
              size: stats.size
            });
          }
        }
        
        return result;
      };
      
      const structure = await getFilesRecursive(projectPath);
      return structure;
    } catch (error) {
      logger.error(`שגיאה בקבלת מבנה קבצים: ${error.message}`);
      throw error;
    }
  }

  /**
   * פותח קובץ בעורך חיצוני (VS Code)
   * 
   * @param {string} filePath נתיב יחסי לקובץ בפרויקט
   * @returns {Promise<Object>} תוצאות פתיחת הקובץ
   */
  async openFileInEditor(filePath) {
    try {
      if (!this.activeProject) {
        throw new Error('לא נבחר פרויקט');
      }
      
      const projectPath = path.join(this.projectsRoot, this.activeProject);
      const fullPath = path.join(projectPath, filePath);
      
      // בדוק אם הקובץ קיים
      const exists = await fs.pathExists(fullPath);
      if (!exists) {
        throw new Error(`קובץ ${filePath} לא קיים`);
      }
      
      logger.info(`פותח קובץ במערכת חיצונית: ${fullPath}`);
      
      // הפעל את VS Code עם הקובץ
      const vscode = spawn('code', [fullPath], { stdio: 'inherit' });
      
      return new Promise((resolve, reject) => {
        vscode.on('error', (err) => {
          logger.error(`שגיאה בפתיחת VS Code: ${err.message}`);
          reject(err);
        });
        
        // VSCode יורץ ברקע ולא נחכה לסיום התהליך
        resolve({ success: true, message: `קובץ ${filePath} נפתח בהצלחה` });
      });
    } catch (error) {
      logger.error(`שגיאה בפתיחת קובץ ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * קורא את תוכן הקובץ
   * 
   * @param {string} filePath נתיב יחסי לקובץ בפרויקט
   * @returns {Promise<string>} תוכן הקובץ
   */
  async readProjectFile(filePath) {
    try {
      if (!this.activeProject) {
        throw new Error('לא נבחר פרויקט');
      }
      
      const projectPath = path.join(this.projectsRoot, this.activeProject);
      const fullPath = path.join(projectPath, filePath);
      
      // בדוק אם הקובץ קיים
      const exists = await fs.pathExists(fullPath);
      if (!exists) {
        throw new Error(`קובץ ${filePath} לא קיים`);
      }
      
      const content = await fs.readFile(fullPath, 'utf8');
      return content;
    } catch (error) {
      logger.error(`שגיאה בקריאת קובץ ${filePath}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ProjectManager(); 