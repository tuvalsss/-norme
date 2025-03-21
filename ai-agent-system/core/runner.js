const { exec, spawn } = require('child_process');
const { logger } = require('./logger');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');

// המר את exec לגרסה מבוססת Promise
const execPromise = util.promisify(exec);

/**
 * מנהל הרצת פקודות מעטפת
 */
class Runner {
  constructor(workspacePath = '../workspace') {
    // נתיב בסיס לתיקיית העבודה
    this.workspacePath = path.resolve(__dirname, workspacePath);
    
    // וודא שהתיקייה קיימת
    fs.ensureDirSync(this.workspacePath);
    
    // רשימת פקודות אסורות
    this.forbiddenCommands = [
      'rm -rf', 'deltree', 'format',
      'wget', 'curl -O', 
      'sudo', 'su', 
      '>', '>>', '2>', '2>>', 
      'eval', 'source',
      'ssh', 'telnet', 'ftp',
      'chmod 777', 'chmod -R 777'
    ];
    
    logger.info(`מנהל הרצת פקודות אותחל עם תיקיית עבודה: ${this.workspacePath}`);
  }

  /**
   * בודק אם פקודה מכילה פעולות אסורות
   * @param {string} command - הפקודה לבדיקה
   * @returns {boolean} - האם הפקודה מכילה פעולות אסורות
   */
  _isCommandSafe(command) {
    const lowerCommand = command.toLowerCase();
    
    // בדוק אם הפקודה מכילה מילות מפתח אסורות
    for (const forbidden of this.forbiddenCommands) {
      if (lowerCommand.includes(forbidden.toLowerCase())) {
        logger.error(`פקודה נדחתה: ${command} - מכילה פעולה אסורה: ${forbidden}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * מריץ פקודת מעטפת ומחזיר את הפלט שלה
   * @param {string} command - הפקודה להרצה
   * @returns {Promise<Object>} - הפלט מהפקודה (stdout, stderr)
   */
  async runCommand(command) {
    if (!this._isCommandSafe(command)) {
      throw new Error(`הפקודה '${command}' נדחתה מסיבות אבטחה`);
    }
    
    try {
      logger.info(`מריץ פקודה: ${command}`);
      
      const { stdout, stderr } = await execPromise(command, {
        cwd: this.workspacePath,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      if (stderr) {
        logger.warn(`פקודה החזירה שגיאות: ${command}\n${stderr}`);
      }
      
      return { stdout, stderr };
    } catch (error) {
      logger.error(`שגיאה בהרצת פקודה ${command}: ${error.message}`);
      throw error;
    }
  }

  /**
   * מריץ פקודה ושולח עדכונים בזמן אמת
   * @param {string} command - הפקודה להרצה
   * @param {Function} stdoutCallback - קולבק לפלט סטנדרטי
   * @param {Function} stderrCallback - קולבק לפלט שגיאה
   * @param {Function} closeCallback - קולבק לסיום הפקודה
   * @returns {ChildProcess} - תהליך הבן שנוצר
   */
  runLiveCommand(command, stdoutCallback, stderrCallback, closeCallback) {
    if (!this._isCommandSafe(command)) {
      throw new Error(`הפקודה '${command}' נדחתה מסיבות אבטחה`);
    }
    
    logger.info(`מריץ פקודה בזמן אמת: ${command}`);
    
    // פצל את הפקודה למערך פרמטרים
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    // צור תהליך בן חדש
    const child = spawn(cmd, args, {
      cwd: this.workspacePath,
      shell: true
    });
    
    // הגדר מאזינים לאירועים
    child.stdout.on('data', (data) => {
      const output = data.toString();
      logger.debug(`פלט מהפקודה: ${output}`);
      if (stdoutCallback) stdoutCallback(output);
    });
    
    child.stderr.on('data', (data) => {
      const output = data.toString();
      logger.warn(`שגיאה מהפקודה: ${output}`);
      if (stderrCallback) stderrCallback(output);
    });
    
    child.on('close', (code) => {
      logger.info(`הפקודה הסתיימה עם קוד יציאה: ${code}`);
      if (closeCallback) closeCallback(code);
    });
    
    return child;
  }
}

module.exports = new Runner(); 