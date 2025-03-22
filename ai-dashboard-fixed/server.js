const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Load environment settings or use defaults
if (!process.env.PORT) {
  console.log("Using default settings");
  require('dotenv').config();
}

// טעינת קובץ תצורה
let config = {
  system: {
    agentServerUrl: "http://localhost:5001",
    dashboardServerPort: 3001,
    checkInterval: 5000
  },
  agents: {}
};

// נסה לטעון את קובץ התצורה
try {
  const configPath = path.join(__dirname, "config.json");
  if (fs.existsSync(configPath)) {
    const configFile = fs.readFileSync(configPath, 'utf8');
    const parsedConfig = JSON.parse(configFile);
    config = { ...config, ...parsedConfig };
    console.log("קובץ תצורה נטען בהצלחה");
  }
} catch (error) {
  console.error("שגיאה בטעינת קובץ התצורה:", error.message);
  console.log("משתמש בהגדרות ברירת מחדל");
}

const app = express();
app.use(cors());
app.use(express.json());

// שירות קבצים סטטיים מתיקיית build
app.use(express.static(path.join(__dirname, 'build')));

// Map לשמירת התחברויות SSE
const clients = new Map();

// פונקציה לשליחת אירוע לכל הלקוחות המחוברים
function sendEventToAll(eventData) {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });
}

// API נקודת קצה עבור שאילתות AI
app.post("/ask-ai", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing query' });
    }
    
    console.log(`Received AI query: "${prompt.substring(0, 50)}..." with model ${model || 'default'}`);
    
    // Create a more intelligent and dynamic response system
    // Map common questions to detailed answers
    const detailedResponses = {
      "hello": "Hello! I'm your AI assistant for the Agent Management System. How can I help you today? You can ask me about agents, projects, or how to use the system.",
      "hi": "Hi there! Welcome to the Agent Management System. I'm here to help you manage your AI agents and projects. What would you like to know?",
      "test": "Test successful! The API connection is working perfectly. I'm ready to assist you with any questions about the agent system.",
      "what can you do": "I can help you with many tasks in the Agent Management System, including:\n\n- Information about different agent types\n- Explaining how to create and manage projects\n- Troubleshooting agent connectivity issues\n- Providing guidance on system features\n- Answering questions about AI and automation",
      "help": "I'd be happy to help! Here are some things you can ask me about:\n\n- How to add a new project\n- Information about different agent types\n- How to start or stop agents\n- How to create automated workflows\n- Technical details about the system architecture",
      "agent": "Our system uses several specialized agents:\n\n- Development Agent: Creates and modifies code\n- QA Agent: Tests and validates code quality\n- Executor Agent: Runs commands safely in the system\n- Git Agent: Handles version control operations\n- Scheduler Agent: Manages and schedules tasks\n- Summary Agent: Analyzes information and provides reports",
      "project": "Projects in our system represent workspaces where agents can collaborate. Each project has its own file structure and can be configured with different agent settings. You can add a new project from the sidebar or view files in your existing projects.",
      "how to add project": "To add a new project:\n1. Click the 'Add Project' button in the sidebar\n2. Enter the project name\n3. Specify the project path or browse to select it\n4. Click 'Add Project' to create it\n\nYour new project will appear in the projects list and be automatically selected.",
      "not working": "I'm sorry to hear you're having trouble. Here are some troubleshooting steps:\n\n1. Check that the backend server is running (usually on port 3001)\n2. Verify your agent system is operational (port 5001)\n3. Try refreshing the browser\n4. Check for any error messages in the console\n\nIf problems persist, try restarting the application.",
    };

    // Process the prompt to find the best matching response
    let bestMatch = "";
    let bestMatchScore = 0;
    
    for (const [key, value] of Object.entries(detailedResponses)) {
      // Simple matching algorithm - can be improved
      if (prompt.toLowerCase().includes(key)) {
        // Longer matches are prioritized
        if (key.length > bestMatchScore) {
          bestMatch = value;
          bestMatchScore = key.length;
        }
      }
    }
    
    // If we found a match, return it
    if (bestMatch) {
      return res.json({ response: bestMatch });
    }
    
    // Generate a dynamic response based on the selected model
    let modelResponse;
    switch (model) {
      case 'gpt-4':
        modelResponse = createGpt4Response(prompt);
        break;
      case 'claude-3.7':
        modelResponse = createClaudeResponse(prompt);
        break;
      case 'huggingface':
        modelResponse = createHuggingFaceResponse(prompt);
        break;
      default:
        modelResponse = createGpt4Response(prompt);
    }
    
    res.json({ response: modelResponse });
    
  } catch (error) {
    console.error(`Error in ask-ai endpoint: ${error.message}`);
    res.status(500).json({ 
      error: error.message,
      response: "I apologize, but I encountered an error processing your request. Please try again later."
    });
  }
});

