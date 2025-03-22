const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./logger');
const fileManager = require('./fileManager');
const git = require('simple-git');
const glob = require('glob');

/**
 * Project Management System
 * Handles project creation, file operations, version control, and analysis.
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
    
    // Active projects
    this.projects = {};
    
    logger.info(`Project Manager initialized. Projects directory: ${this.projectsRoot}`);
  }

  /**
   * Creates a new project
   * @param {string} projectName - Project name
   * @param {Object} options - Project options
   * @returns {Object} Project information
   */
  async createProject(projectName, options = {}) {
    try {
      const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const projectDir = path.join(this.projectsRoot, sanitizedName);
      
      // Check if project already exists
      if (fs.existsSync(projectDir)) {
        if (!options.overwrite) {
          throw new Error(`Project ${projectName} already exists. Use overwrite option to recreate.`);
        } else {
          await fs.remove(projectDir);
        }
      }
      
      // Create project directory
      await fs.ensureDir(projectDir);
      
      // Initialize Git repository if needed
      if (options.initGit !== false) {
        await git(projectDir).init();
        logger.info(`Initialized Git repository for project ${projectName}`);
      }
      
      // Create basic structure
      await fs.ensureDir(path.join(projectDir, 'src'));
      await fs.ensureDir(path.join(projectDir, 'docs'));
      
      // Create README.md
      const readmeContent = `# ${projectName}\n\nCreated at ${new Date().toISOString()}\n\n## Description\n\n${options.description || 'Project description goes here.'}\n`;
      await fs.writeFile(path.join(projectDir, 'README.md'), readmeContent);
      
      // Create basic configuration
      const config = {
        name: projectName,
        description: options.description || '',
        created: new Date().toISOString(),
        settings: options.settings || {}
      };
      
      await fs.writeJson(path.join(projectDir, 'project.json'), config, { spaces: 2 });
      
      // Register project
      this.projects[sanitizedName] = {
        name: projectName,
        path: projectDir,
        active: true,
        config
      };
      
      logger.info(`Created project ${projectName} at ${projectDir}`);
      
      return {
        name: projectName,
        path: projectDir,
        config
      };
    } catch (error) {
      logger.error(`Failed to create project ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Opens an existing project
   * @param {string} projectName - Project name
   * @returns {Object} Project information
   */
  async openProject(projectName) {
    try {
      const projectDir = path.join(this.projectsRoot, projectName);
      
      // Check if project exists
      if (!fs.existsSync(projectDir)) {
        throw new Error(`Project ${projectName} does not exist.`);
      }
      
      // Load project configuration
      let config = {};
      const configPath = path.join(projectDir, 'project.json');
      
      if (fs.existsSync(configPath)) {
        config = await fs.readJson(configPath);
      } else {
        // Create minimal config if it doesn't exist
        config = {
          name: projectName,
          description: '',
          created: new Date().toISOString(),
          settings: {}
        };
        await fs.writeJson(configPath, config, { spaces: 2 });
      }
      
      // Register project
      this.projects[projectName] = {
        name: projectName,
        path: projectDir,
        active: true,
        config
      };
      
      logger.info(`Opened project ${projectName} at ${projectDir}`);
      
      return {
        name: projectName,
        path: projectDir,
        config
      };
    } catch (error) {
      logger.error(`Failed to open project ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets a list of available projects
   * @returns {Array<Object>} List of projects
   */
  async listProjects() {
    try {
      const dirs = await fs.readdir(this.projectsRoot);
      
      const projects = [];
      
      for (const dir of dirs) {
        const projectDir = path.join(this.projectsRoot, dir);
        const stat = await fs.stat(projectDir);
        
        if (stat.isDirectory()) {
          // Try to read project config
          let config = {};
          const configPath = path.join(projectDir, 'project.json');
          
          if (fs.existsSync(configPath)) {
            config = await fs.readJson(configPath);
          }
          
          projects.push({
            name: dir,
            path: projectDir,
            config,
            active: !!this.projects[dir]
          });
        }
      }
      
      return projects;
    } catch (error) {
      logger.error(`Failed to list projects: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets information about a specific project
   * @param {string} projectName - Project name
   * @returns {Object} Project information
   */
  async getProjectInfo(projectName) {
    try {
      // Check if project is registered
      if (this.projects[projectName]) {
        return this.projects[projectName];
      }
      
      // Try to open the project
      return await this.openProject(projectName);
    } catch (error) {
      logger.error(`Failed to get project info for ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyzes a project's structure and returns information about it
   * @param {string} projectName - Project name
   * @returns {Object} Project analysis
   */
  async analyzeProject(projectName) {
    try {
      // Ensure project is opened
      const projectInfo = await this.getProjectInfo(projectName);
      const projectDir = projectInfo.path;
      
      const analysis = {
        name: projectName,
        path: projectDir,
        files: {
          total: 0,
          byType: {}
        },
        size: 0,
        structure: {},
        git: {
          initialized: false,
          branches: [],
          lastCommit: null
        }
      };
      
      // Count files and analyze structure
      const files = await glob('**/*', { cwd: projectDir, nodir: true, dot: true });
      
      analysis.files.total = files.length;
      
      for (const file of files) {
        const ext = path.extname(file).toLowerCase() || 'no-extension';
        
        if (!analysis.files.byType[ext]) {
          analysis.files.byType[ext] = 0;
        }
        
        analysis.files.byType[ext]++;
        
        // Calculate file size
        const filePath = path.join(projectDir, file);
        const stat = await fs.stat(filePath);
        analysis.size += stat.size;
        
        // Build structure
        const parts = file.split('/');
        let current = analysis.structure;
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
        
        const fileName = parts[parts.length - 1];
        current[fileName] = 'file';
      }
      
      // Check Git status
      if (fs.existsSync(path.join(projectDir, '.git'))) {
        analysis.git.initialized = true;
        
        const gitRepo = git(projectDir);
        
        try {
          // Get branches
          const branches = await gitRepo.branch();
          analysis.git.branches = branches.all;
          analysis.git.currentBranch = branches.current;
          
          // Get last commit
          const log = await gitRepo.log({ maxCount: 1 });
          if (log.latest) {
            analysis.git.lastCommit = {
              hash: log.latest.hash,
              date: log.latest.date,
              message: log.latest.message,
              author: log.latest.author_name
            };
          }
        } catch (gitError) {
          logger.warn(`Error getting Git information for ${projectName}: ${gitError.message}`);
        }
      }
      
      return analysis;
    } catch (error) {
      logger.error(`Failed to analyze project ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a file in a project
   * @param {string} projectName - Project name
   * @param {string} filePath - File path within the project
   * @param {string} content - File content
   * @returns {Object} File information
   */
  async createFile(projectName, filePath, content) {
    try {
      // Ensure project is opened
      const projectInfo = await this.getProjectInfo(projectName);
      const fullPath = path.join(projectInfo.path, filePath);
      
      // Create directory if it doesn't exist
      await fs.ensureDir(path.dirname(fullPath));
      
      // Write file
      await fs.writeFile(fullPath, content);
      
      logger.info(`Created file ${filePath} in project ${projectName}`);
      
      return {
        project: projectName,
        path: filePath,
        fullPath,
        size: content.length
      };
    } catch (error) {
      logger.error(`Failed to create file ${filePath} in project ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reads a file from a project
   * @param {string} projectName - Project name
   * @param {string} filePath - File path within the project
   * @returns {string} File content
   */
  async readFile(projectName, filePath) {
    try {
      // Ensure project is opened
      const projectInfo = await this.getProjectInfo(projectName);
      const fullPath = path.join(projectInfo.path, filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File ${filePath} does not exist in project ${projectName}.`);
      }
      
      // Read file
      const content = await fs.readFile(fullPath, 'utf8');
      
      return content;
    } catch (error) {
      logger.error(`Failed to read file ${filePath} in project ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates a file in a project
   * @param {string} projectName - Project name
   * @param {string} filePath - File path within the project
   * @param {string} content - New file content
   * @returns {Object} File information
   */
  async updateFile(projectName, filePath, content) {
    try {
      // Ensure project is opened
      const projectInfo = await this.getProjectInfo(projectName);
      const fullPath = path.join(projectInfo.path, filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File ${filePath} does not exist in project ${projectName}.`);
      }
      
      // Write file
      await fs.writeFile(fullPath, content);
      
      logger.info(`Updated file ${filePath} in project ${projectName}`);
      
      return {
        project: projectName,
        path: filePath,
        fullPath,
        size: content.length
      };
    } catch (error) {
      logger.error(`Failed to update file ${filePath} in project ${projectName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes a file from a project
   * @param {string} projectName - Project name
   * @param {string} filePath - File path within the project
   * @returns {boolean} Success status
   */
  async deleteFile(projectName, filePath) {
    try {
      // Ensure project is opened
      const projectInfo = await this.getProjectInfo(projectName);
      const fullPath = path.join(projectInfo.path, filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File ${filePath} does not exist in project ${projectName}.`);
      }
      
      // Delete file
      await fs.unlink(fullPath);
      
      logger.info(`Deleted file ${filePath} from project ${projectName}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete file ${filePath} from project ${projectName}: ${error.message}`);
      throw error;
    }
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
            id: dir,          // השתמש בשם התיקייה כ-ID
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
   * מוסיף פרויקט חדש מתיקייה קיימת
   * 
   * @param {string} projectName שם הפרויקט
   * @param {string} sourcePath נתיב למיקום התיקייה המקורית
   * @returns {Promise<Object>} מידע על הפרויקט שנוסף
   */
  async addProject(projectName, sourcePath) {
    try {
      // וודא שהנתיב המקורי קיים
      if (!await fs.pathExists(sourcePath)) {
        throw new Error(`הנתיב ${sourcePath} אינו קיים`);
      }
      
      // בדוק אם פרויקט בשם זה כבר קיים
      const projectPath = path.join(this.projectsRoot, projectName);
      if (await fs.pathExists(projectPath)) {
        throw new Error(`פרויקט בשם ${projectName} כבר קיים`);
      }
      
      // יצירת תיקיית הפרויקט
      await fs.ensureDir(projectPath);
      
      // העתקת התוכן מהתיקייה המקורית
      await fs.copy(sourcePath, projectPath, {
        overwrite: false,
        errorOnExist: false,
        recursive: true
      });
      
      logger.info(`פרויקט חדש נוסף: ${projectName} מהנתיב ${sourcePath}`);
      
      // החזר מידע על הפרויקט החדש
      return {
        id: projectName,
        name: projectName,
        path: projectPath,
        status: 'new'
      };
    } catch (error) {
      logger.error(`שגיאה בהוספת פרויקט: ${error.message}`);
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

// Create and export singleton instance
const projectManager = new ProjectManager();
module.exports = projectManager; 