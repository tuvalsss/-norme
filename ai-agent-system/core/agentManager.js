const { EventEmitter } = require('events');
const logger = require('./logger');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { getConfig } = require('../config/config');

/**
 * Agent Manager - Responsible for managing and allocating resources to agents in the system
 * Enables:
 * - Agent registration
 * - Automatic task scheduling
 * - Load balancing
 * - Information transfer between agents
 * - Selection of appropriate models
 * - Workflow support
 */
class AgentManager extends EventEmitter {
  constructor() {
    super();
    
    // Initialize main data structures
    this.agents = {}; // Mapping of all registered agents
    this.tasks = {}; // Track tasks in progress
    this.taskQueue = []; // Task queue for execution
    this.active = false; // Whether the manager is active
    this.config = null; // System settings
    this.interval = null; // Identifier for periodic checks
    this.startTime = null; // Start time of activity
    
    this.logPrefix = '[agent_manager]';
    
    // Statistics
    this.stats = {
      totalTasksQueued: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
      agentUsageCount: {},
      modelUsageCount: {},
      lastTaskTime: null
    };
    
    // Workflow systems
    this.workflowManager = null;
    this.contextManager = null;
    this.metricsCollector = null;
    
    logger.info(`${this.logPrefix} Agent manager initialized`);
  }
  
  /**
   * Activate agent manager
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} Agent manager already active`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} Activating agent manager...`);
      
      // Load settings
      this.config = await getConfig();
      
      // Initialize start time
      this.startTime = new Date();
      
      // Enable task queue check
      const checkInterval = this.config.agentManager?.taskCheckInterval || 5000; // Default: 5 seconds
      this.interval = setInterval(() => this._processTaskQueue(), checkInterval);
      
      this.active = true;
      
      logger.info(`${this.logPrefix} Agent manager activated successfully`);
    } catch (error) {
      logger.error(`${this.logPrefix} Error activating agent manager: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Deactivate agent manager
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} Agent manager already inactive`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} Deactivating agent manager...`);
      
      // Cancel task queue check
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      
      // Save statistics
      await this._saveStats();
      
      this.active = false;
      
      logger.info(`${this.logPrefix} Agent manager deactivated successfully`);
    } catch (error) {
      logger.error(`${this.logPrefix} Error deactivating agent manager: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Register agent in the system
   * @param {string} agentName - Agent name 
   * @param {Object} agentInstance - Agent instance
   */
  registerAgent(agentName, agentInstance) {
    if (this.agents[agentName]) {
      logger.warn(`${this.logPrefix} Agent named ${agentName} is already registered in the system`);
      return;
    }
    
    this.agents[agentName] = {
      instance: agentInstance,
      registeredAt: new Date().toISOString(),
      lastActivity: null,
      currentTask: null,
      status: 'idle'
    };
    
    // Initialize agent usage counter
    this.stats.agentUsageCount[agentName] = 0;
    
    logger.info(`${this.logPrefix} Agent ${agentName} registered in the system`);
  }
  
  /**
   * Unregister agent from the system
   * @param {string} agentName - Agent name
   */
  unregisterAgent(agentName) {
    if (!this.agents[agentName]) {
      logger.warn(`${this.logPrefix} Agent named ${agentName} is not registered in the system`);
      return;
    }
    
    delete this.agents[agentName];
    logger.info(`${this.logPrefix} Agent ${agentName} removed from the system`);
  }

  /**
   * Returns the recommended model for a given agent
   * @param {string} agentName - Agent name
   * @returns {Object} - Object containing the recommended AI provider and model
   */
  getRecommendedModel(agentName) {
    // If the agent is not registered, use default
    if (!this.agents[agentName]) {
      return {
        provider: 'openai',
        model: 'gpt-4o'
      };
    }
    
    const agentInstance = this.agents[agentName].instance;
    
    // Check if the agent has model preferences
    if (agentInstance.preferredProvider && agentInstance.preferredModel) {
      return {
        provider: agentInstance.preferredProvider,
        model: agentInstance.preferredModel
      };
    }
    
    // Otherwise, use default from configuration
    const defaultProvider = this.config?.ai?.defaultProvider || 'openai';
    const defaultModel = this.config?.ai?.defaultModel || 'gpt-4o';
    
    return {
      provider: defaultProvider,
      model: defaultModel
    };
  }
  
