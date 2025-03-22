const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { EventEmitter } = require('events');
const logger = require('../core/logger');
const { v4: uuidv4 } = require('uuid');
const memoryManager = require('../core/memoryManager');
const aiEngine = require('../core/aiEngine');
const agentManager = require('../core/agentManager');
const BaseAgent = require('../core/BaseAgent');

/**
 * Development Agent
 * Responsible for managing development tasks and code writing
 */
class DevAgent extends BaseAgent {
  constructor(options = {}) {
    super({
      name: options.name || 'dev_agent',
      type: 'dev',
      description: 'Development agent for code generation and project management',
      ...options
    });
    
    // Default working directory
    this.workspacePath = options.workspacePath || path.join(process.cwd(), 'workspace');
    
    // Working mode (debug/production)
    this.mode = process.env.DEV_AGENT_MODE || 'debug';
    
    // Current session ID
    this.currentSessionId = null;
    
    // Sub-agents
    this.subAgents = {
      gpt4: new Gpt4SubAgent(this), // GPT-4 sub-agent (coding)
      claude: new ClaudeSubAgent(this) // Claude sub-agent (code review)
    };
    
    // Whether to use sub-agents (default: yes)
    this.useSubAgents = options.useSubAgents !== false;
    
    logger.info(`Development agent initialized. Using sub-agents: ${this.useSubAgents ? 'yes' : 'no'}`);
  }
  
  /**
   * Starts the agent
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Development agent is already running');
      return;
    }
    
    try {
      logger.info('Starting development agent...');
      
      // Ensure workspace directory exists
      await fs.ensureDir(this.workspacePath);
      
      // Initialize memory
      if (!this.memory) {
        this.memory = memoryManager.createAgentMemory(this.name);
      }
      
      // Start sub-agents if enabled
      if (this.useSubAgents) {
        for (const [name, agent] of Object.entries(this.subAgents)) {
          if (agent.start) {
            await agent.start();
            logger.info(`Started sub-agent: ${name}`);
          }
        }
      }
      
      this.isRunning = true;
      this.emit('started');
      
      logger.info('Development agent started successfully');
    } catch (error) {
      logger.error(`Failed to start development agent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stops the agent
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('Development agent is not running');
      return;
    }
    
    try {
      logger.info('Stopping development agent...');
      
      // Stop sub-agents
      if (this.useSubAgents) {
        for (const [name, agent] of Object.entries(this.subAgents)) {
          if (agent.stop) {
            await agent.stop();
            logger.info(`Stopped sub-agent: ${name}`);
          }
        }
      }
      
      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('Development agent stopped successfully');
    } catch (error) {
      logger.error(`Failed to stop development agent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Sets the working directory
   * @param {string} directory - Path to the working directory
   */
  setWorkingDirectory(directory) {
    this.workspacePath = directory;
    logger.info(`Set working directory to: ${directory}`);
  }
  
