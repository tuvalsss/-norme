/**
 * Base class for all agent implementations
 * Provides core functionality including event handling, memory management, and logging
 */

const { EventEmitter } = require('events');
const path = require('path');
const fsExtra = require('fs-extra');
const logger = require('./logger');
const memoryManager = require('./memoryManager');
const aiEngine = require('./aiEngine');

class BaseAgent extends EventEmitter {
  /**
   * Initialize a new agent
   * @param {Object} options - Configuration options
   * @param {string} options.name - Agent name (unique identifier)
   * @param {string} options.type - Agent type (dev, qa, summary, etc.)
   * @param {string} options.description - Human-readable description of the agent's purpose
   * @param {Object} options.capabilities - List of capabilities this agent provides
   * @param {Array<string>} options.dependencies - List of other agents this agent depends on
   */
  constructor(options = {}) {
    super();
    
    // Basic agent information
    this.name = options.name || 'unnamed_agent';
    this.type = options.type || 'generic';
    this.description = options.description || 'Generic agent';
    this.capabilities = options.capabilities || {};
    this.dependencies = options.dependencies || [];
    
    // Working state
    this.status = 'initialized';
    this.isRunning = false;
    this.currentTask = null;
    this.taskQueue = [];
    this.maxConcurrentTasks = options.maxConcurrentTasks || 1;
    this.activeTasks = 0;
    
    // Memory management
    this.memory = memoryManager.createAgentMemory(this.name);
    
    // Workspace management
    this.workingDirectory = options.workingDirectory || path.join(process.cwd(), 'workspace');
    
    logger.info(`Agent ${this.name} (${this.type}) initialized`);
  }
  
  /**
   * Starts the agent
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      logger.warn(`Agent ${this.name} is already running`);
      return;
    }
    
    try {
      // Ensure working directory exists
      await fsExtra.ensureDir(this.workingDirectory);
      
      this.isRunning = true;
      this.status = 'running';
      this.emit('started');
      
      logger.info(`Agent ${this.name} started`);
    } catch (error) {
      logger.error(`Failed to start agent ${this.name}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stops the agent
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn(`Agent ${this.name} is not running`);
      return;
    }
    
    try {
      this.isRunning = false;
      this.status = 'stopped';
      this.emit('stopped');
      
      logger.info(`Agent ${this.name} stopped`);
    } catch (error) {
      logger.error(`Failed to stop agent ${this.name}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Sets the working directory for the agent
   * @param {string} directory - Path to the working directory
   */
  setWorkingDirectory(directory) {
    this.workingDirectory = directory;
    logger.info(`Agent ${this.name} working directory set to ${directory}`);
  }
  
  /**
   * Adds a task to the queue
   * @param {Object} task - Task to add to the queue
   * @returns {string} - Task ID
   */
  queueTask(task) {
    const taskId = task.id || `${this.name}_task_${Date.now()}`;
    const taskWithId = { ...task, id: taskId };
    
    this.taskQueue.push(taskWithId);
    logger.info(`Task ${taskId} added to ${this.name} queue`);
    
    this._processQueue();
    
    return taskId;
  }
  
  /**
   * Processes the task queue
   * @private
   */
  _processQueue() {
    if (!this.isRunning) {
      logger.debug(`Agent ${this.name} is not running, queue processing paused`);
      return;
    }
    
    // Process tasks if we can handle more
    while (this.taskQueue.length > 0 && this.activeTasks < this.maxConcurrentTasks) {
      const task = this.taskQueue.shift();
      this._executeTask(task);
    }
  }
  
  /**
   * Executes a task
   * @param {Object} task - Task to execute
   * @private
   */
  async _executeTask(task) {
    this.activeTasks++;
    this.currentTask = task;
    
    try {
      logger.info(`Agent ${this.name} executing task ${task.id}`);
      this.emit('taskStarted', task);
      
      // Child classes should override this method
      if (this.executeTask) {
        await this.executeTask(task);
      } else {
        throw new Error(`Agent ${this.name} does not implement executeTask method`);
      }
      
      this.emit('taskCompleted', task);
      logger.info(`Agent ${this.name} completed task ${task.id}`);
    } catch (error) {
      logger.error(`Agent ${this.name} failed task ${task.id}: ${error.message}`);
      this.emit('taskFailed', { task, error });
    } finally {
      this.activeTasks--;
      this.currentTask = null;
      this._processQueue();
    }
  }
  
  /**
   * Sends a message to the agent's memory
   * @param {string} message - Message to store
   * @param {Object} metadata - Additional metadata
   */
  remember(message, metadata = {}) {
    this.memory.addEntry(message, {
      ...metadata,
      timestamp: new Date().toISOString(),
      agent: this.name
    });
  }
  
  /**
   * Retrieves information from the agent's memory
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - Matching memories
   */
  recall(query, options = {}) {
    return this.memory.search(query, options);
  }
  
  /**
   * Sends a query to the AI model
   * @param {string} prompt - Query to send
   * @param {Object} options - Additional options
   * @returns {Promise<string>} - AI response
   */
  async askAI(prompt, options = {}) {
    try {
      const response = await aiEngine.query(prompt, {
        ...options,
        agentName: this.name
      });
      
      // Optionally record the interaction in memory
      if (options.rememberInteraction !== false) {
        this.remember(`Question: ${prompt}\nAnswer: ${response}`, {
          type: 'ai_interaction',
          prompt,
          response
        });
      }
      
      return response;
    } catch (error) {
      logger.error(`Agent ${this.name} AI query failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Returns the agent's state
   * @returns {Object} - Current state
   */
  getState() {
    return {
      name: this.name,
      type: this.type,
      status: this.status,
      isRunning: this.isRunning,
      currentTask: this.currentTask,
      queueLength: this.taskQueue.length,
      activeTasks: this.activeTasks
    };
  }
}

module.exports = BaseAgent; 