  /**
   * Handle an existing task
   * @param {string} taskId - Task ID
   * @private
   */
  async _processTask(taskId) {
    if (!this.tasks[taskId]) {
      logger.warn(`${this.logPrefix} Task ${taskId} does not exist`);
      return;
    }
    
    const task = this.tasks[taskId];
    
    // Check if the task is already being processed or completed
    if (task.status !== 'pending') {
      return;
    }
    
    // Check if the designated agent is available
    const agentData = this.agents[task.agentName];
    if (!agentData || agentData.status !== 'idle') {
      // If the agent is not available, skip and try again later
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} Starting to process task ${taskId} (${task.actionType}) using agent ${task.agentName}`);
      
      // Update agent and task status
      agentData.status = 'busy';
      agentData.currentTask = taskId;
      agentData.lastActivity = new Date().toISOString();
      
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      
      // Get the agent
      const agent = agentData.instance;
      
      // Check if there is a matching method in the agent
      if (typeof agent[task.actionType] !== 'function') {
        throw new Error(`Action ${task.actionType} is not supported by agent ${task.agentName}`);
      }
      
      // Run the action
      const result = await agent[task.actionType](...Object.values(task.parameters));
      
      // Update task result
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
      
      // Update statistics
      this.stats.totalTasksCompleted++;
      this.stats.agentUsageCount[task.agentName]++;
      
      // Update agent status
      agentData.status = 'idle';
      agentData.currentTask = null;
      
      logger.info(`${this.logPrefix} Task ${taskId} completed successfully`);
    } catch (error) {
      // Error handling
      logger.error(`${this.logPrefix} Error executing task ${taskId}: ${error.message}`);
      
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
      task.error = error.message;
      
      // Update statistics
      this.stats.totalTasksFailed++;
      
      // Update agent status
      agentData.status = 'idle';
      agentData.currentTask = null;
    }
    
    // Emit task completion event
    this.emit('task:completed', {
      taskId,
      agentName: task.agentName,
      status: task.status,
      result: task.result,
      error: task.error
    });
    
    // Process the next task if available
    if (this.taskQueue.length > 0) {
      this._processTaskQueue();
    }
  }
  
  /**
   * Loads available agent types from the agents directory
   * @private
   */
  _loadAgentTypes() {
    try {
      const agentsPath = path.join(__dirname, '../agents');
      const files = fs.readdirSync(agentsPath);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const agentPath = path.join(agentsPath, file);
          const AgentClass = require(agentPath);
          
          if (typeof AgentClass === 'function') {
            const agentType = path.basename(file, '.js');
            this.agentTypes[agentType] = AgentClass;
            logger.info(`Registered agent type: ${agentType}`);
          }
        }
      }
      
      logger.info(`Loaded ${Object.keys(this.agentTypes).length} agent types`);
    } catch (error) {
      logger.error(`Failed to load agent types: ${error.message}`);
    }
  }
  
  /**
   * Sets up event handlers for agent communication
   * @private
   */
  _setupEventHandlers() {
    this.on('agent:message', (message) => {
      const { from, to, content, metadata } = message;
      
      if (to === 'all') {
        // Broadcast to all agents
        Object.values(this.agents).forEach(agent => {
          if (agent.name !== from) {
            agent.emit('message', { from, content, metadata });
          }
        });
      } else if (this.agents[to]) {
        // Send to specific agent
        this.agents[to].emit('message', { from, content, metadata });
      } else {
        logger.warn(`Message from ${from} to unknown agent ${to}`);
      }
    });
    
    this.on('agent:task', (task) => {
      const { agentName, taskData } = task;
      
      if (this.agents[agentName]) {
        this.agents[agentName].queueTask(taskData);
      } else {
        logger.warn(`Task assignment to unknown agent ${agentName}`);
      }
    });
  }
  
  /**
   * Creates a new agent of the specified type
   * @param {string} type - Agent type
   * @param {string} name - Agent name (unique identifier)
   * @param {Object} options - Additional agent options
   * @returns {Object} The created agent
   */
  createAgent(type, name, options = {}) {
    try {
      if (!this.agentTypes[type]) {
        logger.error(`Unknown agent type: ${type}`);
        throw new Error(`Unknown agent type: ${type}`);
      }
      
      if (this.agents[name]) {
        logger.warn(`Agent with name ${name} already exists`);
        return this.agents[name];
      }
      
      // Create a new agent
      const AgentClass = this.agentTypes[type];
      const agent = new AgentClass({
        name,
        type,
        workingDirectory: path.join(this.workingDirectory, name),
        ...options
      });
      
      // Register the agent
      this.agents[name] = agent;
      
      // Listen for agent events
      agent.on('started', () => {
        this.emit('agent:started', { name, type });
      });
      
      agent.on('stopped', () => {
        this.emit('agent:stopped', { name, type });
      });
      
      agent.on('taskCompleted', (task) => {
        this.emit('agent:taskCompleted', { agentName: name, task });
      });
      
      agent.on('taskFailed', (data) => {
        this.emit('agent:taskFailed', { agentName: name, ...data });
      });
      
      logger.info(`Created agent ${name} of type ${type}`);
      return agent;
    } catch (error) {
      logger.error(`Failed to create agent ${name} of type ${type}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Gets an agent by name
   * @param {string} name - Agent name
   * @returns {Object} The agent
   */
  getAgent(name) {
    return this.agents[name];
  }
  
  /**
   * Lists all registered agents
   * @returns {Array<Object>} Array of agent information
   */
  listAgents() {
    return Object.keys(this.agents).map(name => {
      const agent = this.agents[name];
      return {
        name: agent.name,
        type: agent.type,
        status: agent.status,
        isRunning: agent.isRunning
      };
    });
  }
  
  /**
   * Starts an agent by name
   * @param {string} name - Agent name
   * @returns {Promise<boolean>} Whether the agent was started
   */
  async startAgent(name) {
    const agent = this.agents[name];
    
    if (!agent) {
      logger.error(`Agent ${name} not found`);
      return false;
    }
    
    try {
      await agent.start();
      logger.info(`Started agent ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start agent ${name}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Stops an agent by name
   * @param {string} name - Agent name
   * @returns {Promise<boolean>} Whether the agent was stopped
   */
  async stopAgent(name) {
    const agent = this.agents[name];
    
    if (!agent) {
      logger.error(`Agent ${name} not found`);
      return false;
    }
    
    try {
      await agent.stop();
      logger.info(`Stopped agent ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop agent ${name}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Removes an agent from the system
   * @param {string} name - Agent name
   * @returns {boolean} Whether the agent was removed
   */
  removeAgent(name) {
    const agent = this.agents[name];
    
    if (!agent) {
      logger.error(`Agent ${name} not found`);
      return false;
    }
    
    try {
      if (agent.isRunning) {
        agent.stop();
      }
      
      delete this.agents[name];
      logger.info(`Removed agent ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove agent ${name}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Creates a multi-agent system with predefined agent types
   * @param {Object} config - System configuration
   * @returns {Array<Object>} Created agents
   */
  createMultiAgentSystem(config = {}) {
    const createdAgents = [];
    
    try {
      // Create development agent
      if (config.dev !== false) {
        const devName = config.dev?.name || 'dev_agent';
        const devAgent = this.createAgent('dev_agent', devName, config.dev);
        createdAgents.push(devAgent);
      }
      
      // Create QA agent
      if (config.qa !== false) {
        const qaName = config.qa?.name || 'qa_agent';
        const qaAgent = this.createAgent('qa', qaName, config.qa);
        createdAgents.push(qaAgent);
      }
      
      // Create executor agent
      if (config.executor !== false) {
        const executorName = config.executor?.name || 'executor_agent';
        const executorAgent = this.createAgent('executor', executorName, config.executor);
        createdAgents.push(executorAgent);
      }
      
      // Create git synchronization agent
      if (config.gitSync !== false) {
        const gitSyncName = config.gitSync?.name || 'git_sync_agent';
        const gitSyncAgent = this.createAgent('git_sync', gitSyncName, config.gitSync);
        createdAgents.push(gitSyncAgent);
      }
      
      // Create summary agent
      if (config.summary !== false) {
        const summaryName = config.summary?.name || 'summary_agent';
        const summaryAgent = this.createAgent('summary', summaryName, config.summary);
        createdAgents.push(summaryAgent);
      }
      
      // Create scheduler agent
      if (config.scheduler !== false) {
        const schedulerName = config.scheduler?.name || 'scheduler_agent';
        const schedulerAgent = this.createAgent('scheduler_agent', schedulerName, config.scheduler);
        createdAgents.push(schedulerAgent);
      }
      
      logger.info(`Created multi-agent system with ${createdAgents.length} agents`);
      
      return createdAgents;
    } catch (error) {
      logger.error(`Failed to create multi-agent system: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Starts all agents in the system
   * @returns {Promise<Array<string>>} Names of started agents
   */
  async startAllAgents() {
    const startedAgents = [];
    
    for (const name in this.agents) {
      try {
        const success = await this.startAgent(name);
        if (success) {
          startedAgents.push(name);
        }
      } catch (error) {
        logger.error(`Error starting agent ${name}: ${error.message}`);
      }
    }
    
    logger.info(`Started ${startedAgents.length} agents`);
    return startedAgents;
  }
  
  /**
   * Stops all agents in the system
   * @returns {Promise<Array<string>>} Names of stopped agents
   */
  async stopAllAgents() {
    const stoppedAgents = [];
    
    for (const name in this.agents) {
      try {
        const success = await this.stopAgent(name);
        if (success) {
          stoppedAgents.push(name);
        }
      } catch (error) {
        logger.error(`Error stopping agent ${name}: ${error.message}`);
      }
    }
    
    logger.info(`Stopped ${stoppedAgents.length} agents`);
    return stoppedAgents;
  }
  
  /**
   * Sends a message to an agent
   * @param {string} from - Sender name
   * @param {string} to - Recipient name
   * @param {string} content - Message content
   * @param {Object} metadata - Additional metadata
   * @returns {boolean} Whether the message was sent
   */
  sendMessage(from, to, content, metadata = {}) {
    if (to === 'all' || this.agents[to]) {
      this.emit('agent:message', { from, to, content, metadata });
      return true;
    } else {
      logger.warn(`Cannot send message to unknown agent: ${to}`);
      return false;
    }
  }
  
  /**
   * Assigns a task to an agent
   * @param {string} agentName - Agent name
   * @param {Object} taskData - Task data
   * @returns {string|null} Task ID if assigned, null otherwise
   */
  assignTask(agentName, taskData) {
    const agent = this.agents[agentName];
    
    if (!agent) {
      logger.error(`Cannot assign task to unknown agent: ${agentName}`);
      return null;
    }
    
    try {
      return agent.queueTask(taskData);
    } catch (error) {
      logger.error(`Failed to assign task to agent ${agentName}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Gets the system status
   * @returns {Object} System status
   */
  getSystemStatus() {
    const agentCount = Object.keys(this.agents).length;
    const runningAgents = Object.values(this.agents).filter(a => a.isRunning).length;
    
    return {
      agentCount,
      runningAgents,
      agents: this.listAgents(),
      workingDirectory: this.workingDirectory
    };
  }
  
  /**
   * Sets the global working directory
   * @param {string} directory - Working directory path
   */
  setWorkingDirectory(directory) {
    this.workingDirectory = directory;
    fs.ensureDirSync(this.workingDirectory);
    logger.info(`Set global working directory to ${directory}`);
  }
  
  /**
   * Set workflow manager
   * @param {Object} workflowManager - Workflow manager instance
   */
  setWorkflowManager(workflowManager) {
    this.workflowManager = workflowManager;
    logger.info(`${this.logPrefix} Workflow manager set`);
  }
  
  /**
   * Set context manager
   * @param {Object} contextManager - Context manager instance
   */
  setContextManager(contextManager) {
    this.contextManager = contextManager;
    logger.info(`${this.logPrefix} Context manager set`);
  }
  
  /**
   * Set metrics collector
   * @param {Object} metricsCollector - Metrics collector instance
   */
  setMetricsCollector(metricsCollector) {
    this.metricsCollector = metricsCollector;
    logger.info(`${this.logPrefix} Metrics collector set`);
  }
}

// Create and export singleton instance
const agentManager = new AgentManager();
module.exports = agentManager; 