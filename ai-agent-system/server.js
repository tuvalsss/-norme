const express = require('express');
const cors = require('cors');
const logger = require('./core/logger');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs-extra');

// Load environment variables
dotenv.config();

// Import agents
const devAgent = require('./agents/dev_agent');
const qaAgent = require('./agents/qa');
const executorAgent = require('./agents/executor');
const summaryAgent = require('./agents/summary');
const gitSyncAgent = require('./agents/git_sync');
const schedulerAgent = require('./agents/scheduler_agent');

// Import project manager and memory manager
const projectManager = require('./core/projectManager');
const memoryManager = require('./core/memoryManager');
const agentManager = require('./core/agentManager');
const aiEngine = require('./core/aiEngine');
const workflowManager = require('./core/workflow/workflowManager');
const contextManager = require('./core/context/contextManager');
const metricsCollector = require('./core/analytics/metricsCollector');

// Create Express application
const app = express();
const PORT = process.env.PORT || 5001;

// Load middleware
app.use(cors());
app.use(express.json());

// Map agent names to instances
const agents = {
  'dev_agent': devAgent,
  'qa_agent': qaAgent,
  'executor_agent': executorAgent,
  'summary_agent': summaryAgent,
  'git_sync_agent': gitSyncAgent,
  'scheduler_agent': schedulerAgent
};

// Register agents in the system
agentManager.registerAgent('dev_agent', devAgent);
agentManager.registerAgent('qa_agent', qaAgent);
agentManager.registerAgent('executor_agent', executorAgent);
agentManager.registerAgent('summary_agent', summaryAgent);
agentManager.registerAgent('git_sync_agent', gitSyncAgent);
agentManager.registerAgent('scheduler_agent', schedulerAgent);

// Set new systems in the agent manager
agentManager.setWorkflowManager(workflowManager);
agentManager.setContextManager(contextManager);
agentManager.setMetricsCollector(metricsCollector);

// Route to run an agent
app.post('/run-agent', async (req, res) => {
  try {
    const { agent: agentName } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `Invalid agent: ${agentName}` });
    }
    
    const agent = agents[agentName];
    
    logger.info(`Starting agent: ${agentName}`);
    await agent.start();
    
    res.json({ 
      success: true, 
      message: `Agent ${agentName} started successfully`,
      status: { active: agent.active }
    });
  } catch (error) {
    logger.error(`Error starting agent: ${error.message}`);
    res.status(500).json({ 
      error: 'Error starting agent',
      message: error.message
    });
  }
});

// Route to stop an agent
app.post('/stop-agent', async (req, res) => {
  try {
    const { agent: agentName } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `Invalid agent: ${agentName}` });
    }
    
    const agent = agents[agentName];
    
    logger.info(`Stopping agent: ${agentName}`);
    await agent.stop();
    
    res.json({ 
      success: true, 
      message: `Agent ${agentName} stopped successfully`,
      status: { active: agent.active }
    });
  } catch (error) {
    logger.error(`Error stopping agent: ${error.message}`);
    res.status(500).json({ 
      error: 'Error stopping agent',
      message: error.message
    });
  }
});

