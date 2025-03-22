const aiEngine = require('../core/aiEngine');
const fileManager = require('../core/fileManager');
const logger = require('../core/logger');
const path = require('path');
const fs = require('fs-extra');
const memoryManager = require('../core/memoryManager');
const agentManager = require('../core/agentManager');
const { v4: uuidv4 } = require('uuid');

// Import other agents for status retrieval
const devAgent = require('./dev_agent');
const qaAgent = require('./qa');
const executorAgent = require('./executor');

// Create a dedicated logger for the summary agent
// const logger = createAgentLogger('summary_agent');

/**
 * Summary agent that collects status, writes logs and reports
 */
class SummaryAgent {
  constructor() {
    this.name = 'summary_agent';
    this.active = false;
    this.provider = 'anthropic'; // Default provider
    this.model = 'claude-3-haiku';  // Default model (lighter for summaries)
    this.isRunning = false;
    this.currentSummaryId = null;
    
    logger.info('Summary agent initialized');
  }

  /**
   * Starts the agent
   * @returns {Promise<void>}
   */
  async start() {
    this.active = true;
    this.isRunning = true;
    this.currentSummaryId = `summary_${uuidv4()}`;
    
    // Document in memory manager
    if (memoryManager && typeof memoryManager.logAction === 'function') {
      memoryManager.logAction(this.name, 'Summary agent initialized');
    }
    
    logger.info('Summary agent started');
    return true;
  }

  /**
   * Stops the agent
   * @returns {Promise<void>}
   */
  async stop() {
    this.active = false;
    this.isRunning = false;
    
    // Document in memory manager
    if (memoryManager && typeof memoryManager.logAction === 'function') {
      memoryManager.logAction(this.name, 'Summary agent stopped');
    }
    
    logger.info('Summary agent stopped');
    return true;
  }

  /**
   * Collects status from all active agents in the system
   * @returns {Promise<Object>} Object with status information from all agents
   */
  async collectAgentsStatus() {
    logger.info('Collecting status from all agents');
    
    const result = {
      timestamp: new Date().toISOString(),
      agents: {}
    };
    
    // Get list of all registered agents
    const agents = agentManager.getAgents();
    
    for (const agentName in agents) {
      const agent = agents[agentName];
      
      // Skip the summary agent itself
      if (agentName === this.name) continue;
      
      result.agents[agentName] = {
        active: agent.active || false,
        lastAction: null,
        memory: null
      };
      
      // Try to get more detailed information if the agent has a getStatus method
      if (agent.getStatus && typeof agent.getStatus === 'function') {
        try {
          const status = await agent.getStatus();
          result.agents[agentName] = {
            ...result.agents[agentName],
            ...status
          };
        } catch (error) {
          logger.error(`Error getting status from ${agentName}: ${error.message}`);
        }
      }
      
      // Get agent memory if available
      try {
        const memory = await memoryManager.loadMemory(agentName);
        if (memory) {
          result.agents[agentName].memory = {
            sessionCount: Object.keys(memory.sessions || {}).length,
            lastSession: memory.sessions ? Object.values(memory.sessions).pop() : null
          };
        }
      } catch (error) {
        logger.error(`Error loading memory for ${agentName}: ${error.message}`);
      }
    }
    
    return result;
  }

