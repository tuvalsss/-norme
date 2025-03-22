const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { EventEmitter } = require('events');
const logger = require('../core/logger');
const { v4: uuidv4 } = require('uuid');
const memoryManager = require('../core/memoryManager');

// Import summary agent for error reporting
const summaryAgent = require('./summary');

/**
 * Git Sync Agent
 * Responsible for automatically synchronizing the project with GitHub
 */
class GitSyncAgent {
  constructor() {
    this.active = false;
    this.intervalId = null;
    this.events = new EventEmitter();
    this.logPrefix = '[git_sync_agent]';
    
    // Default working directory
    this.workspacePath = path.resolve(__dirname, '../workspace');
    
    // GitHub credentials
    this.gitUsername = process.env.GIT_USERNAME;
    this.gitEmail = process.env.GIT_EMAIL;
    this.gitToken = process.env.GIT_TOKEN;
    
    // Time in minutes between synchronizations
    this.syncInterval = 10;
    
    // Active project
    this.activeProject = null;
    
    // Current session ID
    this.currentSessionId = null;
    
    // Agent memory
    this.memory = null;
  }
  
  /**
   * Start the agent
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} Agent is already active`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} Starting Git Sync Agent...`);
      
      // Validate Git credentials
      this._validateGitCredentials();
      
      // Generate new session ID
      this.currentSessionId = `session_${uuidv4()}`;
      
      // Load agent memory
      this.memory = await memoryManager.loadMemory('git_sync_agent');
      
      // Log session start
      await this._logSessionStart();
      
      // Configure Git if credentials are available
      await this._configureGit();
      
      // Start automatic synchronization
      this.intervalId = setInterval(async () => {
        try {
          // Only sync if there's an active project
          if (this.activeProject) {
            await this.syncRepository();
          }
        } catch (error) {
          logger.error(`${this.logPrefix} Error during automatic sync: ${error.message}`);
          
          // Log the error in memory
          await this._logAction('auto_sync', {
            projectPath: this.activeProject
          }, {
            success: false,
            error: error.message
          });
        }
      }, this.syncInterval * 60 * 1000);
      
      this.active = true;
      logger.info(`${this.logPrefix} Git Sync Agent started successfully (session: ${this.currentSessionId})`);
      
      // Initial sync if there's an active project
      if (this.activeProject) {
        await this.syncRepository();
      }
    } catch (error) {
      logger.error(`${this.logPrefix} Error starting Git Sync Agent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stop the agent
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} Agent is already inactive`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} Stopping Git Sync Agent...`);
      
      // Clear automatic sync interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      
      // Log session end
      await this._logSessionEnd();
      
      this.active = false;
      this.currentSessionId = null;
      
      logger.info(`${this.logPrefix} Git Sync Agent stopped successfully`);
    } catch (error) {
      logger.error(`${this.logPrefix} Error stopping Git Sync Agent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Set the active project path
   * @param {string} projectPath - Path to the project directory
   */
  async setProjectPath(projectPath) {
    try {
      const fullPath = path.resolve(projectPath);
      logger.info(`${this.logPrefix} Setting project path: ${fullPath}`);
      
      // Check if directory exists
      if (!await fs.pathExists(fullPath)) {
        throw new Error(`Project directory does not exist: ${fullPath}`);
      }
      
      // Check if it's a Git repository
      const isGitRepo = await this._isGitRepository(fullPath);
      
      this.activeProject = fullPath;
      
      // Log the action
      await this._logAction('set_project_path', {
        projectPath: fullPath
      }, {
        success: true,
        isGitRepo
      });
      
      return {
        path: fullPath,
        isGitRepository: isGitRepo
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Error setting project path: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Synchronize the repository with GitHub
   * Performs: pull -> add -> commit -> push
   */
  async syncRepository() {
    if (!this.activeProject) {
      throw new Error('No active project set. Please set a project path first.');
    }
    
    if (!this.active) {
      throw new Error('Git Sync Agent is not active. Please start the agent first.');
    }
    
    // Get the original current directory to restore it later
    const originalCwd = process.cwd();
    
    try {
      logger.info(`${this.logPrefix} Synchronizing repository at: ${this.activeProject}`);
      
      // Change to the project directory
      process.chdir(this.activeProject);
      
      // Check if this is a Git repository
      const isGitRepo = await this._isGitRepository(this.activeProject);
      if (!isGitRepo) {
        throw new Error(`Directory is not a Git repository: ${this.activeProject}`);
      }
      
      // Step 1: Pull changes from remote
      const pullResult = await this._gitPull();
      
      // Step 2: Check if there are local changes
      const hasChanges = await this._hasLocalChanges();
      
      if (hasChanges) {
        // Get the list of changes for commit message
        const changes = await this._getChanges();
        
        // Step 3: Add all changes
        await this._gitAdd();
        
        // Step 4: Create a commit
        const commitMessage = this._generateCommitMessage(changes);
        await this._gitCommit(commitMessage);
        
        // Step 5: Push changes to remote
        await this._gitPush();
        
        logger.info(`${this.logPrefix} Repository synchronized successfully with ${changes.length} changes`);
      } else {
        logger.info(`${this.logPrefix} No local changes to synchronize`);
      }
      
      // Log the successful sync
      await this._logAction('sync_repository', {
        projectPath: this.activeProject
      }, {
        success: true,
        hasChanges,
        pullResult
      });
      
      return {
        success: true,
        hasChanges,
        pullResult
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Repository synchronization failed: ${error.message}`);
      
      // Handle merge conflicts specially
      if (error.message.includes('merge conflict') || error.message.includes('CONFLICT')) {
        await this._reportMergeConflict(error.message);
      } else {
        // Log the failed sync
        await this._logAction('sync_repository', {
          projectPath: this.activeProject
        }, {
          success: false,
          error: error.message
        });
        
        // Notify summary agent about the failure
        try {
          await summaryAgent.logEvent('git_sync_failure', {
            projectPath: this.activeProject,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        } catch (summaryError) {
          logger.error(`${this.logPrefix} Failed to notify summary agent: ${summaryError.message}`);
        }
      }
      
      throw error;
    } finally {
      // Restore the original working directory
      process.chdir(originalCwd);
    }
  }
  
  /**
   * Initialize a new Git repository
   * @param {string} remoteUrl - GitHub repository URL
   * @param {string} branch - Branch name (default: main)
   */
  async initRepository(remoteUrl, branch = 'main') {
    if (!this.activeProject) {
      throw new Error('No active project set. Please set a project path first.');
    }
    
    if (!this.active) {
      throw new Error('Git Sync Agent is not active. Please start the agent first.');
    }
    
    // Get the original current directory to restore it later
    const originalCwd = process.cwd();
    
    try {
      logger.info(`${this.logPrefix} Initializing Git repository at: ${this.activeProject}`);
      
      // Change to the project directory
      process.chdir(this.activeProject);
      
      // Check if this is already a Git repository
      const isGitRepo = await this._isGitRepository(this.activeProject);
      if (isGitRepo) {
        throw new Error(`Directory is already a Git repository: ${this.activeProject}`);
      }
      
      // Initialize Git repository
      await this._executeGitCommand(['init']);
      
      // Configure Git if needed
      await this._configureGit();
      
      // Add all files
      await this._gitAdd();
      
      // Initial commit
      await this._gitCommit('Initial commit');
      
      // Add remote
      const authenticatedUrl = this._getAuthenticatedUrl(remoteUrl);
      await this._executeGitCommand(['remote', 'add', 'origin', authenticatedUrl]);
      
      // Set the branch
      await this._executeGitCommand(['branch', '-M', branch]);
      
      // Push to remote
      await this._gitPush('--set-upstream', 'origin', branch);
      
      logger.info(`${this.logPrefix} Git repository initialized successfully`);
      
      // Log the successful initialization
      await this._logAction('init_repository', {
        projectPath: this.activeProject,
        remoteUrl,
        branch
      }, {
        success: true
      });
      
      return {
        success: true,
        projectPath: this.activeProject,
        remoteUrl,
        branch
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Repository initialization failed: ${error.message}`);
      
      // Log the failed initialization
      await this._logAction('init_repository', {
        projectPath: this.activeProject,
        remoteUrl,
        branch
      }, {
        success: false,
        error: error.message
      });
      
      throw error;
    } finally {
      // Restore the original working directory
      process.chdir(originalCwd);
    }
  }
  
  /**
   * Validate that Git credentials are available
   * @private
   */
  _validateGitCredentials() {
    if (!this.gitUsername || !this.gitEmail) {
      logger.warn(`${this.logPrefix} Git username or email not configured. Some features may be limited.`);
    }
    
    if (!this.gitToken) {
      logger.warn(`${this.logPrefix} Git token not configured. Remote operations requiring authentication may fail.`);
    }
  }
  
  /**
   * Configure Git with user credentials
   * @private
   */
  async _configureGit() {
    // Skip if credentials are not available
    if (!this.gitUsername || !this.gitEmail) {
      return;
    }
    
    try {
      // Set Git user name and email
      await this._executeGitCommand(['config', 'user.name', this.gitUsername]);
      await this._executeGitCommand(['config', 'user.email', this.gitEmail]);
      
      // Set credential helper to cache credentials
      await this._executeGitCommand(['config', 'credential.helper', 'cache --timeout=3600']);
      
      logger.info(`${this.logPrefix} Git configured with user: ${this.gitUsername}`);
    } catch (error) {
      logger.error(`${this.logPrefix} Error configuring Git: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get an authenticated URL for Git operations
   * @param {string} remoteUrl - Original remote URL
   * @returns {string} - Authenticated URL
   * @private
   */
  _getAuthenticatedUrl(remoteUrl) {
    if (!this.gitToken) {
      logger.warn(`${this.logPrefix} No Git token available, using plain URL`);
      return remoteUrl;
    }
    
    try {
      const url = new URL(remoteUrl);
      
      if (url.protocol === 'https:') {
        url.username = this.gitToken;
        return url.toString();
      }
      
      return remoteUrl;
    } catch (error) {
      logger.error(`${this.logPrefix} Error creating authenticated URL: ${error.message}`);
      return remoteUrl;
    }
  }
  
  /**
   * Check if directory is a Git repository
   * @param {string} dirPath - Directory path
   * @returns {boolean} - Is Git repository
   * @private
   */
  async _isGitRepository(dirPath) {
    try {
      await this._executeGitCommand(['rev-parse', '--is-inside-work-tree'], { cwd: dirPath });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Pull changes from remote repository
   * @returns {object} - Pull result
   * @private
   */
  async _gitPull() {
    try {
      const output = await this._executeGitCommand(['pull']);
      
      return {
        success: true,
        message: output
      };
    } catch (error) {
      // If there's a merge conflict, we need to handle it specially
      if (error.message.includes('merge conflict') || error.message.includes('CONFLICT')) {
        await this._reportMergeConflict(error.message);
      }
      
      throw error;
    }
  }
  
  /**
   * Check if repository has local changes
   * @returns {boolean} - Has changes
   * @private
   */
  async _hasLocalChanges() {
    try {
      const output = await this._executeGitCommand(['status', '--porcelain']);
      return output.trim().length > 0;
    } catch (error) {
      logger.error(`${this.logPrefix} Error checking for local changes: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get list of changed files
   * @returns {Array} - List of changes
   * @private
   */
  async _getChanges() {
    try {
      const output = await this._executeGitCommand(['status', '--porcelain']);
      return output.trim().split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      logger.error(`${this.logPrefix} Error getting changes: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Add all changes to the index
   * @private
   */
  async _gitAdd() {
    try {
      await this._executeGitCommand(['add', '.']);
    } catch (error) {
      logger.error(`${this.logPrefix} Error adding files: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Commit changes
   * @param {string} message - Commit message
   * @private
   */
  async _gitCommit(message) {
    try {
      await this._executeGitCommand(['commit', '-m', message]);
    } catch (error) {
      // If there are no changes to commit, it's not an error
      if (error.message.includes('nothing to commit')) {
        logger.info(`${this.logPrefix} No changes to commit`);
        return;
      }
      
      logger.error(`${this.logPrefix} Error committing changes: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Push changes to remote
   * @param {...string} args - Additional Git push arguments
   * @private
   */
  async _gitPush(...args) {
    try {
      // Start with base push command
      const pushArgs = ['push'];
      
      // Add any additional arguments
      if (args && args.length > 0) {
        pushArgs.push(...args);
      }
      
      await this._executeGitCommand(pushArgs);
    } catch (error) {
      // Handle specific error cases
      if (error.message.includes('remote contains work that you do')) {
        // Need to pull first
        logger.warn(`${this.logPrefix} Remote contains new changes, attempting to pull first`);
        await this._gitPull();
        await this._gitPush(...args);
        return;
      }
      
      logger.error(`${this.logPrefix} Error pushing changes: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Generate commit message based on changes
   * @param {Array} changes - List of changes
   * @returns {string} - Commit message
   * @private
   */
  _generateCommitMessage(changes) {
    if (!changes || changes.length === 0) {
      return 'Automatic commit by Git Sync Agent';
    }
    
    const fileCount = changes.length;
    
    // Get list of changed file types
    const fileTypes = changes.map(change => {
      const match = change.match(/\s([A-Za-z0-9]+\.[A-Za-z0-9]+)$/);
      return match ? path.extname(match[1]).slice(1) : 'unknown';
    }).filter(Boolean);
    
    // Count occurrences of each file type
    const typeCount = {};
    fileTypes.forEach(type => {
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    // Create summary of changes
    const typeSummary = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
    
    return `Automatic update: ${fileCount} files changed (${typeSummary})`;
  }
  
  /**
   * Report merge conflict to the relevant agents
   * @param {string} errorMessage - Git error message
   * @private
   */
  async _reportMergeConflict(errorMessage) {
    logger.error(`${this.logPrefix} Merge conflict detected: ${errorMessage}`);
    
    try {
      // Get the list of conflicted files
      const output = await this._executeGitCommand(['diff', '--name-only', '--diff-filter=U']);
      const conflictedFiles = output.trim().split('\n').filter(Boolean);
      
      // Log the conflict
      await this._logAction('merge_conflict', {
        projectPath: this.activeProject
      }, {
        success: false,
        error: 'Merge conflict',
        conflictedFiles
      });
      
      // Check for previous conflicts in the same files
      const previousConflicts = await this.findPreviousConflicts(conflictedFiles);
      
      // Notify summary agent
      await summaryAgent.logEvent('git_merge_conflict', {
        projectPath: this.activeProject,
        conflictedFiles,
        previousConflicts,
        timestamp: new Date().toISOString(),
        errorMessage
      });
      
      logger.info(`${this.logPrefix} Reported merge conflict in ${conflictedFiles.length} files`);
      
      return {
        conflictedFiles,
        previousConflicts
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Error reporting merge conflict: ${error.message}`);
      
      // Still try to notify summary agent with limited info
      try {
        await summaryAgent.logEvent('git_merge_conflict', {
          projectPath: this.activeProject,
          errorMessage,
          timestamp: new Date().toISOString()
        });
      } catch (summaryError) {
        logger.error(`${this.logPrefix} Failed to notify summary agent: ${summaryError.message}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Execute a Git command and return the output
   * @param {Array} args - Git command arguments
   * @param {Object} options - Command options
   * @returns {string} - Command output
   * @private
   */
  _executeGitCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      // Set default options
      const cmdOptions = {
        cwd: process.cwd(),
        env: process.env,
        ...options
      };
      
      logger.debug(`${this.logPrefix} Executing git ${args.join(' ')}`);
      
      const gitProcess = spawn('git', args, cmdOptions);
      
      let stdout = '';
      let stderr = '';
      
      gitProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`));
        }
      });
      
      gitProcess.on('error', (error) => {
        reject(new Error(`Failed to execute Git command: ${error.message}`));
      });
    });
  }
  
  /**
   * Find previous conflicts in the given files
   * @param {Array} filePaths - Paths of conflicted files
   * @returns {Array} - Previous conflicts
   */
  async findPreviousConflicts(filePaths) {
    try {
      if (!this.memory || !filePaths || filePaths.length === 0) {
        return [];
      }
      
      const previousConflicts = [];
      
      // Get all merge conflict actions from memory
      const allSessions = this.memory.sessions || {};
      
      for (const sessionId in allSessions) {
        const session = allSessions[sessionId];
        if (!session.actions) continue;
        
        for (const action of session.actions) {
          if (action.type === 'merge_conflict' && action.result && action.result.conflictedFiles) {
            // Check if any of the current conflicted files had conflicts before
            const sameFiles = action.result.conflictedFiles.filter(file => 
              filePaths.includes(file)
            );
            
            if (sameFiles.length > 0) {
              previousConflicts.push({
                timestamp: action.timestamp,
                files: sameFiles,
                sessionId
              });
            }
          }
        }
      }
      
      return previousConflicts;
    } catch (error) {
      logger.error(`${this.logPrefix} Error finding previous conflicts: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Log session start
   * @private
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
      status: 'active'
    };
    
    await memoryManager.saveMemory('git_sync_agent', this.memory);
    
    logger.debug(`${this.logPrefix} New session started (${this.currentSessionId})`);
  }
  
  /**
   * Log session end
   * @private
   */
  async _logSessionEnd() {
    if (!this.memory || !this.currentSessionId) return;
    
    const session = this.memory.sessions[this.currentSessionId];
    if (!session) return;
    
    session.endTime = new Date().toISOString();
    session.status = 'completed';
    
    await memoryManager.saveMemory('git_sync_agent', this.memory);
    
    logger.debug(`${this.logPrefix} Session closed (${this.currentSessionId})`);
  }
  
  /**
   * Log agent action
   * @private
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
    
    await memoryManager.saveMemory('git_sync_agent', this.memory);
  }
}

module.exports = new GitSyncAgent(); 