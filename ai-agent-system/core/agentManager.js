const { EventEmitter } = require('events');
const { logger } = require('./logger');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { getConfig } = require('../config/config');

/**
 * מנהל הסוכנים - אחראי על ניהול והקצאת משאבים לסוכנים במערכת
 * מאפשר:
 * - רישום סוכנים
 * - תזמון משימות אוטומטיות
 * - חלוקת עומסים
 * - העברת מידע בין סוכנים
 * - בחירת מודלים מתאימים
 */
class AgentManager extends EventEmitter {
  constructor() {
    super();
    
    // אתחול מבני הנתונים העיקריים
    this.agents = {}; // מיפוי של כל הסוכנים הרשומים
    this.tasks = {}; // מעקב אחר משימות שנמצאות בביצוע
    this.taskQueue = []; // תור משימות לביצוע
    this.active = false; // האם המנהל פעיל
    this.config = null; // הגדרות המערכת
    this.interval = null; // מזהה עבור בדיקות תקופתיות
    this.startTime = null; // זמן תחילת פעילות
    
    this.logPrefix = '[agent_manager]';
    
    // סטטיסטיקות
    this.stats = {
      totalTasksQueued: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
      agentUsageCount: {},
      modelUsageCount: {},
      lastTaskTime: null
    };
    
    logger.info(`${this.logPrefix} מנהל הסוכנים אותחל`);
  }
  
  /**
   * הפעלת מנהל הסוכנים
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} מנהל הסוכנים כבר פעיל`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} מפעיל את מנהל הסוכנים...`);
      
      // טען הגדרות
      this.config = await getConfig();
      
      // אתחול זמן התחלה
      this.startTime = new Date();
      
      // הפעל את בדיקת תור המשימות
      const checkInterval = this.config.agentManager?.taskCheckInterval || 5000; // ברירת מחדל: 5 שניות
      this.interval = setInterval(() => this._processTaskQueue(), checkInterval);
      
      this.active = true;
      
      logger.info(`${this.logPrefix} מנהל הסוכנים הופעל בהצלחה`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בהפעלת מנהל הסוכנים: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * כיבוי מנהל הסוכנים
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} מנהל הסוכנים כבר כבוי`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} מכבה את מנהל הסוכנים...`);
      
      // ביטול בדיקת תור המשימות
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      
      // שמירת סטטיסטיקות
      await this._saveStats();
      
      this.active = false;
      
      logger.info(`${this.logPrefix} מנהל הסוכנים כובה בהצלחה`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בכיבוי מנהל הסוכנים: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * רישום סוכן במערכת
   * @param {string} agentName - שם הסוכן 
   * @param {Object} agentInstance - מופע הסוכן
   */
  registerAgent(agentName, agentInstance) {
    if (this.agents[agentName]) {
      logger.warn(`${this.logPrefix} סוכן בשם ${agentName} כבר רשום במערכת`);
      return;
    }
    
    this.agents[agentName] = {
      instance: agentInstance,
      registeredAt: new Date().toISOString(),
      lastActivity: null,
      currentTask: null,
      status: 'idle'
    };
    
    // אתחול מונה שימוש בסוכן
    this.stats.agentUsageCount[agentName] = 0;
    
    logger.info(`${this.logPrefix} סוכן ${agentName} נרשם במערכת`);
  }
  
  /**
   * ביטול רישום של סוכן במערכת
   * @param {string} agentName - שם הסוכן
   */
  unregisterAgent(agentName) {
    if (!this.agents[agentName]) {
      logger.warn(`${this.logPrefix} סוכן בשם ${agentName} אינו רשום במערכת`);
      return;
    }
    
    delete this.agents[agentName];
    logger.info(`${this.logPrefix} סוכן ${agentName} הוסר מהמערכת`);
  }
  
  /**
   * בדיקה אם סוכן רשום במערכת
   * @param {string} agentName - שם הסוכן
   * @returns {boolean} - האם הסוכן רשום
   */
  isAgentRegistered(agentName) {
    return !!this.agents[agentName];
  }
  
  /**
   * קבלת רשימת כל הסוכנים הרשומים
   * @returns {Object} - מידע על כל הסוכנים
   */
  getRegisteredAgents() {
    const agentInfo = {};
    
    for (const [agentName, agentData] of Object.entries(this.agents)) {
      agentInfo[agentName] = {
        registeredAt: agentData.registeredAt,
        lastActivity: agentData.lastActivity,
        status: agentData.status,
        currentTask: agentData.currentTask
      };
    }
    
    return agentInfo;
  }
  
