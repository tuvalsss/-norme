const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { EventEmitter } = require('events');
const logger = require('../core/logger');
const { v4: uuidv4 } = require('uuid');
const memoryManager = require('../core/memoryManager');
const aiEngine = require('../core/aiEngine');
const agentManager = require('../core/agentManager');
const cron = require('node-cron');

/**
 * Scheduler Agent
 * Responsible for scheduling operations of other agents in the system
 */
class SchedulerAgent {
  constructor() {
    this.name = 'scheduler';
    this.activeTasks = new Map(); // Active tasks storage
    this.isRunning = false;
  }

  /**
   * Initialize the scheduler agent
   */
  init() {
    this.isRunning = true;
    logger.info(`[${this.name}] Scheduler agent initialized`);
    return true;
  }

  /**
   * Stop the scheduler agent
   */
  stop() {
    // Stop all scheduled tasks
    for (const [taskId, task] of this.activeTasks.entries()) {
      task.cronJob.stop();
    }
    this.isRunning = false;
    memoryManager.logAction(this.name, 'Scheduler agent stopped');
    return true;
  }

  /**
   * Schedule a new task
   * @param {string} agentId - Agent ID
   * @param {string} name - Task name
   * @param {string} cronExpression - Cron expression for scheduling
   * @param {string} action - Action to perform (run, stop, custom)
   * @param {object} params - Additional parameters for the action
   * @returns {string} Task ID
   */
  async scheduleTask(agentId, name, cronExpression, action, params = {}) {
    if (!this.isRunning) {
      throw new Error('Scheduler agent is not running');
    }
    
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    // Generate task ID
    const taskId = `task_${uuidv4()}`;
    
    // Create cron job
    const cronJob = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`[${this.name}] Executing scheduled task: ${name} (${taskId})`);
        await this.executeScheduledTask(taskId, agentId, action, params);
      } catch (error) {
        logger.error(`[${this.name}] Error executing scheduled task ${taskId}: ${error.message}`);
      }
    });
    
    // Store task information
    const task = {
      id: taskId,
      agentId,
      name,
      cronExpression,
      action,
      params,
      cronJob,
      createdAt: new Date().toISOString(),
      lastRun: null,
      status: 'active'
    };
    
    this.activeTasks.set(taskId, task);
    
    // Log the action
    memoryManager.logAction(this.name, `Scheduled new task: ${name}`, {
      taskId,
      agentId,
      cronExpression,
      action
    });
    
    logger.info(`[${this.name}] New task scheduled: ${name} with cron "${cronExpression}" for agent ${agentId}`);
    
    return taskId;
  }
  
  /**
   * Remove a scheduled task
   * @param {string} taskId - Task ID to remove
   * @returns {boolean} Success status
   */
  async removeTask(taskId) {
    if (!this.activeTasks.has(taskId)) {
      logger.warn(`[${this.name}] Task ${taskId} not found`);
      return false;
    }
    
    // Stop the cron job
    const task = this.activeTasks.get(taskId);
    task.cronJob.stop();
    
    // Remove from active tasks
    this.activeTasks.delete(taskId);
    
    // Log the action
    memoryManager.logAction(this.name, `Removed scheduled task: ${task.name}`, {
      taskId,
      agentId: task.agentId
    });
    
    logger.info(`[${this.name}] Task removed: ${taskId} (${task.name})`);
    
    return true;
  }
  
  /**
   * Execute a scheduled task
   * @param {string} taskId - Task ID
   * @param {string} agentId - Agent ID
   * @param {string} action - Action to perform
   * @param {object} params - Action parameters
   * @returns {object} Execution result
   * @private
   */
  async executeScheduledTask(taskId, agentId, action, params) {
    // Update last run time
    const task = this.activeTasks.get(taskId);
    task.lastRun = new Date().toISOString();
    
    try {
      let result = null;
      
      // Find the target agent
      const agent = agentManager.getAgent(agentId);
      
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      // Execute the appropriate action
      switch (action) {
        case 'run':
          result = await agent.run(params);
          break;
        case 'stop':
          result = await agent.stop();
          break;
        case 'custom':
          if (!params.method || !agent[params.method]) {
            throw new Error(`Custom method ${params.method} not found on agent ${agentId}`);
          }
          result = await agent[params.method](params.args || {});
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      // Log successful execution
      memoryManager.logAction(this.name, `Successfully executed task: ${task.name}`, {
        taskId,
        agentId,
        action,
        result
      });
      
      return result;
    } catch (error) {
      // Log failed execution
      memoryManager.logAction(this.name, `Failed to execute task: ${task.name}`, {
        taskId,
        agentId,
        action,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all scheduled tasks
   * @returns {Array} List of all tasks
   */
  async getAllTasks() {
    const tasks = [];
    
    for (const [taskId, task] of this.activeTasks.entries()) {
      tasks.push({
        id: task.id,
        agentId: task.agentId,
        name: task.name,
        cronExpression: task.cronExpression,
        action: task.action,
        createdAt: task.createdAt,
        lastRun: task.lastRun,
        status: task.status
      });
    }
    
    return tasks;
  }
  
  /**
   * Get all tasks for a specific agent
   * @param {string} agentId - Agent ID
   * @returns {Array} List of tasks for the agent
   */
  async getTasksForAgent(agentId) {
    const tasks = [];
    
    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.agentId === agentId) {
        tasks.push({
          id: task.id,
          name: task.name,
          cronExpression: task.cronExpression,
          action: task.action,
          createdAt: task.createdAt,
          lastRun: task.lastRun,
          status: task.status
        });
      }
    }
    
    return tasks;
  }
  
  /**
   * Create a schedule from a natural language description
   * @param {string} agentId - Agent ID
   * @param {string} schedule - Natural language schedule description
   * @returns {string} Created task ID
   */
  async createScheduleFromDescription(agentId, schedule) {
    try {
      // Use AI to convert natural language to cron expression
      const prompt = `
        Convert the following schedule description to a cron expression:
        "${schedule}"
        
        Only return the cron expression in the format "* * * * *" and optionally a brief explanation.
        For example: "0 9 * * 1-5" for "every weekday at 9 AM".
      `;
      
      const response = await aiEngine.query(prompt, {
        provider: 'openai',
        model: 'gpt-4',
        max_tokens: 100
      });
      
      // Extract cron expression from response
      const cronMatch = response.match(/([0-9*,-/]+\s+[0-9*,-/]+\s+[0-9*,-/]+\s+[0-9*,-/]+\s+[0-9*,-/]+)/);
      
      if (!cronMatch || !cronMatch[1]) {
        throw new Error(`Could not extract a valid cron expression from AI response: ${response}`);
      }
      
      const cronExpression = cronMatch[1].trim();
      
      // Validate the extracted cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }
      
      // Create a task name from the schedule description
      const name = `Auto-scheduled: ${schedule}`;
      
      // Schedule the task (default action is 'run')
      return await this.scheduleTask(agentId, name, cronExpression, 'run', {});
    } catch (error) {
      logger.error(`[${this.name}] Failed to create schedule from description: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SchedulerAgent(); 