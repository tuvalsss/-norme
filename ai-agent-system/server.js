const express = require('express');
const cors = require('cors');
const { logger } = require('./core/logger');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs-extra');

// טען משתנים סביבתיים
dotenv.config();

// ייבוא הסוכנים
const devAgent = require('./agents/dev_agent');
const qaAgent = require('./agents/qa');
const executorAgent = require('./agents/executor');
const summaryAgent = require('./agents/summary');
const gitSyncAgent = require('./agents/git_sync');
const schedulerAgent = require('./agents/scheduler_agent');

// ייבוא מנהל הפרויקטים ומנהל הזיכרון
const projectManager = require('./core/projectManager');
const memoryManager = require('./core/memoryManager');
const agentManager = require('./core/agentManager');
const aiEngine = require('./core/aiEngine');

// יצירת אפליקציית Express
const app = express();
const PORT = process.env.PORT || 5001;

// טען מידלוור
app.use(cors());
app.use(express.json());

// מיפוי שמות סוכנים למופעים
const agents = {
  'dev_agent': devAgent,
  'qa_agent': qaAgent,
  'executor_agent': executorAgent,
  'summary_agent': summaryAgent,
  'git_sync_agent': gitSyncAgent,
  'scheduler_agent': schedulerAgent
};

// רישום הסוכנים במערכת
const registerAgents = async () => {
  // רישום סוכנים קיימים
  const devAgent = require('./agents/dev_agent');
  const qaAgent = require('./agents/qa');
  const executorAgent = require('./agents/executor');
  const gitSyncAgent = require('./agents/git_sync');
  const summaryAgent = require('./agents/summary_agent');

  // רישום סוכן התזמון החדש
  agentManager.registerAgent('scheduler', schedulerAgent);
  
  // רישום סוכן הסיכום
  agentManager.registerAgent('summary', summaryAgent);

  // ... existing code ...
};

// נתיב להפעלת סוכן
app.post('/run-agent', async (req, res) => {
  try {
    const { agent: agentName } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `סוכן לא תקין: ${agentName}` });
    }
    
    const agent = agents[agentName];
    
    logger.info(`מפעיל סוכן: ${agentName}`);
    await agent.start();
    
    res.json({ 
      success: true, 
      message: `סוכן ${agentName} הופעל בהצלחה`,
      status: { active: agent.active }
    });
  } catch (error) {
    logger.error(`שגיאה בהפעלת סוכן: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בהפעלת הסוכן',
      message: error.message
    });
  }
});

// נתיב לכיבוי סוכן
app.post('/stop-agent', async (req, res) => {
  try {
    const { agent: agentName } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `סוכן לא תקין: ${agentName}` });
    }
    
    const agent = agents[agentName];
    
    logger.info(`מכבה סוכן: ${agentName}`);
    await agent.stop();
    
    res.json({ 
      success: true, 
      message: `סוכן ${agentName} כובה בהצלחה`,
      status: { active: agent.active }
    });
  } catch (error) {
    logger.error(`שגיאה בכיבוי סוכן: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בכיבוי הסוכן',
      message: error.message
    });
  }
});