  /**
   * הוספת משימה לתור המשימות
   * @param {string} agentName - שם הסוכן לביצוע המשימה
   * @param {string} actionType - סוג הפעולה 
   * @param {Object} parameters - פרמטרים לפעולה
   * @param {Object} options - אפשרויות נוספות
   * @returns {string} - מזהה המשימה
   */
  addTask(agentName, actionType, parameters = {}, options = {}) {
    if (!this.active) {
      throw new Error('מנהל הסוכנים אינו פעיל');
    }
    
    if (!this.agents[agentName]) {
      throw new Error(`סוכן ${agentName} אינו רשום במערכת`);
    }
    
    const taskId = `task_${uuidv4()}`;
    const task = {
      id: taskId,
      agentName,
      actionType,
      parameters,
      priority: options.priority || 'normal', // אפשרויות: low, normal, high, critical
      status: 'pending',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };
    
    this.tasks[taskId] = task;
    
    // הוסף את המשימה לתור בהתאם לעדיפות
    if (task.priority === 'critical') {
      // משימות קריטיות נכנסות לראש התור
      this.taskQueue.unshift(taskId);
    } else if (task.priority === 'high') {
      // משימות בעדיפות גבוהה נכנסות אחרי משימות קריטיות
      const criticalTasksCount = this.taskQueue.filter(id => 
        this.tasks[id].priority === 'critical'
      ).length;
      
      this.taskQueue.splice(criticalTasksCount, 0, taskId);
    } else {
      // משימות רגילות או בעדיפות נמוכה נכנסות לסוף התור
      this.taskQueue.push(taskId);
    }
    
    this.stats.totalTasksQueued++;
    this.stats.lastTaskTime = new Date().toISOString();
    
    logger.info(`${this.logPrefix} משימה ${taskId} (${actionType}) נוספה לתור עבור סוכן ${agentName}`);
    
    return taskId;
  }
  
  /**
   * בדיקת סטטוס משימה
   * @param {string} taskId - מזהה המשימה
   * @returns {Object|null} - פרטי המשימה
   */
  getTaskStatus(taskId) {
    if (!this.tasks[taskId]) {
      return null;
    }
    
    return { ...this.tasks[taskId] };
  }
  
