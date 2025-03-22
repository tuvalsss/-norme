const express = require('express');
const cors = require('cors');
const { logger } = require('./core/logger');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs-extra');

// ╫ר╫ó╫ƒ ╫₧╫⌐╫¬╫á╫ש╫¥ ╫í╫ס╫ש╫ס╫¬╫ש╫ש╫¥
dotenv.config();

// ╫ש╫ש╫ס╫ץ╫נ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
const devAgent = require('./agents/dev_agent');
const qaAgent = require('./agents/qa');
const executorAgent = require('./agents/executor');
const summaryAgent = require('./agents/summary');
const gitSyncAgent = require('./agents/git_sync');
const schedulerAgent = require('./agents/scheduler_agent');

// ╫ש╫ש╫ס╫ץ╫נ ╫₧╫á╫פ╫£ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥ ╫ץ╫₧╫á╫פ╫£ ╫פ╫צ╫ש╫¢╫¿╫ץ╫ƒ
const projectManager = require('./core/projectManager');
const memoryManager = require('./core/memoryManager');
const agentManager = require('./core/agentManager');
const aiEngine = require('./core/aiEngine');

// ╫ש╫ª╫ש╫¿╫¬ ╫נ╫ñ╫£╫ש╫º╫ª╫ש╫ש╫¬ Express
const app = express();
const PORT = process.env.PORT || 5001;

// ╫ר╫ó╫ƒ ╫₧╫ש╫ף╫£╫ץ╫ץ╫¿
app.use(cors());
app.use(express.json());

// ╫₧╫ש╫ñ╫ץ╫ש ╫⌐╫₧╫ץ╫¬ ╫í╫ץ╫¢╫á╫ש╫¥ ╫£╫₧╫ץ╫ñ╫ó╫ש╫¥
const agents = {
  'dev_agent': devAgent,
  'qa_agent': qaAgent,
  'executor_agent': executorAgent,
  'summary_agent': summaryAgent,
  'git_sync_agent': gitSyncAgent,
  'scheduler_agent': schedulerAgent
};

// ╫¿╫ש╫⌐╫ץ╫¥ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫ס╫₧╫ó╫¿╫¢╫¬
const registerAgents = async () => {
  // ╫¿╫ש╫⌐╫ץ╫¥ ╫í╫ץ╫¢╫á╫ש╫¥ ╫º╫ש╫ש╫₧╫ש╫¥
  const devAgent = require('./agents/dev_agent');
  const qaAgent = require('./agents/qa');
  const executorAgent = require('./agents/executor');
  const gitSyncAgent = require('./agents/git_sync');
  // ╫⌐╫ש╫₧╫ץ╫⌐ ╫ס╫í╫ץ╫¢╫ƒ ╫פ╫í╫ש╫¢╫ץ╫¥ ╫⌐╫¢╫ס╫¿ ╫ש╫ץ╫ס╫נ ╫ס╫¿╫נ╫⌐ ╫פ╫º╫ץ╫ס╫Ñ
  // const summaryAgent = require('./agents/summary_agent');

  // ╫¿╫ש╫⌐╫ץ╫¥ ╫í╫ץ╫¢╫ƒ ╫פ╫¬╫צ╫₧╫ץ╫ƒ ╫פ╫ק╫ף╫⌐
  agentManager.registerAgent('scheduler', schedulerAgent);
  
  // ╫¿╫ש╫⌐╫ץ╫¥ ╫í╫ץ╫¢╫ƒ ╫פ╫í╫ש╫¢╫ץ╫¥ - ╫פ╫⌐╫¥ ╫ק╫ש╫ש╫ס ╫£╫פ╫¬╫נ╫ש╫¥ ╫£╫₧╫פ ╫⌐╫₧╫ץ╫ע╫ף╫¿ ╫ס╫º╫ץ╫ס╫Ñ summary.js
  agentManager.registerAgent('summary_agent', summaryAgent);

  // ... existing code ...
};

// ╫á╫¬╫ש╫ס ╫£╫פ╫ñ╫ó╫£╫¬ ╫í╫ץ╫¢╫ƒ
app.post('/run-agent', async (req, res) => {
  try {
    const { agent: agentName } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `╫í╫ץ╫¢╫ƒ ╫£╫נ ╫¬╫º╫ש╫ƒ: ${agentName}` });
    }
    
    const agent = agents[agentName];
    
    logger.info(`╫₧╫ñ╫ó╫ש╫£ ╫í╫ץ╫¢╫ƒ: ${agentName}`);
    await agent.start();
    
    res.json({ 
      success: true, 
      message: `╫í╫ץ╫¢╫ƒ ${agentName} ╫פ╫ץ╫ñ╫ó╫£ ╫ס╫פ╫ª╫£╫ק╫פ`,
      status: { active: agent.active }
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫ó╫£╫¬ ╫í╫ץ╫¢╫ƒ: ${error.message}`);
    res.status(500).json({ 
      error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫ó╫£╫¬ ╫פ╫í╫ץ╫¢╫ƒ',
      message: error.message
    });
  }
});

// ╫á╫¬╫ש╫ס ╫£╫¢╫ש╫ס╫ץ╫ש ╫í╫ץ╫¢╫ƒ
app.post('/stop-agent', async (req, res) => {
  try {
    const { agent: agentName } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `╫í╫ץ╫¢╫ƒ ╫£╫נ ╫¬╫º╫ש╫ƒ: ${agentName}` });
    }
    
    const agent = agents[agentName];
    
    logger.info(`╫₧╫¢╫ס╫פ ╫í╫ץ╫¢╫ƒ: ${agentName}`);
    await agent.stop();
    
    res.json({ 
      success: true, 
      message: `╫í╫ץ╫¢╫ƒ ${agentName} ╫¢╫ץ╫ס╫פ ╫ס╫פ╫ª╫£╫ק╫פ`,
      status: { active: agent.active }
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫¢╫ש╫ס╫ץ╫ש ╫í╫ץ╫¢╫ƒ: ${error.message}`);
    res.status(500).json({ 
      error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫¢╫ש╫ס╫ץ╫ש ╫פ╫í╫ץ╫¢╫ƒ',
      message: error.message
    });
  }
});