// נתיב לקבלת סטטוס כל הסוכנים
app.get('/status', async (req, res) => {
  try {
    const status = {};
    
    for (const [agentName, agent] of Object.entries(agents)) {
      status[agentName] = { active: agent.active };
      
      // הוסף מידע נוסף לסוכנים מסוימים
      if (agentName === 'executor_agent' && agent.active) {
        status[agentName].processes = (await agent.getStatus()).runningProcesses;
      }
    }
    
    res.json({ success: true, status });
  } catch (error) {
    logger.error(`שגיאה בקבלת סטטוס: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת סטטוס',
      message: error.message
    });
  }
});

// נתיב לבניית פרויקט
app.post('/build-project', async (req, res) => {
  try {
    const { project, requirements } = req.body;
    
    if (!project || !requirements) {
      return res.status(400).json({ 
        error: 'חסר מידע לבניית הפרויקט',
        message: 'נדרש שם פרויקט ודרישות'
      });
    }
    
    // וודא שסוכן הפיתוח פעיל
    if (!devAgent.active) {
      await devAgent.start();
    }
    
    // צור ותיקייה עבור הפרויקט
    const projectDir = `${project}`;
    
    // צור קובץ README.md עם דרישות הפרויקט
    const readmePath = `${projectDir}/README.md`;
    const readmeContent = `# ${project}\n\n## דרישות פרויקט\n\n${requirements}`;
    
    // השתמש בסוכן הפיתוח ליצירת הפרויקט
    logger.info(`יוצר פרויקט חדש: ${projectDir}`);
    await devAgent.generateCode(readmePath, readmeContent);
    
    // צור קובץ package.json בסיסי אם מדובר בפרויקט JavaScript/Node.js
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
    
    // הפעל את סוכן הסיכום ליצירת דוח פרויקט ראשוני
    if (!summaryAgent.active) {
      await summaryAgent.start();
    }
    
    const reportPath = `${projectDir}/project_report.md`;
    await summaryAgent.generateProjectReport(projectDir, reportPath);
    
    res.json({ 
      success: true, 
      message: `פרויקט ${project} נוצר בהצלחה`,
      projectDir
    });
  } catch (error) {
    logger.error(`שגיאה בבניית פרויקט: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בבניית פרויקט',
      message: error.message
    });
  }
});

// נתיב להפעלת פעולות סוכן ספציפיות
app.post('/agent-action', async (req, res) => {
  try {
    const { agent: agentName, action, params } = req.body;
    
    if (!agentName || !agents[agentName]) {
      return res.status(400).json({ error: `סוכן לא תקין: ${agentName}` });
    }
    
    if (!action) {
      return res.status(400).json({ error: 'לא צוינה פעולה' });
    }
    
    const agent = agents[agentName];
    
    // וודא שהסוכן פעיל
    if (!agent.active) {
      await agent.start();
    }
    
    // בדוק אם הפעולה קיימת
    if (typeof agent[action] !== 'function') {
      return res.status(400).json({ error: `פעולה לא תקינה: ${action}` });
    }
    
    // הפעל את הפעולה המבוקשת עם הפרמטרים
    logger.info(`מפעיל פעולת סוכן: ${agentName}.${action}()`);
    const result = await agent[action](...(params || []));
    
    res.json({ 
      success: true, 
      result,
      message: `פעולה ${action} הופעלה בהצלחה על סוכן ${agentName}`
    });
  } catch (error) {
    logger.error(`שגיאה בהפעלת פעולת סוכן: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בהפעלת פעולת סוכן',
      message: error.message
    });
  }
});

// =============================================================
// API לניהול פרויקטים
// =============================================================

// קבלת רשימת פרויקטים
app.get('/projects', async (req, res) => {
  try {
    const projects = await projectManager.getProjects();
    res.json({ success: true, projects });
  } catch (error) {
    logger.error(`שגיאה בקבלת רשימת פרויקטים: ${error.message}`);
    res.status(500).json({ error: 'שגיאה בקבלת רשימת פרויקטים', message: error.message });
  }
});

// בחירת פרויקט פעיל
app.post('/select-project', async (req, res) => {
  try {
    const { projectName } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ error: 'לא צוין שם פרויקט' });
    }
    
    const result = await projectManager.selectProject(projectName);
    
    // עדכן את נתיבי הסוכנים לעבוד על הפרויקט הנבחר
    for (const agent of Object.values(agents)) {
      if (typeof agent.setProjectPath === 'function') {
        await agent.setProjectPath(result.path);
      }
    }
    
    res.json({ 
      success: true, 
      message: `פרויקט ${projectName} נבחר בהצלחה`,
      project: result
    });
  } catch (error) {
    logger.error(`שגיאה בבחירת פרויקט: ${error.message}`);
    res.status(500).json({ error: 'שגיאה בבחירת פרויקט', message: error.message });
  }
});

// קבלת מידע על הפרויקט הפעיל
app.get('/active-project', async (req, res) => {
  try {
    const activeProject = await projectManager.getActiveProject();
    
    if (!activeProject) {
      return res.json({ success: true, message: 'אין פרויקט פעיל', project: null });
    }
    
    res.json({ success: true, project: activeProject });
  } catch (error) {
    logger.error(`שגיאה בקבלת פרויקט פעיל: ${error.message}`);
    res.status(500).json({ error: 'שגיאה בקבלת פרויקט פעיל', message: error.message });
  }
});

