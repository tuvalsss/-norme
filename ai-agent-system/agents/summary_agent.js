/**
 * סוכן סיכום
 * אחראי על יצירת סיכומים, תובנות וניתוחים מזיכרון הסוכנים
 */

const memoryManager = require('../core/memoryManager');
const agentManager = require('../core/agentManager');
const aiEngine = require('../core/aiEngine');
const { v4: uuidv4 } = require('uuid');

class SummaryAgent {
  constructor() {
    this.name = 'summary';
    this.isRunning = false;
    this.currentSummaryId = null;
  }

  /**
   * הפעלת הסוכן
   */
  async init() {
    if (this.isRunning) {
      return true;
    }

    this.isRunning = true;
    this.currentSummaryId = `summary_${uuidv4()}`;
    
    memoryManager.logAction(this.name, 'Summary agent initialized');
    
    return true;
  }

  /**
   * עצירת הסוכן
   */
  async stop() {
    if (!this.isRunning) {
      return true;
    }

    this.isRunning = false;
    memoryManager.logAction(this.name, 'Summary agent stopped');
    
    return true;
  }

  /**
   * יצירת סיכום לפעילות סוכן מסוים
   * @param {string} agentName - שם הסוכן לסיכום
   * @param {object} options - אפשרויות סיכום
   * @param {number} options.timePeriod - תקופת זמן לסיכום בשעות (ברירת מחדל: 24)
   * @param {boolean} options.includeInsights - האם לכלול תובנות (ברירת מחדל: true)
   * @param {string} options.format - פורמט התוצאה (json/text/markdown, ברירת מחדל: markdown)
   * @returns {Promise<object>} - תוצאות הסיכום
   */
  async generateAgentSummary(agentName, options = {}) {
    if (!this.isRunning) {
      await this.init();
    }

    try {
      const timePeriod = options.timePeriod || 24;
      const includeInsights = options.includeInsights !== false;
      const format = options.format || 'markdown';
      
      memoryManager.logAction(
        this.name, 
        `Generating summary for agent ${agentName} for the last ${timePeriod} hours`
      );

      // טעינת זיכרון הסוכן
      const agentMemory = await memoryManager.loadAgentMemory(agentName);
      if (!agentMemory || !agentMemory.sessions || !agentMemory.actions) {
        throw new Error(`No memory found for agent ${agentName}`);
      }

      // סינון פעולות מהתקופה הרלוונטית
      const cutoffTime = new Date(Date.now() - (timePeriod * 60 * 60 * 1000));
      const recentActions = agentMemory.actions
        .filter(action => new Date(action.timestamp) > cutoffTime)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (recentActions.length === 0) {
        return {
          agent: agentName,
          period: `${timePeriod} hours`,
          timestamp: new Date().toISOString(),
          summary: 'No activity during this period',
          actions: 0
        };
      }

      // חישוב מדדים סטטיסטיים
      const stats = this._calculateStats(recentActions);

      // בניית מסד נתונים לסיכום
      const summaryData = {
        agent: agentName,
        period: `${timePeriod} hours`,
        timestamp: new Date().toISOString(),
        stats,
        actions: recentActions.length,
        firstAction: recentActions[0].timestamp,
        lastAction: recentActions[recentActions.length - 1].timestamp
      };

      // הוספת תובנות אם נדרש
      if (includeInsights) {
        summaryData.insights = await this._generateInsights(agentName, recentActions, stats);
      }

      // פורמט התוצאה
      const formattedSummary = await this._formatSummary(summaryData, format);
      
      // שמירה בזיכרון
      await memoryManager.logAction(
        this.name, 
        `Generated summary for agent ${agentName}`, 
        true, 
        { summaryId: this.currentSummaryId }
      );

      return formattedSummary;
    } catch (error) {
      memoryManager.logAction(
        this.name, 
        `Error generating summary for agent ${agentName}: ${error.message}`, 
        false
      );
      throw error;
    }
  }

