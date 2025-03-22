import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AgentComponent.css';

/**
 * Component for managing the scheduler agent
 *
 * @param {Object} props - Component properties
 * @param {string} props.agentId - Agent ID (scheduler_agent)
 * @returns {JSX.Element} React component
 */
const SchedulerComponent = ({ agentId = 'scheduler_agent' }) => {
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTask, setNewTask] = useState({
    name: '',
    agentId: '',
    cronExpression: '0 * * * *', // Default: every hour
    action: '',
    params: '{}'
  });
  const [showForm, setShowForm] = useState(false);

  // Load scheduled tasks when component mounts
  useEffect(() => {
    fetchTasks();
    fetchAgents();
    
    // Refresh task list every 30 seconds
    const intervalId = setInterval(fetchTasks, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Fetch scheduled tasks
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3001/scheduler/tasks/${agentId}`);
      
      if (response.status === 200) {
        setTasks(response.data || []);
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (err) {
      console.error('Error loading scheduled tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available agents
  const fetchAgents = async () => {
    try {
      const response = await axios.get('http://localhost:3001/agents');
      
      if (response.status === 200) {
        setAgents(response.data || []);
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (err) {
      console.error('Error loading agents:', err);
      setError(err.message);
    }
  };

  // Create new scheduled task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Try to parse params as JSON to validate
      let parsedParams;
      try {
        parsedParams = JSON.parse(newTask.params);
      } catch (err) {
        alert('Invalid JSON parameters');
        return;
      }
      
      const response = await axios.post('http://localhost:3001/scheduler/create', {
        agentId: newTask.agentId,
        name: newTask.name,
        cronExpression: newTask.cronExpression,
        action: newTask.action,
        params: parsedParams
      });
      
      if (response.status === 200) {
        // Reset form
        setNewTask({
          name: '',
          agentId: '',
          cronExpression: '0 * * * *',
          action: '',
          params: '{}'
        });
        setShowForm(false);
        
        // Reload tasks
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error creating scheduled task:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete scheduled task
  const handleDeleteTask = async (taskId) => {
    try {
      setLoading(true);
      
      const response = await axios.delete(`http://localhost:3001/scheduler/delete/${taskId}`);
      
      if (response.status === 200) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting scheduled task:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle form changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTask(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Format cron expression to human-readable form
  const formatCronExpression = (cronExp) => {
    const parts = cronExp.split(' ');
    
    if (parts.length !== 5) return cronExp;
    
    if (parts[0] === '0' && parts[1] === '*' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return 'Every hour';
    }
    
    if (parts[0] === '0' && parts[1] === '0' && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return 'Every day at midnight';
    }
    
    return cronExp;
  };

  return (
    <div className="scheduler-component">
      <h2>Scheduler Agent Management</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="control-panel">
        <button 
          className="toggle-form-button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Schedule New Task'}
        </button>
      </div>
      
      {showForm && (
        <div className="task-form">
          <h3>Create New Scheduled Task</h3>
          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label htmlFor="name">Task Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={newTask.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="targetAgent">Target Agent:</label>
              <select
                id="targetAgent"
                name="agentId"
                value={newTask.agentId}
                onChange={handleInputChange}
                required
              >
                <option value="">Select agent...</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="cronExpression">Schedule (Cron):</label>
              <input
                type="text"
                id="cronExpression"
                name="cronExpression"
                value={newTask.cronExpression}
                onChange={handleInputChange}
                required
              />
              <div className="form-helper">
                Format: <code>minute hour day-of-month month day-of-week</code><br />
                Examples: <code>0 * * * *</code> (every hour), <code>0 0 * * *</code> (daily at midnight)
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="action">Action:</label>
              <input
                type="text"
                id="action"
                name="action"
                value={newTask.action}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="params">Parameters (JSON):</label>
              <textarea
                id="params"
                name="params"
                rows="3"
                value={newTask.params}
                onChange={handleInputChange}
                placeholder="{}"
              ></textarea>
            </div>
            
            <button 
              type="submit" 
              className="create-button"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </form>
        </div>
      )}
      
      <div className="tasks-list">
        <h3>Scheduled Tasks</h3>
        {loading && tasks.length === 0 ? (
          <div className="loading">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="no-tasks">No scheduled tasks found.</div>
        ) : (
          <div className="tasks-table">
            {tasks.map(task => (
              <div key={task.id} className="task-item">
                <div className="task-header">
                  <h4>{task.name}</h4>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteTask(task.id)}
                    title="Delete Task"
                  >
                    ×
                  </button>
                </div>
                
                <div className="task-details">
                  <span className="task-schedule">
                    Schedule: <strong>{formatCronExpression(task.cronExpression)}</strong>
                  </span>
                  <span className="task-action">
                    Action: <strong>{task.action}</strong>
                  </span>
                  <span className="task-agent-id">
                    For agent: <strong>{task.agentId}</strong>
                  </span>
                  {task.lastRun && (
                    <span className="task-last-run">
                      Last run: <strong>{new Date(task.lastRun).toLocaleString()}</strong>
                    </span>
                  )}
                  {task.nextRun && (
                    <span className="task-next-run">
                      Next run: <strong>{new Date(task.nextRun).toLocaleString()}</strong>
                    </span>
                  )}
                </div>
                
                {task.params && Object.keys(task.params).length > 0 && (
                  <div className="task-params">
                    <span>Parameters:</span>
                    <pre>{JSON.stringify(task.params, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulerComponent; 