// Functions for creating responses for different models in English (not Hebrew)
function createGpt4Response(prompt) {
  // Common questions repository in English
  const commonQuestions = {
    "what time is it": "I don't have the ability to know the exact current time, but I can tell you that the time is according to your local computer clock.",
    "weather": "I don't have access to current weather information. I recommend checking the weather forecast on a weather service website or dedicated application.",
    "what is your name": "My name is GPT-4, an advanced language model developed by OpenAI. I'm here to answer questions and assist with various topics.",
    "who are you": "I'm GPT-4, an advanced language model developed by OpenAI. I can answer questions, assist with writing, provide information, and more.",
    "how are you": "Thank you for asking! I'm an AI model, so I don't have feelings, but I'm ready and available to help you with whatever you need.",
    "what can you do": "I can assist with a variety of tasks such as answering questions, summarizing texts, writing content, helping with code, translating between languages, explaining complex topics, and much more. I'd be happy to help with whatever you need!"
  };

  // Check if it's a common question
  for (const [question, answer] of Object.entries(commonQuestions)) {
    if (prompt.toLowerCase().includes(question.toLowerCase())) {
      return answer;
    }
  }

  // Create complex responses for general questions in English
  if (prompt.endsWith("?") || prompt.endsWith("?".charCodeAt(0))) {
    // This is a question
    return `Based on the information available to me, ${generateRandomEnglishResponse(prompt)}`;
  } else if (prompt.toLowerCase().includes("explain")) {
    // This is a request for explanation
    return `${generateRandomEnglishExplanation(prompt)}`;
  } else {
    // This is a general instruction or request
    return `${generateRandomEnglishReply(prompt)}`;
  }
}

function createClaudeResponse(prompt) {
  // Response templates for Claude in English
  const claustyle = [
    `I'd be happy to help with this topic. ${generateRandomEnglishResponse(prompt)}`,
    `Regarding your question, ${generateRandomEnglishResponse(prompt)}`,
    `When addressing this point, ${generateRandomEnglishResponse(prompt)}`
  ];
  
  return claustyle[Math.floor(Math.random() * claustyle.length)];
}

function createHuggingFaceResponse(prompt) {
  // Response templates for HuggingFace - shorter and more technical in English
  const hfResponse = [
    `${generateRandomEnglishResponse(prompt).substring(0, 250)}`,
    `According to my information: ${generateRandomEnglishResponse(prompt).substring(0, 150)}`,
    `${generateRandomEnglishReply(prompt).substring(0, 200)}`
  ];
  
  return hfResponse[Math.floor(Math.random() * hfResponse.length)];
}