// ╫á╫¬╫ש╫ס ╫£╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ץ╫í ╫¢╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
app.get('/status', async (req, res) => {
  try {
    const status = {};
    
    for (const [agentName, agent] of Object.entries(agents)) {
      status[agentName] = { active: agent.active };
      
      // ╫פ╫ץ╫í╫ú ╫₧╫ש╫ף╫ó ╫á╫ץ╫í╫ú ╫£╫í╫ץ╫¢╫á╫ש╫¥ ╫₧╫í╫ץ╫ש╫₧╫ש╫¥
      if (agentName === 'executor_agent' && agent.active) {
        status[agentName].processes = (await agent.getStatus()).runningProcesses;
      }
    }
    
    res.json({ success: true, status });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ץ╫í: ${error.message}`);
    res.status(500).json({ 
      error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ץ╫í',
      message: error.message
    });
  }
});

// ╫á╫¬╫ש╫ס ╫£╫ס╫á╫ש╫ש╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר
app.post('/build-project', async (req, res) => {
  try {
    const { project, requirements } = req.body;
    
    if (!project || !requirements) {
      return res.status(400).json({ 
        error: '╫ק╫í╫¿ ╫₧╫ש╫ף╫ó ╫£╫ס╫á╫ש╫ש╫¬ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר',
        message: '╫á╫ף╫¿╫⌐ ╫⌐╫¥ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ץ╫ף╫¿╫ש╫⌐╫ץ╫¬'
      });
    }
    
    // ╫ץ╫ץ╫ף╫נ ╫⌐╫í╫ץ╫¢╫ƒ ╫פ╫ñ╫ש╫¬╫ץ╫ק ╫ñ╫ó╫ש╫£
    if (!devAgent.active) {
      await devAgent.start();
    }
    
    // ╫ª╫ץ╫¿ ╫ץ╫¬╫ש╫º╫ש╫ש╫פ ╫ó╫ס╫ץ╫¿ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
    const projectDir = `${project}`;
    
    // ╫ª╫ץ╫¿ ╫º╫ץ╫ס╫Ñ README.md ╫ó╫¥ ╫ף╫¿╫ש╫⌐╫ץ╫¬ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
    const readmePath = `${projectDir}/README.md`;
    const readmeContent = `# ${project}\n\n## ╫ף╫¿╫ש╫⌐╫ץ╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר\n\n${requirements}`;
    
    // ╫פ╫⌐╫¬╫₧╫⌐ ╫ס╫í╫ץ╫¢╫ƒ ╫פ╫ñ╫ש╫¬╫ץ╫ק ╫£╫ש╫ª╫ש╫¿╫¬ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר
    logger.info(`╫ש╫ץ╫ª╫¿ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ק╫ף╫⌐: ${projectDir}`);
    await devAgent.generateCode(readmePath, readmeContent);
    
    // ╫ª╫ץ╫¿ ╫º╫ץ╫ס╫Ñ package.json ╫ס╫í╫ש╫í╫ש ╫נ╫¥ ╫₧╫ף╫ץ╫ס╫¿ ╫ס╫ñ╫¿╫ץ╫ש╫º╫ר JavaScript/Node.js
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
    
    // ╫פ╫ñ╫ó╫£ ╫נ╫¬ ╫í╫ץ╫¢╫ƒ ╫פ╫í╫ש╫¢╫ץ╫¥ ╫£╫ש╫ª╫ש╫¿╫¬ ╫ף╫ץ╫ק ╫ñ╫¿╫ץ╫ש╫º╫ר ╫¿╫נ╫⌐╫ץ╫á╫ש
    if (!summaryAgent.active) {
      await summaryAgent.start();
    }
    
    const reportPath = `${projectDir}/project_report.md`;
    await summaryAgent.generateProjectReport(projectDir, reportPath);
    
    res.json({ 
      success: true, 
      message: `╫ñ╫¿╫ץ╫ש╫º╫ר ${project} ╫á╫ץ╫ª╫¿ ╫ס╫פ╫ª╫£╫ק╫פ`,
      projectDir
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ס╫á╫ש╫ש╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר: ${error.message}`);
    res.status(500).json({ 
      error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫ס╫á╫ש╫ש╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר',
      message: error.message
    });
  }
});

// ╫á╫¬╫ש╫ס ╫£╫פ╫ñ╫ó╫£╫¬ ╫ñ╫ó╫ץ╫£╫ץ╫¬ ╫í╫ץ╫¢╫ƒ ╫í╫ñ╫ª╫ש╫ñ╫ש╫ץ╫¬
app.post('/agent-action', async (req, res) => {
  try {
    const { agent: agentName, action, params } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `╫í╫ץ╫¢╫ƒ ╫£╫נ ╫¬╫º╫ש╫ƒ: ${agentName}` });
    }
    
    if (!action) {
      return res.status(400).json({ error: '╫£╫נ ╫ª╫ץ╫ש╫á╫פ ╫ñ╫ó╫ץ╫£╫פ' });
    }
    
    const agent = agents[agentName];
    
    // ╫ץ╫ץ╫ף╫נ ╫⌐╫פ╫í╫ץ╫¢╫ƒ ╫ñ╫ó╫ש╫£
    if (!agent.active) {
      await agent.start();
    }
    
    // ╫ס╫ף╫ץ╫º ╫נ╫¥ ╫פ╫ñ╫ó╫ץ╫£╫פ ╫º╫ש╫ש╫₧╫¬
    if (typeof agent[action] !== 'function') {
      return res.status(400).json({ error: `╫ñ╫ó╫ץ╫£╫פ ╫£╫נ ╫¬╫º╫ש╫á╫פ: ${action}` });
    }
    
    // ╫פ╫ñ╫ó╫£ ╫נ╫¬ ╫פ╫ñ╫ó╫ץ╫£╫פ ╫פ╫₧╫ס╫ץ╫º╫⌐╫¬ ╫ó╫¥ ╫פ╫ñ╫¿╫₧╫ר╫¿╫ש╫¥
    logger.info(`╫₧╫ñ╫ó╫ש╫£ ╫ñ╫ó╫ץ╫£╫¬ ╫í╫ץ╫¢╫ƒ: ${agentName}.${action}()`);
    const result = await agent[action](...(params || []));
    
    res.json({ 
      success: true, 
      result,
      message: `╫ñ╫ó╫ץ╫£╫פ ${action} ╫פ╫ץ╫ñ╫ó╫£╫פ ╫ס╫פ╫ª╫£╫ק╫פ ╫ó╫£ ╫í╫ץ╫¢╫ƒ ${agentName}`
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫ó╫£╫¬ ╫ñ╫ó╫ץ╫£╫¬ ╫í╫ץ╫¢╫ƒ: ${error.message}`);
    res.status(500).json({ 
      error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫ó╫£╫¬ ╫ñ╫ó╫ץ╫£╫¬ ╫í╫ץ╫¢╫ƒ',
      message: error.message
    });
  }
});

// =============================================================
// API ╫£╫á╫ש╫פ╫ץ╫£ ╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥
// =============================================================

// ╫º╫ס╫£╫¬ ╫¿╫⌐╫ש╫₧╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥
app.get('/projects', async (req, res) => {
  try {
    const projects = await projectManager.getProjects();
    res.json(projects);
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫¿╫⌐╫ש╫₧╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫¿╫⌐╫ש╫₧╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥', message: error.message });
  }
});

// ╫פ╫ץ╫í╫ñ╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ק╫ף╫⌐
app.post('/projects/add', async (req, res) => {
  try {
    const { name, path } = req.body;
    
    if (!name || !path) {
      return res.status(400).json({ error: '╫á╫ף╫¿╫⌐ ╫⌐╫¥ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ץ╫á╫¬╫ש╫ס' });
    }
    
    // ╫ס╫ף╫ץ╫º ╫נ╫¥ ╫פ╫á╫¬╫ש╫ס ╫º╫ש╫ש╫¥
    if (!fs.existsSync(path)) {
      return res.status(400).json({ error: '╫פ╫á╫¬╫ש╫ס ╫⌐╫ª╫ץ╫ש╫ƒ ╫נ╫ש╫á╫ץ ╫º╫ש╫ש╫¥' });
    }
    
    // ╫פ╫ץ╫í╫ú ╫נ╫¬ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר ╫פ╫ק╫ף╫⌐
    const newProject = await projectManager.addProject(name, path);
    
    // ╫ס╫ק╫¿ ╫נ╫ץ╫¬╫ץ ╫נ╫ץ╫ר╫ץ╫₧╫ר╫ש╫¬ ╫¢╫ñ╫¿╫ץ╫ש╫º╫ר ╫פ╫ñ╫ó╫ש╫£
    await projectManager.selectProject(name);
    
    res.json({ 
      success: true, 
      message: `╫ñ╫¿╫ץ╫ש╫º╫ר ${name} ╫á╫ץ╫í╫ú ╫ס╫פ╫ª╫£╫ק╫פ`,
      project: newProject
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ץ╫í╫ñ╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ץ╫í╫ñ╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר', message: error.message });
  }
});

// ╫ס╫ק╫ש╫¿╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ñ╫ó╫ש╫£
app.post('/select-project', async (req, res) => {
  try {
    const { projectName } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ error: '╫£╫נ ╫ª╫ץ╫ש╫ƒ ╫⌐╫¥ ╫ñ╫¿╫ץ╫ש╫º╫ר' });
    }
    
    const result = await projectManager.selectProject(projectName);
    
    // ╫ó╫ף╫¢╫ƒ ╫נ╫¬ ╫á╫¬╫ש╫ס╫ש ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫£╫ó╫ס╫ץ╫ף ╫ó╫£ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר ╫פ╫á╫ס╫ק╫¿
    for (const agent of Object.values(agents)) {
      if (typeof agent.setProjectPath === 'function') {
        await agent.setProjectPath(result.path);
      }
    }
    
    res.json({ 
      success: true, 
      message: `╫ñ╫¿╫ץ╫ש╫º╫ר ${projectName} ╫á╫ס╫ק╫¿ ╫ס╫פ╫ª╫£╫ק╫פ`,
      project: result
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ס╫ק╫ש╫¿╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫ס╫ק╫ש╫¿╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר', message: error.message });
  }
});

// ╫º╫ס╫£╫¬ ╫₧╫ש╫ף╫ó ╫ó╫£ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר ╫פ╫ñ╫ó╫ש╫£
app.get('/active-project', async (req, res) => {
  try {
    const activeProject = await projectManager.getActiveProject();
    
    if (!activeProject) {
      return res.json({ success: true, message: '╫נ╫ש╫ƒ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ñ╫ó╫ש╫£', project: null });
    }
    
    res.json({ success: true, project: activeProject });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ñ╫ó╫ש╫£: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ñ╫ó╫ש╫£', message: error.message });
  }
});

// ╫º╫ס╫£╫¬ ╫₧╫ס╫á╫פ ╫פ╫º╫ס╫ª╫ש╫¥ ╫⌐╫£ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר ╫פ╫ñ╫ó╫ש╫£
app.get('/active-project/files', async (req, res) => {
  try {
    const fileStructure = await projectManager.getProjectFiles();
    res.json({ success: true, files: fileStructure });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫₧╫ס╫á╫פ ╫º╫ס╫ª╫ש╫¥: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫₧╫ס╫á╫פ ╫º╫ס╫ª╫ש╫¥', message: error.message });
  }
});

// ╫º╫¿╫ש╫נ╫¬ ╫¬╫ץ╫¢╫ƒ ╫º╫ץ╫ס╫Ñ
app.get('/active-project/file', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: '╫£╫נ ╫ª╫ץ╫ש╫ƒ ╫á╫¬╫ש╫ס ╫£╫º╫ץ╫ס╫Ñ' });
    }
    
    const content = await projectManager.readProjectFile(filePath);
    res.json({ success: true, path: filePath, content });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫¿╫ש╫נ╫¬ ╫º╫ץ╫ס╫Ñ: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫¿╫ש╫נ╫¬ ╫º╫ץ╫ס╫Ñ', message: error.message });
  }
});