// קבלת מבנה הקבצים של הפרויקט הפעיל
app.get('/active-project/files', async (req, res) => {
  try {
    const fileStructure = await projectManager.getProjectFiles();
    res.json({ success: true, files: fileStructure });
  } catch (error) {
    logger.error(`שגיאה בקבלת מבנה קבצים: ${error.message}`);
    res.status(500).json({ error: 'שגיאה בקבלת מבנה קבצים', message: error.message });
  }
});

// קריאת תוכן קובץ
app.get('/active-project/file', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: 'לא צוין נתיב לקובץ' });
    }
    
    const content = await projectManager.readProjectFile(filePath);
    res.json({ success: true, path: filePath, content });
  } catch (error) {
    logger.error(`שגיאה בקריאת קובץ: ${error.message}`);
    res.status(500).json({ error: 'שגיאה בקריאת קובץ', message: error.message });
  }
});

// פתיחת קובץ בעורך חיצוני
app.post('/open-file', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'לא צוין נתיב לקובץ' });
    }
    
    const result = await projectManager.openFileInEditor(filePath);
    res.json({ success: true, message: result.message });
  } catch (error) {
    logger.error(`שגיאה בפתיחת קובץ: ${error.message}`);
    res.status(500).json({ error: 'שגיאה בפתיחת קובץ', message: error.message });
  }
});

// הפעלת השרת
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // רישום הסוכנים במערכת
  await registerAgents();
  
  // אתחול סוכן התזמון אם מוגדר ב-.env
  if (process.env.SCHEDULER_AUTO_INIT === 'true') {
    schedulerAgent.init();
    console.log('Scheduler agent initialized');
  }
});

// =============================================================
// API לניהול Git 
// =============================================================

// ביצוע סנכרון ידני
app.post('/git/sync', async (req, res) => {
  try {
    // וודא שסוכן Git פעיל
    if (!gitSyncAgent.active) {
      await gitSyncAgent.start();
    }
    
    // הפעל סנכרון ידני
    await gitSyncAgent.syncRepository();
    
    res.json({ 
      success: true, 
      message: 'סנכרון Git בוצע בהצלחה'
    });
  } catch (error) {
    logger.error(`שגיאה בביצוע סנכרון Git: ${error.message}`);
    res.status(500).json({ error: 'שגיאה בביצוע סנכרון Git', message: error.message });
  }
});

// אתחול רפוזיטורי Git
app.post('/git/init', async (req, res) => {
  try {
    const { remoteUrl, branch = 'main' } = req.body;
    
    if (!remoteUrl) {
      return res.status(400).json({ error: 'לא צוין כתובת רפוזיטורי מרוחק' });
    }
    
    // וודא שסוכן Git פעיל
    if (!gitSyncAgent.active) {
      await gitSyncAgent.start();
    }
    
    // אתחל רפוזיטורי Git
    await gitSyncAgent.initRepository(remoteUrl, branch);
    
    res.json({ 
      success: true, 
      message: `רפוזיטורי Git אותחל בהצלחה עם ענף ${branch}`
    });
  } catch (error) {
    logger.error(`שגיאה באתחול רפוזיטורי Git: ${error.message}`);
    res.status(500).json({ error: 'שגיאה באתחול רפוזיטורי Git', message: error.message });
  }
});

// =============================================================
// API לניהול זיכרון הסוכנים
// =============================================================

