const runner = require('../core/runner');
const fileManager = require('../core/fileManager');
const logger = require('../core/logger');
const path = require('path');
const fs = require('fs-extra');

// Create dedicated logger for the executor agent
// const logger = createAgentLogger('executor_agent');

/**
 * Executor agent responsible for running scripts and logging output
 */
class ExecutorAgent {
  constructor() {
    this.name = 'executor_agent';
    this.active = false;
    this.runningProcesses = new Map(); // Map of active processes
    this.outputBuffer = new Map(); // Buffer for process output
    
    logger.info('Executor agent initialized');
  }

  /**
   * Start the agent
   * @returns {Promise<void>}
   */
  async start() {
    this.active = true;
    logger.info('Executor agent started');
  }

  /**
   * Stop the agent and terminate all active processes
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.runningProcesses.size > 0) {
      logger.info(`Stopping ${this.runningProcesses.size} active processes`);
      
      // Iterate through all active processes and terminate them
      for (const [processId, process] of this.runningProcesses.entries()) {
        try {
          process.kill();
          logger.info(`Process ${processId} terminated`);
        } catch (error) {
          logger.error(`Error terminating process ${processId}: ${error.message}`);
        }
      }
      
      this.runningProcesses.clear();
    }
    
    this.active = false;
    logger.info('Executor agent stopped');
  }

  /**
   * Execute a shell command
   * @param {string} command - Command to execute
   * @param {boolean} logOutput - Whether to log the output
   * @returns {Promise<Object>} - Result of the command execution
   */
  async executeCommand(command, logOutput = true) {
    if (!this.active) {
      throw new Error('Executor agent is not active');
    }
    
    logger.info(`Executing command: ${command}`);
    
    try {
      const { stdout, stderr, exitCode } = await runner.executeCommand(command);
      
      const result = {
        command,
        stdout,
        stderr,
        exitCode,
        success: exitCode === 0,
        timestamp: new Date().toISOString()
      };
      
      if (logOutput) {
        if (exitCode === 0) {
          logger.info(`Command executed successfully with exit code ${exitCode}`);
          logger.debug(`Command output: ${stdout}`);
        } else {
          logger.error(`Command failed with exit code ${exitCode}`);
          logger.error(`Error output: ${stderr}`);
        }
      }
      
      return result;
    } catch (error) {
      logger.error(`Error executing command: ${error.message}`);
      
      return {
        command,
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run a script as a background process
   * @param {string} scriptPath - Path to the script to run
   * @param {string} logFile - Path to log file (optional)
   * @returns {Promise<Object>} - Process information
   */
  async runScript(scriptPath, logFile = null) {
    if (!this.active) {
      throw new Error('Executor agent is not active');
    }
    
    // Resolve full path
    const fullPath = path.resolve(scriptPath);
    
    // Ensure the script exists
    if (!await fs.pathExists(fullPath)) {
      throw new Error(`Script not found: ${fullPath}`);
    }
    
    logger.info(`Running script: ${fullPath}`);
    
    // Build command based on script type
    const command = this._buildScriptCommand(fullPath);
    
    // Create output buffer for this process
    const processId = `process_${Date.now()}`;
    this.outputBuffer.set(processId, []);
    
    // Create log file if specified
    let logStream = null;
    if (logFile) {
      await fs.ensureDir(path.dirname(logFile));
      logStream = fs.createWriteStream(logFile, { flags: 'a' });
    }
    
    // Handle script output
    const handleOutput = (data) => {
      const output = data.toString();
      
      // Add to buffer (limited to last 100 lines)
      const buffer = this.outputBuffer.get(processId);
      buffer.push(output);
      if (buffer.length > 100) {
        buffer.shift();
      }
      
      // Write to log file if specified
      if (logStream) {
        logStream.write(output + '\n');
      }
    };
    
    // Handle process completion
    const handleClose = (code) => {
      logger.info(`Script ${fullPath} completed with exit code ${code}`);
      
      if (logStream) {
        logStream.end();
      }
      
      this.runningProcesses.delete(processId);
      
      // Keep the output buffer for a while
      setTimeout(() => {
        this.outputBuffer.delete(processId);
      }, 30 * 60 * 1000); // Keep output for 30 minutes
    };
    
    try {
      // Start the process
      const process = runner.runProcess(command, {
        cwd: path.dirname(fullPath),
        env: { ...process.env, FORCE_COLOR: 'true' }
      });
      
      // Store the process
      this.runningProcesses.set(processId, process);
      
      // Set up event handlers
      process.stdout.on('data', handleOutput);
      process.stderr.on('data', handleOutput);
      process.on('close', handleClose);
      
      // Return process info
      return {
        processId,
        command,
        scriptPath: fullPath,
        startTime: new Date().toISOString(),
        logFile
      };
    } catch (error) {
      logger.error(`Error running script: ${error.message}`);
      
      // Clean up
      this.outputBuffer.delete(processId);
      if (logStream) {
        logStream.end();
      }
      
      throw error;
    }
  }

  /**
   * Stop a running process
   * @param {string} processId - ID of the process to stop
   * @returns {Promise<Object>} - Result of the operation
   */
  async stopProcess(processId) {
    if (!this.runningProcesses.has(processId)) {
      throw new Error(`Process ${processId} not found or already stopped`);
    }
    
    logger.info(`Stopping process ${processId}`);
    
    try {
      const process = this.runningProcesses.get(processId);
      process.kill();
      
      this.runningProcesses.delete(processId);
      
      return {
        processId,
        success: true,
        message: `Process ${processId} stopped successfully`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error stopping process ${processId}: ${error.message}`);
      
      return {
        processId,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get agent status
   * @returns {Promise<Object>} - Status information
   */
  async getStatus() {
    const runningProcesses = [];
    
    for (const [processId, process] of this.runningProcesses.entries()) {
      // Check if process is still running
      let isRunning = true;
      try {
        // Check if kill signal 0 can be sent (doesn't actually kill the process)
        isRunning = process.kill(0);
      } catch (error) {
        isRunning = false;
      }
      
      if (isRunning) {
        runningProcesses.push({
          processId,
          lastOutput: this._getLastOutput(processId)
        });
      } else {
        // Clean up dead processes
        this.runningProcesses.delete(processId);
      }
    }
    
    return {
      active: this.active,
      activeProcesses: runningProcesses.length,
      processes: runningProcesses
    };
  }

  /**
   * Get last few lines of output from a process
   * @param {string} processId - ID of the process
   * @returns {string} - Last few lines of output
   * @private
   */
  _getLastOutput(processId) {
    const buffer = this.outputBuffer.get(processId);
    
    if (!buffer || buffer.length === 0) {
      return '';
    }
    
    // Return the last 10 lines or less
    return buffer.slice(-10).join('\n');
  }

  /**
   * Build the appropriate command to run a script based on file extension
   * @param {string} scriptPath - Path to the script
   * @returns {string} - Command to execute
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
      case '.cmd':
        return scriptPath;
      default:
        // Try to determine if it's an executable
        try {
          const stat = fs.statSync(scriptPath);
          const isExecutable = !!(stat.mode & 0o111); // Check if executable bit is set
          
          if (isExecutable) {
            return scriptPath;
          }
        } catch (error) {
          // Ignore errors
        }
        
        // Default to node
        return `node ${scriptPath}`;
    }
  }
}

module.exports = new ExecutorAgent(); 