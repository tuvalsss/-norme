const aiEngine = require('../core/aiEngine');
const fileManager = require('../core/fileManager');
const { createAgentLogger } = require('../core/logger');
const path = require('path');
const fs = require('fs-extra');
const memoryManager = require('../core/memoryManager');
const agentManager = require('../core/agentManager');
const { v4: uuidv4 } = require('uuid');

// ╫ש╫ש╫ס╫ץ╫נ ╫í╫ץ╫¢╫á╫ש╫¥ ╫נ╫ק╫¿╫ש╫¥ ╫£╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ץ╫í
const devAgent = require('./dev_agent');
const qaAgent = require('./qa');
const executorAgent = require('./executor');

// ╫ª╫ץ╫¿ logger ╫ש╫ש╫ó╫ץ╫ף╫ש ╫£╫í╫ץ╫¢╫ƒ ╫פ╫í╫ש╫¢╫ץ╫¥
const logger = createAgentLogger('summary_agent');

/**
 * ╫í╫ץ╫¢╫ƒ ╫í╫ש╫¢╫ץ╫¥ ╫⌐╫נ╫ץ╫í╫ú ╫í╫ר╫ר╫ץ╫í, ╫¢╫ץ╫¬╫ס ╫£╫ץ╫ע╫ש╫¥ ╫ץ╫ף╫ץ╫ק╫ץ╫¬
 */
class SummaryAgent {
  constructor() {
    this.name = 'summary_agent';
    this.active = false;
    this.provider = 'anthropic'; // ╫í╫ñ╫º ╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£
    this.model = 'claude-3-haiku';  // ╫₧╫ץ╫ף╫£ ╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£ (╫º╫£ ╫ש╫ץ╫¬╫¿ ╫£╫í╫ש╫¢╫ץ╫₧╫ש╫¥)
    this.isRunning = false;
    this.currentSummaryId = null;
    
    logger.info('╫í╫ץ╫¢╫ƒ ╫í╫ש╫¢╫ץ╫¥ ╫נ╫ץ╫¬╫ק╫£');
  }

  /**
   * ╫₧╫ñ╫ó╫ש╫£ ╫נ╫¬ ╫פ╫í╫ץ╫¢╫ƒ
   * @returns {Promise<void>}
   */
  async start() {
    this.active = true;
    this.isRunning = true;
    this.currentSummaryId = `summary_${uuidv4()}`;
    
    // ╫¬╫ש╫ó╫ץ╫ף ╫ס╫₧╫á╫פ╫£ ╫פ╫צ╫ש╫¢╫¿╫ץ╫ƒ
    if (memoryManager && typeof memoryManager.logAction === 'function') {
      memoryManager.logAction(this.name, 'Summary agent initialized');
    }
    
    logger.info('╫í╫ץ╫¢╫ƒ ╫í╫ש╫¢╫ץ╫¥ ╫פ╫ץ╫ñ╫ó╫£');
    return true;
  }

  /**
   * ╫₧╫¢╫ס╫פ ╫נ╫¬ ╫פ╫í╫ץ╫¢╫ƒ
   * @returns {Promise<void>}
   */
  async stop() {
    this.active = false;
    this.isRunning = false;
    
    // ╫¬╫ש╫ó╫ץ╫ף ╫ס╫₧╫á╫פ╫£ ╫פ╫צ╫ש╫¢╫¿╫ץ╫ƒ
    if (memoryManager && typeof memoryManager.logAction === 'function') {
      memoryManager.logAction(this.name, 'Summary agent stopped');
    }
    
    logger.info('╫í╫ץ╫¢╫ƒ ╫í╫ש╫¢╫ץ╫¥ ╫¢╫ץ╫ס╫פ');
    return true;
  }