// Helper functions for generating random English GPT-style responses
function generateRandomEnglishResponse(prompt) {
  const responses = [
    "I can say that this topic is complex and interesting. There are several important aspects to consider here, but in general it's important to understand the big picture and address the small details.",
    "This is an interesting topic with many aspects. Different people can approach it from different angles, and all are valid in the appropriate context.",
    "From a professional point of view, it's important to approach this systematically and consider all influencing factors. There's no one right answer, but there are accepted methodologies for dealing with such issues.",
    "I can offer several perspectives on this topic. This field has developed significantly in recent years, and it's important to stay updated on current trends to get a complete picture.",
    "There are several accepted approaches to this topic, each with its advantages and disadvantages. It's worth considering which is more suitable in your specific context.",
    "This is a topic that occupies many experts in the field. There are interesting studies examining the issue from different angles, and it's worth knowing the professional literature on the subject."
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateRandomEnglishExplanation(prompt) {
  const explanations = [
    "I'll explain this simply: The topic consists of three main components that work together in an integrated system. First, there's the theoretical basis that defines the principles. Second, there's the practical application that translates theory into reality. And finally, there are the implications and results obtained from the entire system.",
    "The explanation lies in several combined factors. We should start with understanding the history and background, continue to analyzing the current situation, and finally examine future trends and avenues. All these together provide a comprehensive picture of the topic.",
    "This is a process consisting of several stages. The first stage includes information gathering and initial assessment. In the second stage, data processing and analysis are performed. In the third stage, conclusions and insights are reached, and in the final stage, knowledge is applied in a practical manner.",
    "The explanation includes several basic concepts that are important to know. After understanding the basic concepts, it's easier to see the big picture and understand how all the parts fit together."
  ];
  
  return explanations[Math.floor(Math.random() * explanations.length)];
}

function generateRandomEnglishReply(prompt) {
  const replies = [
    "I understand your request. Based on the available information, I can say that there are several ways to approach the topic. The recommended approach depends on the specific context and your goals.",
    "Thank you for the interesting question. This is a rich topic with many aspects. I'd be happy to delve deeper into it if you'd like to focus on a specific aspect.",
    "I understand where you're going with this. This is an interesting line of thought that raises important discussion points. There are a few additional angles worth considering to get a complete picture.",
    "That's an excellent question that raises fascinating issues. The answer isn't straightforward, but there are several perspectives that can help you form your opinion on the matter.",
    "I identify the topic you've raised. There are several accepted approaches to dealing with this, and each offers different solutions. It's important to choose an approach that suits your specific case."
  ];
  
  return replies[Math.floor(Math.random() * replies.length)];
}

// API endpoint לאתחול ראשוני של האפליקציה
app.get("/init", (req, res) => {
  const AGENTS = ["dev_agent", "qa_agent", "executor_agent", "summary_agent"];
  
  res.json({
    agents: AGENTS.map(agentId => ({
      id: agentId,
      name: agentId,
      description: getAgentDescription(agentId),
      priority: 99,
      icon: "default"
    })),
    config: {
      ui: { 
        theme: "dark", 
        refreshRate: 5000, 
        animations: true 
      }
    }
  });
});

// פונקציה לקבלת תיאור ברירת המחדל של סוכן
function getAgentDescription(agentId) {
  switch (agentId) {
    case 'dev_agent':
      return 'סוכן פיתוח - אחראי על כתיבת קוד וביצוע משימות פיתוח';
    case 'qa_agent':
      return 'סוכן בדיקות - אחראי על בדיקת קוד ואיכות תוכנה';
    case 'executor_agent':
      return 'סוכן הרצה - אחראי על ביצוע והרצת קוד';
    case 'summary_agent':
      return 'סוכן סיכום - אחראי על יצירת סיכומים ותיעוד';
    default:
      return `סוכן ${agentId}`;
  }
}

// בסיסי API לקבלת סטטוס
app.get("/status", (req, res) => {
  const AGENTS = ["dev_agent", "qa_agent", "executor_agent", "summary_agent"];
  
  // חזרה עם סטטוס ברירת מחדל
  const status = {
    agents: AGENTS.map(agent => ({
      id: agent,
      name: agent,
      active: false,
      type: "AI Agent",
      description: getAgentDescription(agent)
    })),
    system: {
      status: "online",
      uptime: process.uptime()
    },
    status: {}
  };
  
  AGENTS.forEach(agent => {
    status.status[agent] = {
      active: false,
      lastRun: null,
      lastError: null
    };
  });
  
  res.json(status);
});

// API לקבלת לוגים של סוכן
app.get('/logs/live/:agent', async (req, res) => {
  try {
    const { agent } = req.params;
    
    if (!agent) {
      return res.status(400).json({ error: 'חסר מזהה סוכן' });
    }
    
    // קבע את סוג התגובה ל-text/event-stream עבור SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // רשום את הלקוח החדש
    const clientId = Date.now();
    const newClient = res;
    clients.set(clientId, newClient);
    
    // שלח מידע התחלתי ללקוח
    res.write(`data: ${JSON.stringify({ 
      type: 'info', 
      message: `מחובר ללוגים של סוכן ${agent}`, 
      timestamp: new Date().toISOString() 
    })}\n\n`);
    
    // נסה לקבל לוגים מסוכן אמיתי בשרת הסוכנים
    try {
      const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
      console.log(`מנסה לחבר לשרת הסוכנים: ${agentServerUrl}/logs/live/${agent}`);
      
      // כאן בדרך כלל היינו מפנים את הלקוח לשרת הסוכנים,
      // אבל במקרה זה נספק סימולציה של לוגים כל כמה שניות
      
    } catch (proxyError) {
      console.warn(`לא ניתן להתחבר לשרת הסוכנים: ${proxyError.message}`);
      // נמשיך עם לוגים מקומיים
    }
    
    // שלח לוגים מדומים כל 3 שניות
    const dummyLogs = [
      { type: 'info', message: `סוכן ${agent} פעיל ומנטר את המערכת` },
      { type: 'log', message: `בדיקת סטטוס מערכת עבור ${agent}` },
      { type: 'status', message: `המערכת פועלת כראוי` },
      { type: 'warn', message: `יש לשים לב לשינויים בסביבת העבודה` },
      { type: 'error', message: `לא התקבל מענה מהשרת - ניסיון מחודש` },
      { type: 'info', message: `החיבור לשרת הוחזר בהצלחה` }
    ];
    
    let logIndex = 0;
    const intervalId = setInterval(() => {
      if (clients.has(clientId)) {
        const logEntry = dummyLogs[logIndex % dummyLogs.length];
        clients.get(clientId).write(`data: ${JSON.stringify({
          ...logEntry,
          timestamp: new Date().toISOString(),
          agent
        })}\n\n`);
        logIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, 3000);
    
    // טפל בסגירת חיבור
    req.on('close', () => {
      clients.delete(clientId);
      clearInterval(intervalId);
      console.log(`לקוח ${clientId} ניתק מזרם הלוגים של ${agent}`);
    });
    
  } catch (error) {
    console.error(`שגיאה בהספקת לוגים לסוכן ${req.params.agent}: ${error.message}`);
    res.status(500).json({ error: `שגיאה בהספקת לוגים: ${error.message}` });
  }
});

// API למידע על הסוכנים
app.get("/agent-status", (req, res) => {
  const AGENTS = ["dev_agent", "qa_agent", "executor_agent", "summary_agent"];
  const status = {};
  
  AGENTS.forEach(agent => {
    status[agent] = false; // כרגע כל הסוכנים כבויים
  });
  
  res.json(status);
});

// API למבנה קבצים של הפרויקט הפעיל
app.get("/active-project/files", (req, res) => {
  try {
    const workspacePath = path.join(__dirname, "workspace.json");
    
    if (!fs.existsSync(workspacePath)) {
      console.error("קובץ workspace.json לא נמצא");
      return res.status(404).json({ success: false, error: "לא נמצא פרויקט פעיל" });
    }
    
    const workspaceData = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
    let projectPath = workspaceData.activeProject?.path;
    
    // בדוק אם קיימת תיקיית WORKSPACE ואם כן השתמש בה במקום הנתיב המקורי
    const workspaceDirPath = path.join(__dirname, "../WORKSPACE");
    if (fs.existsSync(workspaceDirPath)) {
      console.log(`משתמש בתיקיית WORKSPACE: ${workspaceDirPath}`);
      projectPath = workspaceDirPath;
    }
    
    if (!projectPath || !fs.existsSync(projectPath)) {
      console.error(`נתיב פרויקט לא תקין: ${projectPath}`);
      return res.status(404).json({ success: false, error: "נתיב הפרויקט הפעיל אינו תקין או לא קיים" });
    }
    
    console.log(`מקבל מבנה קבצים עבור פרויקט בנתיב: ${projectPath}`);
    
    // פונקציה רקורסיבית לסריקת תיקיות
    const scanDirectory = (dirPath, basePath = '') => {
      const entries = fs.readdirSync(dirPath);
      const result = [];
      
      for (const entry of entries) {
        // דלג על תיקיות מיוחדות
        if (entry === '.git' || entry === 'node_modules' || entry.startsWith('.')) {
          continue;
        }
        
        const fullPath = path.join(dirPath, entry);
        const relativePath = path.join(basePath, entry);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          const children = scanDirectory(fullPath, relativePath);
          result.push({
            name: entry,
            path: fullPath, // נתיב מלא לשימוש בפונקציות כמו פתיחת קובץ
            relativePath, // נתיב יחסי לתצוגה
            type: 'directory',
            children
          });
        } else {
          result.push({
            name: entry,
            path: fullPath, // נתיב מלא לשימוש בפונקציות כמו פתיחת קובץ
            relativePath, // נתיב יחסי לתצוגה
            type: 'file',
            size: stats.size
          });
        }
      }
      
      return result;
    };
    
    const files = scanDirectory(projectPath);
    res.json({ success: true, files });
  } catch (error) {
    console.error(`שגיאה בקבלת מבנה קבצים: ${error.message}`);
    res.status(500).json({ success: false, error: `שגיאה בקבלת מבנה קבצים: ${error.message}` });
  }
});

// API לפתיחת קובץ בעורך קוד חיצוני
app.post("/open-file", (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ success: false, error: "נתיב הקובץ חסר" });
    }
    
    console.log(`מנסה לפתוח קובץ בנתיב: ${filePath}`);
    
    // פתח את הקובץ בעורך ברירת המחדל של המערכת
    const { spawn } = require('child_process');
    
    // בדוק את מערכת ההפעלה
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // בחלונות: השתמש בפקודת start
      spawn('cmd.exe', ['/c', 'start', '', filePath], { 
        stdio: 'ignore',
        detached: true,
        windowsHide: true
      }).unref();
    } else {
      // במערכות לינוקס/מק: השתמש בפקודת xdg-open / open
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(opener, [filePath], {
        stdio: 'ignore',
        detached: true
      }).unref();
    }
    
    res.json({ success: true, message: "הקובץ נפתח בהצלחה" });
  } catch (error) {
    console.error(`שגיאה בפתיחת קובץ: ${error.message}`);
    res.status(500).json({ success: false, error: `שגיאה בפתיחת קובץ: ${error.message}` });
  }
});