  /**
   * Analyzes a project to understand its structure and technologies
   * @param {string} projectPath - Path to the project
   * @returns {Object} Project analysis results
   */
  async analyzeProject(projectPath) {
    try {
      const fullPath = path.resolve(projectPath);
      logger.info(`Analyzing project at: ${fullPath}`);
      
      // Check if directory exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Project directory does not exist: ${fullPath}`);
      }
      
      // Collect project information
      const analysis = {
        path: fullPath,
        files: {},
        technologies: {},
        dependencies: {},
        structure: {}
      };
      
      // Gather file statistics
      const fileStats = await this._collectFileStats(fullPath);
      analysis.files = fileStats;
      
      // Detect technologies and frameworks
      analysis.technologies = await this._detectTechnologies(fullPath, fileStats);
      
      // Analyze dependencies
      analysis.dependencies = await this._analyzeDependencies(fullPath);
      
      // Map project structure
      analysis.structure = await this._mapProjectStructure(fullPath);
      
      // Save analysis to memory
      this.memory.store('project_analysis', analysis);
      
      logger.info(`Project analysis completed for: ${fullPath}`);
      return analysis;
    } catch (error) {
      logger.error(`Project analysis failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Collects file statistics for a project
   * @param {string} projectPath - Project path
   * @returns {Object} File statistics
   * @private
   */
  async _collectFileStats(projectPath) {
    // Implementation would analyze file types, counts, sizes
    return {
      totalCount: 0,
      byExtension: {},
      largestFiles: []
    };
  }
  
  /**
   * Detects technologies used in the project
   * @param {string} projectPath - Project path
   * @param {Object} fileStats - File statistics
   * @returns {Object} Detected technologies
   * @private
   */
  async _detectTechnologies(projectPath, fileStats) {
    // Implementation would detect languages, frameworks, etc.
    return {
      languages: [],
      frameworks: [],
      databases: [],
      tools: []
    };
  }
  
  /**
   * Analyzes project dependencies
   * @param {string} projectPath - Project path
   * @returns {Object} Dependency information
   * @private
   */
  async _analyzeDependencies(projectPath) {
    // Implementation would analyze package.json, requirements.txt, etc.
    return {
      direct: [],
      dev: [],
      indirect: []
    };
  }
  
  /**
   * Maps the project structure
   * @param {string} projectPath - Project path
   * @returns {Object} Project structure
   * @private
   */
  async _mapProjectStructure(projectPath) {
    // Implementation would create a tree structure of the project
    return {};
  }
  
  /**
   * Generates code for a specific task
   * @param {Object} task - Code generation task
   * @returns {Object} Generated code and metadata
   */
  async generateCode(task) {
    try {
      logger.info(`Generating code for task: ${task.description}`);
      
      if (!this.isRunning) {
        await this.start();
      }
      
      // Use GPT-4 sub-agent for code generation if available
      if (this.useSubAgents && this.subAgents.gpt4) {
        return await this.subAgents.gpt4.generateCode(task);
      } else {
        // Direct implementation using aiEngine
        const prompt = this._createCodeGenerationPrompt(task);
        const response = await aiEngine.query(prompt, { 
          provider: 'openai', 
          model: 'gpt-4',
          agentName: this.name
        });
        
        return this._parseCodeGenerationResponse(response, task);
      }
    } catch (error) {
      logger.error(`Code generation failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Creates a prompt for code generation
   * @param {Object} task - Code generation task
   * @returns {string} Prompt for the AI model
   * @private
   */
  _createCodeGenerationPrompt(task) {
    return `I need you to generate code for the following task:
      
Description: ${task.description}

${task.requirements ? `Requirements:
${task.requirements}` : ''}

${task.context ? `Context:
${task.context}` : ''}

${task.language ? `Programming Language: ${task.language}` : ''}
${task.framework ? `Framework: ${task.framework}` : ''}

Please provide well-structured, clean, and efficient code that meets these requirements.
Include appropriate error handling, comments, and documentation.`;
  }
  
  /**
   * Parses the AI response to extract generated code
   * @param {string} response - AI response
   * @param {Object} task - Original task
   * @returns {Object} Parsed code and metadata
   * @private
   */
  _parseCodeGenerationResponse(response, task) {
    // Basic implementation - in practice would use regex to extract code blocks
    return {
      task: task.description,
      code: response,
      language: task.language,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Reviews code and provides feedback
   * @param {Object} codeReview - Code review request
   * @returns {Object} Review results
   */
  async reviewCode(codeReview) {
    try {
      logger.info(`Reviewing code: ${codeReview.description || 'No description'}`);
      
      if (!this.isRunning) {
        await this.start();
      }
      
      // Use Claude sub-agent for code review if available
      if (this.useSubAgents && this.subAgents.claude) {
        return await this.subAgents.claude.reviewCode(codeReview);
      } else {
        // Direct implementation using aiEngine
        const prompt = this._createCodeReviewPrompt(codeReview);
        const response = await aiEngine.query(prompt, { 
          provider: 'anthropic', 
          model: 'claude-3-opus-20240229',
          agentName: this.name
        });
        
        return this._parseCodeReviewResponse(response, codeReview);
      }
    } catch (error) {
      logger.error(`Code review failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Creates a prompt for code review
   * @param {Object} codeReview - Code review request
   * @returns {string} Prompt for the AI model
   * @private
   */
  _createCodeReviewPrompt(codeReview) {
    return `Please review the following code:

\`\`\`${codeReview.language || ''}
${codeReview.code}
\`\`\`

${codeReview.context ? `Context: ${codeReview.context}` : ''}

Provide a detailed code review covering:
1. Correctness - Does it work as intended?
2. Efficiency - Are there performance concerns?
3. Readability - Is the code easy to understand?
4. Maintainability - Is it well-structured and easy to modify?
5. Security - Are there any security vulnerabilities?
6. Best practices - Does it follow language/framework best practices?

For each issue, provide:
- Issue description
- Severity (Critical, High, Medium, Low)
- Suggested improvement with code example where applicable`;
  }
  
  /**
   * Parses the AI response to extract code review feedback
   * @param {string} response - AI response
   * @param {Object} codeReview - Original review request
   * @returns {Object} Parsed review results
   * @private
   */
  _parseCodeReviewResponse(response, codeReview) {
    // Basic implementation
    return {
      originalCode: codeReview.code,
      review: response,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Fixes bugs in code
   * @param {Object} bugFix - Bug fix request
   * @returns {Object} Fixed code
   */
  async fixBug(bugFix) {
    try {
      logger.info(`Fixing bug: ${bugFix.description}`);
      
      if (!this.isRunning) {
        await this.start();
      }
      
      // Use GPT-4 sub-agent for bug fixing
      if (this.useSubAgents && this.subAgents.gpt4) {
        return await this.subAgents.gpt4.fixBug(bugFix);
      } else {
        // Direct implementation
        const prompt = this._createBugFixPrompt(bugFix);
        const response = await aiEngine.query(prompt, { 
          provider: 'openai', 
          model: 'gpt-4',
          agentName: this.name
        });
        
        return this._parseBugFixResponse(response, bugFix);
      }
    } catch (error) {
      logger.error(`Bug fix failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Creates a prompt for bug fixing
   * @param {Object} bugFix - Bug fix request
   * @returns {string} Prompt for the AI model
   * @private
   */
  _createBugFixPrompt(bugFix) {
    return `Please fix the bug in the following code:

\`\`\`${bugFix.language || ''}
${bugFix.code}
\`\`\`

Bug description: ${bugFix.description}

${bugFix.errorMessage ? `Error message: ${bugFix.errorMessage}` : ''}
${bugFix.context ? `Additional context: ${bugFix.context}` : ''}

Please provide:
1. The fixed code (complete)
2. An explanation of the bug and how your solution fixes it
3. Any recommendations to prevent similar bugs in the future`;
  }
  
  /**
   * Parses the AI response to extract fixed code
   * @param {string} response - AI response
   * @param {Object} bugFix - Original bug fix request
   * @returns {Object} Parsed fix results
   * @private
   */
  _parseBugFixResponse(response, bugFix) {
    // Basic implementation
    return {
      originalCode: bugFix.code,
      fixedCode: response,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Logs an action performed by the agent
   * @param {string} action - Action description
   * @param {Object} metadata - Additional metadata
   * @private
   */
  _logAction(action, metadata = {}) {
    logger.info(`DevAgent action: ${action}`);
    
    if (this.memory) {
      this.memory.addEntry(action, {
        ...metadata,
        timestamp: new Date().toISOString(),
        agent: 'dev_agent'
      });
    }
  }
  
  /**
   * Calculates execution duration
   * @param {number} startTime - Start time in milliseconds
   * @returns {string} Formatted duration
   * @private
   */
  _calculateDuration(startTime) {
    const duration = Date.now() - startTime;
    
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(2)}s`;
    } else {
      return `${(duration / 60000).toFixed(2)}m`;
    }
  }
}

/**
 * GPT-4 Sub-Agent for generating code and fixing bugs
 */
class Gpt4SubAgent {
  constructor(parentAgent) {
    this.parent = parentAgent;
    this.name = 'gpt4_sub_agent';
    this.provider = 'openai';
    this.model = 'gpt-4';
    this.active = false;
    
    logger.info('GPT-4 sub-agent initialized');
  }
  
  async start() {
    this.active = true;
    logger.info('GPT-4 sub-agent started');
    return true;
  }
  
  async stop() {
    this.active = false;
    logger.info('GPT-4 sub-agent stopped');
    return true;
  }
  
  async generateCode(task) {
    try {
      if (!this.active) {
        await this.start();
      }
      
      logger.info(`GPT-4 sub-agent generating code for: ${task.description}`);
      
      const prompt = `As an expert developer, please generate code for the following task:

Description: ${task.description}

${task.requirements ? `Requirements: ${task.requirements}` : ''}
${task.context ? `Context: ${task.context}` : ''}
${task.language ? `Language: ${task.language}` : ''}
${task.framework ? `Framework: ${task.framework}` : ''}

Provide clean, well-structured code with appropriate comments and error handling.
Include any necessary imports or dependencies.
Format your response as a complete, functional solution.`;
      
      const startTime = Date.now();
      const response = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model,
        temperature: 0.2,
        agentName: this.name
      });
      
      const duration = Date.now() - startTime;
      logger.info(`GPT-4 code generation completed in ${duration}ms`);
      
      return {
        task: task.description,
        code: response,
        language: task.language,
        framework: task.framework,
        timestamp: new Date().toISOString(),
        model: this.model,
        generationTime: duration
      };
    } catch (error) {
      logger.error(`GPT-4 code generation failed: ${error.message}`);
      throw error;
    }
  }
  
  async fixBug(bugFix) {
    try {
      if (!this.active) {
        await this.start();
      }
      
      logger.info(`GPT-4 sub-agent fixing bug: ${bugFix.description}`);
      
      const prompt = `As an expert developer, please fix the bug in this code:

\`\`\`${bugFix.language || ''}
${bugFix.code}
\`\`\`

Bug description: ${bugFix.description}
${bugFix.errorMessage ? `Error message: ${bugFix.errorMessage}` : ''}
${bugFix.context ? `Context: ${bugFix.context}` : ''}

Please provide:
1. The complete fixed code (not just the changed parts)
2. A brief explanation of what was causing the bug
3. How your solution fixes the issue`;
      
      const startTime = Date.now();
      const response = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model,
        temperature: 0.2,
        agentName: this.name
      });
      
      const duration = Date.now() - startTime;
      logger.info(`GPT-4 bug fix completed in ${duration}ms`);
      
      // Extract the fixed code from the response
      const fixedCode = this._extractCodeFromResponse(response, bugFix.language);
      
      return {
        originalCode: bugFix.code,
        fixedCode: fixedCode,
        fullResponse: response,
        timestamp: new Date().toISOString(),
        model: this.model,
        fixTime: duration
      };
    } catch (error) {
      logger.error(`GPT-4 bug fix failed: ${error.message}`);
      throw error;
    }
  }
  
  _extractCodeFromResponse(response, language) {
    // Try to extract code between backticks with language marker
    const codeBlockRegex = new RegExp(`\`\`\`(?:${language || ''})\\s*([\\s\\S]*?)\`\`\``, 'i');
    const match = response.match(codeBlockRegex);
    
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Fallback to any code block
    const genericCodeBlockRegex = /```(?:\w*)\s*([\s\S]*?)```/;
    const genericMatch = response.match(genericCodeBlockRegex);
    
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1].trim();
    }
    
    // If no code blocks found, return the whole response
    return response;
  }
}

/**
 * Claude Sub-Agent for code reviews
 */
class ClaudeSubAgent {
  constructor(parentAgent) {
    this.parent = parentAgent;
    this.name = 'claude_sub_agent';
    this.provider = 'anthropic';
    this.model = 'claude-3-opus-20240229';
    this.active = false;
    
    logger.info('Claude sub-agent initialized');
  }
  
  async start() {
    this.active = true;
    logger.info('Claude sub-agent started');
    return true;
  }
  
  async stop() {
    this.active = false;
    logger.info('Claude sub-agent stopped');
    return true;
  }
  
  async reviewCode(codeReview) {
    try {
      if (!this.active) {
        await this.start();
      }
      
      logger.info(`Claude sub-agent reviewing code: ${codeReview.description || 'unnamed review'}`);
      
      const prompt = `As an expert code reviewer, please review the following code:

\`\`\`${codeReview.language || ''}
${codeReview.code}
\`\`\`

${codeReview.context ? `Context: ${codeReview.context}` : ''}

Provide a comprehensive code review covering:
1. Functionality - Does it meet the requirements?
2. Code quality - Is it well-structured and maintainable?
3. Efficiency - Are there performance concerns?
4. Security - Are there security vulnerabilities?
5. Best practices - Does it follow language/framework conventions?

For each issue found:
- Describe the issue clearly
- Rate severity (Critical, High, Medium, Low)
- Provide a specific recommendation with code example where applicable
- Explain why your suggestion is better

Also highlight any particularly good practices in the code.`;
      
      const startTime = Date.now();
      const response = await aiEngine.query(prompt, {
        provider: this.provider,
        model: this.model,
        temperature: 0.2,
        agentName: this.name
      });
      
      const duration = Date.now() - startTime;
      logger.info(`Claude code review completed in ${duration}ms`);
      
      return {
        originalCode: codeReview.code,
        review: response,
        timestamp: new Date().toISOString(),
        model: this.model,
        reviewTime: duration
      };
    } catch (error) {
      logger.error(`Claude code review failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = DevAgent; 