// ╫ñ╫¬╫ש╫ק╫¬ ╫º╫ץ╫ס╫Ñ ╫ס╫ó╫ץ╫¿╫ת ╫ק╫ש╫ª╫ץ╫á╫ש
app.post('/open-file', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: '╫£╫נ ╫ª╫ץ╫ש╫ƒ ╫á╫¬╫ש╫ס ╫£╫º╫ץ╫ס╫Ñ' });
    }
    
    const result = await projectManager.openFileInEditor(filePath);
    res.json({ success: true, message: result.message });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ñ╫¬╫ש╫ק╫¬ ╫º╫ץ╫ס╫Ñ: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫ñ╫¬╫ש╫ק╫¬ ╫º╫ץ╫ס╫Ñ', message: error.message });
  }
});

// ╫á╫º╫ץ╫ף╫ץ╫¬ ╫º╫ª╫פ ╫ó╫ס╫ץ╫¿ ╫£╫ץ╫ע╫ש╫¥ ╫ס╫צ╫₧╫ƒ ╫נ╫₧╫¬ - ╫£╫ף╫נ╫⌐╫ס╫ץ╫¿╫ף
app.get('/logs/live/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    // ╫¿╫⌐╫ש╫₧╫¬ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫פ╫º╫ש╫ש╫₧╫ש╫¥ ╫ס╫₧╫ó╫¿╫¢╫¬
    const validAgents = ['dev_agent', 'qa_agent', 'executor_agent', 'summary_agent'];
    
    if (!validAgents.includes(agentName)) {
      return res.status(404).json({ error: `Agent ${agentName} not found` });
    }
    
    // ╫á╫¬╫ש╫ס ╫£╫º╫ץ╫ס╫Ñ ╫פ╫£╫ץ╫ע ╫⌐╫£ ╫פ╫í╫ץ╫¢╫ƒ
    const logPath = path.join(__dirname, `logs/README_${agentName}.md`);
    
    // ╫ס╫ף╫ץ╫º ╫נ╫¥ ╫פ╫º╫ץ╫ס╫Ñ ╫º╫ש╫ש╫¥
    if (!fs.existsSync(logPath)) {
      // ╫נ╫¥ ╫פ╫º╫ץ╫ס╫Ñ ╫£╫נ ╫º╫ש╫ש╫¥, ╫ª╫ץ╫¿ ╫º╫ץ╫ס╫Ñ ╫£╫ץ╫ע ╫ס╫í╫ש╫í╫ש
      const defaultContent = `# ${agentName} Log\n\nNo activities recorded yet.`;
      
      // ╫ש╫ª╫ש╫¿╫¬ ╫¬╫ש╫º╫ש╫ש╫¬ logs ╫נ╫¥ ╫£╫נ ╫º╫ש╫ש╫₧╫¬
      if (!fs.existsSync(path.join(__dirname, 'logs'))) {
        fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
      }
      
      // ╫¢╫¬╫ש╫ס╫¬ ╫¬╫ץ╫¢╫ƒ ╫ס╫¿╫ש╫¿╫¬ ╫₧╫ק╫ף╫£
      fs.writeFileSync(logPath, defaultContent, 'utf8');
      return res.send(defaultContent);
    }
    
    // ╫º╫¿╫ש╫נ╫¬ ╫פ╫º╫ץ╫ס╫Ñ ╫ץ╫פ╫ק╫צ╫¿╫פ
    const logContent = fs.readFileSync(logPath, 'utf8');
    res.send(logContent);
    
  } catch (error) {
    logger.error(`Error reading log for agent: ${error.message}`);
    res.status(500).send(`Error reading log: ${error.message}`);
  }
});