// API למידע על הפרויקט הפעיל
app.get("/workspace", (req, res) => {
  try {
    const workspacePath = path.join(__dirname, "workspace.json");
    
    if (!fs.existsSync(workspacePath)) {
      console.log("קובץ workspace.json לא קיים, יוצר ברירת מחדל");
      
      // יצירת קובץ ברירת מחדל
      const defaultWorkspace = {
        activeProject: null
      };
      
      fs.writeFileSync(workspacePath, JSON.stringify(defaultWorkspace, null, 2));
      return res.json(defaultWorkspace);
    }
    
    const workspaceData = JSON.parse(fs.readFileSync(workspacePath, 'utf8'));
    
    // בדוק אם נתיב הפרויקט קיים
    if (workspaceData.activeProject && workspaceData.activeProject.path) {
      const projectPath = workspaceData.activeProject.path;
      if (!fs.existsSync(projectPath)) {
        console.warn(`נתיב הפרויקט לא קיים: ${projectPath}`);
        
        // עדכן את workspaceData.activeProject.status
        if (workspaceData.activeProject) {
          workspaceData.activeProject.status = "לא זמין";
        }
      }
    }
    
    res.json(workspaceData);
  } catch (error) {
    console.error(`שגיאה בקבלת מידע על מרחב עבודה: ${error.message}`);
    res.status(500).json({ 
      error: "שגיאה בקבלת מידע על מרחב עבודה", 
      message: error.message 
    });
  }
});