  /**
   * Generates a summary of the system logs
   * @param {string} logDir - Directory containing logs
   * @param {string} outputFile - Output file for the summary
   * @returns {Promise<string>} Path to the generated summary file
   */
  async generateLogSummary(logDir = 'logs', outputFile = 'logs/summary.md') {
    logger.info(`Generating log summary from ${logDir} to ${outputFile}`);
    
    try {
      // Collect log files
      const logFiles = await this._collectLogFiles(logDir);
      
      if (!logFiles || logFiles.length === 0) {
        logger.warn('No log files found');
        return null;
      }
      
      // Create a summary object
      const summary = {
        timestamp: new Date().toISOString(),
        logFiles: logFiles.length,
        recentLogs: []
      };
      
      // Process the most recent log files (limit to 10)
      const recentLogFiles = logFiles.slice(0, 10);
      
      for (const logFile of recentLogFiles) {
        try {
          const content = await fs.readFile(logFile.path, 'utf8');
          
          // Extract the last 20 lines from each log
          const lines = content.split('\n');
          const lastLines = lines.slice(-20);
          
          summary.recentLogs.push({
            file: logFile.name,
            size: logFile.size,
            lastUpdated: logFile.mtime,
            lastLines
          });
        } catch (error) {
          logger.error(`Error reading log file ${logFile.path}: ${error.message}`);
        }
      }
      
      // Use AI to generate insights from the logs
      let insights = '';
      
      try {
        // Prepare the prompt for the AI
        const prompt = `Analyze the following log data and provide a concise summary of what's happening in the system, any errors or issues that need attention, and any patterns you notice:
        
        ${JSON.stringify(summary, null, 2)}
        
        Provide your analysis in markdown format with the following sections:
        1. System Status Overview
        2. Issues Detected (if any)
        3. Recent Activity Summary
        `;
        
        // Call the AI engine
        const aiResponse = await aiEngine.generateText({
          provider: this.provider,
          model: this.model,
          prompt,
          max_tokens: 1000
        });
        
        insights = aiResponse.trim();
      } catch (error) {
        logger.error(`Error generating AI insights for log summary: ${error.message}`);
        insights = "Error generating AI insights. Please check the logs manually.";
      }
      
      // Create the final summary
      const finalSummary = `# System Log Summary
      
Generated: ${new Date().toLocaleString()}

## Files Analyzed
Total log files: ${summary.logFiles}

${insights}

`;
      
      // Ensure the output directory exists
      await fs.ensureDir(path.dirname(outputFile));
      
      // Write the summary to the output file
      await fs.writeFile(outputFile, finalSummary, 'utf8');
      
      logger.info(`Log summary written to ${outputFile}`);
      
      return outputFile;
    } catch (error) {
      logger.error(`Error generating log summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates a report about the project
   * @param {string} projectPath - Path to the project
   * @param {string} outputFile - Output file for the report
   * @returns {Promise<string>} Path to the generated report file
   */
  async generateProjectReport(projectPath = 'workspace', outputFile = 'logs/project_report.md') {
    logger.info(`Generating project report for ${projectPath}`);
    
    try {
      // Verify the project path exists
      const fullProjectPath = path.resolve(projectPath);
      if (!await fs.pathExists(fullProjectPath)) {
        throw new Error(`Project path ${fullProjectPath} does not exist`);
      }
      
      // Collect project structure
      const structure = await this._getProjectStructure(fullProjectPath);
      
      // Get status from dev agent if available
      let devStatus = {};
      if (devAgent && devAgent.active && typeof devAgent.getProjectStatus === 'function') {
        try {
          devStatus = await devAgent.getProjectStatus(projectPath);
        } catch (error) {
          logger.error(`Error getting project status from dev agent: ${error.message}`);
        }
      }
      
      // Use AI to generate insights about the project
      let insights = '';
      
      try {
        // Prepare the prompt for the AI
        const prompt = `Analyze the following project structure and provide a concise summary of the project, its structure, and any recommendations:
        
        ${JSON.stringify(structure, null, 2)}
        
        ${Object.keys(devStatus).length > 0 ? `Additional project information: ${JSON.stringify(devStatus, null, 2)}` : ''}
        
        Provide your analysis in markdown format with the following sections:
        1. Project Overview
        2. Directory Structure Analysis
        3. Code Quality Assessment (if information is available)
        4. Recommendations (if any)
        `;
        
        // Call the AI engine
        const aiResponse = await aiEngine.generateText({
          provider: this.provider,
          model: this.model,
          prompt,
          max_tokens: 1500
        });
        
        insights = aiResponse.trim();
      } catch (error) {
        logger.error(`Error generating AI insights for project report: ${error.message}`);
        insights = "Error generating AI insights. Please analyze the project structure manually.";
      }
      
      // Create the final report
      const finalReport = `# Project Report: ${path.basename(fullProjectPath)}
      
Generated: ${new Date().toLocaleString()}

## Project Path
${fullProjectPath}

${insights}

`;
      
      // Ensure the output directory exists
      await fs.ensureDir(path.dirname(outputFile));
      
      // Write the report to the output file
      await fs.writeFile(outputFile, finalReport, 'utf8');
      
      logger.info(`Project report written to ${outputFile}`);
      
      return outputFile;
    } catch (error) {
      logger.error(`Error generating project report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates a summary of an agent's activities
   * @param {string} agentName - Name of the agent
   * @param {Object} options - Options for the summary
   * @returns {Promise<Object>} Summary data
   */
  async generateAgentSummary(agentName, options = {}) {
    logger.info(`Generating summary for agent: ${agentName}`);
    
    const { 
      period = 'all', // 'day', 'week', 'month', 'all'
      format = 'markdown', // 'markdown', 'json', 'text'
      detailed = false
    } = options;
    
    try {
      // Load agent memory
      const memory = await memoryManager.loadMemory(agentName);
      
      if (!memory || !memory.sessions) {
        logger.warn(`No memory data found for agent: ${agentName}`);
        return {
          agentName,
          timestamp: new Date().toISOString(),
          error: 'No memory data found for this agent'
        };
      }
      
      // Filter sessions based on the specified period
      const now = new Date();
      const filteredSessions = Object.values(memory.sessions).filter(session => {
        if (!session.startTime) return false;
        
        const sessionDate = new Date(session.startTime);
        
        switch (period) {
          case 'day':
            return sessionDate >= new Date(now.setDate(now.getDate() - 1));
          case 'week':
            return sessionDate >= new Date(now.setDate(now.getDate() - 7));
          case 'month':
            return sessionDate >= new Date(now.setMonth(now.getMonth() - 1));
          case 'all':
          default:
            return true;
        }
      });
      
      // Extract actions from the filtered sessions
      const actions = filteredSessions.flatMap(session => 
        (session.actions || []).map(action => ({
          ...action,
          sessionId: session.id || 'unknown'
        }))
      );
      
      // Calculate statistics
      const stats = this._calculateStats(actions);
      
      // Generate AI insights
      let insights = null;
      if (actions.length > 0) {
        insights = await this._generateInsights(agentName, actions, stats);
      }
      
      // Create the summary object
      const summaryData = {
        agentName,
        timestamp: new Date().toISOString(),
        period,
        sessionCount: filteredSessions.length,
        actionCount: actions.length,
        firstSession: filteredSessions.length > 0 ? filteredSessions[0].startTime : null,
        lastSession: filteredSessions.length > 0 ? filteredSessions[filteredSessions.length - 1].startTime : null,
        stats,
        insights
      };
      
      // Add detailed data if requested
      if (detailed) {
        summaryData.sessions = filteredSessions;
        summaryData.actions = actions;
      }
      
      // Format the summary according to the specified format
      const formattedSummary = await this._formatSummary(summaryData, format);
      
      return {
        ...summaryData,
        formatted: formattedSummary
      };
    } catch (error) {
      logger.error(`Error generating summary for agent ${agentName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generates a summary of the entire system
   * @param {Object} options - Options for the summary
   * @returns {Promise<Object>} System summary data
   */
  async generateSystemSummary(options = {}) {
    logger.info('Generating system summary');
    
    const { 
      period = 'day', // 'day', 'week', 'month', 'all'
      format = 'markdown', // 'markdown', 'json', 'text'
      detailed = false
    } = options;
    
    try {
      // Get list of all agents
      const agents = agentManager.getAgents();
      const agentNames = Object.keys(agents);
      
      // Collect agent summaries
      const agentSummaries = {};
      
      for (const agentName of agentNames) {
        try {
          // Skip generating detailed summaries to keep the system summary concise
          const agentSummary = await this.generateAgentSummary(agentName, {
            period,
            format: 'json', // Always use JSON for internal processing
            detailed: false
          });
          
          agentSummaries[agentName] = agentSummary;
        } catch (error) {
          logger.error(`Error generating summary for agent ${agentName}: ${error.message}`);
          agentSummaries[agentName] = {
            error: error.message
          };
        }
      }
      
      // Collect current agent status
      const agentStatus = await this.collectAgentsStatus();
      
      // Create system summary object
      const systemSummary = {
        timestamp: new Date().toISOString(),
        period,
        agentCount: agentNames.length,
        activeAgents: Object.values(agents).filter(agent => agent.active).length,
        agentSummaries,
        agentStatus
      };
      
      // Generate AI insights for the system
      systemSummary.insights = await this._generateSystemInsights(systemSummary);
      
      // Format the summary according to the specified format
      const formattedSummary = await this._formatSystemSummary(systemSummary, format);
      
      return {
        ...systemSummary,
        formatted: formattedSummary
      };
    } catch (error) {
      logger.error(`Error generating system summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reports an issue for tracking
   * @param {string} issueType - Type of issue
   * @param {Object} issueData - Data about the issue
   * @returns {Promise<Object>} Issue report data
   */
  async reportIssue(issueType, issueData) {
    logger.info(`Reporting issue of type: ${issueType}`);
    
    try {
      // Ensure the agent is active
      if (!this.active) {
        await this.start();
      }
      
      // Create issue report
      const report = {
        id: `issue_${uuidv4()}`,
        type: issueType,
        timestamp: new Date().toISOString(),
        data: issueData,
        status: 'reported'
      };
      
      // Save to memory
      const memory = await memoryManager.loadMemory('system_issues') || { issues: [] };
      memory.issues.push(report);
      await memoryManager.saveMemory('system_issues', memory);
      
      // Save detailed report to file
      const issueDir = path.join('logs', 'issues');
      await fs.ensureDir(issueDir);
      
      const reportFile = path.join(issueDir, `${report.id}.json`);
      await fs.writeJson(reportFile, report, { spaces: 2 });
      
      logger.info(`Issue reported and saved to ${reportFile}`);
      
      // Log to summary agent's memory
      await this.logEvent('issue_reported', {
        issueId: report.id,
        issueType,
        timestamp: report.timestamp
      });
      
      return report;
    } catch (error) {
      logger.error(`Error reporting issue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Logs an event to the summary agent's memory
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Data about the event
   */
  async logEvent(eventType, eventData) {
    // Make sure the agent is active
    if (!this.active) {
      await this.start();
    }
    
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data: eventData
    };
    
    // Log to memory
    const memory = await memoryManager.loadMemory(this.name) || { events: [] };
    if (!memory.events) memory.events = [];
    memory.events.push(event);
    await memoryManager.saveMemory(this.name, memory);
    
    logger.debug(`Event logged: ${eventType}`);
    return event;
  }

  /**
   * Collects log files from a directory
   * @param {string} logDir - Directory containing logs
   * @returns {Promise<Array>} Array of log file objects
   * @private
   */
  async _collectLogFiles(logDir) {
    const logFiles = [];
    
    async function scanDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDir(entryPath);
        } else if (entry.isFile() && (entry.name.endsWith('.log') || entry.name.endsWith('.txt'))) {
          const stats = await fs.stat(entryPath);
          
          logFiles.push({
            name: entry.name,
            path: entryPath,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      }
    }
    
    await scanDir(logDir);
    
    // Sort by modification time, newest first
    logFiles.sort((a, b) => b.mtime - a.mtime);
    
    return logFiles;
  }

  /**
   * Gets the structure of a project directory
   * @param {string} projectDir - Project directory
   * @returns {Promise<Object>} Project structure object
   * @private
   */
  async _getProjectStructure(projectDir) {
    const structure = {
      name: path.basename(projectDir),
      path: projectDir,
      size: 0,
      type: 'directory',
      children: []
    };
    
    async function scanDir(dir, isRoot = false) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const result = [];
      
      // Skip node_modules and other large standard directories
      if (isRoot) {
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
        entries = entries.filter(entry => !skipDirs.includes(entry.name));
      }
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        // Skip hidden files
        if (entry.name.startsWith('.') && !isRoot) continue;
        
        if (entry.isDirectory()) {
          // For directories, scan recursively
          const children = await scanDir(entryPath);
          
          // Calculate directory size based on children
          const size = children.reduce((total, child) => total + (child.size || 0), 0);
          
          result.push({
            name: entry.name,
            path: entryPath,
            type: 'directory',
            size,
            children
          });
        } else if (entry.isFile()) {
          // For files, get stats
          const stats = await fs.stat(entryPath);
          const ext = path.extname(entry.name).toLowerCase();
          
          // Determine file type based on extension
          let fileType = 'unknown';
          if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) fileType = 'javascript';
          else if (['.html', '.css'].includes(ext)) fileType = 'web';
          else if (['.json', '.yaml', '.yml', '.xml'].includes(ext)) fileType = 'config';
          else if (['.md', '.txt'].includes(ext)) fileType = 'documentation';
          
          result.push({
            name: entry.name,
            path: entryPath,
            type: 'file',
            fileType,
            extension: ext,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
      
      return result;
    }
    
    structure.children = await scanDir(projectDir, true);
    structure.size = structure.children.reduce((total, child) => total + (child.size || 0), 0);
    
    // Add summary info
    const fileTypes = {};
    let totalFiles = 0;
    
    function countFiles(items) {
      for (const item of items) {
        if (item.type === 'file') {
          totalFiles++;
          fileTypes[item.fileType] = (fileTypes[item.fileType] || 0) + 1;
        } else if (item.children) {
          countFiles(item.children);
        }
      }
    }
    
    countFiles(structure.children);
    
    structure.summary = {
      totalFiles,
      fileTypes,
      totalSize: structure.size
    };
    
    return structure;
  }

  /**
   * Calculates statistics from agent actions
   * @param {Array} actions - List of agent actions
   * @returns {Object} Statistics object
   * @private
   */
  _calculateStats(actions) {
    const stats = {
      totalActions: actions.length,
      actionsByType: {},
      actionsByCategory: {},
      successRate: 0,
      avgDuration: 0
    };
    
    if (actions.length === 0) return stats;
    
    // Count actions by type
    actions.forEach(action => {
      const type = action.type || 'unknown';
      stats.actionsByType[type] = (stats.actionsByType[type] || 0) + 1;
      
      // Categorize actions
      const category = this._categorizeAction(action.description || action.type || '');
      stats.actionsByCategory[category] = (stats.actionsByCategory[category] || 0) + 1;
    });
    
    // Calculate success rate
    const successfulActions = actions.filter(action => 
      action.result && action.result.success === true
    ).length;
    
    stats.successRate = actions.length > 0 ? (successfulActions / actions.length) * 100 : 0;
    
    // Calculate average duration if available
    const actionsWithDuration = actions.filter(action => 
      action.result && typeof action.result.duration === 'number'
    );
    
    if (actionsWithDuration.length > 0) {
      const totalDuration = actionsWithDuration.reduce((sum, action) => 
        sum + action.result.duration
      , 0);
      
      stats.avgDuration = totalDuration / actionsWithDuration.length;
    }
    
    return stats;
  }

  /**
   * Categorizes an action based on its description
   * @param {string} description - Action description
   * @returns {string} Category name
   * @private
   */
  _categorizeAction(description) {
    description = description.toLowerCase();
    
    if (description.includes('start') || description.includes('initialize') || description.includes('init')) {
      return 'initialization';
    } else if (description.includes('stop') || description.includes('shutdown') || description.includes('exit')) {
      return 'shutdown';
    } else if (description.includes('analyze') || description.includes('review') || description.includes('check')) {
      return 'analysis';
    } else if (description.includes('fix') || description.includes('repair') || description.includes('resolve')) {
      return 'fixes';
    } else if (description.includes('generate') || description.includes('create') || description.includes('build')) {
      return 'generation';
    } else if (description.includes('sync') || description.includes('pull') || description.includes('push')) {
      return 'synchronization';
    } else if (description.includes('execute') || description.includes('run') || description.includes('perform')) {
      return 'execution';
    } else {
      return 'other';
    }
  }

  /**
   * Generates insights from agent actions using AI
   * @param {string} agentName - Name of the agent
   * @param {Array} actions - List of agent actions
   * @param {Object} stats - Statistics object
   * @returns {Promise<string>} Insights text
   * @private
   */
  async _generateInsights(agentName, actions, stats) {
    try {
      // Prepare a summary of actions for the AI
      const recentActions = actions.slice(-20); // Use only the 20 most recent actions
      
      const actionSummary = recentActions.map(action => ({
        type: action.type,
        timestamp: action.timestamp,
        description: action.description,
        success: action.result ? action.result.success : null,
        error: action.result && action.result.error ? action.result.error : null
      }));
      
      // Create prompt for the AI
      const prompt = `As an AI assistant, analyze the following data about the agent "${agentName}" and provide insights:

Statistics:
${JSON.stringify(stats, null, 2)}

Recent actions:
${JSON.stringify(actionSummary, null, 2)}

Please provide insights about:
1. What is this agent primarily doing?
2. How successful has it been in its actions?
3. Are there any patterns or issues you can identify?
4. What recommendations would you give for improving the agent's performance?

Provide your analysis in 3-5 short paragraphs, focusing on the most important observations.`;
      
      // Call the AI engine
      const aiResponse = await aiEngine.generateText({
        provider: this.provider,
        model: this.model,
        prompt,
        max_tokens: 800
      });
      
      return aiResponse.trim();
    } catch (error) {
      logger.error(`Error generating insights: ${error.message}`);
      return "Error generating insights with AI. Please review the agent's activity manually.";
    }
  }

  /**
   * Generates insights about the system using AI
   * @param {Object} systemSummary - System summary object
   * @returns {Promise<string>} Insights text
   * @private
   */
  async _generateSystemInsights(systemSummary) {
    try {
      // Prepare a simplified summary for the AI
      const simplifiedSummary = {
        agentCount: systemSummary.agentCount,
        activeAgents: systemSummary.activeAgents,
        timestamp: systemSummary.timestamp,
        period: systemSummary.period,
        agentSummaries: {}
      };
      
      // Simplify agent summaries
      for (const agentName in systemSummary.agentSummaries) {
        const summary = systemSummary.agentSummaries[agentName];
        
        simplifiedSummary.agentSummaries[agentName] = {
          actionCount: summary.actionCount || 0,
          sessionCount: summary.sessionCount || 0,
          successRate: summary.stats ? summary.stats.successRate : null,
          lastSession: summary.lastSession,
          error: summary.error
        };
      }
      
      // Create prompt for the AI
      const prompt = `As an AI assistant, analyze the following system summary data and provide insights:

System Summary:
${JSON.stringify(simplifiedSummary, null, 2)}

Agent Status:
${JSON.stringify(systemSummary.agentStatus.agents, null, 2)}

Please provide insights about:
1. Overall system health and activity levels
2. Which agents are most active and successful
3. Any issues or anomalies detected
4. Recommendations for improving system performance
5. What appears to be the main focus of the system recently

Provide your analysis in 3-5 short paragraphs, focusing on the most important observations.`;
      
      // Call the AI engine
      const aiResponse = await aiEngine.generateText({
        provider: this.provider,
        model: this.model,
        prompt,
        max_tokens: 1000
      });
      
      return aiResponse.trim();
    } catch (error) {
      logger.error(`Error generating system insights: ${error.message}`);
      return "Error generating system insights with AI. Please review the system summary manually.";
    }
  }

  /**
   * Formats the summary according to the specified format
   * @param {Object} summaryData - Summary data
   * @param {string} format - Output format (markdown, json, text)
   * @returns {Promise<string>} Formatted summary
   * @private
   */
  async _formatSummary(summaryData, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(summaryData, null, 2);
        
      case 'text':
        return `Agent Summary: ${summaryData.agentName}
Generated: ${new Date(summaryData.timestamp).toLocaleString()}
Period: ${summaryData.period}

Sessions: ${summaryData.sessionCount}
Actions: ${summaryData.actionCount}
First Session: ${summaryData.firstSession ? new Date(summaryData.firstSession).toLocaleString() : 'N/A'}
Last Session: ${summaryData.lastSession ? new Date(summaryData.lastSession).toLocaleString() : 'N/A'}

Statistics:
- Success Rate: ${summaryData.stats.successRate.toFixed(2)}%
- Average Duration: ${summaryData.stats.avgDuration.toFixed(2)} ms

Action Types:
${Object.entries(summaryData.stats.actionsByType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

Categories:
${Object.entries(summaryData.stats.actionsByCategory).map(([category, count]) => `- ${category}: ${count}`).join('\n')}

Insights:
${summaryData.insights || 'No insights available.'}
`;
        
      case 'markdown':
      default:
        return `# Agent Summary: ${summaryData.agentName}

*Generated: ${new Date(summaryData.timestamp).toLocaleString()}*
*Period: ${summaryData.period}*

## Overview
- **Sessions:** ${summaryData.sessionCount}
- **Actions:** ${summaryData.actionCount}
- **First Session:** ${summaryData.firstSession ? new Date(summaryData.firstSession).toLocaleString() : 'N/A'}
- **Last Session:** ${summaryData.lastSession ? new Date(summaryData.lastSession).toLocaleString() : 'N/A'}

## Statistics
- **Success Rate:** ${summaryData.stats.successRate.toFixed(2)}%
- **Average Duration:** ${summaryData.stats.avgDuration.toFixed(2)} ms

### Action Types
${Object.entries(summaryData.stats.actionsByType).map(([type, count]) => `- **${type}:** ${count}`).join('\n')}

### Categories
${Object.entries(summaryData.stats.actionsByCategory).map(([category, count]) => `- **${category}:** ${count}`).join('\n')}

## Insights
${summaryData.insights || 'No insights available.'}
`;
    }
  }

  /**
   * Formats the system summary according to the specified format
   * @param {Object} systemSummary - System summary data
   * @param {string} format - Output format (markdown, json, text)
   * @returns {Promise<string>} Formatted summary
   * @private
   */
  async _formatSystemSummary(systemSummary, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(systemSummary, null, 2);
        
      case 'text':
        let textSummary = `System Summary
Generated: ${new Date(systemSummary.timestamp).toLocaleString()}
Period: ${systemSummary.period}

Total Agents: ${systemSummary.agentCount}
Active Agents: ${systemSummary.activeAgents}

Agent Summaries:
`;
        
        for (const agentName in systemSummary.agentSummaries) {
          const summary = systemSummary.agentSummaries[agentName];
          
          textSummary += `\n${agentName}:
- Actions: ${summary.actionCount || 0}
- Sessions: ${summary.sessionCount || 0}
- Success Rate: ${summary.stats && summary.stats.successRate ? summary.stats.successRate.toFixed(2) + '%' : 'N/A'}
- Last Session: ${summary.lastSession ? new Date(summary.lastSession).toLocaleString() : 'N/A'}
${summary.error ? '- Error: ' + summary.error : ''}
`;
        }
        
        textSummary += `\nInsights:
${systemSummary.insights || 'No insights available.'}`;
        
        return textSummary;
        
      case 'markdown':
      default:
        let mdSummary = `# System Summary

*Generated: ${new Date(systemSummary.timestamp).toLocaleString()}*
*Period: ${systemSummary.period}*

## Overview
- **Total Agents:** ${systemSummary.agentCount}
- **Active Agents:** ${systemSummary.activeAgents}

## Agent Summaries

`;
        
        for (const agentName in systemSummary.agentSummaries) {
          const summary = systemSummary.agentSummaries[agentName];
          
          mdSummary += `### ${agentName}
- **Actions:** ${summary.actionCount || 0}
- **Sessions:** ${summary.sessionCount || 0}
- **Success Rate:** ${summary.stats && summary.stats.successRate ? summary.stats.successRate.toFixed(2) + '%' : 'N/A'}
- **Last Session:** ${summary.lastSession ? new Date(summary.lastSession).toLocaleString() : 'N/A'}
${summary.error ? '- **Error:** ' + summary.error : ''}

`;
        }
        
        mdSummary += `## Insights
${systemSummary.insights || 'No insights available.'}`;
        
        return mdSummary;
    }
  }
}

module.exports = new SummaryAgent(); 