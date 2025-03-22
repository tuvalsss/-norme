const { exec, spawn } = require('child_process');
const logger = require('./logger');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');

// המר את exec לגרסה מבוססת Promise
const execPromise = util.promisify(exec);

/**
 * Task Runner System
 * Handles running external commands, scripts, and code execution
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
    
    this.activeProcesses = {};
    this.logDirectory = path.join(__dirname, '../logs/processes');
    
    // Ensure log directory exists
    fs.ensureDirSync(this.logDirectory);
    
    logger.info(`Task Runner initialized with workspace: ${this.workspacePath}`);
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
        logger.error(`Command rejected: ${command} - Contains forbidden operation: ${forbidden}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Executes a shell command
   * @param {string} command - The command to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeCommand(command, options = {}) {
    const taskId = options.taskId || `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const cwd = options.cwd || process.cwd();
    const timeout = options.timeout || 60000; // Default 1 minute timeout
    const shouldLog = options.log !== false;
    
    try {
      logger.info(`Executing command: ${command} (${taskId})`);
      
      // Split command into command and args
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      
      // Set up logging
      let logFile = null;
      if (shouldLog) {
        const logPath = path.join(this.logDirectory, `${taskId}.log`);
        logFile = fs.createWriteStream(logPath, { flags: 'a' });
        logFile.write(`Command: ${command}\nStarted: ${new Date().toISOString()}\n\n`);
      }
      
      return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let killed = false;
        
        // Execute command
        const process = spawn(cmd, args, {
          cwd,
          shell: true,
          env: { ...options.env, ...process.env }
        });
        
        // Track process
        this.activeProcesses[taskId] = {
          process,
          command,
          startTime: Date.now(),
          options
        };
        
        // Handle data events
        process.stdout.on('data', (data) => {
          const dataStr = data.toString();
          stdout += dataStr;
          if (logFile) logFile.write(`[stdout] ${dataStr}`);
          if (options.onOutput) options.onOutput(dataStr, 'stdout');
        });
        
        process.stderr.on('data', (data) => {
          const dataStr = data.toString();
          stderr += dataStr;
          if (logFile) logFile.write(`[stderr] ${dataStr}`);
          if (options.onOutput) options.onOutput(dataStr, 'stderr');
        });
        
        // Handle process exit
        process.on('close', (code) => {
          delete this.activeProcesses[taskId];
          
          if (logFile) {
            logFile.write(`\nExit code: ${code}\nFinished: ${new Date().toISOString()}\n`);
            logFile.end();
          }
          
          const duration = Date.now() - this.activeProcesses[taskId]?.startTime || 0;
          
          if (killed) {
            reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
          } else if (code !== 0 && !options.ignoreExitCode) {
            logger.error(`Command failed with code ${code}: ${command}`);
            reject(new Error(`Command failed with code ${code}: ${stderr || 'No error output'}`));
          } else {
            logger.info(`Command completed successfully: ${command}`);
            resolve({
              taskId,
              command,
              exitCode: code,
              stdout,
              stderr,
              duration
            });
          }
        });
        
        // Handle timeout
        if (timeout > 0) {
          setTimeout(() => {
            if (this.activeProcesses[taskId]) {
              killed = true;
              this.killProcess(taskId);
            }
          }, timeout);
        }
      });
    } catch (error) {
      logger.error(`Error executing command ${command}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stops a running process
   * @param {string} taskId - ID of the process to stop
   * @returns {boolean} Success status
   */
  killProcess(taskId) {
    const processInfo = this.activeProcesses[taskId];
    if (!processInfo) {
      logger.warn(`No active process found with ID: ${taskId}`);
      return false;
    }
    
    try {
      logger.info(`Killing process: ${taskId} (${processInfo.command})`);
      processInfo.process.kill('SIGTERM');
      
      // Give it a second to terminate gracefully
      setTimeout(() => {
        if (this.activeProcesses[taskId]) {
          logger.warn(`Force killing process: ${taskId}`);
          processInfo.process.kill('SIGKILL');
          delete this.activeProcesses[taskId];
        }
      }, 1000);
      
      return true;
    } catch (error) {
      logger.error(`Failed to kill process ${taskId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Executes a JavaScript code snippet
   * @param {string} code - JavaScript code to execute
   * @param {Object} context - Execution context variables
   * @returns {Promise<any>} Execution result
   */
  async executeJavaScript(code, context = {}) {
    try {
      logger.info('Executing JavaScript code');
      
      // Create a safe execution context
      const safeContext = {
        console: {
          log: (...args) => logger.info('[js_execution]', ...args),
          error: (...args) => logger.error('[js_execution]', ...args),
          warn: (...args) => logger.warn('[js_execution]', ...args),
          info: (...args) => logger.info('[js_execution]', ...args)
        },
        setTimeout,
        clearTimeout,
        ...context
      };
      
      // Create function with context params
      const contextKeys = Object.keys(safeContext);
      const contextValues = Object.values(safeContext);
      
      // Function to execute the code with the provided context
      const executor = new Function(...contextKeys, `
        try {
          return (async () => {
            ${code}
          })();
        } catch (error) {
          throw new Error('JavaScript execution error: ' + error.message);
        }
      `);
      
      // Execute the code
      const result = await executor(...contextValues);
      return result;
    } catch (error) {
      logger.error(`Error executing JavaScript: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Gets active processes information
   * @returns {Object} Active processes
   */
  getActiveProcesses() {
    const processes = {};
    
    for (const [taskId, info] of Object.entries(this.activeProcesses)) {
      processes[taskId] = {
        command: info.command,
        startTime: info.startTime,
        duration: Date.now() - info.startTime,
        options: {
          ...info.options,
          // Remove sensitive data and functions
          env: info.options.env ? '[redacted]' : undefined,
          onOutput: info.options.onOutput ? '[function]' : undefined
        }
      };
    }
    
    return processes;
  }
}

// Create and export singleton instance
const runner = new Runner();
module.exports = runner; 