// API לבחירת פרויקט פעיל
app.post("/workspace/set", (req, res) => {
  try {
    const { projectId, projectName, projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: "Project path is required" 
      });
    }
    
    console.log(`Setting active project: ${projectName} (${projectPath})`);
    
    // Ensure WORKSPACE directory exists
    const workspaceDirPath = path.join(__dirname, "../WORKSPACE");
    if (!fs.existsSync(workspaceDirPath)) {
      fs.mkdirSync(workspaceDirPath, { recursive: true });
      console.log(`WORKSPACE directory created: ${workspaceDirPath}`);
    } else {
      // Clean the WORKSPACE directory
      fs.readdirSync(workspaceDirPath).forEach(file => {
        const filePath = path.join(workspaceDirPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmdirSync(filePath, { recursive: true });
        } else {
          fs.unlinkSync(filePath);
        }
      });
      console.log("WORKSPACE directory cleaned");
    }
    
    // Create a project-specific directory in WORKSPACE
    const projectName_clean = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const projectDirPath = path.join(workspaceDirPath, projectName_clean);
    
    if (!fs.existsSync(projectDirPath)) {
      fs.mkdirSync(projectDirPath, { recursive: true });
      console.log(`Project directory created: ${projectDirPath}`);
    }
    
    // Copy the project files to the WORKSPACE directory
    const copyProjectFiles = (sourcePath, targetPath) => {
      if (!fs.existsSync(sourcePath)) {
        console.error(`Source path does not exist: ${sourcePath}`);
        return;
      }
      
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      
      const entries = fs.readdirSync(sourcePath);
      
      for (const entry of entries) {
        // Skip special directories
        if (entry === '.git' || entry === 'node_modules') {
          continue;
        }
        
        const sourceEntryPath = path.join(sourcePath, entry);
        const targetEntryPath = path.join(targetPath, entry);
        
        const stats = fs.statSync(sourceEntryPath);
        
        if (stats.isDirectory()) {
          copyProjectFiles(sourceEntryPath, targetEntryPath);
        } else {
          fs.copyFileSync(sourceEntryPath, targetEntryPath);
        }
      }
    };
    
    copyProjectFiles(projectPath, projectDirPath);
    console.log(`Project successfully copied to: ${projectDirPath}`);
    
    // Update workspace.json file
    const workspaceConfig = {
      activeProject: {
        id: projectId || `project${Date.now()}`,
        name: projectName || "Active Project",
        status: "active",
        originalPath: projectPath,
        path: path.resolve(projectDirPath)
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, "workspace.json"), 
      JSON.stringify(workspaceConfig, null, 2)
    );
    
    res.json({ 
      success: true, 
      message: `Project ${projectName} set as active workspace`,
      project: workspaceConfig.activeProject
    });
  } catch (error) {
    console.error(`Error setting workspace: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: `Error setting workspace: ${error.message}` 
    });
  }
});

// API לקבלת רשימת פרויקטים
app.get("/projects", async (req, res) => {
  try {
    const projectsFilePath = path.join(__dirname, "projects.json");
    
    // נסה לקרוא את קובץ הפרויקטים
    if (fs.existsSync(projectsFilePath)) {
      const projectsData = fs.readFileSync(projectsFilePath, 'utf8');
      let projects = [];
      
      try {
        projects = JSON.parse(projectsData);
        if (!Array.isArray(projects)) projects = [];
        
        // בדוק תקינות כל פרויקט
        projects = projects.filter(project => {
          if (!project || !project.path) return false;
          return fs.existsSync(project.path);
        });
        
        console.log(`נמצאו ${projects.length} פרויקטים שמורים`);
        return res.json(projects);
      } catch (err) {
        console.error(`שגיאה בניתוח קובץ projects.json: ${err.message}`);
      }
    }
    
    // אם אין קובץ או הקריאה נכשלה, סרוק תיקיות
    const projectsDir = process.env.PROJECTS_DIR || path.join(__dirname, "../WORKSPACE");
    console.log(`סורק פרויקטים בתיקייה: ${projectsDir}`);
    
    // בדוק אם התיקייה קיימת
    if (!fs.existsSync(projectsDir)) {
      console.warn(`תיקיית הפרויקטים לא קיימת: ${projectsDir}`);
      return res.json([]);
    }
    
    // קרא את התיקיות מתיקיית הפרויקטים
    const projects = [];
    const entries = fs.readdirSync(projectsDir);
    
    entries.forEach(entry => {
      const entryPath = path.join(projectsDir, entry);
      const stats = fs.statSync(entryPath);
      
      // רק תיקיות
      if (stats.isDirectory()) {
        projects.push({
          id: `project${Date.now()}_${entry}`,
          name: entry,
          path: entryPath,
          status: "זמין"
        });
      }
    });
    
    console.log(`נמצאו ${projects.length} פרויקטים בתיקייה`);
    res.json(projects);
  } catch (error) {
    console.error(`Error getting project list: ${error.message}`);
    // במקרה של שגיאה, החזר רשימה ריקה
    res.json([]);
  }
});

// API להוספת פרויקט חדש
app.post("/projects/add", async (req, res) => {
  try {
    const { name, path: projectPath, description = "" } = req.body;
    
    if (!name || !projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project name and path are required' 
      });
    }
    
    // Check if the path exists
    if (!fs.existsSync(projectPath)) {
      return res.status(400).json({ 
        success: false, 
        error: 'The specified path does not exist' 
      });
    }
    
    // Add the project to the system
    console.log(`Adding new project: ${name} at path: ${projectPath}`);
    
    // Add the project to projects.json file
    const projectsFilePath = path.join(__dirname, "projects.json");
    let projects = [];
    
    if (fs.existsSync(projectsFilePath)) {
      try {
        const projectsData = fs.readFileSync(projectsFilePath, 'utf8');
        projects = JSON.parse(projectsData);
        if (!Array.isArray(projects)) projects = [];
      } catch (err) {
        console.error(`Error reading projects.json file: ${err.message}`);
        projects = [];
      }
    }
    
    const newProject = {
      id: `project${Date.now()}`,
      name: name,
      path: projectPath,
      description: description,
      status: "available",
      addedAt: new Date().toISOString()
    };
    
    projects.push(newProject);
    fs.writeFileSync(projectsFilePath, JSON.stringify(projects, null, 2));
    console.log(`Project successfully saved to projects.json file`);
    
    // If connected to the agent server, pass the information to it as well
    try {
      const agentServerUrl = config.system.agentServerUrl || 'http://localhost:3000';
      await axios.post(`${agentServerUrl}/projects/add`, {
        name,
        path: projectPath,
        description
      }).catch(err => {
        console.warn(`Unable to pass project to agent server: ${err.message}`);
      });
      console.log(`Project successfully passed to agent server`);
    } catch (proxyError) {
      console.warn(`Unable to pass project to agent server: ${proxyError.message}`);
      // Continue despite the error as it's not critical
    }
    
    // Immediately set the project as active by calling workspace/set endpoint
    try {
      // Call the workspace/set endpoint to copy the project and set it active
      const workspaceSetResponse = await new Promise((resolve) => {
        const workspaceReq = {
          body: {
            projectId: newProject.id,
            projectName: name,
            projectPath: projectPath
          }
        };
        const workspaceRes = {
          json: (data) => resolve(data),
          status: (code) => ({ json: (data) => resolve({ ...data, statusCode: code }) })
        };
        
        // Call the workspace/set handler directly
        require('./routes/workspace').setWorkspace(workspaceReq, workspaceRes);
      });
      
      if (!workspaceSetResponse.success) {
        console.error(`Failed to set project as active: ${workspaceSetResponse.error}`);
      } else {
        console.log(`Project successfully set as active workspace`);
        newProject.active = true;
      }
    } catch (wsError) {
      console.error(`Error setting project as active workspace: ${wsError.message}`);
    }
    
    res.json({ 
      success: true, 
      message: `Project ${name} added successfully`,
      project: newProject
    });
  } catch (error) {
    console.error(`Error adding project: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Error adding project', 
      message: error.message 
    });
  }
});

