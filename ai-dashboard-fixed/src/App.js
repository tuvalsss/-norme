import React, { useEffect, useState, useCallback, useMemo } from "react";
import "./App.css";
import ProjectSelector from "./components/ProjectSelector";
import FileExplorer from "./components/FileExplorer";
import AgentComponent from "./components/AgentComponent";
import SchedulerComponent from "./components/SchedulerComponent";
import WorkflowComponent from "./components/WorkflowComponent";
import AnalyticsComponent from "./components/AnalyticsComponent";
import AiAssistantButton from "./components/aiAssistant/AiAssistantButton";
import axios from 'axios';

// We'll use configuration variables from the server
const API_URL = 'http://localhost:3001';

function App() {
  const [logs, setLogs] = useState({});
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Checking status...");
  const [unlocked, setUnlocked] = useState(true);
  const [input, setInput] = useState([]);
  const [agentStatus, setAgentStatus] = useState({});
  const [activeProject, setActiveProject] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [config, setConfig] = useState({
    ui: {
      theme: localStorage.getItem('theme') || "dark",
      refreshRate: 5000,
      animations: true,
    }
  });
  const [agents, setAgents] = useState([]);
  const [lastStatusUpdate, setLastStatusUpdate] = useState(null);
  const [statusUpdateCount, setStatusUpdateCount] = useState(0);
  
  // Initialize the system with settings from the server
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setLoading(true);
        
        // Get the configuration and agent information
        const initResponse = await axios.get(`${API_URL}/init`);
        
        if (initResponse.data) {
          setConfig(initResponse.data.config);
          setAgents(initResponse.data.agents);
          console.log("System initialized with config:", initResponse.data);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Initialization error:", err);
        setError("System initialization error. Please refresh the page.");
        setLoading(false);
      }
    };
    
    initializeSystem();
  }, []);

  // Check server connection
  useEffect(() => {
    const checkServerConnection = async () => {
      try {
        setIsChecking(true);
        await axios.get(`${API_URL}/status`);
        setIsServerConnected(true);
        setIsOffline(false);
      } catch (err) {
        console.error('Server connection error:', err);
        setIsServerConnected(false);
        setIsOffline(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkServerConnection();
    
    const intervalId = setInterval(checkServerConnection, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Check agent status
  const checkAgentStatus = useCallback(async () => {
    if (isOffline) return;
    
    try {
      const response = await axios.get(`${API_URL}/agent-status`);
      
      // Update only if there are changes from the previous status
      const newStatus = response.data;
      const hasChanges = !lastStatusUpdate || 
        JSON.stringify(newStatus) !== JSON.stringify(lastStatusUpdate);
      
      if (hasChanges) {
        setAgentStatus(newStatus);
        setLastStatusUpdate(newStatus);
        setStatusUpdateCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error checking agent status:', err);
    }
  }, [isOffline, lastStatusUpdate]);

  // Check agent status periodically
  useEffect(() => {
    if (isOffline) return;
    
    checkAgentStatus();
    
    const intervalId = setInterval(checkAgentStatus, config.ui.refreshRate || 5000);
    
    return () => clearInterval(intervalId);
  }, [checkAgentStatus, config.ui.refreshRate, isOffline]);

  // Load projects
  useEffect(() => {
    loadProjects();
  }, []);

  // Sort agents by priority
  const sortedAgents = useMemo(() => {
    if (!agents) return [];
    
    return [...agents].sort((a, b) => {
      // Sort by priority if available
      if (a.priority !== undefined && b.priority !== undefined) {
        return a.priority - b.priority;
      }
      // Otherwise sort by name
      return a.name.localeCompare(b.name);
    });
  }, [agents]);

  // Handle project selection
  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    
    try {
      // Call API to set the selected project as active
      const response = await axios.post(`${API_URL}/workspace/set`, { projectId: project.id });
      
      if (response.data.success) {
        setActiveProject(project);
        console.log("Active project set:", project.name);
      } else {
        console.error("Failed to set active project:", response.data.error);
      }
    } catch (err) {
      console.error("Error setting active project:", err);
    }
  };

  // Load projects
  const loadProjects = async () => {
    try {
      // Get projects list
      const projectsResponse = await axios.get(`${API_URL}/projects`);
      setProjects(projectsResponse.data || []);
      
      // Get active project
      const activeProjectResponse = await axios.get(`${API_URL}/active-project`);
      
      if (activeProjectResponse.data.project) {
        setActiveProject(activeProjectResponse.data.project);
        setSelectedProject(activeProjectResponse.data.project);
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    } finally {
      setLoading(false);
    }
  };

  // Add a new project
  const handleAddProject = async (projectData) => {
    try {
      const response = await axios.post(`${API_URL}/projects/add`, {
        name: projectData.name,
        path: projectData.path,
        description: projectData.description || ""
      });
      
      if (response.data.success) {
        // Add the new project to the list immediately
        const newProject = response.data.project || {
          id: Date.now().toString(), // Temporary ID if server doesn't provide one
          name: projectData.name,
          path: projectData.path,
          description: projectData.description || ""
        };
        
        // Update projects list
        setProjects(prevProjects => [...prevProjects, newProject]);
        
        // Set the new project as active immediately
        setSelectedProject(newProject);
        setActiveProject(newProject);
        
        // Force a re-fetch of the file explorer to show the new project files
        setTimeout(() => {
          if (newProject && newProject.id) {
            console.log("Setting up new project as active:", newProject.name);
            // Make sure the UI updates to show the project
            handleProjectSelect(newProject);
          }
        }, 500);
        
        console.log("Project added successfully:", newProject);
        return { success: true, project: newProject };
      } else {
        console.error("Failed to add project:", response.data.error);
        return { success: false, error: response.data.error };
      }
    } catch (err) {
      console.error("Error adding project:", err);
      return { success: false, error: err.message };
    }
  };

  // Handle tab selection
  const handleSelectTab = (tab) => {
    setActiveTab(tab);
  };

  // Handle theme change
  const handleThemeChange = (e) => {
    const theme = e.target.checked ? 'light' : 'dark';
    setConfig({
      ...config,
      ui: {
        ...config.ui,
        theme
      }
    });
    localStorage.setItem('theme', theme);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-300 mx-auto mb-4"></div>
          <p className="text-xl">Loading system...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="bg-black border border-gray-800 p-6 rounded-lg max-w-lg">
          <h2 className="text-gray-400 text-xl mb-4">System Error</h2>
          <p className="mb-4">{error}</p>
          <button 
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${config.ui.theme === 'light' ? 'bg-gray-100 text-gray-800' : 'bg-black text-white'}`}>
      {/* Header */}
      <header className={`py-2 flex justify-center items-center ${config.ui.theme === 'light' ? 'bg-white border-b border-gray-200' : 'bg-black border-b border-gray-800'}`}>
        <div className="logo-container">
          <img 
            src="/images/enorme-logo.png" 
            alt="ÉNORME AI AGENT SYSTEM" 
            className="logo-image"
          />
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-80 p-4 flex flex-col ${config.ui.theme === 'light' ? 'bg-white border-r border-gray-200' : 'bg-black border-r border-gray-800'}`}>
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-2 text-gray-300">Current Project</h2>
            <ProjectSelector 
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={handleProjectSelect}
              onAddProject={handleAddProject}
            />
          </div>
          
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-2 text-gray-300">System Agents</h2>
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] pr-1 custom-scrollbar">
              {sortedAgents.map(agent => (
                <AgentComponent 
                  key={agent.id}
                  agent={agent.id}
                  name={agent.name}
                  description={agent.description}
                  agentStatus={agentStatus}
                  setAgentStatus={setAgentStatus}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Main panel */}
        <div className={`flex-1 p-4 overflow-hidden ${config.ui.theme === 'light' ? 'bg-gray-100' : 'bg-black'}`}>
          <div className="mb-4">
            <ul className="flex border-b border-gray-800">
              <li className="mr-2">
                <button
                  className={`py-2 px-4 ${activeTab === 'projects' ? 'border-b-2 border-gray-300 text-gray-300' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => handleSelectTab('projects')}
                >
                  Project Overview
                </button>
              </li>
              <li className="mr-2">
                <button
                  className={`py-2 px-4 ${activeTab === 'logs' ? 'border-b-2 border-gray-300 text-gray-300' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => handleSelectTab('logs')}
                >
                  Logs
                </button>
              </li>
              <li className="mr-2">
                <button
                  className={`py-2 px-4 ${activeTab === 'scheduler' ? 'border-b-2 border-gray-300 text-gray-300' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => handleSelectTab('scheduler')}
                >
                  Scheduler
                </button>
              </li>
              <li className="mr-2">
                <button
                  className={`py-2 px-4 ${activeTab === 'workflows' ? 'border-b-2 border-gray-300 text-gray-300' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => handleSelectTab('workflows')}
                >
                  Workflows
                </button>
              </li>
              <li className="mr-2">
                <button
                  className={`py-2 px-4 ${activeTab === 'analytics' ? 'border-b-2 border-gray-300 text-gray-300' : 'text-gray-400 hover:text-white'}`}
                  onClick={() => handleSelectTab('analytics')}
                >
                  Analytics
                </button>
              </li>
            </ul>
          </div>

          {/* Tab content */}
          <div className="h-full overflow-y-auto custom-scrollbar">
            {activeTab === 'projects' && (
              selectedProject ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-lg border border-gray-800">
                    <h2 className="text-2xl font-bold mb-2">{selectedProject.name}</h2>
                    <p className="text-gray-400 mb-4">{selectedProject.description || "No description provided"}</p>
                    <div className="flex space-x-2">
                      <button className="btn-action">Run Analysis</button>
                      <button className="btn-action">Generate Report</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                      <h3 className="text-lg font-bold mb-2">File Explorer</h3>
                      <FileExplorer activeProject={selectedProject} />
                    </div>
                    
                    <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                      <h3 className="text-lg font-bold mb-2">Agent Activity</h3>
                      <div className="space-y-2">
                        {Object.entries(agentStatus).map(([agentId, status]) => (
                          <div key={agentId} className="flex justify-between items-center p-2 bg-gray-800 rounded">
                            <span>{agentId}</span>
                            <span className={`px-2 py-1 rounded text-xs ${status.active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                              {status.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-gray-400 mb-4">No project selected</p>
                    <p className="text-sm text-gray-500">Select a project from the sidebar or create a new one</p>
                  </div>
                </div>
              )
            )}
            
            {activeTab === 'logs' && (
              <div className="bg-gray-900 p-4 rounded-lg">
                <h3 className="text-lg font-bold mb-2">System Logs</h3>
                <div className="bg-black p-4 rounded font-mono text-xs h-64 overflow-y-auto">
                  {Object.entries(logs).map(([timestamp, log], index) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-500">[{timestamp}]</span> <span className="text-white">{log}</span>
                    </div>
                  ))}
                  {Object.keys(logs).length === 0 && (
                    <p className="text-gray-500">No logs available</p>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'scheduler' && (
              <SchedulerComponent />
            )}
            
            {activeTab === 'workflows' && (
              <WorkflowComponent />
            )}
            
            {activeTab === 'analytics' && (
              <AnalyticsComponent agents={sortedAgents} />
            )}
          </div>
        </div>
      </div>
      
      {/* Theme toggle */}
      <div className="fixed bottom-4 left-4 flex items-center">
        <span className="mr-2 text-xs text-gray-500">Dark</span>
        <label className="relative inline-block w-10 h-5">
          <input
            type="checkbox"
            className="opacity-0 w-0 h-0"
            checked={config.ui.theme === 'light'}
            onChange={handleThemeChange}
          />
          <span className="absolute top-0 left-0 right-0 bottom-0 bg-gray-800 rounded-full cursor-pointer before:absolute before:content-[''] before:h-4 before:w-4 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-all before:duration-300 before:translate-x-0 before:translate-y-0 peer-checked:bg-blue-600 peer-checked:before:translate-x-5"></span>
        </label>
        <span className="ml-2 text-xs text-gray-500">Light</span>
      </div>

      {/* AI Assistant Button */}
      <AiAssistantButton />
    </div>
  );
}

export default App;
