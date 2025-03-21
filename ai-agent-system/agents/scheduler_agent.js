const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { EventEmitter } = require('events');
const { logger } = require('../core/logger');
const { v4: uuidv4 } = require('uuid');
const memoryManager = require('../core/memoryManager');
const aiEngine = require('../core/aiEngine');
const agentManager = require('../core/agentManager');
const cron = require('node-cron');

/**
 * סוכן תזמון למערכת
 * אחראי על תזמון פעולות של סוכנים אחרים במערכת
 */
class SchedulerAgent {
  constructor() {
    this.name = 'scheduler';
    this.activeTasks = new Map(); // שמירת משימות פעילות
    this.isRunning = false;
  }

  /**
   * אתחול סוכן התזמון
   */
  init() {
    this.isRunning = true;
    memoryManager.logAction(this.name, 'Scheduler agent initialized');
    return true;
  }

  /**
   * עצירת סוכן התזמון
   */
  stop() {
    // עצירת כל המשימות המתוזמנות
    for (const [taskId, task] of this.activeTasks.entries()) {
      task.cronJob.stop();
    }
    this.isRunning = false;
    memoryManager.logAction(this.name, 'Scheduler agent stopped');
    return true;
  }

  /**
   * תזמון משימה חדשה
   * @param {string} agentId - זיהוי הסוכן
   * @param {string} name - שם המשימה
   * @param {string} cronExpression - ביטוי cron לתזמון
   * @param {string} action - הפעולה לביצוע (run, stop, custom)
   * @param {object} params - פרמטרים נוספים לפעולה
   * @returns {string} - מזהה המשימה
   */
  async scheduleTask(agentId, name, cronExpression, action, params = {}) {
    try {
      // וידוא שביטוי ה-cron תקין
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // וידוא שהסוכן קיים
      const targetAgent = agentManager.getAgent(agentId);
      if (!targetAgent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const taskId = uuidv4();
      
      // יצירת משימה מתוזמנת
      const cronJob = cron.schedule(cronExpression, async () => {
        try {
          await this.executeScheduledTask(taskId, agentId, action, params);
        } catch (error) {
          console.error(`Error executing scheduled task ${taskId}:`, error);
          memoryManager.logAction(this.name, `Failed to execute scheduled task ${name} for agent ${agentId}: ${error.message}`, false);
        }
      });

      // שמירת המשימה המתוזמנת
      this.activeTasks.set(taskId, {
        id: taskId,
        agentId,
        name,
        cronExpression,
        action,
        params,
        cronJob,
        createdAt: new Date().toISOString()
      });

      memoryManager.logAction(this.name, `Scheduled new task ${name} for agent ${agentId} with cron: ${cronExpression}`);
      
      return taskId;
    } catch (error) {
      memoryManager.logAction(this.name, `Failed to schedule task for agent ${agentId}: ${error.message}`, false);
      throw error;
    }
  }

  /**
   * הסרת משימה מתוזמנת
   * @param {string} taskId - מזהה המשימה
   * @returns {boolean} - האם ההסרה הצליחה
   */
  async removeTask(taskId) {
    if (!this.activeTasks.has(taskId)) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const task = this.activeTasks.get(taskId);
    task.cronJob.stop();
    this.activeTasks.delete(taskId);

    memoryManager.logAction(this.name, `Removed scheduled task ${task.name} for agent ${task.agentId}`);
    
    return true;
  }

  /**
   * ביצוע משימה מתוזמנת
   * @param {string} taskId - מזהה המשימה
   * @param {string} agentId - זיהוי הסוכן
   * @param {string} action - הפעולה לביצוע
   * @param {object} params - פרמטרים נוספים לפעולה
   */
  async executeScheduledTask(taskId, agentId, action, params) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const targetAgent = agentManager.getAgent(agentId);
    if (!targetAgent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    memoryManager.logAction(this.name, `Executing scheduled task ${task.name} for agent ${agentId}`);

    try {
      switch (action) {
        case 'run':
          await agentManager.runAgent(agentId, params);
          break;
        case 'stop':
          await agentManager.stopAgent(agentId);
          break;
        case 'custom':
          // אם נדרשת פעולה מותאמת אישית, ניתן להשתמש בפרמטרים לביצוע פעולות מורכבות יותר
          if (params.functionName && typeof targetAgent[params.functionName] === 'function') {
            await targetAgent[params.functionName](...(params.args || []));
          } else {
            throw new Error(`Custom function not found or not callable: ${params.functionName}`);
          }
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      memoryManager.logAction(this.name, `Successfully executed scheduled task ${task.name} for agent ${agentId}`);
      return true;
    } catch (error) {
      memoryManager.logAction(this.name, `Failed to execute scheduled task ${task.name} for agent ${agentId}: ${error.message}`, false);
      throw error;
    }
  }

  /**
   * קבלת כל המשימות המתוזמנות
   * @returns {Array} - רשימת המשימות המתוזמנות
   */
  async getAllTasks() {
    return Array.from(this.activeTasks.values()).map(task => ({
      id: task.id,
      agentId: task.agentId,
      name: task.name,
      cronExpression: task.cronExpression,
      action: task.action,
      createdAt: task.createdAt
    }));
  }

  /**
   * קבלת משימות מתוזמנות לסוכן ספציפי
   * @param {string} agentId - זיהוי הסוכן
   * @returns {Array} - רשימת המשימות המתוזמנות לסוכן
   */
  async getTasksForAgent(agentId) {
    return Array.from(this.activeTasks.values())
      .filter(task => task.agentId === agentId)
      .map(task => ({
        id: task.id,
        agentId: task.agentId,
        name: task.name,
        cronExpression: task.cronExpression,
        action: task.action,
        createdAt: task.createdAt
      }));
  }

  /**
   * יצירת לוח זמנים אוטומטי לסוכן
   * @param {string} agentId - זיהוי הסוכן
   * @param {string} schedule - תיאור מילולי של הלוח זמנים הרצוי
   */
  async createScheduleFromDescription(agentId, schedule) {
    try {
      // בניית פרומפט לבקשת סיוע מ-AI
      const prompt = `
      אני צריך ליצור לוח זמנים עבור סוכן AI. הנה תיאור הלוח זמנים:
      "${schedule}"
      
      אנא המר את התיאור הזה לרשימה של ביטויי cron תקינים.
      עבור כל ביטוי cron, תן גם שם תיאורי לפעולה ואיזו פעולה לבצע (run/stop).
      הפרד כל פעולה בשורה חדשה בפורמט: name|cronExpression|action
      
      לדוגמה:
      morning_start|0 9 * * 1-5|run
      evening_stop|0 17 * * 1-5|stop
      weekend_check|0 12 * * 0,6|run
      `;

      // קבלת הצעות לביטויי cron מה-AI
      const aiResponse = await aiEngine.sendPromptWithAgentContext(prompt, {}, 'scheduler');
      
      // עיבוד התשובה
      const scheduleLines = aiResponse.split('\n').filter(line => line.trim() !== '');
      
      const createdTasks = [];
      
      for (const line of scheduleLines) {
        const [name, cronExpression, action] = line.split('|').map(part => part.trim());
        
        if (name && cronExpression && action) {
          const taskId = await this.scheduleTask(agentId, name, cronExpression, action);
          createdTasks.push({ taskId, name, cronExpression, action });
        }
      }
      
      memoryManager.logAction(
        this.name, 
        `Created automatic schedule for agent ${agentId} with ${createdTasks.length} tasks`
      );
      
      return createdTasks;
    } catch (error) {
      memoryManager.logAction(
        this.name, 
        `Failed to create automatic schedule for agent ${agentId}: ${error.message}`,
        false
      );
      throw error;
    }
  }
}

module.exports = new SchedulerAgent(); 