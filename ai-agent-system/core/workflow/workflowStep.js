/**
 * מייצג שלב בתזרים עבודה
 * מכיל את הלוגיקה הדרושה לביצוע פעולה בודדת של תזרים עבודה
 */

const { logger } = require('../logger');
const agentManager = require('../agentManager');

class WorkflowStep {
  /**
   * יוצר שלב תזרים עבודה חדש
   * @param {object} config - תצורת השלב
   * @param {string} config.id - מזהה השלב
   * @param {string} config.agentId - מזהה הסוכן שמבצע את השלב
   * @param {string} config.action - פעולה לביצוע
   * @param {object} config.params - פרמטרים לפעולה
   * @param {function} config.condition - פונקציה לבדיקת תנאי המשך (אופציונלי)
   * @param {string} config.onSuccess - מזהה השלב הבא במקרה של הצלחה (אופציונלי)
   * @param {string} config.onFailure - מזהה השלב הבא במקרה של כשלון (אופציונלי)
   */
  constructor(config) {
    this.id = config.id;
    this.agentId = config.agentId;
    this.action = config.action;
    this.params = config.params || {};
    this.condition = config.condition;
    this.onSuccess = config.onSuccess;
    this.onFailure = config.onFailure;
    this.description = config.description || '';
    this.timeout = config.timeout || 60000; // ברירת מחדל: דקה אחת
  }

  /**
   * ביצוע השלב
   * @param {object} context - קונטקסט תזרים העבודה
   * @returns {Promise<object>} - תוצאות השלב
   */
  async execute(context = {}) {
    logger.info(`[workflow:step] Executing step: ${this.id}, action: ${this.action}, agent: ${this.agentId}`);
    
    try {
      // נסה לקבל את הסוכן מתוך מנהל הסוכנים
      const agent = agentManager.getAgent(this.agentId);
      
      if (!agent) {
        throw new Error(`Agent not found: ${this.agentId}`);
      }
      
      // בדוק האם הסוכן תומך בפעולות תזרים עבודה
      if (typeof agent.handleWorkflowAction !== 'function') {
        throw new Error(`Agent ${this.agentId} does not support workflow actions`);
      }
      
      // בדוק אם הסוכן פעיל
      if (!agent.active && this.action !== 'init') {
        logger.info(`[workflow:step] Agent ${this.agentId} is not active, initializing...`);
        await agent.init();
      }
      
      // מריץ את הפעולה עם טיימאאוט
      const result = await this._executeWithTimeout(agent, context);
      
      logger.info(`[workflow:step] Step ${this.id} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`[workflow:step] Error in step ${this.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * ביצוע הפעולה עם טיימאאוט
   * @param {object} agent - הסוכן לביצוע הפעולה
   * @param {object} context - קונטקסט תזרים העבודה
   * @returns {Promise<object>} - תוצאות הפעולה
   * @private
   */
  async _executeWithTimeout(agent, context) {
    return new Promise((resolve, reject) => {
      // הגדר טיימר לטיימאאוט
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${this.timeout}ms in step ${this.id}`));
      }, this.timeout);
      
      // נסה לבצע את הפעולה
      agent.handleWorkflowAction(this.action, this.params, context)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * המרה למחרוזת
   * @returns {string} ייצוג מחרוזת של השלב
   */
  toString() {
    return `WorkflowStep {id: ${this.id}, agent: ${this.agentId}, action: ${this.action}}`;
  }

  /**
   * המרה לאובייקט JSON
   * @returns {object} אובייקט ייצוג של השלב
   */
  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      action: this.action,
      params: this.params,
      description: this.description,
      timeout: this.timeout
    };
  }
}

module.exports = WorkflowStep; 