// קבל רשימת סוכנים עם זיכרון
app.get('/memory', async (req, res) => {
  try {
    const agentsMemory = await memoryManager.getAllAgentsMemoryStats();
    res.json(agentsMemory);
  } catch (error) {
    logger.error(`שגיאה בקבלת נתוני זיכרון: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// קבל מידע על זיכרון סוכן ספציפי
app.get('/memory/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    if (!agentName) {
      return res.status(400).json({ error: 'נדרש שם סוכן' });
    }
    
    const memoryData = await memoryManager.getMemoryForApi(agentName);
    res.json(memoryData);
  } catch (error) {
    logger.error(`שגיאה בקבלת נתוני זיכרון של סוכן: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// חיפוש בזיכרון של סוכן
app.post('/memory/:agent/search', async (req, res) => {
  try {
    const agentName = req.params.agent;
    const { query, options } = req.body;
    
    if (!agentName) {
      return res.status(400).json({ error: 'נדרש שם סוכן' });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'נדרש ביטוי חיפוש' });
    }
    
    const results = await memoryManager.searchMemory(agentName, query, options);
    res.json(results);
  } catch (error) {
    logger.error(`שגיאה בחיפוש בזיכרון: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// מחיקת זיכרון של סוכן
app.delete('/memory/:agent', async (req, res) => {
  try {
    const agentName = req.params.agent;
    
    if (!agentName) {
      return res.status(400).json({ error: 'נדרש שם סוכן' });
    }
    
    await memoryManager.deleteMemory(agentName);
    res.json({ success: true, message: `זיכרון של סוכן ${agentName} נמחק בהצלחה` });
  } catch (error) {
    logger.error(`שגיאה במחיקת זיכרון: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================
// API לניהול מנהל הסוכנים
// =============================================================

// הפעלת מנהל הסוכנים
app.post('/agent-manager/start', async (req, res) => {
  try {
    agentManager.start();
    res.json({ 
      success: true, 
      message: 'מנהל הסוכנים הופעל בהצלחה'
    });
  } catch (error) {
    logger.error(`שגיאה בהפעלת מנהל הסוכנים: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// כיבוי מנהל הסוכנים
app.post('/agent-manager/stop', async (req, res) => {
  try {
    agentManager.stop();
    res.json({ 
      success: true, 
      message: 'מנהל הסוכנים כובה בהצלחה'
    });
  } catch (error) {
    logger.error(`שגיאה בכיבוי מנהל הסוכנים: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// קבלת סטטיסטיקות מנהל הסוכנים
app.get('/agent-manager/stats', async (req, res) => {
  try {
    const stats = agentManager.getStats();
    res.json(stats);
  } catch (error) {
    logger.error(`שגיאה בקבלת סטטיסטיקות מנהל הסוכנים: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// קבלת מידע על פעילות נוכחית
app.get('/agent-manager/current-activity', async (req, res) => {
  try {
    const { currentActivity, currentHeavyAgent } = agentManager;
    
    res.json({ 
      currentActivity,
      currentHeavyAgent
    });
  } catch (error) {
    logger.error(`שגיאה בקבלת פעילות נוכחית: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// תזמון משימה חדשה
app.post('/agent-manager/schedule-task', async (req, res) => {
  try {
    const { agentName, action, params, options } = req.body;
    
    if (!agentName || !action) {
      return res.status(400).json({ error: 'נדרש שם סוכן ופעולה' });
    }

    // וודא שהסוכן רשום
    if (!agents[agentName]) {
      return res.status(404).json({ error: `סוכן ${agentName} לא נמצא` });
    }
    
    // רשום את הסוכן אם הוא לא רשום כבר
    if (!agentManager.agents.has(agentName)) {
      agentManager.registerAgent(agentName, agents[agentName]);
    }
    
    // הוסף משימה לתור
    const taskId = await agentManager.scheduleTask(agentName, action, params, options);
    
    res.json({ 
      success: true, 
      message: `משימה ${taskId} הוספה לתור`,
      taskId
    });
  } catch (error) {
    logger.error(`שגיאה בתזמון משימה: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// קבלת סטטוס משימה
app.get('/agent-manager/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = agentManager.getTaskStatus(taskId);
    
    if (!task) {
      return res.status(404).json({ error: `משימה ${taskId} לא נמצאה` });
    }
    
    res.json(task);
  } catch (error) {
    logger.error(`שגיאה בקבלת סטטוס משימה: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API נקודות קצה לסוכן התזמון
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

// API נקודות קצה לסוכן הסיכום
app.get('/summary/agent/:agentName', async (req, res) => {
  try {
    const { agentName } = req.params;
    const { period, insights, format } = req.query;

    const summaryAgent = agentManager.getAgent('summary');
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

    const summaryAgent = agentManager.getAgent('summary');
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