  /**
   * יצירת סיכום מערכת כולל
   * @param {object} options - אפשרויות סיכום
   * @param {number} options.timePeriod - תקופת זמן לסיכום בשעות (ברירת מחדל: 24)
   * @param {boolean} options.includeInsights - האם לכלול תובנות (ברירת מחדל: true)
   * @param {string} options.format - פורמט התוצאה (json/text/markdown, ברירת מחדל: markdown)
   * @returns {Promise<object>} - תוצאות הסיכום
   */
  async generateSystemSummary(options = {}) {
    if (!this.isRunning) {
      await this.init();
    }

    try {
      const timePeriod = options.timePeriod || 24;
      const includeInsights = options.includeInsights !== false;
      const format = options.format || 'markdown';
      
      memoryManager.logAction(
        this.name, 
        `Generating system summary for the last ${timePeriod} hours`
      );

      // קבלת רשימת כל הסוכנים
      const agents = await agentManager.getAgents();
      
      // איסוף סיכומים לכל סוכן
      const agentSummaries = [];
      for (const agent of agents) {
        try {
          // השתמש בפורמט JSON לסיכומי הסוכנים (לעיבוד פנימי)
          const agentSummary = await this.generateAgentSummary(
            agent.name, 
            { ...options, format: 'json', includeInsights: false }
          );
          agentSummaries.push(agentSummary);
        } catch (error) {
          console.error(`Error summarizing agent ${agent.name}:`, error);
        }
      }

      // בניית מסד נתונים לסיכום מערכת
      const systemSummary = {
        timestamp: new Date().toISOString(),
        period: `${timePeriod} hours`,
        agentCount: agents.length,
        activeSummaries: agentSummaries.length,
        agentSummaries
      };

      // חישוב סטטיסטיקות מערכת
      systemSummary.stats = this._calculateSystemStats(agentSummaries);

      // הוספת תובנות אם נדרש
      if (includeInsights) {
        systemSummary.insights = await this._generateSystemInsights(systemSummary);
      }

      // פורמט התוצאה
      const formattedSummary = await this._formatSummary(systemSummary, format);
      
      // שמירה בזיכרון
      await memoryManager.logAction(
        this.name, 
        `Generated system summary`, 
        true, 
        { summaryId: this.currentSummaryId }
      );

      return formattedSummary;
    } catch (error) {
      memoryManager.logAction(
        this.name, 
        `Error generating system summary: ${error.message}`, 
        false
      );
      throw error;
    }
  }