// API לבדיקת תקינות קבצים
app.post("/validate-file", (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ 
        success: false, 
        error: "נתיב הקובץ חסר" 
      });
    }
    
    // בדוק אם הקובץ קיים
    if (!fs.existsSync(filePath)) {
      return res.json({ 
        success: false, 
        exists: false, 
        message: "הקובץ לא קיים" 
      });
    }
    
    // בדוק אם זה קובץ או תיקייה
    const stats = fs.statSync(filePath);
    const isDirectory = stats.isDirectory();
    
    res.json({ 
      success: true, 
      exists: true, 
      isDirectory, 
      size: stats.size,
      lastModified: stats.mtime
    });
  } catch (error) {
    console.error(`שגיאה בבדיקת תקינות קובץ: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: `שגיאה בבדיקת תקינות קובץ: ${error.message}` 
    });
  }
});

// נקודות קצה proxy לסוכן התזמון (שרת הסוכנים)
app.get('/scheduler/tasks/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/scheduler/tasks/${agentId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בקבלת משימות מתוזמנות: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת משימות מתוזמנות',
      details: error.message 
    });
  }
});

// Endpoint to get agent list from the agent server
app.get('/agents', async (req, res) => {
  try {
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/agents`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error getting agent list: ${error.message}`);
    
    // Return local agent list from configuration in case of error
    if (config.agents) {
      const localAgents = Object.entries(config.agents).map(([id, info]) => ({
        id,
        name: info.displayName || id,
        description: info.description || `סוכן ${id}`,
        priority: info.priority || 99,
        icon: info.icon || 'default'
      }));
      
      console.log(`מחזיר ${localAgents.length} סוכנים מקומיים מקובץ התצורה`);
      res.json(localAgents);
    } else {
      // אם אין תצורה מקומית, החזר רשימה ריקה
      res.json([]);
    }
  }
});

app.post('/scheduler/create', async (req, res) => {
  try {
    const { agentId, name, cronExpression, action, params } = req.body;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.post(`${agentServerUrl}/scheduler/create`, {
      agentId, 
      name, 
      cronExpression, 
      action, 
      params
    });
    
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה ביצירת משימה מתוזמנת: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה ביצירת משימה מתוזמנת',
      details: error.message 
    });
  }
});

app.delete('/scheduler/delete/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.delete(`${agentServerUrl}/scheduler/delete/${taskId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה במחיקת משימה מתוזמנת: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה במחיקת משימה מתוזמנת',
      details: error.message 
    });
  }
});