// ╫á╫º╫ץ╫ף╫¬ ╫º╫ª╫פ ╫ó╫ס╫ץ╫¿ workspace
app.get('/workspace', async (req, res) => {
  try {
    const activeProject = await projectManager.getActiveProject();
    res.json({ activeProject });
  } catch (error) {
    logger.error(`Error getting workspace: ${error.message}`);
    res.status(500).json({ error: 'Error getting workspace', message: error.message });
  }
});

// ╫פ╫ע╫ף╫¿╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫¢-workspace
app.post('/workspace/set', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID not provided' });
    }
    
    // ╫º╫ס╫£╫¬ ╫¿╫⌐╫ש╫₧╫¬ ╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥
    const projects = await projectManager.getProjects();
    console.log("╫₧╫º╫ס╫£ ╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥...", projects);
    
    // ╫ק╫ש╫ñ╫ץ╫⌐ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר ╫£╫ñ╫ש ╫פ╫₧╫צ╫פ╫פ
    const project = projects.find(p => p.id === projectId || p.name === projectId);
    console.log("╫ñ╫¿╫ץ╫ש╫º╫ר ╫⌐╫á╫₧╫ª╫נ:", project);
    
    if (!project) {
      console.log("╫£╫נ ╫á╫₧╫ª╫נ ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ó╫¥ ╫₧╫צ╫פ╫פ:", projectId);
      console.log("╫ñ╫¿╫ץ╫ש╫º╫ר╫ש╫¥ ╫צ╫₧╫ש╫á╫ש╫¥:", projects);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // ╫פ╫ע╫ף╫¿╫¬ ╫פ╫ñ╫¿╫ץ╫ש╫º╫ר ╫¢╫ñ╫ó╫ש╫£
    const result = await projectManager.selectProject(project.name);
    
    // ╫ó╫ף╫¢╫ץ╫ƒ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
    for (const agent of Object.values(agents)) {
      if (typeof agent.setProjectPath === 'function') {
        try {
          await agent.setProjectPath(result.path);
        } catch (err) {
          console.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ó╫ף╫¢╫ץ╫ƒ ╫á╫¬╫ש╫ס ╫ñ╫¿╫ץ╫ש╫º╫ר ╫ó╫ס╫ץ╫¿ ╫í╫ץ╫¢╫ƒ:`, err);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `╫ñ╫¿╫ץ╫ש╫º╫ר ${project.name} ╫á╫ס╫ק╫¿ ╫ס╫פ╫ª╫£╫ק╫פ`,
      workspace: project
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ע╫ף╫¿╫¬ workspace: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ע╫ף╫¿╫¬ workspace', message: error.message });
  }
});

// ╫פ╫ñ╫ó╫£╫¬ ╫פ╫⌐╫¿╫¬
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // ╫¿╫ש╫⌐╫ץ╫¥ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫ס╫₧╫ó╫¿╫¢╫¬
  await registerAgents();
  
  // ╫¿╫⌐╫ש╫₧╫¬ ╫¢╫£ ╫פ╫á╫¬╫ש╫ס╫ש╫¥ ╫ס╫₧╫ó╫¿╫¢╫¬
  console.log("\nAvailable API endpoints:");
  
  // ╫₧╫ª╫ש╫ע ╫נ╫¬ ╫¢╫£ ╫פ╫á╫¬╫ש╫ס╫ש╫¥ ╫פ╫₧╫ץ╫ע╫ף╫¿╫ש╫¥
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
  
  // ╫₧╫ש╫ץ╫ƒ ╫פ╫á╫¬╫ש╫ס╫ש╫¥ ╫£╫ñ╫ש ╫נ╫£╫ñ╫ס╫ש╫¬
  endpoints.sort().forEach(endpoint => {
    console.log(`- ${endpoint}`);
  });
  
  // ╫נ╫¬╫ק╫ץ╫£ ╫í╫ץ╫¢╫ƒ ╫פ╫¬╫צ╫₧╫ץ╫ƒ ╫נ╫¥ ╫₧╫ץ╫ע╫ף╫¿ ╫ס-.env
  if (process.env.SCHEDULER_AUTO_INIT === 'true') {
    schedulerAgent.init();
    console.log('Scheduler agent initialized');
  }
  
  logger.info('[agent_manager] ╫í╫ץ╫¢╫ƒ scheduler ╫á╫¿╫⌐╫¥ ╫ס╫₧╫ó╫¿╫¢╫¬');
});

// =============================================================
// API ╫£╫á╫ש╫פ╫ץ╫£ Git 
// =============================================================

// ╫ס╫ש╫ª╫ץ╫ó ╫í╫á╫¢╫¿╫ץ╫ƒ ╫ש╫ף╫á╫ש
app.post('/git/sync', async (req, res) => {
  try {
    // ╫ץ╫ץ╫ף╫נ ╫⌐╫í╫ץ╫¢╫ƒ Git ╫ñ╫ó╫ש╫£
    if (!gitSyncAgent.active) {
      await gitSyncAgent.start();
    }
    
    // ╫פ╫ñ╫ó╫£ ╫í╫á╫¢╫¿╫ץ╫ƒ ╫ש╫ף╫á╫ש
    await gitSyncAgent.syncRepository();
    
    res.json({ 
      success: true, 
      message: '╫í╫á╫¢╫¿╫ץ╫ƒ Git ╫ס╫ץ╫ª╫ó ╫ס╫פ╫ª╫£╫ק╫פ'
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ס╫ש╫ª╫ץ╫ó ╫í╫á╫¢╫¿╫ץ╫ƒ Git: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫ס╫ש╫ª╫ץ╫ó ╫í╫á╫¢╫¿╫ץ╫ƒ Git', message: error.message });
  }
});

// ╫נ╫¬╫ק╫ץ╫£ ╫¿╫ñ╫ץ╫צ╫ש╫ר╫ץ╫¿╫ש Git
app.post('/git/init', async (req, res) => {
  try {
    const { remoteUrl, branch = 'main' } = req.body;
    
    if (!remoteUrl) {
      return res.status(400).json({ error: '╫£╫נ ╫ª╫ץ╫ש╫ƒ ╫¢╫¬╫ץ╫ס╫¬ ╫¿╫ñ╫ץ╫צ╫ש╫ר╫ץ╫¿╫ש ╫₧╫¿╫ץ╫ק╫º' });
    }
    
    // ╫ץ╫ץ╫ף╫נ ╫⌐╫í╫ץ╫¢╫ƒ Git ╫ñ╫ó╫ש╫£
    if (!gitSyncAgent.active) {
      await gitSyncAgent.start();
    }
    
    // ╫נ╫¬╫ק╫£ ╫¿╫ñ╫ץ╫צ╫ש╫ר╫ץ╫¿╫ש Git
    await gitSyncAgent.initRepository(remoteUrl, branch);
    
    res.json({ 
      success: true, 
      message: `╫¿╫ñ╫ץ╫צ╫ש╫ר╫ץ╫¿╫ש Git ╫נ╫ץ╫¬╫ק╫£ ╫ס╫פ╫ª╫£╫ק╫פ ╫ó╫¥ ╫ó╫á╫ú ${branch}`
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫נ╫¬╫ק╫ץ╫£ ╫¿╫ñ╫ץ╫צ╫ש╫ר╫ץ╫¿╫ש Git: ${error.message}`);
    res.status(500).json({ error: '╫⌐╫ע╫ש╫נ╫פ ╫ס╫נ╫¬╫ק╫ץ╫£ ╫¿╫ñ╫ץ╫צ╫ש╫ר╫ץ╫¿╫ש Git', message: error.message });
  }
});