  /**
   * המתנה לסיום משימה
   * @param {string} taskId - מזהה המשימה
   * @param {number} timeout - זמן המתנה מקסימלי במילישניות
   * @returns {Promise<Object>} - תוצאת המשימה
   */
  async waitForTask(taskId, timeout = 60000) {
    if (!this.tasks[taskId]) {
      throw new Error(`משימה ${taskId} אינה קיימת`);
    }
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const task = this.tasks[taskId];
        
        // בדוק אם המשימה הושלמה
        if (task.status === 'completed') {
          clearInterval(checkInterval);
          resolve(task.result);
        }
        
        // בדוק אם המשימה נכשלה
        if (task.status === 'failed') {
          clearInterval(checkInterval);
          reject(new Error(task.error || 'המשימה נכשלה'));
        }
        
        // בדוק אם פג תוקף זמן ההמתנה
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`פג תוקף זמן ההמתנה למשימה ${taskId}`));
        }
      }, 500);
    });
  }
  
  /**
   * קבלת המודל המומלץ עבור סוכן
   * @param {string} agentName - שם הסוכן
   * @returns {Object} - הספק והמודל המומלצים
   */
  getRecommendedModel(agentName) {
    // אם הסוכן לא נרשם, השתמש בברירת מחדל
    if (!this.agents[agentName]) {
      return {
        provider: 'openai',
        model: 'gpt-4o'
      };
    }
    
    const agentInstance = this.agents[agentName].instance;
    
    // בדוק אם לסוכן יש העדפות מודל
    if (agentInstance.preferredProvider && agentInstance.preferredModel) {
      return {
        provider: agentInstance.preferredProvider,
        model: agentInstance.preferredModel
      };
    }
    
    // אחרת, השתמש בברירת מחדל מהתצורה
    const defaultProvider = this.config?.ai?.defaultProvider || 'openai';
    const defaultModel = this.config?.ai?.defaultModel || 'gpt-4o';
    
    return {
      provider: defaultProvider,
      model: defaultModel
    };
  }
  
  /**
   * טיפול במשימה קיימת
   * @param {string} taskId - מזהה המשימה
   * @private
   */
  async _processTask(taskId) {
    if (!this.tasks[taskId]) {
      logger.warn(`${this.logPrefix} משימה ${taskId} אינה קיימת`);
      return;
    }
    
    const task = this.tasks[taskId];
    
    // בדוק אם המשימה כבר מטופלת או הושלמה
    if (task.status !== 'pending') {
      return;
    }
    
    // בדוק אם הסוכן המיועד זמין
    const agentData = this.agents[task.agentName];
    if (!agentData || agentData.status !== 'idle') {
      // אם הסוכן לא זמין כרגע, נדלג וננסה שוב בהזדמנות הבאה
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} מתחיל לטפל במשימה ${taskId} (${task.actionType}) באמצעות סוכן ${task.agentName}`);
      
      // עדכן סטטוס הסוכן והמשימה
      agentData.status = 'busy';
      agentData.currentTask = taskId;
      agentData.lastActivity = new Date().toISOString();
      
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      
      // קבל את הסוכן
      const agent = agentData.instance;
      
      // בדוק אם קיימת מתודה מתאימה בסוכן
      if (typeof agent[task.actionType] !== 'function') {
        throw new Error(`פעולה ${task.actionType} אינה נתמכת על ידי סוכן ${task.agentName}`);
      }
      
      // הרץ את הפעולה
      const result = await agent[task.actionType](...Object.values(task.parameters));
      
      // עדכן את תוצאת המשימה
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      task.result = result;
      
      // עדכן סטטיסטיקות
      this.stats.totalTasksCompleted++;
      this.stats.agentUsageCount[task.agentName]++;
      
      // עדכן את מצב הסוכן
      agentData.status = 'idle';
      agentData.currentTask = null;
      
      logger.info(`${this.logPrefix} משימה ${taskId} הושלמה בהצלחה`);
    } catch (error) {
      // טיפול בשגיאות
      logger.error(`${this.logPrefix} שגיאה בביצוע משימה ${taskId}: ${error.message}`);
      
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
      task.error = error.message;
      
      // עדכן סטטיסטיקות
      this.stats.totalTasksFailed++;
      
      // שחרר את הסוכן
      agentData.status = 'idle';
      agentData.currentTask = null;
    }
  }
  
  /**
   * עיבוד תור המשימות
   * @private
   */
  async _processTaskQueue() {
    if (!this.active || this.taskQueue.length === 0) {
      return;
    }
    
    // בדוק אם יש משימות בתור
    while (this.taskQueue.length > 0) {
      const taskId = this.taskQueue[0];
      
      // נסה לטפל במשימה
      await this._processTask(taskId);
      
      // בדוק אם המשימה הסתיימה (הצליחה או נכשלה)
      const task = this.tasks[taskId];
      if (task.status === 'completed' || task.status === 'failed') {
        // הסר את המשימה מהתור
        this.taskQueue.shift();
      } else {
        // אם המשימה עדיין מחכה או רצה, צא מהלולאה ונסה שוב מאוחר יותר
        break;
      }
    }
  }
  
  /**
   * קבלת סטטיסטיקות ביצועים
   * @returns {Object} - סטטיסטיקות מנהל הסוכנים
   */
  getStats() {
    const uptime = this.startTime ? Math.floor((new Date() - this.startTime) / 1000) : 0;
    
    return {
      isActive: this.active,
      startTime: this.startTime ? this.startTime.toISOString() : null,
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
      registeredAgents: Object.keys(this.agents).length,
      activeAgents: Object.values(this.agents).filter(a => a.status === 'busy').length,
      queuedTasks: this.taskQueue.length,
      totalTasksStats: {
        queued: this.stats.totalTasksQueued,
        completed: this.stats.totalTasksCompleted,
        failed: this.stats.totalTasksFailed,
        success_rate: this.stats.totalTasksQueued > 0 
          ? ((this.stats.totalTasksCompleted / this.stats.totalTasksQueued) * 100).toFixed(2) + '%' 
          : 'N/A'
      },
      agentUsage: this.stats.agentUsageCount,
      lastTaskTime: this.stats.lastTaskTime
    };
  }
  
  /**
   * שמירת סטטיסטיקות למאגר
   * @private
   */
  async _saveStats() {
    try {
      const statsDir = path.join(process.cwd(), 'logs', 'stats');
      await fs.ensureDir(statsDir);
      
      const statsFile = path.join(statsDir, `agent_manager_stats_${new Date().toISOString().replace(/:/g, '-')}.json`);
      await fs.writeJson(statsFile, this.getStats(), { spaces: 2 });
      
      logger.debug(`${this.logPrefix} סטטיסטיקות נשמרו ב-${statsFile}`);
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בשמירת סטטיסטיקות: ${error.message}`);
    }
  }
  
  /**
   * קבלת הפעילות הנוכחית של הסוכנים
   * @returns {Object} - מידע על פעילות נוכחית
   */
  getCurrentActivity() {
    const activity = {
      runningTasks: {},
      pendingTasks: this.taskQueue.length,
      idleAgents: [],
      busyAgents: []
    };
    
    // איסוף מידע על סוכנים פעילים וממתינים
    for (const [agentName, agentData] of Object.entries(this.agents)) {
      if (agentData.status === 'busy' && agentData.currentTask) {
        activity.busyAgents.push({
          name: agentName,
          currentTask: agentData.currentTask,
          lastActivity: agentData.lastActivity
        });
        
        const task = this.tasks[agentData.currentTask];
        if (task) {
          activity.runningTasks[agentData.currentTask] = {
            type: task.actionType,
            startedAt: task.startedAt,
            agent: agentName
          };
        }
      } else {
        activity.idleAgents.push({
          name: agentName,
          lastActivity: agentData.lastActivity
        });
      }
    }
    
    // הוסף מידע כללי
    activity.timestamp = new Date().toISOString();
    activity.pendingTasksIds = this.taskQueue.slice(0, 5); // הצג רק 5 הראשונים
    
    return activity;
  }
}

// יצירת מופע בודד
const agentManager = new AgentManager();

module.exports = agentManager; 