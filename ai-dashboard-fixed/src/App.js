import React, { useEffect, useState } from "react";
import "./index.css";
import ProjectSelector from "./components/ProjectSelector";
import FileExplorer from "./components/FileExplorer";
import AgentComponent from "./components/AgentComponent";

const AGENTS = ["dev_agent", "qa_agent", "executor_agent", "summary_agent"];

export default function App() {
  const [logs, setLogs] = useState({});
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("בודק מצב...");
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState([]);
  const [agentStatus, setAgentStatus] = useState({});
  const [activeProject, setActiveProject] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchAgentStatus();
    fetchProjects();
    const interval = setInterval(() => {
      fetchLogs();
      fetchAgentStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    const newLogs = {};
    for (const agent of AGENTS) {
      try {
        const res = await fetch(`http://localhost:5001/logs/live/${agent}`);
        let text = await res.text();
        if (text.includes("<!DOCTYPE html>")) {
          text = "⚠️ קובץ לוג לא נמצא או הכתובת שגויה.";
        }
        newLogs[agent] = text;
      } catch (err) {
        newLogs[agent] = "⚠️ שגיאה בטעינת הלוג.";
      }
    }
    setLogs(newLogs);
    updateProgress(newLogs);
  };

  const fetchAgentStatus = async () => {
    try {
      const res = await fetch("http://localhost:5001/status");
      const data = await res.json();
      setAgentStatus(data.status || {});
    } catch (err) {
      console.error("שגיאה בבדיקת סטטוס סוכנים");
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5001/projects");
      const data = await response.json();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProject(data[0]);
      }
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת פרויקטים: ' + err.message);
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = (logs) => {
    const total = AGENTS.length;
    let completed = 0;
    for (const log of Object.values(logs)) {
      if (!log.includes("אין פעולות") && log.length > 50) completed++;
    }
    const percent = Math.floor((completed / total) * 100);
    setProgress(percent);
    setStatus(percent === 100 ? "🚀 הפרויקט מוכן!" : `התקדמות: ${percent}%`);
  };

  const runAgent = async (agent) => {
    try {
      const res = await fetch("http://localhost:5001/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      const data = await res.json();
      alert(`✅ ${data.message}`);
    } catch (err) {
      alert("❌ שגיאה בהפעלה");
    }
  };

  const stopAgent = async (agent) => {
    try {
      const res = await fetch("http://localhost:5001/stop-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent }),
      });
      const data = await res.json();
      alert(`🛑 ${data.message}`);
    } catch (err) {
      alert("❌ שגיאה בכיבוי");
    }
  };

  const buildProject = async () => {
    try {
      const res = await fetch("http://localhost:5001/build-project", {
        method: "POST",
      });
      const data = await res.json();
      alert(`🚀 ${data.message}`);
    } catch (err) {
      alert("❌ שגיאה בבניית הפרויקט");
    }
  };

  const handleInput = (num) => {
    const newInput = [...input, num];
    setInput(newInput);
    if (newInput.join("") === "369") {
      setUnlocked(true);
    } else if (newInput.length >= 3) {
      setInput([]);
      alert("❌ נסיון פריצה! 😈");
    }
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white flex-col">
        <h2 className="text-3xl font-bold mb-6">🔒 הזן את הקוד כדי להיכנס</h2>
        <div className="flex space-x-4">
          {[3, 6, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleInput(num)}
              className="bg-gray-800 text-white px-6 py-4 text-2xl rounded-lg shadow-lg hover:bg-gray-700 transition"
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Agent Dashboard</h1>
        <nav>
          <button 
            className={activeTab === 'dashboard' ? 'active' : ''} 
            onClick={() => setActiveTab('dashboard')}
          >
            לוח בקרה
          </button>
          <button 
            className={activeTab === 'projects' ? 'active' : ''} 
            onClick={() => setActiveTab('projects')}
          >
            פרויקטים
          </button>
          <button 
            className={activeTab === 'agents' ? 'active' : ''} 
            onClick={() => setActiveTab('agents')}
          >
            סוכנים
          </button>
        </nav>
      </header>

      <main>
        {error && <div className="error-message">{error}</div>}
        
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <h2>מצב המערכת</h2>
            <div className="dashboard-content">
              <div className="dashboard-card">
                <h3>פרויקטים פעילים</h3>
                <p className="dashboard-value">{projects.length}</p>
              </div>
              <div className="dashboard-card">
                <h3>סוכנים פעילים</h3>
                <p className="dashboard-value">0</p>
              </div>
              <div className="dashboard-card">
                <h3>משימות ממתינות</h3>
                <p className="dashboard-value">0</p>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'projects' && (
          <div className="projects-container">
            <div className="project-sidebar">
              <ProjectSelector 
                projects={projects} 
                selectedProject={selectedProject}
                onSelectProject={handleProjectSelect}
                onRefreshProjects={fetchProjects}
              />
            </div>
            <div className="project-content">
              {selectedProject ? (
                <FileExplorer projectId={selectedProject.id} projectPath={selectedProject.path} />
              ) : (
                loading ? <p>טוען פרויקטים...</p> : <p>בחר פרויקט כדי להציג את הקבצים</p>
              )}
            </div>
          </div>
        )}
        
        {activeTab === 'agents' && (
          <div className="agents-container">
            <AgentComponent />
          </div>
        )}
      </main>
    </div>
  );
}