// Route to get status of all agents
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'active',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Route for building a project
app.post('/build-project', async (req, res) => {
  try {
    const { project, requirements } = req.body;
    
    if (!project || !requirements) {
      return res.status(400).json({ 
        error: 'Missing information for project build',
        message: 'Project name and requirements are required'
      });
    }
    
    // Ensure dev agent is active
    if (!devAgent.active) {
      await devAgent.start();
    }
    
    // Create directory for the project
    const projectDir = `${project}`;
    
    // Create README.md with project requirements
    const readmePath = `${projectDir}/README.md`;
    const readmeContent = `# ${project}\n\n## Project Requirements\n\n${requirements}`;
    
    // Use the development agent to create the project
    logger.info(`Creating new project: ${projectDir}`);
    await devAgent.generateCode(readmePath, readmeContent);
    
    // Create basic package.json if it's a JavaScript/Node.js project
    const packageJsonPath = `${projectDir}/package.json`;
    const packageJsonContent = {
      name: project,
      version: '1.0.0',
      description: requirements.slice(0, 100) + '...',
      main: 'index.js',
      scripts: {
        start: 'node index.js'
      }
    };
    
    // Run the summary agent to create an initial project report
    if (!summaryAgent.active) {
      await summaryAgent.start();
    }
    
    const reportPath = `${projectDir}/project_report.md`;
    await summaryAgent.generateProjectReport(projectDir, reportPath);
    
    res.json({ 
      success: true, 
      message: `Project ${project} created successfully`,
      projectDir
    });
  } catch (error) {
    logger.error(`Error building project: ${error.message}`);
    res.status(500).json({ 
      error: 'Error building project',
      message: error.message
    });
  }
});

// Route for specific agent actions
app.post('/agent-action', async (req, res) => {
  try {
    const { agent: agentName, action, params } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `Invalid agent: ${agentName}` });
    }
    
    if (!action) {
      return res.status(400).json({ error: 'No action specified' });
    }
    
    const agent = agents[agentName];
    
    // Ensure the agent is active
    if (!agent.active) {
      await agent.start();
    }
    
    // Check if the action exists
    if (typeof agent[action] !== 'function') {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }
    
    // Run the requested action with parameters
    logger.info(`Running agent action: ${agentName}.${action}()`);
    const result = await agent[action](...(params || []));
    
    res.json({ 
      success: true, 
      result,
      message: `Action ${action} executed successfully on agent ${agentName}`
    });
  } catch (error) {
    logger.error(`Error executing agent action: ${error.message}`);
    res.status(500).json({ 
      error: 'Error executing agent action',
      message: error.message
    });
  }
});

// =============================================================
// API for Project Management
// =============================================================

// Get project list
app.get('/projects', async (req, res) => {
  try {
    const projects = await projectManager.getProjects();
    res.json(projects);
  } catch (error) {
    logger.error(`Error getting project list: ${error.message}`);
    res.status(500).json({ error: 'Error getting project list', message: error.message });
  }
});

// Add new project
app.post('/projects/add', async (req, res) => {
  try {
    const { name, path } = req.body;
    
    if (!name || !path) {
      return res.status(400).json({ error: 'Project name and path required' });
    }
    
    // Check if the path exists
    if (!fs.existsSync(path)) {
      return res.status(400).json({ error: 'The specified path does not exist' });
    }
    
    // Add the new project
    const newProject = await projectManager.addProject(name, path);
    
    // Automatically select it as the active project
    await projectManager.selectProject(name);
    
    res.json({ 
      success: true, 
      message: `Project ${name} added successfully`,
      project: newProject
    });
  } catch (error) {
    logger.error(`Error adding project: ${error.message}`);
    res.status(500).json({ error: 'Error adding project', message: error.message });
  }
});

