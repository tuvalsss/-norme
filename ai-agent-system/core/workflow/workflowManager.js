/**
 * מנהל תזרימי העבודה של המערכת
 * אחראי על רישום, הפעלה ומעקב אחר תזרימי עבודה
 */

const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../logger');
const memoryManager = require('../memoryManager');
const WorkflowStep = require('./workflowStep');

class WorkflowManager extends EventEmitter {
  constructor() {
    super();
    this.workflows = new Map();         // מאגר תזרימי העבודה הרשומים
    this.activeWorkflows = new Map();   // תזרימי עבודה פעילים
  }

  /**
   * רישום תזרים עבודה חדש
   * @param {string} id - מזהה תזרים העבודה (אופציונלי, יווצר אוטומטית אם לא מסופק)
   * @param {object} config - תצורת תזרים העבודה
   * @returns {string} - מזהה תזרים העבודה
   */
  registerWorkflow(id = null, config) {
    const workflowId = id || `workflow_${uuidv4()}`;
    
    if (this.workflows.has(workflowId)) {
      logger.warn(`[workflow_manager] Workflow ID already exists: ${workflowId}. Overwriting.`);
    }
    
    // המר את תצורת השלבים לאובייקטים של WorkflowStep
    const steps = Array.isArray(config.steps) 
      ? config.steps.map(step => new WorkflowStep(step))
      : [];
    
    const workflow = {
      id: workflowId,
      name: config.name || workflowId,
      description: config.description || '',
      steps,
      createdAt: new Date(),
      metadata: config.metadata || {}
    };
    
    this.workflows.set(workflowId, workflow);
    logger.info(`[workflow_manager] Workflow registered: ${workflowId} (${workflow.name})`);
    
    return workflowId;
  }