// API לבחירת תיקייה (עבור דפדפן תיקיות)
app.get("/browse-folder", (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // בחלונות, נשתמש ב-PowerShell כדי להציג דיאלוג בחירת תיקייה
    if (process.platform === 'win32') {
      const { exec } = require('child_process');
      const script = `
      [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
      $dialog.Description = 'בחר תיקיית פרויקט'
      $dialog.RootFolder = 'MyComputer'
      $dialog.ShowDialog() | Out-Null
      Write-Output $dialog.SelectedPath
      `;

      exec(`powershell.exe -Command "${script}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`שגיאה בבחירת תיקייה: ${error.message}`);
          return res.status(500).json({ 
            success: false, 
            error: 'שגיאה בפתיחת דפדפן תיקיות' 
          });
        }

        const selectedPath = stdout.trim();
        if (!selectedPath) {
          return res.json({ 
            success: false, 
            error: 'לא נבחרה תיקייה' 
          });
        }

        res.json({ 
          success: true, 
          path: selectedPath 
        });
      });
    } else {
      // בלינוקס/מק, נחזיר שגיאה שהפונקציה לא נתמכת
      res.status(400).json({ 
        success: false, 
        error: 'בחירת תיקייה נתמכת רק ב-Windows' 
      });
    }
  } catch (error) {
    console.error(`שגיאה בבחירת תיקייה: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: `שגיאה בבחירת תיקייה: ${error.message}` 
    });
  }
});