// Select active project
app.post('/select-project', async (req, res) => {
  try {
    const { projectName } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ error: 'No project name specified' });
    }
    
    const result = await projectManager.selectProject(projectName);
    
    // Update agent paths to work on the selected project
    for (const agent of Object.values(agents)) {
      if (typeof agent.setProjectPath === 'function') {
        await agent.setProjectPath(result.path);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Project ${projectName} selected successfully`,
      project: result
    });
  } catch (error) {
    logger.error(`Error selecting project: ${error.message}`);
    res.status(500).json({ error: 'Error selecting project', message: error.message });
  }
});

// Get active project info
app.get('/active-project', async (req, res) => {
  try {
    const activeProject = await projectManager.getActiveProject();
    
    if (!activeProject) {
      return res.json({ success: true, message: 'No active project', project: null });
    }
    
    res.json({ success: true, project: activeProject });
  } catch (error) {
    logger.error(`Error getting active project: ${error.message}`);
    res.status(500).json({ error: 'Error getting active project', message: error.message });
  }
});

// Get file structure of active project
app.get('/active-project/files', async (req, res) => {
  try {
    const fileStructure = await projectManager.getProjectFiles();
    res.json({ success: true, files: fileStructure });
  } catch (error) {
    logger.error(`Error getting file structure: ${error.message}`);
    res.status(500).json({ error: 'Error getting file structure', message: error.message });
  }
});

// Read file content
app.get('/active-project/file', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'No file path specified' });
    }
    
    const content = await projectManager.readProjectFile(filePath);
    res.json({ success: true, path: filePath, content });
  } catch (error) {
    logger.error(`Error reading file: ${error.message}`);
    res.status(500).json({ error: 'Error reading file', message: error.message });
  }
});

// Open file in external editor
app.post('/open-file', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'No file path specified' });
    }
    
    const result = await projectManager.openFileInEditor(filePath);
    res.json({ success: true, message: result.message });
  } catch (error) {
    logger.error(`Error opening file: ${error.message}`);
    res.status(500).json({ error: 'Error opening file', message: error.message });
  }
});

// Live log endpoints for dashboard
app.get('/logs/live/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    // List of existing agents in the system
    const validAgents = ['dev_agent', 'qa_agent', 'executor_agent', 'summary_agent'];
    
    if (!validAgents.includes(agentName)) {
      return res.status(404).json({ error: `Agent ${agentName} not found` });
    }
    
    // Path to the agent's log file
    const logPath = path.join(__dirname, `logs/README_${agentName}.md`);
    
    // Check if the file exists
    if (!fs.existsSync(logPath)) {
      // If the file doesn't exist, create a basic log file
      const defaultContent = `# ${agentName} Log\n\nNo activities recorded yet.`;
      
      // Create logs directory if it doesn't exist
      if (!fs.existsSync(path.join(__dirname, 'logs'))) {
        fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
      }
      
      // Write default content
      fs.writeFileSync(logPath, defaultContent, 'utf8');
      return res.send(defaultContent);
    }
    
    // Read the file and return
    const logContent = fs.readFileSync(logPath, 'utf8');
    res.send(logContent);
    
  } catch (error) {
    logger.error(`Error reading log for agent: ${error.message}`);
    res.status(500).send(`Error reading log: ${error.message}`);
  }
});

// Endpoint for workspace
app.get('/workspace', async (req, res) => {
  try {
    const activeProject = await projectManager.getActiveProject();
    res.json({ activeProject });
  } catch (error) {
    logger.error(`Error getting workspace: ${error.message}`);
    res.status(500).json({ error: 'Error getting workspace', message: error.message });
  }
});

// Set project as workspace
app.post('/workspace/set', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID not provided' });
    }
    
    // Get project list
    const projects = await projectManager.getProjects();
    console.log("Getting projects...", projects);
    
    // Find the project by ID
    const project = projects.find(p => p.id === projectId || p.name === projectId);
    console.log("Found project:", project);
    
    if (!project) {
      console.log("No project found with ID:", projectId);
      console.log("Available projects:", projects);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Set the project as active
    const result = await projectManager.selectProject(project.name);
    
    // Update agents
    for (const agent of Object.values(agents)) {
      if (typeof agent.setProjectPath === 'function') {
        try {
          await agent.setProjectPath(result.path);
        } catch (err) {
          console.error(`Error updating project path for agent:`, err);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `Project ${project.name} selected successfully`,
      workspace: project
    });
  } catch (error) {
    logger.error(`Error setting workspace: ${error.message}`);
    res.status(500).json({ error: 'Error setting workspace', message: error.message });
  }
});

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // List all routes in the system
  console.log("\nAvailable API endpoints:");
  
  // Display all defined routes
  const endpoints = [];
  
  app._router.stack.forEach(middleware => {
    if(middleware.route) { // routes registered directly on the app
      endpoints.push(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
    } else if(middleware.name === 'router') { // router middleware
      middleware.handle.stack.forEach(handler => {
        if(handler.route) {
          const method = Object.keys(handler.route.methods)[0].toUpperCase();
          endpoints.push(`${method} ${handler.route.path}`);
        }
      });
    }
  });
  
  // Sort routes alphabetically
  endpoints.sort().forEach(endpoint => {
    console.log(`- ${endpoint}`);
  });
  
  // Initialize scheduler agent if defined in .env
  if (process.env.SCHEDULER_AUTO_INIT === 'true') {
    schedulerAgent.init();
    console.log('Scheduler agent initialized');
  }
  
  console.log('[agent_manager] Scheduler agent registered in the system');
});