  /**
   * קבלת כל תזרימי העבודה הרשומים
   * @returns {Array} - רשימת תזרימי העבודה
   */
  getAllWorkflows() {
    return Array.from(this.workflows.values()).map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      steps: workflow.steps.length,
      createdAt: workflow.createdAt,
      metadata: workflow.metadata
    }));
  }

  /**
   * קבלת פרטי תזרים עבודה לפי מזהה
   * @param {string} id - מזהה תזרים העבודה
   * @returns {object} - פרטי תזרים העבודה
   */
  getWorkflow(id) {
    if (!this.workflows.has(id)) {
      throw new Error(`Workflow not found: ${id}`);
    }
    
    return this.workflows.get(id);
  }

  /**
   * הפעלת תזרים עבודה
   * @param {string} id - מזהה תזרים העבודה
   * @param {object} context - קונטקסט התחלתי
   * @param {object} options - אפשרויות הפעלה
   * @returns {string} - מזהה ריצת תזרים העבודה
   */
  async startWorkflow(id, context = {}, options = {}) {
    if (!this.workflows.has(id)) {
      throw new Error(`Workflow not found: ${id}`);
    }
    
    const workflow = this.workflows.get(id);
    const runId = `run_${uuidv4()}`;
    
    // יצירת אובייקט ריצה
    const workflowRun = {
      runId,
      workflowId: id,
      workflowName: workflow.name,
      startedAt: new Date(),
      steps: workflow.steps,
      currentStepIndex: 0,
      context,
      status: 'running',
      results: [],
      options
    };
    
    this.activeWorkflows.set(runId, workflowRun);
    
    // רישום התחלת תזרים העבודה
    logger.info(`[workflow_manager] Starting workflow: ${id} (${workflow.name}), runId: ${runId}`);
    memoryManager.logAction('workflow_manager', `התחלת תזרים עבודה: ${workflow.name}`);
    
    this.emit('workflow:started', { runId, workflowId: id });
    
    // התחל לבצע את התזרים בצורה אסינכרונית
    this._executeWorkflow(runId).catch(error => {
      logger.error(`[workflow_manager] Error in workflow ${id} (${runId}): ${error.message}`);
      this.emit('workflow:error', { runId, workflowId: id, error: error.message });
    });
    
    return runId;
  }

  /**
   * ביצוע תזרים עבודה שלב אחר שלב
   * @param {string} runId - מזהה ריצת תזרים העבודה
   * @private
   */
  async _executeWorkflow(runId) {
    if (!this.activeWorkflows.has(runId)) {
      throw new Error(`Active workflow run not found: ${runId}`);
    }
    
    const workflowRun = this.activeWorkflows.get(runId);
    
    try {
      // רוץ על כל השלבים בתור
      while (workflowRun.currentStepIndex < workflowRun.steps.length) {
        const result = await this._executeStep(runId, workflowRun.currentStepIndex);
        
        if (result.status === 'error') {
          workflowRun.status = 'error';
          workflowRun.error = result.error;
          break;
        }
        
        // אם יש תנאי המשך, בדוק אותו
        const currentStep = workflowRun.steps[workflowRun.currentStepIndex];
        if (currentStep.condition && typeof currentStep.condition === 'function') {
          const shouldContinue = currentStep.condition(result, workflowRun.context);
          if (!shouldContinue) {
            workflowRun.status = 'completed';
            break;
          }
        }
        
        workflowRun.currentStepIndex++;
      }
      
      // אם הגענו לסוף בהצלחה
      if (workflowRun.status === 'running') {
        workflowRun.status = 'completed';
      }
      
      workflowRun.completedAt = new Date();
      
      // שמור את התוצאה ושלח אירוע סיום
      this.emit('workflow:completed', { 
        runId, 
        workflowId: workflowRun.workflowId,
        status: workflowRun.status,
        context: workflowRun.context,
        results: workflowRun.results
      });
      
      // רישום סיום תזרים העבודה
      logger.info(`[workflow_manager] Workflow completed: ${workflowRun.workflowId} (${workflowRun.workflowName}), runId: ${runId}, status: ${workflowRun.status}`);
      memoryManager.logAction('workflow_manager', `תזרים עבודה הסתיים: ${workflowRun.workflowName} (סטטוס: ${workflowRun.status})`);
      
      return {
        status: workflowRun.status,
        context: workflowRun.context,
        results: workflowRun.results
      };
    } catch (error) {
      workflowRun.status = 'error';
      workflowRun.error = error.message;
      workflowRun.completedAt = new Date();
      
      this.emit('workflow:error', { 
        runId, 
        workflowId: workflowRun.workflowId,
        error: error.message
      });
      
      logger.error(`[workflow_manager] Error in workflow ${workflowRun.workflowId} (${runId}): ${error.message}`);
      memoryManager.logAction('workflow_manager', `שגיאה בתזרים עבודה: ${workflowRun.workflowName} - ${error.message}`, false);
      
      throw error;
    }
  }

  /**
   * ביצוע שלב בתזרים עבודה
   * @param {string} runId - מזהה ריצת תזרים העבודה
   * @param {number} stepIndex - אינדקס השלב
   * @returns {object} - תוצאת השלב
   * @private
   */
  async _executeStep(runId, stepIndex) {
    if (!this.activeWorkflows.has(runId)) {
      throw new Error(`Active workflow run not found: ${runId}`);
    }
    
    const workflowRun = this.activeWorkflows.get(runId);
    const step = workflowRun.steps[stepIndex];
    
    if (!step) {
      throw new Error(`Step not found at index ${stepIndex}`);
    }
    
    logger.info(`[workflow_manager] Executing step ${stepIndex + 1}/${workflowRun.steps.length}: ${step.id} (${step.action}) in workflow ${workflowRun.workflowId}`);
    memoryManager.logAction('workflow_manager', `ביצוע שלב ${stepIndex + 1}: ${step.id} בתזרים ${workflowRun.workflowName}`);
    
    try {
      // מדידת זמן ביצוע השלב
      const startTime = Date.now();
      
      // ביצוע השלב
      const result = await step.execute(workflowRun.context);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // עדכון הקונטקסט עם תוצאות השלב
      if (result.context) {
        workflowRun.context = { ...workflowRun.context, ...result.context };
      }
      
      // שמירת תוצאת השלב
      const stepResult = {
        stepId: step.id,
        stepIndex,
        action: step.action,
        status: 'success',
        duration,
        result: result.data
      };
      
      workflowRun.results.push(stepResult);
      
      // שליחת אירוע סיום שלב
      this.emit('workflow:step:completed', { 
        runId, 
        workflowId: workflowRun.workflowId,
        stepId: step.id,
        stepIndex,
        result: stepResult
      });
      
      logger.info(`[workflow_manager] Step ${stepIndex + 1} completed successfully in ${duration}ms`);
      
      return { status: 'success', data: result.data, context: result.context };
    } catch (error) {
      logger.error(`[workflow_manager] Error in step ${stepIndex + 1} (${step.id}): ${error.message}`);
      
      // שמירת שגיאת השלב
      const stepResult = {
        stepId: step.id,
        stepIndex,
        action: step.action,
        status: 'error',
        error: error.message
      };
      
      workflowRun.results.push(stepResult);
      
      // שליחת אירוע שגיאת שלב
      this.emit('workflow:step:error', { 
        runId, 
        workflowId: workflowRun.workflowId,
        stepId: step.id,
        stepIndex,
        error: error.message
      });
      
      memoryManager.logAction('workflow_manager', `שגיאה בשלב ${stepIndex + 1} (${step.id}): ${error.message}`, false);
      
      return { status: 'error', error: error.message };
    }
  }

  /**
   * עצירת תזרים עבודה
   * @param {string} runId - מזהה ריצת תזרים העבודה
   * @returns {boolean} - האם העצירה הצליחה
   */
  stopWorkflow(runId) {
    if (!this.activeWorkflows.has(runId)) {
      throw new Error(`Active workflow run not found: ${runId}`);
    }
    
    const workflowRun = this.activeWorkflows.get(runId);
    
    workflowRun.status = 'stopped';
    workflowRun.completedAt = new Date();
    
    this.emit('workflow:stopped', { 
      runId, 
      workflowId: workflowRun.workflowId
    });
    
    logger.info(`[workflow_manager] Workflow stopped: ${workflowRun.workflowId} (${workflowRun.workflowName}), runId: ${runId}`);
    memoryManager.logAction('workflow_manager', `תזרים עבודה נעצר: ${workflowRun.workflowName}`);
    
    return true;
  }

  /**
   * קבלת סטטוס של תזרים עבודה פעיל
   * @param {string} runId - מזהה ריצת תזרים העבודה
   * @returns {object} - סטטוס תזרים העבודה
   */
  getWorkflowStatus(runId) {
    if (!this.activeWorkflows.has(runId)) {
      throw new Error(`Active workflow run not found: ${runId}`);
    }
    
    const workflowRun = this.activeWorkflows.get(runId);
    
    return {
      runId,
      workflowId: workflowRun.workflowId,
      workflowName: workflowRun.workflowName,
      status: workflowRun.status,
      startedAt: workflowRun.startedAt,
      completedAt: workflowRun.completedAt,
      currentStep: workflowRun.currentStepIndex + 1,
      totalSteps: workflowRun.steps.length,
      progress: `${workflowRun.currentStepIndex + 1}/${workflowRun.steps.length}`,
      results: workflowRun.results
    };
  }

  /**
   * קבלת כל תזרימי העבודה הפעילים
   * @returns {Array} - רשימת תזרימי העבודה הפעילים
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values()).map(workflowRun => ({
      runId: workflowRun.runId,
      workflowId: workflowRun.workflowId,
      workflowName: workflowRun.workflowName,
      status: workflowRun.status,
      startedAt: workflowRun.startedAt,
      currentStep: workflowRun.currentStepIndex + 1,
      totalSteps: workflowRun.steps.length,
      progress: `${workflowRun.currentStepIndex + 1}/${workflowRun.steps.length}`
    }));
  }
}

module.exports = new WorkflowManager(); 