// =============================================================
// API ╫£╫á╫ש╫פ╫ץ╫£ ╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
// =============================================================

// ╫º╫ס╫£ ╫¿╫⌐╫ש╫₧╫¬ ╫í╫ץ╫¢╫á╫ש╫¥ ╫ó╫¥ ╫צ╫ש╫¢╫¿╫ץ╫ƒ
app.get('/memory', async (req, res) => {
  try {
    const agentsMemory = await memoryManager.getAllAgentsMemoryStats();
    res.json(agentsMemory);
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫á╫¬╫ץ╫á╫ש ╫צ╫ש╫¢╫¿╫ץ╫ƒ: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫º╫ס╫£ ╫₧╫ש╫ף╫ó ╫ó╫£ ╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫í╫ץ╫¢╫ƒ ╫í╫ñ╫ª╫ש╫ñ╫ש
app.get('/memory/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    if (!agentName) {
      return res.status(400).json({ error: '╫á╫ף╫¿╫⌐ ╫⌐╫¥ ╫í╫ץ╫¢╫ƒ' });
    }
    
    const memoryData = await memoryManager.getMemoryForApi(agentName);
    res.json(memoryData);
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫á╫¬╫ץ╫á╫ש ╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫⌐╫£ ╫í╫ץ╫¢╫ƒ: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫ק╫ש╫ñ╫ץ╫⌐ ╫ס╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫⌐╫£ ╫í╫ץ╫¢╫ƒ
app.post('/memory/:agent/search', async (req, res) => {
  try {
    const agentName = req.params.agent;
    const { query, options } = req.body;
    
    if (!agentName) {
      return res.status(400).json({ error: '╫á╫ף╫¿╫⌐ ╫⌐╫¥ ╫í╫ץ╫¢╫ƒ' });
    }
    
    if (!query) {
      return res.status(400).json({ error: '╫á╫ף╫¿╫⌐ ╫ס╫ש╫ר╫ץ╫ש ╫ק╫ש╫ñ╫ץ╫⌐' });
    }
    
    const results = await memoryManager.searchMemory(agentName, query, options);
    res.json(results);
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫ק╫ש╫ñ╫ץ╫⌐ ╫ס╫צ╫ש╫¢╫¿╫ץ╫ƒ: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫₧╫ק╫ש╫º╫¬ ╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫⌐╫£ ╫í╫ץ╫¢╫ƒ
app.delete('/memory/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    if (!agentName) {
      return res.status(400).json({ error: '╫á╫ף╫¿╫⌐ ╫⌐╫¥ ╫í╫ץ╫¢╫ƒ' });
    }
    
    await memoryManager.deleteMemory(agentName);
    res.json({ success: true, message: `╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫⌐╫£ ╫í╫ץ╫¢╫ƒ ${agentName} ╫á╫₧╫ק╫º ╫ס╫פ╫ª╫£╫ק╫פ` });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫₧╫ק╫ש╫º╫¬ ╫צ╫ש╫¢╫¿╫ץ╫ƒ: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================
// API ╫£╫á╫ש╫פ╫ץ╫£ ╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
// =============================================================

// ╫פ╫ñ╫ó╫£╫¬ ╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
app.post('/agent-manager/start', async (req, res) => {
  try {
    agentManager.start();
    res.json({ 
      success: true, 
      message: '╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫פ╫ץ╫ñ╫ó╫£ ╫ס╫פ╫ª╫£╫ק╫פ'
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫ó╫£╫¬ ╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫¢╫ש╫ס╫ץ╫ש ╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
app.post('/agent-manager/stop', async (req, res) => {
  try {
    agentManager.stop();
    res.json({ 
      success: true, 
      message: '╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫¢╫ץ╫ס╫פ ╫ס╫פ╫ª╫£╫ק╫פ'
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫¢╫ש╫ס╫ץ╫ש ╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬ ╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥
app.get('/agent-manager/stats', async (req, res) => {
  try {
    const stats = agentManager.getStats();
    res.json(stats);
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ש╫í╫ר╫ש╫º╫ץ╫¬ ╫₧╫á╫פ╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫º╫ס╫£╫¬ ╫₧╫ש╫ף╫ó ╫ó╫£ ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫á╫ץ╫¢╫ק╫ש╫¬
app.get('/agent-manager/current-activity', async (req, res) => {
  try {
    const { currentActivity, currentHeavyAgent } = agentManager;
    
    res.json({ 
      currentActivity,
      currentHeavyAgent
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫ñ╫ó╫ש╫£╫ץ╫¬ ╫á╫ץ╫¢╫ק╫ש╫¬: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫¬╫צ╫₧╫ץ╫ƒ ╫₧╫⌐╫ש╫₧╫פ ╫ק╫ף╫⌐╫פ
app.post('/agent-manager/schedule-task', async (req, res) => {
  try {
    const { agentName, action, params, options } = req.body;
    
    if (!agentName || !action) {
      return res.status(400).json({ error: '╫á╫ף╫¿╫⌐ ╫⌐╫¥ ╫í╫ץ╫¢╫ƒ ╫ץ╫ñ╫ó╫ץ╫£╫פ' });
    }

    // ╫ץ╫ץ╫ף╫נ ╫⌐╫פ╫í╫ץ╫¢╫ƒ ╫¿╫⌐╫ץ╫¥
    if (!agents[agentName]) {
      return res.status(404).json({ error: `╫í╫ץ╫¢╫ƒ ${agentName} ╫£╫נ ╫á╫₧╫ª╫נ` });
    }
    
    // ╫¿╫⌐╫ץ╫¥ ╫נ╫¬ ╫פ╫í╫ץ╫¢╫ƒ ╫נ╫¥ ╫פ╫ץ╫נ ╫£╫נ ╫¿╫⌐╫ץ╫¥ ╫¢╫ס╫¿
    if (!agentManager.agents.has(agentName)) {
      agentManager.registerAgent(agentName, agents[agentName]);
    }
    
    // ╫פ╫ץ╫í╫ú ╫₧╫⌐╫ש╫₧╫פ ╫£╫¬╫ץ╫¿
    const taskId = await agentManager.scheduleTask(agentName, action, params, options);
    
    res.json({ 
      success: true, 
      message: `╫₧╫⌐╫ש╫₧╫פ ${taskId} ╫פ╫ץ╫í╫ñ╫פ ╫£╫¬╫ץ╫¿`,
      taskId
    });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫¬╫צ╫₧╫ץ╫ƒ ╫₧╫⌐╫ש╫₧╫פ: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ץ╫í ╫₧╫⌐╫ש╫₧╫פ
app.get('/agent-manager/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = agentManager.getTaskStatus(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `╫₧╫⌐╫ש╫₧╫פ ${taskId} ╫£╫נ ╫á╫₧╫ª╫נ╫פ` });
    }
    
    res.json(task);
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫º╫ס╫£╫¬ ╫í╫ר╫ר╫ץ╫í ╫₧╫⌐╫ש╫₧╫פ: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API ╫á╫º╫ץ╫ף╫ץ╫¬ ╫º╫ª╫פ ╫£╫í╫ץ╫¢╫ƒ ╫פ╫¬╫צ╫₧╫ץ╫ƒ
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

// API ╫á╫º╫ץ╫ף╫ץ╫¬ ╫º╫ª╫פ ╫£╫í╫ץ╫¢╫ƒ ╫פ╫í╫ש╫¢╫ץ╫¥
app.get('/summary/agent/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    const { period, insights, format } = req.query;

    // ╫₧╫⌐╫¬╫₧╫⌐ ╫ס╫₧╫ץ╫ñ╫ó summaryAgent ╫פ╫ע╫£╫ץ╫ס╫£╫ש ╫ס╫₧╫º╫ץ╫¥ ╫£╫á╫í╫ץ╫¬ ╫£╫º╫ס╫£ ╫נ╫ץ╫¬╫ץ ╫₧-agentManager
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

    // ╫₧╫⌐╫¬╫₧╫⌐ ╫ס╫₧╫ץ╫ñ╫ó summaryAgent ╫פ╫ע╫£╫ץ╫ס╫£╫ש ╫ס╫₧╫º╫ץ╫¥ ╫£╫á╫í╫ץ╫¬ ╫£╫º╫ס╫£ ╫נ╫ץ╫¬╫ץ ╫₧-agentManager
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

// API ╫á╫º╫ץ╫ף╫¬ ╫º╫ª╫פ ╫ó╫ס╫ץ╫¿ ╫⌐╫נ╫ש╫£╫¬╫ץ╫¬ AI
app.post('/ask-ai', async (req, res) => {
  try {
    const { prompt, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: '╫פ╫⌐╫נ╫ש╫£╫¬╫פ ╫ק╫í╫¿╫פ' });
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
    
    logger.info(`╫⌐╫נ╫ש╫£╫¬╫¬ AI ╫פ╫¬╫º╫ס╫£╫פ: "${prompt.substring(0, 50)}..." ╫ó╫¥ ╫₧╫ץ╫ף╫£ ${modelId}`);
    
    const response = await aiEngine.generateText({
      model: modelId,
      prompt: prompt,
      temperature: 0.7,
      maxTokens: 1000
    });
    
    res.json({ response });
  } catch (error) {
    logger.error(`╫⌐╫ע╫ש╫נ╫פ ╫ס╫פ╫ñ╫ó╫£╫¬ ╫⌐╫נ╫ש╫£╫¬╫¬ AI: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ╫á╫¬╫ש╫ס ╫£╫º╫ס╫£╫¬ ╫₧╫ש╫ף╫ó ╫ó╫£ ╫פ╫í╫ץ╫¢╫á╫ש╫¥ ╫ס╫₧╫ó╫¿╫¢╫¬
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

// ╫á╫¬╫ש╫ס ╫£╫º╫ס╫£╫¬ ╫₧╫ש╫ף╫ó ╫ó╫£ ╫í╫ץ╫¢╫ƒ ╫í╫ñ╫ª╫ש╫ñ╫ש
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

// ╫á╫¬╫ש╫ס ╫£╫º╫ס╫£╫¬ ╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫⌐╫£ ╫í╫ץ╫¢╫ƒ ╫í╫ñ╫ª╫ש╫ñ╫ש ╫ף╫¿╫ת ╫á╫¬╫ש╫ס /agents (╫₧╫ש╫ñ╫ץ╫ש ╫₧╫ק╫ף╫⌐ ╫£-/memory/:agent)
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

// ╫á╫¬╫ש╫ס ╫£╫ק╫ש╫ñ╫ץ╫⌐ ╫ס╫צ╫ש╫¢╫¿╫ץ╫ƒ ╫⌐╫£ ╫í╫ץ╫¢╫ƒ ╫í╫ñ╫ª╫ש╫ñ╫ש ╫ף╫¿╫ת ╫á╫¬╫ש╫ס /agents
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

// API ╫£╫ñ╫¬╫ש╫ק╫¬ ╫ק╫£╫ץ╫ƒ ╫ס╫ק╫ש╫¿╫¬ ╫¬╫ש╫º╫ש╫ש╫פ
app.get('/select-folder', (req, res) => {
  try {
    // ╫ס╫¬╫¿╫ק╫ש╫⌐ ╫נ╫₧╫ש╫¬╫ש, ╫פ╫ש╫ש╫á╫ץ ╫₧╫⌐╫¬╫₧╫⌐╫ש╫¥ ╫ס-Electron ╫נ╫ץ ╫ס╫í╫ñ╫¿╫ש╫ש╫¬ Node.js ╫נ╫ק╫¿╫¬ ╫£╫ñ╫¬╫ש╫ק╫¬ ╫ף╫ש╫נ╫£╫ץ╫ע
    // ╫¢╫נ╫ƒ ╫á╫ף╫₧╫פ ╫נ╫¬ ╫צ╫פ ╫ó╫£ ╫ש╫ף╫ש ╫º╫¿╫ש╫נ╫פ ╫£╫ñ╫º╫ץ╫ף╫¬ ╫₧╫ó╫¿╫¢╫¬ ╫פ╫ñ╫ó╫£╫פ ╫₧╫¬╫נ╫ש╫₧╫פ
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // ╫ñ╫º╫ץ╫ף╫פ ╫£╫ñ╫¬╫ש╫ק╫¬ ╫ף╫ש╫נ╫£╫ץ╫ע ╫ס╫ק╫ש╫¿╫¬ ╫¬╫ש╫º╫ש╫ש╫פ ╫ס-Windows
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
      // ╫£╫ש╫á╫ץ╫º╫í/╫₧╫º
      const command = `zenity --file-selection --directory --title="Choose a project folder"`;
      
      require('child_process').exec(command, (err, stdout, stderr) => {
        if (err && err.code !== 1) { // ╫º╫ץ╫ף ╫ש╫ª╫ש╫נ╫פ 1 ╫סzenity ╫₧╫ª╫ש╫ש╫ƒ ╫ס╫ש╫ר╫ץ╫£
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