// =============================================================
// API for Git Management
// =============================================================

// Perform manual sync
app.post('/git/sync', async (req, res) => {
  try {
    // Ensure Git agent is active
    if (!gitSyncAgent.active) {
      await gitSyncAgent.start();
    }
    
    // Run manual sync
    await gitSyncAgent.syncRepository();
    
    res.json({ 
      success: true, 
      message: 'Git sync completed successfully'
    });
  } catch (error) {
    logger.error(`Error performing Git sync: ${error.message}`);
    res.status(500).json({ error: 'Error performing Git sync', message: error.message });
  }
});

// Initialize Git repository
app.post('/git/init', async (req, res) => {
  try {
    const { remoteUrl, branch = 'main' } = req.body;
    
    if (!remoteUrl) {
      return res.status(400).json({ error: 'Remote repository URL not specified' });
    }
    
    // Ensure Git agent is active
    if (!gitSyncAgent.active) {
      await gitSyncAgent.start();
    }
    
    // Initialize Git repository
    await gitSyncAgent.initRepository(remoteUrl, branch);
    
    res.json({ 
      success: true, 
      message: `Git repository initialized successfully with branch ${branch}`
    });
  } catch (error) {
    logger.error(`Error initializing Git repository: ${error.message}`);
    res.status(500).json({ error: 'Error initializing Git repository', message: error.message });
  }
});

// =============================================================
// API for Agent Memory Management
// =============================================================