  /**
   * ╫נ╫ץ╫í╫ú ╫נ╫¬ ╫í╫ר╫ר╫ץ╫í ╫¢╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
   * @returns {Promise<Object>} - ╫í╫ר╫ר╫ץ╫í ╫¢╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
   */
  async collectAgentsStatus() {
    logger.info('╫נ╫ץ╫í╫ú ╫í╫ר╫ר╫ץ╫í ╫₧╫¢╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥');
    
    try {
      const status = {
        timestamp: new Date().toISOString(),
        agents: {
          dev: {
            active: devAgent.active,
            provider: devAgent.provider,
            model: devAgent.model
          },
          qa: {
            active: qaAgent.active,
            provider: qaAgent.provider,
            model: qaAgent.model
          },
          executor: await executorAgent.getStatus()
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        }
      };
      
      // ╫⌐╫₧╫ץ╫¿ ╫נ╫¬ ╫פ╫í╫ר╫ר╫ץ╫í ╫£╫º╫ץ╫ס╫Ñ ╫£╫ץ╫ע
      const logFileName = `status_${new Date().toISOString().replace(/:/g, '-')}.json`;
      const logPath = `logs/summary_agent/${logFileName}`;
      await fileManager.writeFile(logPath, JSON.stringify(status, null, 2));
      
      logger.info(`╫í╫ר╫ר╫ץ╫í ╫á╫נ╫í╫ú ╫ץ╫á╫⌐╫₧╫¿ ╫ס: ${logPath}`);
      return status;
      
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫נ╫ש╫í╫ץ╫ú ╫í╫ר╫ר╫ץ╫í: ${error.message}`);
      throw error;
    }
  }

  /**
   * ╫₧╫á╫¬╫ק ╫º╫ס╫ª╫ש ╫£╫ץ╫ע ╫ץ╫¢╫ץ╫¬╫ס ╫ף╫ץ╫ק ╫í╫ש╫¢╫ץ╫¥
   * @param {string} logDir - ╫¬╫ש╫º╫ש╫ש╫¬ ╫פ╫£╫ץ╫ע╫ש╫¥ ╫£╫á╫ש╫¬╫ץ╫ק
   * @param {string} outputFile - ╫º╫ץ╫ס╫Ñ ╫פ╫ñ╫£╫ר ╫£╫ף╫ץ╫ק
   * @returns {Promise<string>} - ╫¬╫ץ╫¢╫ƒ ╫פ╫ף╫ץ╫ק
   */
  async generateLogSummary(logDir = 'logs', outputFile = 'logs/summary.md') {
    logger.info(`╫₧╫á╫¬╫ק ╫£╫ץ╫ע╫ש╫¥ ╫ס╫¬╫ש╫º╫ש╫ש╫פ: ${logDir}`);
    
    try {
      // ╫נ╫í╫ץ╫ú ╫נ╫¬ ╫¢╫£ ╫º╫ס╫ª╫ש ╫פ╫£╫ץ╫ע
      const logFiles = await this._collectLogFiles(logDir);
      
      // ╫נ╫¥ ╫נ╫ש╫ƒ ╫º╫ס╫ª╫ש ╫£╫ץ╫ע, ╫פ╫ק╫צ╫¿ ╫פ╫ץ╫ף╫ó╫פ
      if (logFiles.length === 0) {
        const noLogsMessage = '╫£╫נ ╫á╫₧╫ª╫נ╫ץ ╫º╫ס╫ª╫ש ╫£╫ץ╫ע ╫£╫á╫ש╫¬╫ץ╫ק.';
        await fileManager.writeFile(outputFile, noLogsMessage);
        return noLogsMessage;
      }
      
      // ╫º╫¿╫נ ╫¬╫ץ╫¢╫ƒ ╫₧╫ף╫ע╫₧╫ש ╫₧╫º╫ס╫ª╫ש ╫פ╫£╫ץ╫ע (╫₧╫ץ╫ע╫ס╫£ ╫£╫¢╫₧╫פ ╫⌐╫ץ╫¿╫ץ╫¬ ╫₧╫¢╫£ ╫º╫ץ╫ס╫Ñ)
      const logSamples = {};
      const MAX_LINES = 50; // ╫₧╫º╫í╫ש╫₧╫ץ╫¥ ╫⌐╫ץ╫¿╫ץ╫¬ ╫£╫º╫¿╫ש╫נ╫פ ╫₧╫¢╫£ ╫º╫ץ╫ס╫Ñ
      
      for (const file of logFiles.slice(0, 20)) { // ╫פ╫ע╫ס╫£ ╫£-20 ╫º╫ס╫ª╫ש╫¥
        try {
          const content = await fileManager.readFile(file);
          // ╫º╫ק ╫¿╫º ╫נ╫¬ ╫פ╫⌐╫ץ╫¿╫ץ╫¬ ╫פ╫¿╫נ╫⌐╫ץ╫á╫ץ╫¬
          const lines = content.split('\n').slice(0, MAX_LINES);
          logSamples[file] = lines.join('\n');
        } catch (error) {
          logger.warn(`╫£╫נ ╫á╫ש╫¬╫ƒ ╫£╫º╫¿╫ץ╫נ ╫º╫ץ╫ס╫Ñ ╫£╫ץ╫ע ${file}: ${error.message}`);
          logSamples[file] = '╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫¿╫ש╫נ╫¬ ╫º╫ץ╫ס╫Ñ';
        }
      }
      
      // ╫פ╫¢╫ƒ ╫נ╫¬ ╫פ-prompt ╫£╫í╫ש╫¢╫ץ╫¥
      const prompt = `
        ╫נ╫á╫נ ╫á╫¬╫ק ╫נ╫¬ ╫º╫ס╫ª╫ש ╫פ╫£╫ץ╫ע ╫פ╫ס╫נ╫ש╫¥ ╫ץ╫í╫ñ╫º ╫í╫ש╫¢╫ץ╫¥ ╫¬╫₧╫ª╫ש╫¬╫ש.
        ╫ó╫ס╫ץ╫¿ ╫¢╫£ ╫º╫ץ╫ס╫Ñ ╫£╫ץ╫ע, ╫¬╫ƒ ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬ ╫₧╫ñ╫¬╫ק ╫ץ╫₧╫ש╫ף╫ó ╫¿╫£╫ץ╫ץ╫á╫ר╫ש.
        
        ╫º╫ס╫ª╫ש ╫£╫ץ╫ע ╫£╫á╫ש╫¬╫ץ╫ק:
        ${Object.keys(logSamples).map(file => `- ${file}`).join('\n')}
        
        ╫ף╫ץ╫ע╫₧╫נ╫ץ╫¬ ╫¬╫ץ╫¢╫ƒ ╫⌐╫£ ╫º╫ץ╫ס╫ª╫ש ╫פ╫£╫ץ╫ע:
        ${Object.entries(logSamples).map(([file, content]) => 
          `## ${file}\n\`\`\`\n${content}\n\`\`\``
        ).join('\n\n')}
        
        ╫נ╫á╫נ ╫¢╫£╫ץ╫£ ╫ס╫í╫ש╫¢╫ץ╫¥:
        1. ╫₧╫í╫ñ╫¿ ╫¢╫ץ╫£╫£ ╫⌐╫£ ╫º╫ס╫ª╫ש ╫£╫ץ╫ע
        2. ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫ó╫ש╫º╫¿╫ש╫¬ ╫£╫ñ╫ש ╫í╫ץ╫ע ╫í╫ץ╫¢╫ƒ
        3. ╫⌐╫ע╫ש╫נ╫ץ╫¬ ╫נ╫ץ ╫ס╫ó╫ש╫ץ╫¬ ╫⌐╫צ╫ץ╫פ╫ץ
        4. ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬ ╫ק╫⌐╫ץ╫ס╫ץ╫¬ (╫¢╫₧╫ץ ╫פ╫ª╫£╫ק╫ץ╫¬/╫¢╫⌐╫£╫ץ╫á╫ץ╫¬)
        5. ╫פ╫₧╫£╫ª╫ץ╫¬ ╫£╫פ╫₧╫⌐╫ת ╫ó╫£ ╫í╫₧╫ת ╫פ╫₧╫₧╫ª╫נ╫ש╫¥
        
        ╫ñ╫£╫ר ╫ס╫ñ╫ץ╫¿╫₧╫ר Markdown.
      `;
      
      // ╫פ╫ñ╫ó╫£ ╫נ╫¬ ╫₧╫á╫ץ╫ó ╫פ-AI ╫£╫í╫ש╫¢╫ץ╫¥
      const summary = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // ╫פ╫ץ╫í╫ú ╫¢╫ץ╫¬╫¿╫¬ ╫ץ╫צ╫₧╫ƒ
      const fullSummary = `# ╫í╫ש╫¢╫ץ╫¥ ╫£╫ץ╫ע╫ש╫¥
╫¬╫נ╫¿╫ש╫ת: ${new Date().toLocaleDateString()}
╫צ╫₧╫ƒ: ${new Date().toLocaleTimeString()}

${summary}`;
      
      // ╫⌐╫₧╫ץ╫¿ ╫נ╫¬ ╫פ╫í╫ש╫¢╫ץ╫¥
      await fileManager.writeFile(outputFile, fullSummary);
      
      logger.info(`╫í╫ש╫¢╫ץ╫¥ ╫£╫ץ╫ע╫ש╫¥ ╫á╫ץ╫ª╫¿ ╫ץ╫á╫⌐╫₧╫¿ ╫ס: ${outputFile}`);
      return fullSummary;
      
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ש╫ª╫ש╫¿╫¬ ╫í╫ש╫¢╫ץ╫¥ ╫£╫ץ╫ע╫ש╫¥: ${error.message}`);
      throw error;
    }
  }

  /**
   * ╫ש╫ץ╫ª╫¿ ╫ף╫ץ╫ק ╫í╫ר╫ר╫ץ╫í ╫ñ╫¿╫ץ╫ש╫º╫ר ╫₧╫£╫נ
   * @param {string} projectPath - ╫á╫¬╫ש╫ס ╫£╫¬╫ש╫º╫ש╫ש╫¬ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
   * @param {string} outputFile - ╫º╫ץ╫ס╫Ñ ╫פ╫ñ╫£╫ר ╫£╫ף╫ץ╫ק
   * @returns {Promise<string>} - ╫¬╫ץ╫¢╫ƒ ╫פ╫ף╫ץ╫ק
   */
  async generateProjectReport(projectPath = 'workspace', outputFile = 'logs/project_report.md') {
    logger.info(`╫₧╫ש╫ש╫ª╫¿ ╫ף╫ץ╫ק ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ó╫ס╫ץ╫¿: ${projectPath}`);
    
    try {
      // ╫נ╫í╫ץ╫ú ╫₧╫ש╫ף╫ó ╫ó╫£ ╫₧╫ס╫á╫פ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
      const filesInfo = await this._getProjectStructure(projectPath);
      
      // ╫נ╫í╫ץ╫ú ╫í╫ר╫ר╫ץ╫í ╫í╫ץ╫¢╫á╫ש╫¥
      const agentsStatus = await this.collectAgentsStatus();
      
      // ╫פ╫¢╫ƒ ╫נ╫¬ ╫פ-prompt
      const prompt = `
        ╫נ╫á╫נ ╫ª╫ץ╫¿ ╫ף╫ץ╫ק ╫í╫ר╫ר╫ץ╫í ╫ñ╫¿╫ץ╫ש╫º╫ר ╫₧╫ñ╫ץ╫¿╫ר ╫ס╫פ╫¬╫ס╫í╫í ╫ó╫£ ╫פ╫₧╫ש╫ף╫ó ╫פ╫ס╫נ:
        
        ## ╫₧╫ס╫á╫פ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
        ${JSON.stringify(filesInfo, null, 2)}
        
        ## ╫í╫ר╫ר╫ץ╫í ╫í╫ץ╫¢╫á╫ש╫¥
        ${JSON.stringify(agentsStatus, null, 2)}
        
        ╫פ╫ף╫ץ╫ק ╫ª╫¿╫ש╫ת ╫£╫¢╫£╫ץ╫£:
        1. ╫í╫º╫ש╫¿╫פ ╫¢╫£╫£╫ש╫¬ ╫⌐╫£ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
        2. ╫₧╫ש╫ף╫ó ╫ó╫£ ╫פ╫º╫ס╫ª╫ש╫¥ ╫ץ╫פ╫¬╫ש╫º╫ש╫ץ╫¬ ╫פ╫ó╫ש╫º╫¿╫ש╫ש╫¥
        3. ╫í╫ר╫ר╫ץ╫í ╫ó╫ף╫¢╫á╫ש ╫⌐╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫פ╫⌐╫ץ╫á╫ש╫¥
        4. ╫ס╫ó╫ש╫ץ╫¬ ╫ש╫ף╫ץ╫ó╫ץ╫¬ ╫נ╫ץ ╫נ╫¬╫ע╫¿╫ש╫¥
        5. ╫ª╫ó╫ף╫ש╫¥ ╫₧╫ץ╫₧╫£╫ª╫ש╫¥ ╫£╫פ╫₧╫⌐╫ת
        
        ╫ñ╫£╫ר ╫ס╫ñ╫ץ╫¿╫₧╫ר Markdown ╫ó╫¥ ╫¢╫ץ╫¬╫¿╫ץ╫¬, ╫í╫ó╫ש╫ñ╫ש╫¥ ╫ץ╫ס╫£╫ש╫ר╫ש╫¥.
      `;
      
      // ╫פ╫ñ╫ó╫£ ╫נ╫¬ ╫₧╫á╫ץ╫ó ╫פ-AI ╫£╫ש╫ª╫ש╫¿╫¬ ╫פ╫ף╫ץ╫ק
      const report = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // ╫פ╫ץ╫í╫ú ╫¢╫ץ╫¬╫¿╫¬ ╫¿╫נ╫⌐╫ש╫¬ ╫ץ╫₧╫ש╫ף╫ó ╫ó╫£ ╫צ╫₧╫ƒ
      const fullReport = `# ╫ף╫ץ╫ק ╫í╫ר╫ר╫ץ╫í ╫ñ╫¿╫ץ╫ש╫º╫ר
╫¬╫נ╫¿╫ש╫ת: ${new Date().toLocaleDateString()}
╫צ╫₧╫ƒ: ${new Date().toLocaleTimeString()}

${report}`;
      
      // ╫⌐╫₧╫ץ╫¿ ╫נ╫¬ ╫פ╫ף╫ץ╫ק
      await fileManager.writeFile(outputFile, fullReport);
      
      logger.info(`╫ף╫ץ╫ק ╫ñ╫¿╫ץ╫ש╫º╫ר ╫á╫ץ╫ª╫¿ ╫ץ╫á╫⌐╫₧╫¿ ╫ס: ${outputFile}`);
      return fullReport;
      
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ש╫ª╫ש╫¿╫¬ ╫ף╫ץ╫ק ╫ñ╫¿╫ץ╫ש╫º╫ר: ${error.message}`);
      throw error;
    }
  }

  /**
   * ╫ש╫ª╫ש╫¿╫¬ ╫í╫ש╫¢╫ץ╫¥ ╫£╫ñ╫ó╫ש╫£╫ץ╫¬ ╫í╫ץ╫¢╫ƒ ╫₧╫í╫ץ╫ש╫¥
   * @param {string} agentName - ╫⌐╫¥ ╫פ╫í╫ץ╫¢╫ƒ ╫£╫í╫ש╫¢╫ץ╫¥
   * @param {object} options - ╫נ╫ñ╫⌐╫¿╫ץ╫ש╫ץ╫¬ ╫í╫ש╫¢╫ץ╫¥
   * @param {number} options.timePeriod - ╫¬╫º╫ץ╫ñ╫¬ ╫צ╫₧╫ƒ ╫£╫í╫ש╫¢╫ץ╫¥ ╫ס╫⌐╫ó╫ץ╫¬ (╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£: 24)
   * @param {boolean} options.includeInsights - ╫פ╫נ╫¥ ╫£╫¢╫£╫ץ╫£ ╫¬╫ץ╫ס╫á╫ץ╫¬ (╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£: true)
   * @param {string} options.format - ╫ñ╫ץ╫¿╫₧╫ר ╫פ╫¬╫ץ╫ª╫נ╫פ (json/text/markdown, ╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£: markdown)
   * @returns {Promise<object>} - ╫¬╫ץ╫ª╫נ╫ץ╫¬ ╫פ╫í╫ש╫¢╫ץ╫¥
   */
  async generateAgentSummary(agentName, options = {}) {
    if (!this.active) {
      await this.start();
    }

    try {
      const timePeriod = options.timePeriod || 24;
      const includeInsights = options.includeInsights !== false;
      const format = options.format || 'markdown';
      
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        memoryManager.logAction(
          this.name, 
          `Generating summary for agent ${agentName} for the last ${timePeriod} hours`
        );
      }

      // ╫ר╫ó╫ש╫á╫¬ ╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫פ╫í╫ץ╫¢╫ƒ
      const agentMemory = await memoryManager.loadAgentMemory(agentName);
      if (!agentMemory || !agentMemory.sessions || !agentMemory.actions) {
        throw new Error(`No memory found for agent ${agentName}`);
      }

      // ╫í╫ש╫á╫ץ╫ƒ ╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫₧╫פ╫¬╫º╫ץ╫ñ╫פ ╫פ╫¿╫£╫ץ╫ץ╫á╫ר╫ש╫¬
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

      // ╫ק╫ש╫⌐╫ץ╫ס ╫₧╫ף╫ף╫ש╫¥ ╫í╫ר╫ר╫ש╫í╫ר╫ש╫ש╫¥
      const stats = this._calculateStats(recentActions);

      // ╫ס╫á╫ש╫ש╫¬ ╫₧╫í╫ף ╫á╫¬╫ץ╫á╫ש╫¥ ╫£╫í╫ש╫¢╫ץ╫¥
      const summaryData = {
        agent: agentName,
        period: `${timePeriod} hours`,
        timestamp: new Date().toISOString(),
        stats,
        actions: recentActions.length,
        firstAction: recentActions[0].timestamp,
        lastAction: recentActions[recentActions.length - 1].timestamp
      };

      // ╫פ╫ץ╫í╫ñ╫¬ ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫נ╫¥ ╫á╫ף╫¿╫⌐
      if (includeInsights) {
        summaryData.insights = await this._generateInsights(agentName, recentActions, stats);
      }

      // ╫ñ╫ץ╫¿╫₧╫ר ╫פ╫¬╫ץ╫ª╫נ╫פ
      const formattedSummary = await this._formatSummary(summaryData, format);
      
      // ╫⌐╫₧╫ש╫¿╫פ ╫ס╫צ╫ש╫¢╫¿╫ץ╫ƒ
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        await memoryManager.logAction(
          this.name, 
          `Generated summary for agent ${agentName}`, 
          true, 
          { summaryId: this.currentSummaryId }
        );
      }

      return formattedSummary;
    } catch (error) {
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        memoryManager.logAction(
          this.name, 
          `Error generating summary for agent ${agentName}: ${error.message}`, 
          false
        );
      }
      throw error;
    }
  }

  /**
   * ╫ש╫ª╫ש╫¿╫¬ ╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬ ╫¢╫ץ╫£╫£
   * @param {object} options - ╫נ╫ñ╫⌐╫¿╫ץ╫ש╫ץ╫¬ ╫í╫ש╫¢╫ץ╫¥
   * @param {number} options.timePeriod - ╫¬╫º╫ץ╫ñ╫¬ ╫צ╫₧╫ƒ ╫£╫í╫ש╫¢╫ץ╫¥ ╫ס╫⌐╫ó╫ץ╫¬ (╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£: 24)
   * @param {boolean} options.includeInsights - ╫פ╫נ╫¥ ╫£╫¢╫£╫ץ╫£ ╫¬╫ץ╫ס╫á╫ץ╫¬ (╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£: true)
   * @param {string} options.format - ╫ñ╫ץ╫¿╫₧╫ר ╫פ╫¬╫ץ╫ª╫נ╫פ (json/text/markdown, ╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£: markdown)
   * @returns {Promise<object>} - ╫¬╫ץ╫ª╫נ╫ץ╫¬ ╫פ╫í╫ש╫¢╫ץ╫¥
   */
  async generateSystemSummary(options = {}) {
    if (!this.active) {
      await this.start();
    }

    try {
      const timePeriod = options.timePeriod || 24;
      const includeInsights = options.includeInsights !== false;
      const format = options.format || 'markdown';
      
      // ╫¿╫⌐╫ש╫₧╫¬ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫£╫í╫ש╫¢╫ץ╫¥
      const agentNames = ['dev_agent', 'qa_agent', 'executor_agent', 'git_sync_agent'];
      
      // ╫ª╫ץ╫¿ ╫í╫ש╫¢╫ץ╫¥ ╫£╫¢╫£ ╫í╫ץ╫¢╫ƒ
      const agentSummaries = {};
      for (const agentName of agentNames) {
        try {
          const agentSummary = await this.generateAgentSummary(
            agentName, 
            { timePeriod, includeInsights, format: 'json' }
          );
          agentSummaries[agentName] = agentSummary;
        } catch (error) {
          logger.warn(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫í╫ש╫¢╫ץ╫¥ ╫פ╫í╫ץ╫¢╫ƒ ${agentName}: ${error.message}`);
          agentSummaries[agentName] = { error: error.message };
        }
      }
      
      // ╫ס╫á╫פ ╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬ ╫₧╫£╫נ
      const systemSummary = {
        timestamp: new Date().toISOString(),
        period: `${timePeriod} hours`,
        agents: agentSummaries,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      };
      
      // ╫פ╫ץ╫í╫ú ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬╫ש╫ץ╫¬ ╫נ╫¥ ╫á╫ף╫¿╫⌐
      if (includeInsights) {
        systemSummary.insights = await this._generateSystemInsights(systemSummary);
      }
      
      // ╫ñ╫ץ╫¿╫₧╫ר ╫£╫ñ╫£╫ר ╫פ╫¿╫ª╫ץ╫ש
      if (format === 'json') {
        return systemSummary;
      } else {
        return this._formatSystemSummary(systemSummary, format);
      }
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ש╫ª╫ש╫¿╫¬ ╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * ╫₧╫ף╫ץ╫ץ╫ק ╫ó╫£ ╫ס╫ó╫ש╫פ ╫נ╫ץ ╫¬╫º╫£╫פ ╫ס╫₧╫ó╫¿╫¢╫¬
   * @param {string} issueType - ╫í╫ץ╫ע ╫פ╫ס╫ó╫ש╫פ
   * @param {Object} issueData - ╫á╫¬╫ץ╫á╫ש ╫פ╫ס╫ó╫ש╫פ
   * @returns {Promise<void>}
   */
  async reportIssue(issueType, issueData) {
    try {
      logger.info(`╫₧╫ף╫ץ╫ץ╫ק ╫ó╫£ ╫ס╫ó╫ש╫פ ╫₧╫í╫ץ╫ע: ${issueType}`);
      
      // ╫¬╫ש╫ó╫ץ╫ף ╫פ╫ס╫ó╫ש╫פ ╫ס╫£╫ץ╫ע
      const issueReport = {
        type: issueType,
        timestamp: new Date().toISOString(),
        data: issueData
      };
      
      // ╫⌐╫₧╫ש╫¿╫¬ ╫פ╫ף╫ש╫ץ╫ץ╫ק
      const reportFileName = `issue_${issueType}_${new Date().toISOString().replace(/:/g, '-')}.json`;
      const reportPath = `logs/issues/${reportFileName}`;
      
      // ╫ץ╫ץ╫ף╫נ ╫⌐╫¬╫ש╫º╫ש╫ש╫¬ ╫פ╫ש╫ó╫ף ╫º╫ש╫ש╫₧╫¬
      await fs.ensureDir(path.dirname(reportPath));
      
      // ╫⌐╫₧╫ץ╫¿ ╫נ╫¬ ╫פ╫ף╫ץ╫ק
      await fs.writeJson(reportPath, issueReport, { spaces: 2 });
      
      // ╫¬╫ש╫ó╫ץ╫ף ╫ס╫צ╫ש╫¢╫¿╫ץ╫ƒ
      if (memoryManager && typeof memoryManager.logAction === 'function') {
        await memoryManager.logAction(
          this.name,
          `Reported issue: ${issueType}`,
          false,
          { issueType, reportPath }
        );
      }
      
      logger.info(`╫ף╫ץ╫ק ╫ס╫ó╫ש╫פ ╫á╫⌐╫₧╫¿ ╫ס: ${reportPath}`);
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ף╫ש╫ץ╫ץ╫ק ╫ó╫£ ╫ס╫ó╫ש╫פ: ${error.message}`);
      throw error;
    }
  }

  /**
   * ╫נ╫ץ╫í╫ú ╫נ╫¬ ╫¢╫£ ╫º╫ס╫ª╫ש ╫פ╫£╫ץ╫ע ╫₧╫¬╫ש╫º╫ש╫ש╫פ
   * @param {string} logDir - ╫¬╫ש╫º╫ש╫ש╫¬ ╫פ╫£╫ץ╫ע╫ש╫¥
   * @returns {Promise<string[]>} - ╫¿╫⌐╫ש╫₧╫¬ ╫á╫¬╫ש╫ס╫ש╫¥ ╫£╫º╫ס╫ª╫ש ╫פ╫£╫ץ╫ע
   * @private
   */
  async _collectLogFiles(logDir) {
    const logFiles = [];
    
    async function scanDir(dir) {
      const items = await fileManager.listFiles(dir);
      
      for (const item of items) {
        if (item.isDirectory) {
          // ╫í╫¿╫ץ╫º ╫¬╫ש╫º╫ש╫ץ╫¬ ╫₧╫⌐╫á╫פ
          await scanDir(item.path);
        } else if (item.name.endsWith('.log') || 
                   item.name.endsWith('.json') || 
                   item.name.endsWith('.md')) {
          logFiles.push(item.path);
        }
      }
    }
    
    await scanDir(logDir);
    return logFiles;
  }

  /**
   * ╫₧╫º╫ס╫£ ╫₧╫ש╫ף╫ó ╫ó╫£ ╫₧╫ס╫á╫פ ╫ñ╫¿╫ץ╫ש╫º╫ר
   * @param {string} projectDir - ╫¬╫ש╫º╫ש╫ש╫¬ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
   * @returns {Promise<Object>} - ╫₧╫ש╫ף╫ó ╫ó╫£ ╫₧╫ס╫á╫פ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
   * @private
   */
  async _getProjectStructure(projectDir) {
    try {
      const result = {
        path: projectDir,
        files: [],
        dirs: [],
        summary: {}
      };
      
      // ╫נ╫í╫ץ╫ú ╫₧╫ש╫ף╫ó ╫ó╫£ ╫º╫ס╫ª╫ש╫¥
      async function scanDir(dir, isRoot = false) {
        const items = await fileManager.listFiles(dir);
        
        const fileTypes = {};
        let totalFiles = 0;
        let totalDirs = 0;
        
        for (const item of items) {
          const relativePath = path.relative(projectDir, item.path);
          
          if (item.isDirectory) {
            totalDirs++;
            
            // ╫פ╫ץ╫í╫ú ╫נ╫¬ ╫פ╫¬╫ש╫º╫ש╫ש╫פ ╫£╫¿╫⌐╫ש╫₧╫פ ╫נ╫¥ ╫צ╫ץ ╫¬╫ש╫º╫ש╫ש╫¬ ╫פ╫⌐╫ץ╫¿╫⌐
            if (isRoot) {
              result.dirs.push({
                name: item.name,
                path: relativePath
              });
            }
            
            // ╫í╫¿╫ץ╫º ╫¬╫ש╫º╫ש╫ץ╫¬ ╫₧╫⌐╫á╫פ (╫ó╫ף ╫£╫ó╫ץ╫₧╫º ╫₧╫í╫ץ╫ש╫¥)
            if (relativePath.split(path.sep).length < 5) {
              await scanDir(item.path);
            }
          } else {
            totalFiles++;
            
            // ╫í╫ñ╫ץ╫¿ ╫נ╫¬ ╫í╫ש╫ץ╫₧╫ץ╫¬ ╫פ╫º╫ס╫ª╫ש╫¥
            const ext = path.extname(item.name).toLowerCase();
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            
            // ╫פ╫ץ╫í╫ú ╫º╫ס╫ª╫ש╫¥ ╫₧╫ש╫ץ╫ק╫ף╫ש╫¥ ╫£╫¿╫⌐╫ש╫₧╫פ
            if (isRoot && (
                item.name === 'README.md' || 
                item.name === 'package.json' || 
                item.name === 'requirements.txt' || 
                item.name === '.gitignore'
              )) {
              result.files.push({
                name: item.name,
                path: relativePath,
                size: item.size
              });
            }
          }
        }
        
        // ╫ó╫ף╫¢╫ƒ ╫נ╫¬ ╫פ╫í╫ש╫¢╫ץ╫¥
        Object.entries(fileTypes).forEach(([ext, count]) => {
          result.summary[ext] = (result.summary[ext] || 0) + count;
        });
        
        result.summary.totalFiles = (result.summary.totalFiles || 0) + totalFiles;
        result.summary.totalDirs = (result.summary.totalDirs || 0) + totalDirs;
      }
      
      await scanDir(projectDir, true);
      return result;
      
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫נ╫ש╫í╫ץ╫ú ╫₧╫ש╫ף╫ó ╫ó╫£ ╫₧╫ס╫á╫פ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר: ${error.message}`);
      return { error: error.message };
    }
  }
  
  /**
   * ╫ק╫ש╫⌐╫ץ╫ס ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬ ╫₧╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫פ╫í╫ץ╫¢╫ƒ
   * @param {Array} actions - ╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫פ╫í╫ץ╫¢╫ƒ
   * @returns {Object} - ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬
   * @private
   */
  _calculateStats(actions) {
    const stats = {
      total: actions.length,
      byResult: { success: 0, failure: 0, neutral: 0 },
      byType: {}
    };
    
    for (const action of actions) {
      // ╫í╫ñ╫ץ╫¿ ╫£╫ñ╫ש ╫¬╫ץ╫ª╫נ╫פ
      if (action.success === true) {
        stats.byResult.success++;
      } else if (action.success === false) {
        stats.byResult.failure++;
      } else {
        stats.byResult.neutral++;
      }
      
      // ╫í╫ñ╫ץ╫¿ ╫£╫ñ╫ש ╫í╫ץ╫ע ╫ñ╫ó╫ץ╫£╫פ
      const actionDesc = action.description || 'unknown';
      const actionType = this._categorizeAction(actionDesc);
      stats.byType[actionType] = (stats.byType[actionType] || 0) + 1;
    }
    
    return stats;
  }
  
  /**
   * ╫º╫ר╫ע╫ץ╫¿╫ש╫צ╫ª╫ש╫פ ╫⌐╫£ ╫ñ╫ó╫ץ╫£╫¬ ╫í╫ץ╫¢╫ƒ ╫£╫ñ╫ש ╫¬╫ש╫נ╫ץ╫¿
   * @param {string} description - ╫¬╫ש╫נ╫ץ╫¿ ╫פ╫ñ╫ó╫ץ╫£╫פ
   * @returns {string} - ╫º╫ר╫ע╫ץ╫¿╫ש╫פ
   * @private
   */
  _categorizeAction(description) {
    description = description.toLowerCase();
    
    if (description.includes('initialize') || description.includes('started')) {
      return 'initialization';
    } else if (description.includes('create') || description.includes('generating')) {
      return 'creation';
    } else if (description.includes('analyze') || description.includes('checking')) {
      return 'analysis';
    } else if (description.includes('fix') || description.includes('repair')) {
      return 'fixing';
    } else if (description.includes('test') || description.includes('testing')) {
      return 'testing';
    } else if (description.includes('report') || description.includes('summary')) {
      return 'reporting';
    } else {
      return 'other';
    }
  }
  
  /**
   * ╫ש╫ª╫ש╫¿╫¬ ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫í╫ץ╫¢╫ƒ
   * @param {string} agentName - ╫⌐╫¥ ╫פ╫í╫ץ╫¢╫ƒ
   * @param {Array} actions - ╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫פ╫í╫ץ╫¢╫ƒ
   * @param {Object} stats - ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬
   * @returns {Promise<Array>} - ╫¬╫ץ╫ס╫á╫ץ╫¬
   * @private
   */
  async _generateInsights(agentName, actions, stats) {
    try {
      // ╫פ╫¢╫ƒ ╫נ╫¬ ╫פ-prompt ╫£╫á╫ש╫¬╫ץ╫ק
      const prompt = `
        ╫נ╫á╫נ ╫á╫¬╫ק ╫נ╫¬ ╫פ╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫פ╫ס╫נ╫ץ╫¬ ╫⌐╫£ ╫í╫ץ╫¢╫ƒ ╫פ-AI ╫ס╫⌐╫¥ "${agentName}" ╫ץ╫í╫ñ╫º ╫ó╫ף 5 ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫⌐╫₧╫ó╫ץ╫¬╫ש╫ץ╫¬.
        
        ## ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬ ╫ñ╫ó╫ץ╫£╫ץ╫¬
        ${JSON.stringify(stats, null, 2)}
        
        ## ╫ף╫ץ╫ע╫₧╫נ╫ץ╫¬ ╫£╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫נ╫ק╫¿╫ץ╫á╫ץ╫¬ (╫ó╫ף 10)
        ${JSON.stringify(actions.slice(-10), null, 2)}
        
        ╫נ╫á╫נ ╫ª╫ץ╫¿ ╫¿╫⌐╫ש╫₧╫פ ╫⌐╫£ ╫ó╫ף 5 ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫נ╫ץ ╫₧╫í╫º╫á╫ץ╫¬ ╫₧╫á╫ץ╫¬╫ק╫ץ╫¬. 
        ╫£╫¢╫£ ╫¬╫ץ╫ס╫á╫פ ╫ª╫ש╫ש╫ƒ:
        1. ╫¢╫ץ╫¬╫¿╫¬ ╫פ╫¬╫ץ╫ס╫á╫פ (╫º╫ª╫¿╫פ ╫ץ╫₧╫₧╫ª╫פ)
        2. ╫¬╫ש╫נ╫ץ╫¿ ╫º╫ª╫¿ ╫⌐╫₧╫í╫ס╫ש╫¿ ╫נ╫¬ ╫פ╫¬╫ץ╫ס╫á╫פ ╫ó╫¥ ╫á╫¬╫ץ╫á╫ש╫¥ ╫¬╫ץ╫₧╫¢╫ש╫¥ ╫₧╫פ╫₧╫ש╫ף╫ó
        3. ╫¿╫₧╫¬ ╫ק╫⌐╫ש╫ס╫ץ╫¬ (HIGH/MEDIUM/LOW)
        
        ╫ñ╫ץ╫¿╫₧╫ר JSON ╫ס╫£╫ס╫ף. ╫£╫ף╫ץ╫ע╫₧╫פ:
        [
          {
            "title": "╫ñ╫ó╫ש╫£╫ץ╫¬ ╫פ╫í╫ץ╫¢╫ƒ ╫₧╫¬╫¿╫¢╫צ╫¬ ╫ס╫á╫ש╫¬╫ץ╫ק ╫º╫ץ╫ף",
            "description": "70% ╫₧╫פ╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫₧╫¬╫₧╫º╫ף╫ץ╫¬ ╫ס╫á╫ש╫¬╫ץ╫ק ╫º╫ץ╫ף, ╫ס╫ó╫ץ╫ף ╫¿╫º 20% ╫ס╫¬╫ש╫º╫ץ╫ƒ ╫ס╫ó╫ש╫ץ╫¬",
            "importance": "HIGH"
          }
        ]
      `;
      
      // ╫פ╫ñ╫ó╫£ ╫נ╫¬ ╫₧╫á╫ץ╫ó ╫פ-AI ╫£╫á╫ש╫¬╫ץ╫ק ╫ץ╫פ╫ñ╫º╫¬ ╫¬╫ץ╫ס╫á╫ץ╫¬
      const insightsText = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // ╫á╫í╫פ ╫£╫ñ╫¿╫í╫¿ ╫נ╫¬ ╫פ╫¬╫⌐╫ץ╫ס╫פ ╫¢-JSON
      try {
        return JSON.parse(insightsText);
      } catch (error) {
        logger.warn(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ñ╫ש╫¿╫í╫ץ╫¿ ╫¬╫ץ╫ס╫á╫ץ╫¬: ${error.message}`);
        
        // ╫נ╫¥ ╫פ╫ñ╫ש╫¿╫í╫ץ╫¿ ╫á╫¢╫⌐╫£, ╫á╫í╫פ ╫£╫פ╫ק╫צ╫ש╫¿ ╫¬╫ץ╫ס╫á╫פ ╫ס╫í╫ש╫í╫ש╫¬
        return [{
          title: "╫á╫ש╫¬╫ץ╫ק ╫£╫נ ╫צ╫₧╫ש╫ƒ",
          description: "╫£╫נ ╫á╫ש╫¬╫ƒ ╫£╫ñ╫¿╫í╫¿ ╫נ╫¬ ╫פ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫⌐╫פ╫ץ╫ñ╫º╫ץ",
          importance: "LOW"
        }];
      }
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫º╫¬ ╫¬╫ץ╫ס╫á╫ץ╫¬: ${error.message}`);
      return [];
    }
  }
  
  /**
   * ╫ש╫ª╫ש╫¿╫¬ ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬╫ש╫ץ╫¬
   * @param {Object} systemSummary - ╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬
   * @returns {Promise<Array>} - ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬╫ש╫ץ╫¬
   * @private
   */
  async _generateSystemInsights(systemSummary) {
    try {
      // ╫פ╫¢╫ƒ ╫נ╫¬ ╫פ-prompt ╫£╫á╫ש╫¬╫ץ╫ק
      const prompt = `
        ╫נ╫á╫נ ╫á╫¬╫ק ╫נ╫¬ ╫í╫ש╫¢╫ץ╫¥ ╫פ╫₧╫ó╫¿╫¢╫¬ ╫פ╫ס╫נ ╫ץ╫í╫ñ╫º ╫ó╫ף 5 ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬╫ש╫ץ╫¬ ╫ק╫⌐╫ץ╫ס╫ץ╫¬.
        
        ## ╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬
        ${JSON.stringify(systemSummary, null, 2)}
        
        ╫נ╫á╫נ ╫ª╫ץ╫¿ ╫¿╫⌐╫ש╫₧╫פ ╫⌐╫£ ╫ó╫ף 5 ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫נ╫ץ ╫₧╫í╫º╫á╫ץ╫¬ ╫ס╫¿╫₧╫פ ╫פ╫₧╫ó╫¿╫¢╫¬╫ש╫¬.
        ╫£╫¢╫£ ╫¬╫ץ╫ס╫á╫פ ╫ª╫ש╫ש╫ƒ:
        1. ╫¢╫ץ╫¬╫¿╫¬ ╫פ╫¬╫ץ╫ס╫á╫פ (╫º╫ª╫¿╫פ ╫ץ╫₧╫₧╫ª╫פ)
        2. ╫¬╫ש╫נ╫ץ╫¿ ╫º╫ª╫¿ ╫⌐╫₧╫í╫ס╫ש╫¿ ╫נ╫¬ ╫פ╫¬╫ץ╫ס╫á╫פ ╫ó╫¥ ╫á╫¬╫ץ╫á╫ש╫¥ ╫¬╫ץ╫₧╫¢╫ש╫¥ ╫₧╫פ╫₧╫ש╫ף╫ó
        3. ╫¿╫₧╫¬ ╫ק╫⌐╫ש╫ס╫ץ╫¬ (HIGH/MEDIUM/LOW)
        4. ╫פ╫₧╫£╫ª╫ץ╫¬ ╫נ╫ץ╫ñ╫ª╫ש╫ץ╫á╫נ╫£╫ש╫ץ╫¬
        
        ╫ñ╫ץ╫¿╫₧╫ר JSON ╫ס╫£╫ס╫ף.
      `;
      
      // ╫פ╫ñ╫ó╫£ ╫נ╫¬ ╫₧╫á╫ץ╫ó ╫פ-AI ╫£╫á╫ש╫¬╫ץ╫ק ╫ץ╫פ╫ñ╫º╫¬ ╫¬╫ץ╫ס╫á╫ץ╫¬
      const insightsText = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model
      });
      
      // ╫á╫í╫פ ╫£╫ñ╫¿╫í╫¿ ╫נ╫¬ ╫פ╫¬╫⌐╫ץ╫ס╫פ ╫¢-JSON
      try {
        return JSON.parse(insightsText);
      } catch (error) {
        logger.warn(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ñ╫ש╫¿╫í╫ץ╫¿ ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬: ${error.message}`);
        
        // ╫נ╫¥ ╫פ╫ñ╫ש╫¿╫í╫ץ╫¿ ╫á╫¢╫⌐╫£, ╫á╫í╫פ ╫£╫פ╫ק╫צ╫ש╫¿ ╫¬╫ץ╫ס╫á╫פ ╫ס╫í╫ש╫í╫ש╫¬
        return [{
          title: "╫á╫ש╫¬╫ץ╫ק ╫₧╫ó╫¿╫¢╫¬ ╫£╫נ ╫צ╫₧╫ש╫ƒ",
          description: "╫£╫נ ╫á╫ש╫¬╫ƒ ╫£╫ñ╫¿╫í╫¿ ╫נ╫¬ ╫פ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫פ╫₧╫ó╫¿╫¢╫¬╫ש╫ץ╫¬ ╫⌐╫פ╫ץ╫ñ╫º╫ץ",
          importance: "LOW"
        }];
      }
    } catch (error) {
      logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫º╫¬ ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬╫ש╫ץ╫¬: ${error.message}`);
      return [];
    }
  }
  
  /**
   * ╫ñ╫ץ╫¿╫₧╫ר ╫í╫ש╫¢╫ץ╫¥ ╫£╫ñ╫ש ╫פ╫ñ╫ץ╫¿╫₧╫ר ╫פ╫¿╫ª╫ץ╫ש
   * @param {Object} summaryData - ╫á╫¬╫ץ╫á╫ש ╫פ╫í╫ש╫¢╫ץ╫¥
   * @param {string} format - ╫ñ╫ץ╫¿╫₧╫ר (json/text/markdown)
   * @returns {Promise<any>} - ╫פ╫í╫ש╫¢╫ץ╫¥ ╫פ╫₧╫ñ╫ץ╫¿╫₧╫ר
   * @private
   */
  async _formatSummary(summaryData, format) {
    if (format === 'json') {
      return summaryData;
    }
    
    let formattedSummary = '';
    
    if (format === 'markdown') {
      formattedSummary = `# ╫í╫ש╫¢╫ץ╫¥ ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫í╫ץ╫¢╫ƒ ${summaryData.agent}
      
## ╫₧╫ש╫ף╫ó ╫¢╫£╫£╫ש
- **╫¬╫º╫ץ╫ñ╫פ**: ${summaryData.period}
- **╫צ╫₧╫ƒ**: ${new Date(summaryData.timestamp).toLocaleString()}
- **╫í╫ת ╫ñ╫ó╫ץ╫£╫ץ╫¬**: ${summaryData.actions}
- **╫ñ╫ó╫ץ╫£╫פ ╫¿╫נ╫⌐╫ץ╫á╫פ**: ${new Date(summaryData.firstAction).toLocaleString()}
- **╫ñ╫ó╫ץ╫£╫פ ╫נ╫ק╫¿╫ץ╫á╫פ**: ${new Date(summaryData.lastAction).toLocaleString()}

## ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬
- **╫פ╫ª╫£╫ק╫ץ╫¬**: ${summaryData.stats.byResult.success} (${Math.round(summaryData.stats.byResult.success / summaryData.stats.total * 100)}%)
- **╫¢╫⌐╫£╫ץ╫á╫ץ╫¬**: ${summaryData.stats.byResult.failure} (${Math.round(summaryData.stats.byResult.failure / summaryData.stats.total * 100)}%)

### ╫£╫ñ╫ש ╫í╫ץ╫ע ╫ñ╫ó╫ץ╫£╫פ
${Object.entries(summaryData.stats.byType).map(([type, count]) => 
  `- **${type}**: ${count} (${Math.round(count / summaryData.stats.total * 100)}%)`
).join('\n')}
`;

      // ╫פ╫ץ╫í╫ú ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫נ╫¥ ╫º╫ש╫ש╫₧╫ץ╫¬
      if (summaryData.insights && summaryData.insights.length > 0) {
        formattedSummary += `\n## ╫¬╫ץ╫ס╫á╫ץ╫¬\n`;
        
        summaryData.insights.forEach(insight => {
          formattedSummary += `### ${insight.title} (${insight.importance})\n${insight.description}\n\n`;
        });
      }
    } else {
      // ╫ñ╫ץ╫¿╫₧╫ר ╫ר╫º╫í╫ר ╫ñ╫⌐╫ץ╫ר
      formattedSummary = `╫í╫ש╫¢╫ץ╫¥ ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫í╫ץ╫¢╫ƒ ${summaryData.agent}\n\n`;
      formattedSummary += `╫¬╫º╫ץ╫ñ╫פ: ${summaryData.period}\n`;
      formattedSummary += `╫צ╫₧╫ƒ: ${new Date(summaryData.timestamp).toLocaleString()}\n`;
      formattedSummary += `╫í╫ת ╫ñ╫ó╫ץ╫£╫ץ╫¬: ${summaryData.actions}\n\n`;
      
      formattedSummary += `╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬:\n`;
      formattedSummary += `- ╫פ╫ª╫£╫ק╫ץ╫¬: ${summaryData.stats.byResult.success} (${Math.round(summaryData.stats.byResult.success / summaryData.stats.total * 100)}%)\n`;
      formattedSummary += `- ╫¢╫⌐╫£╫ץ╫á╫ץ╫¬: ${summaryData.stats.byResult.failure} (${Math.round(summaryData.stats.byResult.failure / summaryData.stats.total * 100)}%)\n\n`;
      
      // ╫פ╫ץ╫í╫ú ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫נ╫¥ ╫º╫ש╫ש╫₧╫ץ╫¬
      if (summaryData.insights && summaryData.insights.length > 0) {
        formattedSummary += `╫¬╫ץ╫ס╫á╫ץ╫¬:\n`;
        
        summaryData.insights.forEach(insight => {
          formattedSummary += `- ${insight.title} (${insight.importance}): ${insight.description}\n`;
        });
      }
    }
    
    return formattedSummary;
  }
  
  /**
   * ╫ñ╫ץ╫¿╫₧╫ר ╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬ ╫£╫ñ╫ש ╫פ╫ñ╫ץ╫¿╫₧╫ר ╫פ╫¿╫ª╫ץ╫ש
   * @param {Object} systemSummary - ╫á╫¬╫ץ╫á╫ש ╫í╫ש╫¢╫ץ╫¥ ╫פ╫₧╫ó╫¿╫¢╫¬
   * @param {string} format - ╫ñ╫ץ╫¿╫₧╫ר (text/markdown)
   * @returns {Promise<string>} - ╫פ╫í╫ש╫¢╫ץ╫¥ ╫פ╫₧╫ñ╫ץ╫¿╫₧╫ר
   * @private
   */
  async _formatSystemSummary(systemSummary, format) {
    let formattedSummary = '';
    
    if (format === 'markdown') {
      formattedSummary = `# ╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬
      
## ╫₧╫ש╫ף╫ó ╫¢╫£╫£╫ש
- **╫¬╫º╫ץ╫ñ╫פ**: ${systemSummary.period}
- **╫צ╫₧╫ƒ**: ${new Date(systemSummary.timestamp).toLocaleString()}
- **╫צ╫₧╫ƒ ╫¿╫ש╫ª╫פ ╫₧╫ó╫¿╫¢╫¬**: ${Math.floor(systemSummary.system.uptime / 3600)} ╫⌐╫ó╫ץ╫¬, ${Math.floor((systemSummary.system.uptime % 3600) / 60)} ╫ף╫º╫ץ╫¬

## ╫í╫ר╫ר╫ץ╫í ╫í╫ץ╫¢╫á╫ש╫¥
`;

      // ╫פ╫ץ╫í╫ú ╫₧╫ש╫ף╫ó ╫ó╫£ ╫¢╫£ ╫í╫ץ╫¢╫ƒ
      Object.entries(systemSummary.agents).forEach(([agentName, agentData]) => {
        formattedSummary += `### ${agentName}\n`;
        
        if (agentData.error) {
          formattedSummary += `- **╫⌐╫ע╫ש╫נ╫פ**: ${agentData.error}\n`;
        } else {
          formattedSummary += `- **╫ñ╫ó╫ץ╫£╫ץ╫¬**: ${agentData.actions || 0}\n`;
          
          if (agentData.stats && agentData.stats.byResult) {
            formattedSummary += `- **╫פ╫ª╫£╫ק╫ץ╫¬**: ${agentData.stats.byResult.success || 0}\n`;
            formattedSummary += `- **╫¢╫⌐╫£╫ץ╫á╫ץ╫¬**: ${agentData.stats.byResult.failure || 0}\n`;
          }
        }
        
        formattedSummary += '\n';
      });

      // ╫פ╫ץ╫í╫ú ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫נ╫¥ ╫º╫ש╫ש╫₧╫ץ╫¬
      if (systemSummary.insights && systemSummary.insights.length > 0) {
        formattedSummary += `## ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬\n`;
        
        systemSummary.insights.forEach(insight => {
          formattedSummary += `### ${insight.title} (${insight.importance})\n${insight.description}\n`;
          
          if (insight.recommendations) {
            formattedSummary += `\n**╫פ╫₧╫£╫ª╫ץ╫¬**: ${insight.recommendations}\n`;
          }
          
          formattedSummary += '\n';
        });
      }
    } else {
      // ╫ñ╫ץ╫¿╫₧╫ר ╫ר╫º╫í╫ר ╫ñ╫⌐╫ץ╫ר
      formattedSummary = `╫í╫ש╫¢╫ץ╫¥ ╫₧╫ó╫¿╫¢╫¬\n\n`;
      formattedSummary += `╫¬╫º╫ץ╫ñ╫פ: ${systemSummary.period}\n`;
      formattedSummary += `╫צ╫₧╫ƒ: ${new Date(systemSummary.timestamp).toLocaleString()}\n\n`;
      
      formattedSummary += `╫í╫ר╫ר╫ץ╫í ╫í╫ץ╫¢╫á╫ש╫¥:\n`;
      
      // ╫פ╫ץ╫í╫ú ╫₧╫ש╫ף╫ó ╫ó╫£ ╫¢╫£ ╫í╫ץ╫¢╫ƒ
      Object.entries(systemSummary.agents).forEach(([agentName, agentData]) => {
        formattedSummary += `- ${agentName}: `;
        
        if (agentData.error) {
          formattedSummary += `╫⌐╫ע╫ש╫נ╫פ: ${agentData.error}\n`;
        } else {
          formattedSummary += `${agentData.actions || 0} ╫ñ╫ó╫ץ╫£╫ץ╫¬`;
          
          if (agentData.stats && agentData.stats.byResult) {
            formattedSummary += `, ${agentData.stats.byResult.success || 0} ╫פ╫ª╫£╫ק╫ץ╫¬, ${agentData.stats.byResult.failure || 0} ╫¢╫⌐╫£╫ץ╫á╫ץ╫¬`;
          }
          
          formattedSummary += '\n';
        }
      });
      
      // ╫פ╫ץ╫í╫ú ╫¬╫ץ╫ס╫á╫ץ╫¬ ╫נ╫¥ ╫º╫ש╫ש╫₧╫ץ╫¬
      if (systemSummary.insights && systemSummary.insights.length > 0) {
        formattedSummary += `\n╫¬╫ץ╫ס╫á╫ץ╫¬ ╫₧╫ó╫¿╫¢╫¬:\n`;
        
        systemSummary.insights.forEach(insight => {
          formattedSummary += `- ${insight.title} (${insight.importance}): ${insight.description}\n`;
          
          if (insight.recommendations) {
            formattedSummary += `  ╫פ╫₧╫£╫ª╫ץ╫¬: ${insight.recommendations}\n`;
          }
        });
      }
    }
    
    return formattedSummary;
  }
}

module.exports = new SummaryAgent(); 