  /**
   * יצירת תובנות עבור פעולות סוכן
   * @param {string} agentName - שם הסוכן
   * @param {Array} actions - מערך פעולות
   * @param {object} stats - סטטיסטיקות
   * @returns {Promise<Array>} - מערך תובנות
   * @private
   */
  async _generateInsights(agentName, actions, stats) {
    try {
      // בניית הפרומפט לAI
      const actionsJSON = JSON.stringify(actions.slice(0, 50));
      const statsJSON = JSON.stringify(stats);

      const prompt = `
      Please analyze the following data from an AI agent named "${agentName}" and provide 3-5 key insights.
      
      AGENT STATISTICS:
      ${statsJSON}
      
      RECENT ACTIONS (up to 50):
      ${actionsJSON}
      
      Based on this data, provide 3-5 key insights about the agent's performance, patterns, successes, failures, 
      and any recommendations for improvement. Format each insight as an object with "title" and "description" fields.
      Return ONLY a valid JSON array of insight objects.
      `;

      // שליחה למנוע הAI
      const response = await aiEngine.sendPromptWithAgentContext(prompt, {}, 'summary');
      
      try {
        // ניסיון לפרסר את התשובה כJSON
        const insights = JSON.parse(response);
        return Array.isArray(insights) ? insights : [];
      } catch (parseError) {
        console.error('Error parsing AI response as JSON, using text format instead');
        
        // אם הפרסור נכשל, החזר את התשובה כמערך של תובנה אחת
        return [{
          title: 'AI Generated Insight',
          description: response
        }];
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      return [{
        title: 'Error Generating Insights',
        description: `An error occurred while generating insights: ${error.message}`
      }];
    }
  }

  /**
   * יצירת תובנות ברמת המערכת
   * @param {object} systemSummary - סיכום מערכת
   * @returns {Promise<Array>} - מערך תובנות
   * @private
   */
  async _generateSystemInsights(systemSummary) {
    try {
      // בניית הפרומפט לAI
      const summaryJSON = JSON.stringify({
        ...systemSummary,
        agentSummaries: systemSummary.agentSummaries.map(summary => ({
          agent: summary.agent,
          actions: summary.actions,
          stats: summary.stats
        }))
      });

      const prompt = `
      Please analyze the following system summary data and provide 3-5 key insights about the overall system performance.
      
      SYSTEM SUMMARY:
      ${summaryJSON}
      
      Based on this data, provide 3-5 key insights about the system's performance, patterns across agents, 
      system-wide successes, failures, and any recommendations for improvement. 
      Format each insight as an object with "title" and "description" fields.
      Return ONLY a valid JSON array of insight objects.
      `;

      // שליחה למנוע הAI
      const response = await aiEngine.sendPromptWithAgentContext(prompt, {}, 'summary');
      
      try {
        // ניסיון לפרסר את התשובה כJSON
        const insights = JSON.parse(response);
        return Array.isArray(insights) ? insights : [];
      } catch (parseError) {
        console.error('Error parsing AI response as JSON, using text format instead');
        
        // אם הפרסור נכשל, החזר את התשובה כמערך של תובנה אחת
        return [{
          title: 'System Overview',
          description: response
        }];
      }
    } catch (error) {
      console.error('Error generating system insights:', error);
      return [{
        title: 'Error Generating System Insights',
        description: `An error occurred while generating system insights: ${error.message}`
      }];
    }
  }

  /**
   * חישוב סטטיסטיקות מפעולות
   * @param {Array} actions - מערך פעולות
   * @returns {object} - אובייקט סטטיסטיקות
   * @private
   */
  _calculateStats(actions) {
    const totalActions = actions.length;
    const successfulActions = actions.filter(a => a.success).length;
    const failedActions = totalActions - successfulActions;
    
    // יצירת מיפוי סוגי פעולות
    const actionTypes = {};
    actions.forEach(action => {
      actionTypes[action.type] = (actionTypes[action.type] || 0) + 1;
    });

    // סטטיסטיקות נוספות
    let averageTimeGap = 0;
    if (totalActions > 1) {
      let totalGap = 0;
      for (let i = 1; i < actions.length; i++) {
        const current = new Date(actions[i].timestamp);
        const previous = new Date(actions[i-1].timestamp);
        totalGap += (current - previous);
      }
      averageTimeGap = Math.floor(totalGap / (actions.length - 1) / 1000); // בשניות
    }

    return {
      totalActions,
      successRate: totalActions ? (successfulActions / totalActions * 100).toFixed(2) : 0,
      successfulActions,
      failedActions,
      actionTypes,
      averageTimeGapSeconds: averageTimeGap
    };
  }

  /**
   * חישוב סטטיסטיקות מערכת מסיכומי סוכנים
   * @param {Array} agentSummaries - מערך סיכומי סוכנים
   * @returns {object} - אובייקט סטטיסטיקות מערכת
   * @private
   */
  _calculateSystemStats(agentSummaries) {
    const totalActions = agentSummaries.reduce((sum, summary) => sum + summary.actions, 0);
    const successfulActions = agentSummaries.reduce((sum, summary) => {
      if (summary.stats && summary.stats.successfulActions) {
        return sum + summary.stats.successfulActions;
      }
      return sum;
    }, 0);
    
    // חישוב הסוכן הפעיל ביותר
    let mostActiveAgent = null;
    let maxActions = -1;
    
    for (const summary of agentSummaries) {
      if (summary.actions > maxActions) {
        mostActiveAgent = summary.agent;
        maxActions = summary.actions;
      }
    }

    return {
      totalActions,
      successRate: totalActions ? (successfulActions / totalActions * 100).toFixed(2) : 0,
      successfulActions,
      failedActions: totalActions - successfulActions,
      mostActiveAgent,
      mostActiveAgentActions: maxActions,
      agentsWithActivity: agentSummaries.filter(s => s.actions > 0).length
    };
  }

  /**
   * פורמט סיכום לפי הפורמט הנדרש
   * @param {object} summaryData - נתוני הסיכום
   * @param {string} format - פורמט הפלט (json/text/markdown)
   * @returns {object|string} - הסיכום המפורמט
   * @private
   */
  async _formatSummary(summaryData, format) {
    if (format === 'json') {
      return summaryData;
    }

    if (format === 'text') {
      return this._formatAsText(summaryData);
    }

    // ברירת מחדל: markdown
    return this._formatAsMarkdown(summaryData);
  }

  /**
   * פורמט סיכום כטקסט פשוט
   * @param {object} data - נתוני הסיכום
   * @returns {string} - טקסט מפורמט
   * @private
   */
  _formatAsText(data) {
    let text = '';
    
    // כותרת
    if (data.agent) {
      text += `SUMMARY FOR AGENT: ${data.agent}\n`;
    } else {
      text += `SYSTEM SUMMARY\n`;
    }
    
    text += `Period: Last ${data.period}\n`;
    text += `Generated: ${new Date(data.timestamp).toLocaleString()}\n\n`;
    
    // סטטיסטיקות
    text += `STATISTICS:\n`;
    if (data.stats) {
      Object.entries(data.stats).forEach(([key, value]) => {
        if (key !== 'actionTypes') {
          text += `- ${key}: ${value}\n`;
        }
      });
      
      if (data.stats.actionTypes) {
        text += `\nACTION TYPES:\n`;
        Object.entries(data.stats.actionTypes).forEach(([type, count]) => {
          text += `- ${type}: ${count}\n`;
        });
      }
    }
    
    // תובנות
    if (data.insights && data.insights.length > 0) {
      text += `\nINSIGHTS:\n`;
      data.insights.forEach((insight, index) => {
        text += `${index + 1}. ${insight.title}\n`;
        text += `   ${insight.description}\n\n`;
      });
    }
    
    // סיכומי סוכנים (אם זה סיכום מערכת)
    if (data.agentSummaries && data.agentSummaries.length > 0) {
      text += `\nAGENT SUMMARIES:\n`;
      data.agentSummaries.forEach(summary => {
        text += `\n--- ${summary.agent} ---\n`;
        text += `Actions: ${summary.actions}\n`;
        if (summary.stats) {
          text += `Success Rate: ${summary.stats.successRate}%\n`;
        }
      });
    }
    
    return text;
  }

  /**
   * פורמט סיכום כמסמך Markdown
   * @param {object} data - נתוני הסיכום
   * @returns {string} - מסמך Markdown
   * @private
   */
  _formatAsMarkdown(data) {
    let md = '';
    
    // כותרת
    if (data.agent) {
      md += `# Summary for Agent: ${data.agent}\n\n`;
    } else {
      md += `# System Summary\n\n`;
    }
    
    md += `**Period:** Last ${data.period}  \n`;
    md += `**Generated:** ${new Date(data.timestamp).toLocaleString()}  \n\n`;
    
    // סטטיסטיקות
    md += `## Statistics\n\n`;
    if (data.stats) {
      Object.entries(data.stats).forEach(([key, value]) => {
        if (key !== 'actionTypes') {
          md += `- **${key}:** ${value}\n`;
        }
      });
      
      if (data.stats.actionTypes) {
        md += `\n### Action Types\n\n`;
        Object.entries(data.stats.actionTypes).forEach(([type, count]) => {
          md += `- **${type}:** ${count}\n`;
        });
      }
    }
    
    // תובנות
    if (data.insights && data.insights.length > 0) {
      md += `\n## Insights\n\n`;
      data.insights.forEach((insight, index) => {
        md += `### ${index + 1}. ${insight.title}\n\n`;
        md += `${insight.description}\n\n`;
      });
    }
    
    // סיכומי סוכנים (אם זה סיכום מערכת)
    if (data.agentSummaries && data.agentSummaries.length > 0) {
      md += `\n## Agent Activity\n\n`;
      md += `| Agent | Actions | Success Rate |\n`;
      md += `|-------|---------|-------------|\n`;
      data.agentSummaries.forEach(summary => {
        const successRate = summary.stats ? summary.stats.successRate : 'N/A';
        md += `| ${summary.agent} | ${summary.actions} | ${successRate}% |\n`;
      });
    }
    
    return md;
  }
}

module.exports = new SummaryAgent(); 