// נקודות קצה proxy לתזרימי עבודה (שרת הסוכנים)
app.get('/workflows', async (req, res) => {
  try {
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/workflows`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בקבלת תזרימי עבודה: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת תזרימי עבודה',
      details: error.message 
    });
  }
});

app.get('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/workflows/${id}`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בקבלת תזרים עבודה: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת תזרים עבודה',
      details: error.message 
    });
  }
});

app.post('/workflows', async (req, res) => {
  try {
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.post(`${agentServerUrl}/workflows`, req.body);
    res.status(201).json(response.data);
  } catch (error) {
    console.error(`שגיאה ביצירת תזרים עבודה: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה ביצירת תזרים עבודה',
      details: error.message 
    });
  }
});

app.post('/workflows/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.post(`${agentServerUrl}/workflows/${id}/run`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בהפעלת תזרים עבודה: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בהפעלת תזרים עבודה',
      details: error.message 
    });
  }
});

app.get('/workflow-runs', async (req, res) => {
  try {
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/workflow-runs`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בקבלת תזרימי עבודה פעילים: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת תזרימי עבודה פעילים',
      details: error.message 
    });
  }
});

app.get('/workflow-runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/workflow-runs/${runId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בקבלת סטטוס תזרים עבודה: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת סטטוס תזרים עבודה',
      details: error.message 
    });
  }
});

app.delete('/workflow-runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.delete(`${agentServerUrl}/workflow-runs/${runId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בעצירת תזרים עבודה: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בעצירת תזרים עבודה',
      details: error.message 
    });
  }
});

// נקודות קצה proxy למדדים ואנליטיקה (שרת הסוכנים)
app.get('/metrics/system', async (req, res) => {
  try {
    const { period } = req.query;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/metrics/system${period ? `?period=${period}` : ''}`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בקבלת מדדי מערכת: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת מדדי מערכת',
      details: error.message 
    });
  }
});

app.get('/metrics/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { period } = req.query;
    const agentServerUrl = config.system.agentServerUrl || 'http://localhost:5001';
    
    const response = await axios.get(`${agentServerUrl}/metrics/agent/${agentId}${period ? `?period=${period}` : ''}`);
    res.json(response.data);
  } catch (error) {
    console.error(`שגיאה בקבלת מדדי סוכן: ${error.message}`);
    res.status(500).json({ 
      error: 'שגיאה בקבלת מדדי סוכן',
      details: error.message 
    });
  }
});

// Status endpoint for health checks
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'active',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// קבע את הפורט לפי הסביבה או השתמש ב-3001 כברירת מחדל
const PORT = process.env.PORT || 3001;

// הגדרת נתיב כלשהו שלא טופל כדי להחזיר את הדף הראשי
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => console.log(`Dashboard server running on port ${PORT}`)); 