// Get list of agents with memory
app.get('/memory', async (req, res) => {
  try {
    const agentsMemory = await memoryManager.getAllAgentsMemoryStats();
    res.json(agentsMemory);
  } catch (error) {
    logger.error(`Error getting memory data: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get specific agent memory info
app.get('/memory/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    if (!agentName) {
      return res.status(400).json({ error: 'Agent name required' });
    }
    
    const memoryData = await memoryManager.getMemoryForApi(agentName);
    res.json(memoryData);
  } catch (error) {
    logger.error(`Error getting agent memory data: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Search in agent memory
app.post('/memory/:agent/search', async (req, res) => {
  try {
    const agentName = req.params.agent;
    const { query, options } = req.body;
    
    if (!agentName) {
      return res.status(400).json({ error: 'Agent name required' });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const results = await memoryManager.searchMemory(agentName, query, options);
    res.json(results);
  } catch (error) {
    logger.error(`Error searching memory: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Delete agent memory
app.delete('/memory/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    if (!agentName) {
      return res.status(400).json({ error: 'Agent name required' });
    }
    
    await memoryManager.deleteMemory(agentName);
    res.json({ success: true, message: `Memory for agent ${agentName} deleted successfully` });
  } catch (error) {
    logger.error(`Error deleting memory: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================
// API for Agent Manager
// =============================================================

// Start agent manager
app.post('/agent-manager/start', async (req, res) => {
  try {
    agentManager.start();
    res.json({ 
      success: true, 
      message: 'Agent manager started successfully'
    });
  } catch (error) {
    logger.error(`Error starting agent manager: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Stop agent manager
app.post('/agent-manager/stop', async (req, res) => {
  try {
    agentManager.stop();
    res.json({ 
      success: true, 
      message: 'Agent manager stopped successfully'
    });
  } catch (error) {
    logger.error(`Error stopping agent manager: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get agent manager statistics
app.get('/agent-manager/stats', async (req, res) => {
  try {
    const stats = agentManager.getStats();
    res.json(stats);
  } catch (error) {
    logger.error(`Error getting agent manager statistics: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get current activity information
app.get('/agent-manager/current-activity', async (req, res) => {
  try {
    const { currentActivity, currentHeavyAgent } = agentManager;
    
    res.json({ 
      currentActivity,
      currentHeavyAgent
    });
  } catch (error) {
    logger.error(`Error getting current activity: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Schedule new task
app.post('/agent-manager/schedule-task', async (req, res) => {
  try {
    const { agentName, action, params, options } = req.body;
    
    if (!agentName || !action) {
      return res.status(400).json({ error: 'Agent name and action required' });
    }

    // Ensure agent is registered
    if (!agents[agentName]) {
      return res.status(404).json({ error: `Agent ${agentName} not found` });
    }
    
    // Register agent if not already registered
    if (!agentManager.agents.has(agentName)) {
      agentManager.registerAgent(agentName, agents[agentName]);
    }
    
    // Add task to queue
    const taskId = await agentManager.scheduleTask(agentName, action, params, options);
    
    res.json({ 
      success: true, 
      message: `Task ${taskId} added to queue`,
      taskId
    });
  } catch (error) {
    logger.error(`Error scheduling task: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get task status
app.get('/agent-manager/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = agentManager.getTaskStatus(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `Task ${taskId} not found` });
    }
    
    res.json(task);
  } catch (error) {
    logger.error(`Error getting task status: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API endpoints for scheduler agent
app.get('/scheduler/tasks/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const tasks = await schedulerAgent.getTasksForAgent(agentId);
    res.json(tasks);
  } catch (error) {
    console.error('Error getting scheduled tasks:', error);
    res.status(500).json({ error: 'Failed to get scheduled tasks' });
  }
});

app.post('/scheduler/create', async (req, res) => {
  try {
    const { agentId, name, cronExpression, action, params } = req.body;
    const taskId = await schedulerAgent.scheduleTask(agentId, name, cronExpression, action, params);
    res.json({ success: true, taskId });
  } catch (error) {
    console.error('Error creating scheduled task:', error);
    res.status(500).json({ error: 'Failed to create scheduled task' });
  }
});

app.delete('/scheduler/delete/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    await schedulerAgent.removeTask(taskId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled task:', error);
    res.status(500).json({ error: 'Failed to delete scheduled task' });
  }
});

// API endpoints for summary agent
app.get('/summary/agent/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    const { period, insights, format } = req.query;

    // Use the global summaryAgent instance instead of trying to get it from agentManager
    if (!summaryAgent) {
      return res.status(404).json({ error: 'Summary agent not found' });
    }

    const options = {
      timePeriod: period ? parseInt(period) : 24,
      includeInsights: insights !== 'false',
      format: format || 'json'
    };

    const summary = await summaryAgent.generateAgentSummary(agentName, options);
    res.json(summary);
  } catch (error) {
    console.error('Error generating agent summary:', error);
    res.status(500).json({ error: 'Failed to generate agent summary', details: error.message });
  }
});

app.get('/summary/system', async (req, res) => {
  try {
    const { period, insights, format } = req.query;

    // Use the global summaryAgent instance instead of trying to get it from agentManager
    if (!summaryAgent) {
      return res.status(404).json({ error: 'Summary agent not found' });
    }

    const options = {
      timePeriod: period ? parseInt(period) : 24,
      includeInsights: insights !== 'false',
      format: format || 'json'
    };

    const summary = await summaryAgent.generateSystemSummary(options);
    res.json(summary);
  } catch (error) {
    console.error('Error generating system summary:', error);
    res.status(500).json({ error: 'Failed to generate system summary', details: error.message });
  }
});

// API endpoint for AI queries
app.post('/ask-ai', async (req, res) => {
  try {
    const { prompt, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Query is missing' });
    }
    
    let modelId;
    switch (model) {
      case 'gpt-4':
        modelId = 'openai/gpt-4-turbo';
        break;
      case 'claude-3.7':
        modelId = 'anthropic/claude-3-7-sonnet';
        break;
      case 'huggingface':
        modelId = 'huggingface/mistral-7b';
        break;
      default:
        modelId = 'openai/gpt-4-turbo';
    }
    
    logger.info(`AI query received: "${prompt.substring(0, 50)}..." with model ${modelId}`);
    
    const response = await aiEngine.generateText({
      model: modelId,
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 1000
    });
    
    res.json({ response });
  } catch (error) {
    logger.error(`Error executing AI query: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Path to get information about agents in the system
app.get('/agents', async (req, res) => {
  try {
    const agentsList = Object.keys(agents).map(agentName => {
      const agent = agents[agentName];
      return {
        id: agentName,
        name: agentName,
        status: agent.active ? 'active' : 'inactive',
        type: 'AI Agent',
        description: `AI ${agentName} agent`
      };
    });
    
    res.json(agentsList);
  } catch (error) {
    logger.error(`Error getting agents list: ${error.message}`);
    res.status(500).json({ error: 'Error getting agents list', message: error.message });
  }
});

// Path to get information about a specific agent
app.get('/agents/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agents[agentId]) {
      return res.status(404).json({ error: `Agent ${agentId} not found` });
    }
    
    const agent = agents[agentId];
    
    res.json({
      id: agentId,
      name: agentId,
      status: agent.active ? 'active' : 'inactive',
      type: 'AI Agent',
      description: `AI ${agentId} agent`,
      capabilities: Object.keys(agent).filter(key => typeof agent[key] === 'function')
    });
  } catch (error) {
    logger.error(`Error getting agent info: ${error.message}`);
    res.status(500).json({ error: 'Error getting agent info', message: error.message });
  }
});

// Path to get memory of a specific agent via /agents path (remapped to /memory/:agent)
app.get('/agents/:agentId/memory', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID required' });
    }
    
    const memoryData = await memoryManager.getMemoryForApi(agentId);
    res.json(memoryData);
  } catch (error) {
    logger.error(`Error getting agent memory: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Path to search in memory of a specific agent via /agents path
app.post('/agents/:agentId/memory/search', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { query, options } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID required' });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const results = await memoryManager.searchMemory(agentId, query, options);
    res.json(results);
  } catch (error) {
    logger.error(`Error searching agent memory: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API to open folder selection dialog
app.get('/select-folder', (req, res) => {
  try {
    // In a real scenario, we would use Electron or another Node.js library to open a dialog
    // Here we simulate it by calling an appropriate OS command
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Command to open folder selection dialog on Windows
      const command = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog -Property @{Description = 'Choose a project folder'; ShowNewFolderButton = $true}; if ($folderBrowser.ShowDialog() -eq 'OK') {$folderBrowser.SelectedPath}"`;
      
      require('child_process').exec(command, (err, stdout, stderr) => {
        if (err) {
          logger.error(`Error opening folder dialog: ${err}`);
          return res.status(500).json({ error: "Error opening folder dialog" });
        }
        
        const selectedPath = stdout.trim();
        
        if (!selectedPath) {
          return res.json({ cancelled: true });
        }
        
        res.json({ path: selectedPath });
      });
    } else {
      // Linux/Mac
      const command = `zenity --file-selection --directory --title="Choose a project folder"`;
      
      require('child_process').exec(command, (err, stdout, stderr) => {
        if (err && err.code !== 1) { // Exit code 1 in zenity indicates cancellation
          logger.error(`Error opening folder dialog: ${err}`);
          return res.status(500).json({ error: "Error opening folder dialog" });
        }
        
        const selectedPath = stdout.trim();
        
        if (!selectedPath) {
          return res.json({ cancelled: true });
        }
        
        res.json({ path: selectedPath });
      });
    }
  } catch (err) {
    logger.error(`Error selecting folder: ${err.message}`);
    res.status(500).json({ error: "Error selecting folder" });
  }
});

// API endpoints for workflow system
app.get('/workflows', async (req, res) => {
  try {
    const workflows = workflowManager.getAllWorkflows();
    res.json(workflows);
  } catch (error) {
    logger.error(`Error getting workflows: ${error.message}`);
    res.status(500).json({ error: 'Failed to get workflows', details: error.message });
  }
});

app.get('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = workflowManager.getWorkflow(id);
    res.json(workflow);
  } catch (error) {
    logger.error(`Error getting workflow ${req.params.id}: ${error.message}`);
    res.status(404).json({ error: 'Workflow not found', details: error.message });
  }
});

app.post('/workflows', async (req, res) => {
  try {
    const { id, config } = req.body;
    
    if (!config || !config.name || !Array.isArray(config.steps) || config.steps.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid workflow configuration', 
        details: 'Config must include name and at least one step' 
      });
    }
    
    const workflowId = workflowManager.registerWorkflow(id, config);
    res.status(201).json({ id: workflowId, message: 'Workflow registered successfully' });
  } catch (error) {
    logger.error(`Error registering workflow: ${error.message}`);
    res.status(500).json({ error: 'Failed to register workflow', details: error.message });
  }
});

app.post('/workflows/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const { context = {}, options = {} } = req.body;
    
    const runId = await workflowManager.startWorkflow(id, context, options);
    res.json({ runId, message: 'Workflow started successfully' });
  } catch (error) {
    logger.error(`Error starting workflow ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: 'Failed to start workflow', details: error.message });
  }
});

app.get('/workflow-runs', async (req, res) => {
  try {
    const runs = workflowManager.getActiveWorkflows();
    res.json(runs);
  } catch (error) {
    logger.error(`Error getting workflow runs: ${error.message}`);
    res.status(500).json({ error: 'Failed to get workflow runs', details: error.message });
  }
});

app.get('/workflow-runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const status = workflowManager.getWorkflowStatus(runId);
    res.json(status);
  } catch (error) {
    logger.error(`Error getting workflow run ${req.params.runId}: ${error.message}`);
    res.status(404).json({ error: 'Workflow run not found', details: error.message });
  }
});

app.delete('/workflow-runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const result = workflowManager.stopWorkflow(runId);
    res.json({ success: result, message: 'Workflow stopped successfully' });
  } catch (error) {
    logger.error(`Error stopping workflow run ${req.params.runId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to stop workflow', details: error.message });
  }
});

// API endpoints for analytics
app.get('/metrics/system', async (req, res) => {
  try {
    const { period = 24 } = req.query;
    const metrics = metricsCollector.getSystemMetrics(parseInt(period) || 24);
    res.json(metrics);
  } catch (error) {
    logger.error(`Error getting system metrics: ${error.message}`);
    res.status(500).json({ error: 'Failed to get system metrics', details: error.message });
  }
});

app.get('/metrics/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { period = 24 } = req.query;
    
    const metrics = metricsCollector.getAgentMetrics(agentId, parseInt(period) || 24);
    
    if (!metrics) {
      return res.status(404).json({ error: 'Agent metrics not found' });
    }
    
    res.json(metrics);
  } catch (error) {
    logger.error(`Error getting agent metrics for ${req.params.agentId}: ${error.message}`);
    res.status(500).json({ error: 'Failed to get agent metrics', details: error.message });
  }
}); 