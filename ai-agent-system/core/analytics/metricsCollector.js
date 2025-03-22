/**
 * מערכת איסוף ואנליזת מדדים
 * אחראית על איסוף, שמירה וניתוח מדדי ביצוע של המערכת והסוכנים
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../logger');

class MetricsCollector {
  constructor() {
    this.metrics = {
      system: {
        startTime: Date.now(),
        uptime: 0,
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        responseTime: []
      },
      agents: {}
    };
    
    this.metricsDir = path.resolve(__dirname, '../../data/metrics');
    this.ensureMetricsDir();
    
    // עדכון נתוני זמן פעולה של המערכת
    setInterval(() => {
      this.metrics.system.uptime = Date.now() - this.metrics.system.startTime;
    }, 60000); // עדכון כל דקה
    
    // גיזום מערך זמני תגובה כדי לא לצרוך יותר מדי זיכרון
    setInterval(() => {
      if (this.metrics.system.responseTime.length > 1000) {
        this.metrics.system.responseTime = this.metrics.system.responseTime.slice(-1000);
      }
    }, 3600000); // פעם בשעה
    
    // שמירת מדדים לדיסק
    setInterval(() => {
      this.saveMetricsToDisk();
    }, 300000); // כל 5 דקות
  }

  /**
   * וודא שתיקיית המדדים קיימת
   */
  ensureMetricsDir() {
    try {
      fs.ensureDirSync(this.metricsDir);
      logger.info(`[metrics_collector] Metrics directory ensured: ${this.metricsDir}`);
    } catch (error) {
      logger.error(`[metrics_collector] Failed to create metrics directory: ${error.message}`);
    }
  }

  /**
   * רישום פעולת סוכן
   * @param {string} agentId - מזהה הסוכן
   * @param {string} action - שם הפעולה
   * @param {number} duration - משך הפעולה במילישניות
   * @param {boolean} success - האם הפעולה הצליחה
   * @param {object} metadata - מידע נוסף על הפעולה
   */
  recordAgentAction(agentId, action, duration, success, metadata = {}) {
    // אתחול נתוני סוכן אם לא קיימים
    if (!this.metrics.agents[agentId]) {
      this.metrics.agents[agentId] = {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        responseTime: [],
        actionCounts: {},
        firstAction: Date.now(),
        lastAction: null
      };
    }
    
    const agentMetrics = this.metrics.agents[agentId];
    
    // עדכון מדדים כלליים
    this.metrics.system.totalActions++;
    agentMetrics.totalActions++;
    
    if (success) {
      this.metrics.system.successfulActions++;
      agentMetrics.successfulActions++;
    } else {
      this.metrics.system.failedActions++;
      agentMetrics.failedActions++;
    }
    
    // עדכון זמן תגובה
    this.metrics.system.responseTime.push(duration);
    agentMetrics.responseTime.push(duration);
    
    // עדכון זמן פעולה אחרונה
    agentMetrics.lastAction = Date.now();
    
    // עדכון ספירות פעולות
    if (!agentMetrics.actionCounts[action]) {
      agentMetrics.actionCounts[action] = 0;
    }
    agentMetrics.actionCounts[action]++;
    
    logger.debug(`[metrics_collector] Recorded action for ${agentId}: ${action} (${duration}ms, success: ${success})`);
  }

  /**
   * קבלת מדדי סוכן
   * @param {string} agentId - מזהה הסוכן
   * @param {number} period - תקופת הזמן לחישוב המדדים בשעות (0 לכל הזמן)
   * @returns {object} - מדדי הסוכן
   */
  getAgentMetrics(agentId, period = 24) {
    if (!this.metrics.agents[agentId]) {
      return null;
    }
    
    const agentMetrics = this.metrics.agents[agentId];
    const periodMs = period * 60 * 60 * 1000; // המרה לשעות
    const now = Date.now();
    
    // אם period הוא 0, החזר את כל המדדים
    if (period === 0) {
      return this._calculateAgentMetrics(agentId, agentMetrics);
    }
    
    // סינון לפי התקופה המבוקשת
    const filteredResponseTime = agentMetrics.responseTime.filter(
      (_, index) => {
        // הנחה: הזמנים נרשמים בהדרגה, אז אינדקס גבוה יותר = זמן מאוחר יותר
        const timestamp = agentMetrics.lastAction - 
          (agentMetrics.responseTime.length - 1 - index) * 
          (agentMetrics.lastAction - agentMetrics.firstAction) / 
          agentMetrics.responseTime.length;
        
        return now - timestamp <= periodMs;
      }
    );
    
    // חישוב יחסי של שאר המדדים
    const ratio = filteredResponseTime.length / agentMetrics.responseTime.length;
    const periodMetrics = {
      ...agentMetrics,
      totalActions: Math.round(agentMetrics.totalActions * ratio),
      successfulActions: Math.round(agentMetrics.successfulActions * ratio),
      failedActions: Math.round(agentMetrics.failedActions * ratio),
      responseTime: filteredResponseTime
    };
    
    return this._calculateAgentMetrics(agentId, periodMetrics);
  }

  /**
   * חישוב מדדי סוכן
   * @param {string} agentId - מזהה הסוכן
   * @param {object} metrics - נתוני המדדים
   * @returns {object} - מדדים מחושבים
   * @private
   */
  _calculateAgentMetrics(agentId, metrics) {
    const responseTimeData = metrics.responseTime || [];
    const avgResponseTime = responseTimeData.length > 0 
      ? responseTimeData.reduce((sum, time) => sum + time, 0) / responseTimeData.length 
      : 0;
    
    return {
      agentId,
      totalActions: metrics.totalActions,
      successfulActions: metrics.successfulActions,
      failedActions: metrics.failedActions,
      successRate: metrics.totalActions > 0 
        ? (metrics.successfulActions / metrics.totalActions) * 100 
        : 0,
      avgResponseTime,
      minResponseTime: responseTimeData.length > 0 ? Math.min(...responseTimeData) : 0,
      maxResponseTime: responseTimeData.length > 0 ? Math.max(...responseTimeData) : 0,
      actionsPerHour: metrics.lastAction && metrics.firstAction 
        ? (metrics.totalActions / ((metrics.lastAction - metrics.firstAction) / 3600000)).toFixed(2) 
        : 0,
      firstAction: new Date(metrics.firstAction).toISOString(),
      lastAction: metrics.lastAction ? new Date(metrics.lastAction).toISOString() : null,
      topActions: Object.entries(metrics.actionCounts || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }))
    };
  }

  /**
   * קבלת מדדי מערכת
   * @param {number} period - תקופת הזמן לחישוב המדדים בשעות (0 לכל הזמן)
   * @returns {object} - מדדי המערכת
   */
  getSystemMetrics(period = 24) {
    const systemMetrics = { ...this.metrics.system };
    const periodMs = period * 60 * 60 * 1000; // המרה לשעות
    const now = Date.now();
    
    // אם period הוא 0, החזר את כל המדדים
    if (period === 0) {
      return this._calculateSystemMetrics(systemMetrics);
    }
    
    // סינון לפי התקופה המבוקשת
    const filteredResponseTime = systemMetrics.responseTime.filter(
      (_, index) => {
        // הנחה: הזמנים נרשמים בהדרגה, אז אינדקס גבוה יותר = זמן מאוחר יותר
        const timestamp = now - 
          (systemMetrics.responseTime.length - 1 - index) * 
          (now - systemMetrics.startTime) / 
          systemMetrics.responseTime.length;
        
        return now - timestamp <= periodMs;
      }
    );
    
    // חישוב יחסי של שאר המדדים
    const ratio = filteredResponseTime.length / systemMetrics.responseTime.length;
    const periodMetrics = {
      ...systemMetrics,
      totalActions: Math.round(systemMetrics.totalActions * ratio),
      successfulActions: Math.round(systemMetrics.successfulActions * ratio),
      failedActions: Math.round(systemMetrics.failedActions * ratio),
      responseTime: filteredResponseTime
    };
    
    return this._calculateSystemMetrics(periodMetrics);
  }

  /**
   * חישוב מדדי מערכת
   * @param {object} metrics - נתוני המדדים
   * @returns {object} - מדדים מחושבים
   * @private
   */
  _calculateSystemMetrics(metrics) {
    const responseTimeData = metrics.responseTime || [];
    const avgResponseTime = responseTimeData.length > 0 
      ? responseTimeData.reduce((sum, time) => sum + time, 0) / responseTimeData.length 
      : 0;
    
    // חישוב פעילות לפי סוכנים
    const agentActivity = Object.entries(this.metrics.agents).map(([agentId, agentMetrics]) => ({
      agentId,
      actions: agentMetrics.totalActions,
      successRate: agentMetrics.totalActions > 0 
        ? (agentMetrics.successfulActions / agentMetrics.totalActions) * 100 
        : 0
    })).sort((a, b) => b.actions - a.actions);
    
    return {
      uptime: metrics.uptime,
      uptimeHours: (metrics.uptime / 3600000).toFixed(2),
      totalActions: metrics.totalActions,
      successfulActions: metrics.successfulActions,
      failedActions: metrics.failedActions,
      successRate: metrics.totalActions > 0 
        ? (metrics.successfulActions / metrics.totalActions) * 100 
        : 0,
      avgResponseTime,
      agentCount: Object.keys(this.metrics.agents).length,
      startTime: new Date(metrics.startTime).toISOString(),
      actionsPerHour: metrics.uptime > 0 
        ? (metrics.totalActions / (metrics.uptime / 3600000)).toFixed(2) 
        : 0,
      agentActivity: agentActivity.slice(0, 5) // החזר רק את 5 הסוכנים הפעילים ביותר
    };
  }

  /**
   * שמירת מדדים לדיסק
   */
  saveMetricsToDisk() {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filePath = path.join(this.metricsDir, `metrics_${timestamp}.json`);
      
      // שמירת העתק של המדדים הנוכחיים
      const metricsSnapshot = JSON.parse(JSON.stringify(this.metrics));
      
      // קיצור מערכי זמני תגובה כדי לא לשמור מידע מיותר
      metricsSnapshot.system.responseTime = metricsSnapshot.system.responseTime.slice(-10);
      
      for (const agentId in metricsSnapshot.agents) {
        metricsSnapshot.agents[agentId].responseTime = 
          metricsSnapshot.agents[agentId].responseTime.slice(-10);
      }
      
      fs.writeFileSync(filePath, JSON.stringify(metricsSnapshot, null, 2), 'utf8');
      logger.info(`[metrics_collector] Saved metrics to disk: ${filePath}`);
      
      // ניקוי קבצי מדדים ישנים
      this._cleanupOldMetricsFiles();
    } catch (error) {
      logger.error(`[metrics_collector] Failed to save metrics to disk: ${error.message}`);
    }
  }

  /**
   * ניקוי קבצי מדדים ישנים
   * @private
   */
  _cleanupOldMetricsFiles() {
    try {
      const files = fs.readdirSync(this.metricsDir);
      
      // מיון קבצים לפי תאריך
      const sortedFiles = files
        .filter(file => file.startsWith('metrics_'))
        .sort();
      
      // השאר רק את 24 הקבצים האחרונים (יום אחד אם שומרים כל שעה)
      if (sortedFiles.length > 24) {
        const filesToDelete = sortedFiles.slice(0, sortedFiles.length - 24);
        
        for (const file of filesToDelete) {
          fs.unlinkSync(path.join(this.metricsDir, file));
          logger.debug(`[metrics_collector] Deleted old metrics file: ${file}`);
        }
      }
    } catch (error) {
      logger.error(`[metrics_collector] Failed to cleanup old metrics files: ${error.message}`);
    }
  }

  /**
   * איפוס מדדי המערכת
   */
  resetMetrics() {
    this.metrics = {
      system: {
        startTime: Date.now(),
        uptime: 0,
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        responseTime: []
      },
      agents: {}
    };
    
    logger.info('[metrics_collector] Metrics have been reset');
  }
}

module.exports = new MetricsCollector(); 