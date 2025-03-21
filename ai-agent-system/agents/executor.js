const runner = require('../core/runner');
const fileManager = require('../core/fileManager');
const { createAgentLogger } = require('../core/logger');
const path = require('path');
const fs = require('fs-extra');

// צור logger ייעודי לסוכן ההרצה
const logger = createAgentLogger('executor_agent');

/**
 * סוכן הרצה שאחראי על הרצת סקריפטים ותיעוד הפלט
 */
class ExecutorAgent {
  constructor() {
    this.name = 'executor_agent';
    this.active = false;
    this.runningProcesses = new Map(); // מפה של תהליכים פעילים
    this.outputBuffer = new Map(); // באפר לפלט מתהליכים
    
    logger.info('סוכן הרצה אותחל');
  }

  /**
   * מפעיל את הסוכן
   * @returns {Promise<void>}
   */
  async start() {
    this.active = true;
    logger.info('סוכן הרצה הופעל');
  }

  /**
   * מכבה את הסוכן ומפסיק את כל התהליכים הפעילים
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.runningProcesses.size > 0) {
      logger.info(`מפסיק ${this.runningProcesses.size} תהליכים פעילים`);
      
      // עבור על כל התהליכים הפעילים וסיים אותם
      for (const [processId, process] of this.runningProcesses.entries()) {
        try {
          process.kill();
          logger.info(`תהליך ${processId} הופסק`);
        } catch (error) {
          logger.error(`שגיאה בהפסקת תהליך ${processId}: ${error.message}`);
        }
      }
      
      this.runningProcesses.clear();
    }
    
    this.active = false;
    logger.info('סוכן הרצה כובה');
  }

  /**
   * מריץ פקודה חד פעמית ומחזיר את הפלט שלה
   * @param {string} command - הפקודה להרצה
   * @param {boolean} logOutput - האם לתעד את הפלט לקובץ לוג
   * @returns {Promise<Object>} - הפלט מהפקודה (stdout, stderr)
   */
  async executeCommand(command, logOutput = true) {
    logger.info(`מריץ פקודה חד פעמית: ${command}`);
    
    try {
      const result = await runner.runCommand(command);
      
      if (logOutput) {
        // שמור את הפלט בקובץ לוג
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const logFileName = `command_${timestamp}.log`;
        const logPath = `logs/executor_agent/${logFileName}`;
        
        const logContent = `
פקודה: ${command}
זמן: ${timestamp}
----------------------------
פלט:
${result.stdout}
----------------------------
שגיאות:
${result.stderr || 'אין'}
`;
        
        await fileManager.writeFile(logPath, logContent);
        logger.info(`פלט הפקודה נשמר ב: ${logPath}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`שגיאה בהרצת פקודה: ${error.message}`);
      throw error;
    }
  }

  /**
   * מריץ סקריפט ועוקב אחר הפלט שלו בזמן אמת
   * @param {string} scriptPath - נתיב לסקריפט
   * @param {string} logFile - נתיב לקובץ לוג
   * @returns {Promise<string>} - מזהה התהליך
   */
  async runScript(scriptPath, logFile = null) {
    logger.info(`מריץ סקריפט: ${scriptPath}`);
    
    try {
      // בדוק אם הסקריפט קיים
      const exists = await fileManager.fileExists(scriptPath);
      if (!exists) {
        throw new Error(`הסקריפט ${scriptPath} אינו קיים`);
      }
      
      // אם לא צוין קובץ לוג, צור אחד
      if (!logFile) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const scriptName = path.basename(scriptPath).split('.')[0];
        logFile = `logs/executor_agent/${scriptName}_${timestamp}.log`;
      }
      
      // צור באפר חדש לפלט התהליך
      const processId = `${path.basename(scriptPath)}_${Date.now()}`;
      this.outputBuffer.set(processId, []);
      
      // פונקציות לטיפול בפלט
      const handleOutput = (data) => {
        const output = data.toString();
        // הוסף לבאפר
        const buffer = this.outputBuffer.get(processId) || [];
        buffer.push(output);
        this.outputBuffer.set(processId, buffer);
        
        // שמור לקובץ לוג
        fs.appendFileSync(path.join(fileManager.baseDir, logFile), output);
        
        logger.debug(`פלט מסקריפט ${processId}: ${output}`);
      };
      
      const handleClose = (code) => {
        logger.info(`סקריפט ${processId} הסתיים עם קוד יציאה: ${code}`);
        this.runningProcesses.delete(processId);
        
        // כתוב סיכום לקובץ הלוג
        const summary = `
----------------------------
סיכום הרצה:
סקריפט: ${scriptPath}
מזהה תהליך: ${processId}
קוד יציאה: ${code}
זמן סיום: ${new Date().toISOString()}
----------------------------
`;
        
        fs.appendFileSync(path.join(fileManager.baseDir, logFile), summary);
      };
      
      // התחל את הסקריפט
      const command = this._buildScriptCommand(scriptPath);
      const process = runner.runLiveCommand(
        command,
        handleOutput,
        handleOutput,
        handleClose
      );
      
      // שמור את התהליך
      this.runningProcesses.set(processId, process);
      
      logger.info(`סקריפט ${processId} החל לרוץ. הפלט נשמר ב: ${logFile}`);
      return processId;
      
    } catch (error) {
      logger.error(`שגיאה בהרצת סקריפט ${scriptPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * מפסיק תהליך פעיל לפי מזהה
   * @param {string} processId - מזהה התהליך
   * @returns {Promise<boolean>} - האם התהליך הופסק בהצלחה
   */
  async stopProcess(processId) {
    logger.info(`מנסה להפסיק תהליך: ${processId}`);
    
    if (!this.runningProcesses.has(processId)) {
      logger.warn(`תהליך ${processId} אינו קיים או כבר הסתיים`);
      return false;
    }
    
    try {
      const process = this.runningProcesses.get(processId);
      process.kill();
      this.runningProcesses.delete(processId);
      logger.info(`תהליך ${processId} הופסק בהצלחה`);
      return true;
    } catch (error) {
      logger.error(`שגיאה בהפסקת תהליך ${processId}: ${error.message}`);
      return false;
    }
  }

  /**
   * מחזיר את סטטוס התהליכים הפעילים
   * @returns {Promise<Object>} - מידע על התהליכים הפעילים
   */
  async getStatus() {
    const processes = [];
    
    for (const [processId, process] of this.runningProcesses.entries()) {
      processes.push({
        id: processId,
        startTime: processId.split('_')[1],
        lastOutput: this._getLastOutput(processId)
      });
    }
    
    return {
      active: this.active,
      runningProcesses: processes,
      total: processes.length
    };
  }

  /**
   * מחזיר את הפלט האחרון של תהליך מהבאפר
   * @param {string} processId - מזהה התהליך
   * @returns {string} - הפלט האחרון
   * @private
   */
  _getLastOutput(processId) {
    const buffer = this.outputBuffer.get(processId);
    if (!buffer || buffer.length === 0) {
      return '';
    }
    
    // החזר את שורות הפלט האחרונות (עד 5)
    return buffer.slice(-5).join('\n');
  }

  /**
   * בונה את פקודת ההרצה המתאימה לסוג הסקריפט
   * @param {string} scriptPath - נתיב לסקריפט
   * @returns {string} - פקודת ההרצה
   * @private
   */
  _buildScriptCommand(scriptPath) {
    const ext = path.extname(scriptPath).toLowerCase();
    
    switch (ext) {
      case '.js':
        return `node ${scriptPath}`;
      case '.py':
        return `python ${scriptPath}`;
      case '.sh':
        return `bash ${scriptPath}`;
      case '.bat':
        return scriptPath;
      case '.ps1':
        return `powershell -File ${scriptPath}`;
      default:
        // נסה להריץ כקובץ הרצה
        return scriptPath;
    }
  }
}

module.exports = new ExecutorAgent(); 