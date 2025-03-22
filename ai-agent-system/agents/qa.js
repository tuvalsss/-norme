const path = require('path');
const fs = require('fs-extra');
const logger = require('../core/logger');
const aiEngine = require('../core/aiEngine');
const memoryManager = require('../core/memoryManager');
const agentManager = require('../core/agentManager');
const { v4: uuidv4 } = require('uuid');

/**
 * QA Agent - Responsible for quality assurance testing
 */
class QaAgent {
  constructor() {
    this.active = false;
    this.name = 'qa_agent';
    this.logPrefix = '[qa_agent]';
    this.currentSessionId = null;
    this.memory = null;
    
    // Preferred provider and model for QA Agent
    // Claude 3.7 excels at understanding complex errors and code analysis
    this.preferredProvider = 'anthropic';
    this.preferredModel = 'claude-3.7-sonnet';
    
    logger.info(`${this.logPrefix} QA Agent initialized`);
  }
  
  /**
   * Start the agent
   */
  async start() {
    if (this.active) {
      logger.info(`${this.logPrefix} Agent is already active`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} Starting QA Agent...`);
      
      // Generate new session ID
      this.currentSessionId = `session_${uuidv4()}`;
      
      // Load agent memory
      this.memory = await memoryManager.loadMemory(this.name);
      
      // Log session start
      await this._logSessionStart();
      
      // Register with agent manager
      agentManager.registerAgent(this.name, this);
      
      this.active = true;
      logger.info(`${this.logPrefix} QA Agent started successfully (session: ${this.currentSessionId})`);
    } catch (error) {
      logger.error(`${this.logPrefix} Error starting QA Agent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stop the agent
   */
  async stop() {
    if (!this.active) {
      logger.info(`${this.logPrefix} Agent is already inactive`);
      return;
    }
    
    try {
      logger.info(`${this.logPrefix} Stopping QA Agent...`);
      
      // Log session end
      await this._logSessionEnd();
      
      // Unregister from agent manager
      agentManager.unregisterAgent(this.name);
      
      this.active = false;
      this.currentSessionId = null;
      logger.info(`${this.logPrefix} QA Agent stopped successfully`);
    } catch (error) {
      logger.error(`${this.logPrefix} Error stopping QA Agent: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Validate code
   * @param {string} code - Code to validate
   * @param {string} language - Programming language
   * @param {object} options - Additional options
   * @returns {object} Validation results
   */
  async validateCode(code, language, options = {}) {
    if (!this.active) {
      throw new Error('QA Agent is not active, please start the agent first');
    }
    
    try {
      logger.info(`${this.logPrefix} Validating ${language} code...`);
      
      const validationOptions = {
        checkSyntax: options.checkSyntax !== false,
        checkStyle: options.checkStyle !== false,
        checkSecurity: options.checkSecurity !== false,
        checkPerformance: options.checkPerformance !== false,
        ...options
      };
      
      // Create prompt for code validation
      const prompt = this._createValidationPrompt(code, language, validationOptions);
      
      // Get the response from AI
      const response = await aiEngine.query(prompt, {
        provider: this.preferredProvider,
        model: this.preferredModel,
        temperature: 0.1
      });
      
      // Parse the validation results
      const results = this._parseValidationResults(response, language);
      
      // Log the validation action
      await this._logAction('validateCode', {
        language,
        codeLength: code.length,
        options: validationOptions
      }, {
        issues: results.issues.length,
        score: results.score
      });
      
      logger.info(`${this.logPrefix} Code validation completed with ${results.issues.length} issues identified`);
      return results;
    } catch (error) {
      logger.error(`${this.logPrefix} Error validating code: ${error.message}`);
      
      // Log error to memory
      await this._logAction('validateCode', {
        language,
        codeLength: code.length,
        options
      }, null, error.message);
      
      throw error;
    }
  }
  
  /**
   * Test code functionality
   * @param {string} code - Code to test
   * @param {string} language - Programming language
   * @param {object} testOptions - Testing options
   * @returns {object} Test results
   */
  async testCode(code, language, testOptions = {}) {
    if (!this.active) {
      throw new Error('QA Agent is not active, please start the agent first');
    }
    
    try {
      logger.info(`${this.logPrefix} Testing ${language} code functionality...`);
      
      // Create prompt for code testing
      const prompt = this._createTestingPrompt(code, language, testOptions);
      
      // Get the response from AI
      const response = await aiEngine.query(prompt, {
        provider: this.preferredProvider,
        model: this.preferredModel,
        temperature: 0.2
      });
      
      // Parse the test results
      const results = this._parseTestResults(response, language);
      
      // Log the testing action
      await this._logAction('testCode', {
        language,
        codeLength: code.length,
        testOptions
      }, {
        testsPassed: results.passed,
        testsFailed: results.failed,
        coverage: results.coverage
      });
      
      logger.info(`${this.logPrefix} Code testing completed: ${results.passed} passed, ${results.failed} failed`);
      return results;
    } catch (error) {
      logger.error(`${this.logPrefix} Error testing code: ${error.message}`);
      
      // Log error to memory
      await this._logAction('testCode', {
        language,
        codeLength: code.length,
        testOptions
      }, null, error.message);
      
      throw error;
    }
  }
  
  /**
   * Create test cases for the provided code
   * @param {string} code - Code to create tests for
   * @param {string} language - Programming language
   * @param {object} options - Test generation options
   * @returns {object} Generated test cases
   */
  async createTestCases(code, language, options = {}) {
    if (!this.active) {
      throw new Error('QA Agent is not active, please start the agent first');
    }
    
    try {
      logger.info(`${this.logPrefix} Creating test cases for ${language} code...`);
      
      const testOptions = {
        testFramework: options.testFramework || this._getDefaultTestFramework(language),
        coverageLevel: options.coverageLevel || 'high',
        includeEdgeCases: options.includeEdgeCases !== false,
        ...options
      };
      
      // Create prompt for test generation
      const prompt = this._createTestGenerationPrompt(code, language, testOptions);
      
      // Get the response from AI
      const response = await aiEngine.query(prompt, {
        provider: this.preferredProvider,
        model: this.preferredModel,
        temperature: 0.3
      });
      
      // Extract test code from the response
      const testCode = this._extractTestCode(response, language);
      
      // Log the test creation action
      await this._logAction('createTestCases', {
        language,
        codeLength: code.length,
        testOptions
      }, {
        testCodeLength: testCode.length
      });
      
      logger.info(`${this.logPrefix} Test cases created successfully (${testCode.length} characters)`);
      return {
        testCode,
        language,
        framework: testOptions.testFramework
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Error creating test cases: ${error.message}`);
      
      // Log error to memory
      await this._logAction('createTestCases', {
        language,
        codeLength: code.length,
        options
      }, null, error.message);
      
      throw error;
    }
  }
  
  /**
   * Fix issues in code based on validation results
   * @param {string} code - Original code
   * @param {object} validationResults - Results from validateCode
   * @param {string} language - Programming language
   * @returns {object} Fixed code and summary of changes
   */
  async fixIssues(code, validationResults, language) {
    if (!this.active) {
      throw new Error('QA Agent is not active, please start the agent first');
    }
    
    try {
      logger.info(`${this.logPrefix} Fixing ${validationResults.issues.length} issues in ${language} code...`);
      
      // Create prompt for fixing issues
      const prompt = this._createFixPrompt(code, validationResults, language);
      
      // Get the response from AI
      const response = await aiEngine.query(prompt, {
        provider: this.preferredProvider,
        model: this.preferredModel,
        temperature: 0.1
      });
      
      // Extract fixed code and summary of changes
      const { fixedCode, changesSummary } = this._extractFixedCode(response, language);
      
      // Log the fix action
      await this._logAction('fixIssues', {
        language,
        issuesCount: validationResults.issues.length,
        originalLength: code.length
      }, {
        fixedLength: fixedCode.length,
        changesCount: changesSummary.length
      });
      
      logger.info(`${this.logPrefix} Code fixes applied successfully`);
      return {
        originalCode: code,
        fixedCode,
        changesSummary
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Error fixing code issues: ${error.message}`);
      
      // Log error to memory
      await this._logAction('fixIssues', {
        language,
        issuesCount: validationResults.issues.length,
        originalLength: code.length
      }, null, error.message);
      
      throw error;
    }
  }
  
  /**
   * Create validation prompt
   * @private
   */
  _createValidationPrompt(code, language, options) {
    return `Please analyze this ${language} code for quality issues:

\`\`\`${language}
${code}
\`\`\`

Perform a comprehensive code review focusing on:
${options.checkSyntax ? '- Syntax errors and bugs' : ''}
${options.checkStyle ? '- Style and best practices' : ''}
${options.checkSecurity ? '- Security vulnerabilities' : ''}
${options.checkPerformance ? '- Performance issues' : ''}

For each issue found:
1. Identify the line number(s)
2. Describe the problem
3. Rate severity (Critical, High, Medium, Low)
4. Provide a suggested fix

Also provide an overall quality score from 0-100 and brief summary of the code quality.
Format the response as JSON with the following structure:
{
  "score": number,
  "summary": "string",
  "issues": [
    {
      "line": number or range,
      "description": "string",
      "severity": "string",
      "fix": "string"
    }
  ]
}`;
  }
  
  /**
   * Create testing prompt
   * @private
   */
  _createTestingPrompt(code, language, options) {
    return `Please test the functionality of this ${language} code:

\`\`\`${language}
${code}
\`\`\`

${options.testCases ? `Test cases to verify:
${options.testCases.map(tc => `- ${tc}`).join('\n')}` : 'Generate appropriate test cases to verify all functionality.'}

${options.expectations ? `Expected behavior:
${options.expectations}` : ''}

For each test:
1. Describe the test purpose
2. Show the expected output/behavior
3. Determine if the code would pass or fail
4. Explain any issues found

Provide code coverage estimate and overall assessment.
Format the response as JSON with:
{
  "tests": [
    {
      "name": "string",
      "description": "string",
      "input": any,
      "expectedOutput": any,
      "actualOutput": any,
      "passed": boolean,
      "explanation": "string"
    }
  ],
  "passed": number,
  "failed": number,
  "coverage": number,
  "assessment": "string"
}`;
  }
  
  /**
   * Create test generation prompt
   * @private
   */
  _createTestGenerationPrompt(code, language, options) {
    return `Generate comprehensive test cases for this ${language} code using ${options.testFramework}:

\`\`\`${language}
${code}
\`\`\`

Requirements:
- Use ${options.testFramework} as the testing framework
- Create tests for all functions/methods
- Achieve ${options.coverageLevel} test coverage
${options.includeEdgeCases ? '- Include edge cases and error handling tests' : ''}
${options.specificFeatures ? `- Focus on testing these specific features: ${options.specificFeatures.join(', ')}` : ''}

Provide only the test code, properly formatted and ready to run.`;
  }
  
  /**
   * Create fix prompt
   * @private
   */
  _createFixPrompt(code, validationResults, language) {
    const issuesText = validationResults.issues.map(issue => 
      `- Line ${issue.line}: ${issue.description} (${issue.severity})`
    ).join('\n');
    
    return `Please fix the following issues in this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Issues to fix:
${issuesText}

Please provide:
1. The complete fixed code
2. A summary of all changes made

Ensure the fixed code is complete, ready to use, and addresses all the identified issues.`;
  }
  
  /**
   * Parse validation results
   * @private
   */
  _parseValidationResults(response, language) {
    try {
      // Try to parse the JSON response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                        response.match(/\{[\s\S]*"score"[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }
      
      // If JSON parsing fails, create a structured response manually
      const issues = [];
      const lines = response.split('\n');
      
      let currentIssue = null;
      let summary = '';
      let score = 0;
      
      for (const line of lines) {
        if (line.match(/score:?\s*(\d+)/i)) {
          score = parseInt(line.match(/score:?\s*(\d+)/i)[1]);
        } else if (line.match(/summary:?\s*(.*)/i)) {
          summary = line.match(/summary:?\s*(.*)/i)[1];
        } else if (line.match(/issue|problem|bug|error/i) && line.match(/line\s+\d+/i)) {
          // Start of a new issue
          if (currentIssue) {
            issues.push(currentIssue);
          }
          
          const lineMatch = line.match(/line\s+(\d+)(-(\d+))?/i);
          const severityMatch = line.match(/(critical|high|medium|low)/i);
          
          currentIssue = {
            line: lineMatch ? parseInt(lineMatch[1]) : 0,
            description: line.replace(/^[^:]*:\s*/, ''),
            severity: severityMatch ? severityMatch[1] : 'Medium',
            fix: ''
          };
        } else if (currentIssue && line.match(/fix|solution|suggestion/i)) {
          currentIssue.fix = line.replace(/^[^:]*:\s*/, '');
        }
      }
      
      if (currentIssue) {
        issues.push(currentIssue);
      }
      
      return {
        score: score || 50,
        summary: summary || 'Manual parsing of validation results',
        issues
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Error parsing validation results: ${error.message}`);
      
      // Return a basic structure if parsing fails
      return {
        score: 50,
        summary: 'Failed to parse validation results properly',
        issues: [{
          line: 0,
          description: 'Could not parse specific issues from the validation response',
          severity: 'Medium',
          fix: 'Review the code manually'
        }]
      };
    }
  }
  
  /**
   * Parse test results
   * @private
   */
  _parseTestResults(response, language) {
    try {
      // Try to parse the JSON response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                        response.match(/\{[\s\S]*"tests"[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }
      
      // If JSON parsing fails, create a structured response manually
      const tests = [];
      let passed = 0;
      let failed = 0;
      let coverage = 0;
      let assessment = '';
      
      // Basic parsing logic for test results
      const testBlocks = response.split(/Test\s+\d+|Test case/i).filter(block => block.trim());
      
      for (const block of testBlocks) {
        const nameMatch = block.match(/name:?\s*([^\n]+)/i);
        const passedMatch = block.match(/pass(ed)?|success/i);
        
        const test = {
          name: nameMatch ? nameMatch[1].trim() : `Test ${tests.length + 1}`,
          description: block.substring(0, 100).trim(),
          input: 'Not parsed',
          expectedOutput: 'Not parsed',
          actualOutput: 'Not parsed',
          passed: !!passedMatch,
          explanation: block.trim()
        };
        
        tests.push(test);
        
        if (test.passed) {
          passed++;
        } else {
          failed++;
        }
      }
      
      // Look for coverage and assessment
      const coverageMatch = response.match(/coverage:?\s*(\d+)%?/i);
      if (coverageMatch) {
        coverage = parseInt(coverageMatch[1]);
      }
      
      const assessmentMatch = response.match(/assessment:?\s*([^\n]+)/i);
      if (assessmentMatch) {
        assessment = assessmentMatch[1].trim();
      }
      
      return {
        tests,
        passed,
        failed,
        coverage: coverage || Math.round((passed / (passed + failed)) * 100) || 0,
        assessment: assessment || `${passed} tests passed, ${failed} tests failed`
      };
    } catch (error) {
      logger.error(`${this.logPrefix} Error parsing test results: ${error.message}`);
      
      // Return a basic structure if parsing fails
      return {
        tests: [],
        passed: 0,
        failed: 1,
        coverage: 0,
        assessment: 'Failed to parse test results properly'
      };
    }
  }
  
  /**
   * Extract test code from response
   * @private
   */
  _extractTestCode(response, language) {
    // Try to find code blocks
    const codeBlockMatch = response.match(new RegExp(`\`\`\`(?:${language})?\\s*([\\s\\S]*?)\\s*\`\`\``, 'i'));
    
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim();
    }
    
    // If no code blocks found, try to extract anything that looks like code
    const lines = response.split('\n');
    let inCodeSection = false;
    let codeLines = [];
    
    for (const line of lines) {
      if (line.includes('import ') || line.includes('function test') || line.includes('class Test') || 
          line.includes('describe(') || line.includes('it(') || line.includes('@Test')) {
        inCodeSection = true;
      }
      
      if (inCodeSection) {
        codeLines.push(line);
      }
    }
    
    if (codeLines.length > 0) {
      return codeLines.join('\n');
    }
    
    // If still no code found, return the whole response
    return response;
  }
  
  /**
   * Extract fixed code and summary from response
   * @private
   */
  _extractFixedCode(response, language) {
    // Try to find code blocks
    const codeBlockMatch = response.match(new RegExp(`\`\`\`(?:${language})?\\s*([\\s\\S]*?)\\s*\`\`\``, 'i'));
    let fixedCode = '';
    let changesSummary = [];
    
    if (codeBlockMatch && codeBlockMatch[1]) {
      fixedCode = codeBlockMatch[1].trim();
      
      // Look for a summary section
      const summaryMatch = response.match(/(?:changes|fixes|summary):\s*([^```]*)/i);
      
      if (summaryMatch && summaryMatch[1]) {
        // Split the summary into bullet points
        changesSummary = summaryMatch[1].split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line));
      }
    } else {
      // If no code blocks found, just return the whole response as fixed code
      fixedCode = response;
    }
    
    // If no summary found, generate a generic one
    if (changesSummary.length === 0) {
      changesSummary = ['Code was modified to fix the identified issues'];
    }
    
    return { fixedCode, changesSummary };
  }
  
  /**
   * Get default test framework for language
   * @private
   */
  _getDefaultTestFramework(language) {
    const frameworkMap = {
      'javascript': 'Jest',
      'typescript': 'Jest',
      'python': 'pytest',
      'java': 'JUnit',
      'csharp': 'NUnit',
      'c#': 'NUnit',
      'ruby': 'RSpec',
      'php': 'PHPUnit',
      'go': 'testing package',
      'rust': 'cargo test',
      'swift': 'XCTest'
    };
    
    return frameworkMap[language.toLowerCase()] || 'a standard testing framework';
  }
  
  /**
   * Log session start
   * @private
   */
  async _logSessionStart() {
    if (!this.memory) return;
    
    if (!this.memory.sessions) {
      this.memory.sessions = {};
    }
    
    const startTime = new Date().toISOString();
    
    this.memory.sessions[this.currentSessionId] = {
      startTime,
      endTime: null,
      actions: [],
      status: 'active'
    };
    
    await memoryManager.saveMemory(this.name, this.memory);
    
    logger.debug(`${this.logPrefix} New session started (${this.currentSessionId})`);
  }
  
  /**
   * Log session end
   * @private
   */
  async _logSessionEnd() {
    if (!this.memory || !this.currentSessionId) return;
    
    const session = this.memory.sessions[this.currentSessionId];
    if (!session) return;
    
    session.endTime = new Date().toISOString();
    session.status = 'completed';
    
    await memoryManager.saveMemory(this.name, this.memory);
    
    logger.debug(`${this.logPrefix} Session closed (${this.currentSessionId})`);
  }
  
  /**
   * Log agent action
   * @private
   */
  async _logAction(actionType, parameters, result, error = null) {
    if (!this.memory || !this.currentSessionId) return;
    
    const session = this.memory.sessions[this.currentSessionId];
    if (!session) return;
    
    if (!session.actions) {
      session.actions = [];
    }
    
    const timestamp = new Date().toISOString();
    
    const action = {
      id: `action_${uuidv4()}`,
      type: actionType,
      parameters,
      timestamp,
      success: !error,
      result: result || null,
      error: error || null
    };
    
    session.actions.push(action);
    
    await memoryManager.saveMemory(this.name, this.memory);
  }
}

module.exports = new QaAgent(); 