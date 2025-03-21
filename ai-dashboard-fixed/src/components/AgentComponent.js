import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiPlay, FiPause, FiTrash2, FiClock, FiSearch, FiHardDrive, FiList } from 'react-icons/fi';
import { FaPlay, FaStop, FaMemory, FaClock as FaClockIcon, FaList as FaListIcon, FaSearch as FaSearchIcon, FaTrash } from 'react-icons/fa';
import './AgentComponent.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const AgentComponent = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('status'); // status, memory, scheduler
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [memory, setMemory] = useState(null);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // מידע על פעילות האחרונה
  const [currentActivity, setCurrentActivity] = useState(null);

  const [agentMemory, setAgentMemory] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    cronExpression: '',
    action: 'run',
    params: ''
  });

  useEffect(() => {
    fetchAgents();
    fetchAgentManager();
    
    // עדכון כל 5 שניות
    const intervalId = setInterval(() => {
      fetchAgents();
      fetchAgentManager();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentData();
    }
  }, [selectedAgent, activeTab]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/agents`);
      setAgents(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת סוכנים: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentManager = async () => {
    try {
      const response = await axios.get(`${API_URL}/agent-manager/current-activity`);
      setCurrentActivity(response.data);
    } catch (err) {
      console.error('שגיאה בטעינת פעילות נוכחית:', err);
    }
  };

  const fetchAgentData = async () => {
    if (!selectedAgent) return;

    try {
      setLoading(true);
      
      if (activeTab === 'memory') {
        const response = await axios.get(`${API_URL}/agents/${selectedAgent}/memory`);
        setAgentMemory(response.data);
      } else if (activeTab === 'schedule') {
        const response = await axios.get(`${API_URL}/scheduler/tasks/${selectedAgent}`);
        setSchedules(response.data);
      }
    } catch (err) {
      setError('שגיאה בטעינת נתוני סוכן: ' + err.message);
      console.error('Error fetching agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemory = async (agentName) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/memory/${agentName}`);
      setMemory(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת זיכרון: ' + err.message);
      setMemory(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/agent-manager/scheduled-tasks`);
      setScheduledTasks(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בטעינת משימות מתוזמנות: ' + err.message);
      setScheduledTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const searchMemory = async (agentName, query) => {
    if (!query.trim()) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/memory/${agentName}/search`, { 
        query,
        options: { limit: 20 } 
      });
      setSearchResults(response.data);
      setError(null);
    } catch (err) {
      setError('שגיאה בחיפוש בזיכרון: ' + err.message);
      setSearchResults(null);
    } finally {
      setLoading(false);
    }
  };

  const clearMemory = async (agentName) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את זיכרון הסוכן ${agentName}?`)) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/memory/${agentName}`);
      setMemory(null);
      setError(null);
      alert(`זיכרון של סוכן ${agentName} נמחק בהצלחה`);
    } catch (err) {
      setError('שגיאה במחיקת זיכרון: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAgent = async (agentName) => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/run-agent`, { agent: agentName });
      await fetchAgents();
    } catch (err) {
      setError('שגיאה בהפעלת סוכן: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopAgent = async (agentName) => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/stop-agent`, { agent: agentName });
      await fetchAgents();
    } catch (err) {
      setError('שגיאה בכיבוי סוכן: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentSelect = (agentName) => {
    setSelectedAgent(agentName);
    if (activeTab === 'memory') {
      fetchMemory(agentName);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'memory' && selectedAgent) {
      fetchMemory(selectedAgent);
    } else if (tab === 'scheduler') {
      fetchScheduledTasks();
    }
  };

  const renderTabs = () => (
    <div className="tabs mb-4">
      <button 
        className={`tab ${activeTab === 'status' ? 'active' : ''}`}
        onClick={() => handleTabChange('status')}
      >
        <FiList /> סטטוס
      </button>
      <button 
        className={`tab ${activeTab === 'memory' ? 'active' : ''}`}
        onClick={() => handleTabChange('memory')}
      >
        <FiHardDrive /> זיכרון
      </button>
      <button 
        className={`tab ${activeTab === 'scheduler' ? 'active' : ''}`}
        onClick={() => handleTabChange('scheduler')}
      >
        <FiClock /> תזמון
      </button>
    </div>
  );

  const renderAgentsList = () => (
    <div className="agents-list">
      {agents.map((agent) => (
        <div 
          key={agent.name}
          className={`agent-item ${selectedAgent === agent.name ? 'selected' : ''} ${agent.active ? 'active' : 'inactive'}`}
          onClick={() => handleAgentSelect(agent.name)}
        >
          <div className="agent-name">{agent.name}</div>
          <div className="agent-status">
            {agent.active ? 'פעיל' : 'לא פעיל'}
            {currentActivity && currentActivity.currentHeavyAgent === agent.name && (
              <span className="running-label"> (רץ כעת)</span>
            )}
          </div>
          <div className="agent-actions">
            {agent.active ? (
              <button 
                className="agent-button stop" 
                onClick={(e) => { e.stopPropagation(); handleStopAgent(agent.name); }}
              >
                <FiPause />
              </button>
            ) : (
              <button 
                className="agent-button start" 
                onClick={(e) => { e.stopPropagation(); handleStartAgent(agent.name); }}
              >
                <FiPlay />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStatusTab = () => (
    <div className="status-tab">
      <h3>סטטוס סוכנים</h3>
      {currentActivity && (
        <div className="current-activity">
          <h4>פעילות נוכחית</h4>
          {currentActivity.currentHeavyAgent ? (
            <div>
              <p><strong>סוכן פעיל:</strong> {currentActivity.currentHeavyAgent}</p>
              <p><strong>פעולה:</strong> {currentActivity.currentActivity?.action || 'לא ידוע'}</p>
              <p><strong>התחלה:</strong> {new Date(currentActivity.currentActivity?.startTime).toLocaleString()}</p>
              <div className="progress-bar">
                <div className="progress" style={{ width: '50%' }}></div>
              </div>
            </div>
          ) : (
            <p>אין סוכנים פעילים כרגע</p>
          )}
        </div>
      )}
      
      <div className="agent-stats">
        <h4>סטטיסטיקות</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{agents.length}</div>
            <div className="stat-label">סוכנים</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{agents.filter(a => a.active).length}</div>
            <div className="stat-label">פעילים</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {currentActivity && currentActivity.currentHeavyAgent ? '1' : '0'}
            </div>
            <div className="stat-label">רצים כעת</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMemoryTab = () => (
    <div className="memory-tab">
      <h3>זיכרון סוכנים</h3>
      
      {selectedAgent ? (
        <div className="memory-view">
          <div className="memory-header">
            <h4>{selectedAgent}</h4>
            <div className="memory-actions">
              <button className="btn btn-danger" onClick={() => clearMemory(selectedAgent)}>
                <FiTrash2 /> נקה זיכרון
              </button>
            </div>
          </div>
          
          <div className="memory-search">
            <input 
              type="text" 
              placeholder="חפש בזיכרון..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              className="btn btn-primary" 
              onClick={() => searchMemory(selectedAgent, searchQuery)}
            >
              <FiSearch /> חפש
            </button>
          </div>
          
          {memory ? (
            <div className="memory-content">
              <div className="memory-stats">
                <div className="stat-grid">
                  <div className="stat-item">
                    <div className="stat-value">{memory.stats.totalSessions || 0}</div>
                    <div className="stat-label">מפגשים</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{memory.stats.totalActions || 0}</div>
                    <div className="stat-label">פעולות</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{memory.stats.successRate || 0}%</div>
                    <div className="stat-label">הצלחה</div>
                  </div>
                </div>
                <div className="memory-dates">
                  <p><strong>נוצר:</strong> {new Date(memory.createdAt).toLocaleString()}</p>
                  <p><strong>עודכן:</strong> {new Date(memory.lastUpdated).toLocaleString()}</p>
                </div>
              </div>
              
              {searchResults ? (
                <div className="search-results">
                  <h4>תוצאות חיפוש</h4>
                  <p>נמצאו {searchResults.matched_sessions.length} מפגשים ו-{searchResults.matched_actions.length} פעולות</p>
                  
                  {searchResults.matched_actions.length > 0 && (
                    <>
                      <h5>פעולות</h5>
                      <div className="actions-list">
                        {searchResults.matched_actions.map(action => (
                          <div 
                            key={action.actionId} 
                            className={`action-item ${action.success ? 'success' : 'failure'}`}
                          >
                            <div className="action-header">
                              <div className="action-type">{action.type}</div>
                              <div className="action-time">{new Date(action.timestamp).toLocaleString()}</div>
                            </div>
                            <div className="action-details">
                              <pre>{JSON.stringify(action.details, null, 2)}</pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="recent-sessions">
                  <h4>מפגשים אחרונים</h4>
                  {memory.recentSessions.length > 0 ? (
                    <div className="sessions-list">
                      {memory.recentSessions.map(session => (
                        <div key={session.id} className={`session-item status-${session.status}`}>
                          <div className="session-header">
                            <div className="session-id">{session.id}</div>
                            <div className="session-status">{session.status}</div>
                          </div>
                          <div className="session-dates">
                            <div>התחלה: {new Date(session.startTime).toLocaleString()}</div>
                            {session.endTime && (
                              <div>סיום: {new Date(session.endTime).toLocaleString()}</div>
                            )}
                          </div>
                          <div className="session-actions">
                            פעולות: {session.actionsCount}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>אין מפגשים לתצוגה</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="memory-loading">
              {loading ? 'טוען זיכרון...' : 'בחר סוכן כדי לצפות בזיכרון שלו'}
            </div>
          )}
        </div>
      ) : (
        <div className="select-agent-prompt">
          בחר סוכן מהרשימה כדי לצפות בזיכרון שלו
        </div>
      )}
    </div>
  );

  const renderSchedulerTab = () => (
    <div className="scheduler-tab">
      <h3>תזמון משימות</h3>
      
      <div className="scheduler-actions">
        <button 
          className="btn btn-primary" 
          onClick={() => fetchScheduledTasks()}
        >
          רענן משימות
        </button>
      </div>
      
      {scheduledTasks.length > 0 ? (
        <div className="tasks-list">
          {scheduledTasks.map(task => (
            <div key={task.id} className={`task-item ${task.active ? 'active' : 'inactive'}`}>
              <div className="task-header">
                <div className="task-agent">{task.agentName}</div>
                <div className="task-action">{task.actionName}</div>
              </div>
              <div className="task-schedule">
                {task.cronExpression}
                {task.interval && <span> (כל {task.interval} דקות)</span>}
              </div>
              <div className="task-times">
                {task.lastRun && (
                  <div className="last-run">
                    <strong>ריצה אחרונה:</strong> {new Date(task.lastRun).toLocaleString()}
                  </div>
                )}
                {task.nextRun && (
                  <div className="next-run">
                    <strong>ריצה הבאה:</strong> {new Date(task.nextRun).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-tasks">
          {loading ? 'טוען משימות...' : 'אין משימות מתוזמנות'}
        </div>
      )}
    </div>
  );

  const handleCreateSchedule = async () => {
    if (!newSchedule.name || !newSchedule.cronExpression) return;
    
    try {
      await axios.post(`${API_URL}/scheduler/create`, {
        agentId: selectedAgent,
        name: newSchedule.name,
        cronExpression: newSchedule.cronExpression,
        action: newSchedule.action,
        params: newSchedule.params ? JSON.parse(newSchedule.params) : {}
      });
      
      // Reset form and refresh schedules
      setNewSchedule({
        name: '',
        cronExpression: '',
        action: 'run',
        params: ''
      });
      
      fetchAgentData();
    } catch (err) {
      setError('שגיאה ביצירת תזמון: ' + err.message);
      console.error('Error creating schedule:', err);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await axios.delete(`${API_URL}/scheduler/delete/${scheduleId}`);
      
      // Refresh schedules
      fetchAgentData();
    } catch (err) {
      setError('שגיאה במחיקת תזמון: ' + err.message);
      console.error('Error deleting schedule:', err);
    }
  };

  return (
    <div className="agent-component">
      <h2>ניהול סוכנים</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="agent-container">
        <div className="agent-sidebar">
          <h3>סוכנים במערכת</h3>
          <ul className="agent-list">
            {agents.map(agent => (
              <li 
                key={agent.id}
                className={`agent-item ${selectedAgent === agent.id ? 'selected' : ''}`}
                onClick={() => setSelectedAgent(agent.id)}
              >
                <span className={`status-indicator ${agent.active ? 'active' : 'inactive'}`}></span>
                <span>{agent.name}</span>
                <div className="agent-actions">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleStartAgent(agent.name); 
                    }}
                    disabled={agent.active}
                    title="הפעל סוכן"
                  >
                    <FaPlay />
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleStopAgent(agent.name); 
                    }}
                    disabled={!agent.active}
                    title="עצור סוכן"
                  >
                    <FaStop />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="agent-content">
          {selectedAgent ? (
            <>
              <div className="agent-tabs">
                <button 
                  className={activeTab === 'status' ? 'active' : ''}
                  onClick={() => setActiveTab('status')}
                >
                  <FaListIcon /> סטטוס
                </button>
                <button 
                  className={activeTab === 'memory' ? 'active' : ''}
                  onClick={() => setActiveTab('memory')}
                >
                  <FaMemory /> זיכרון
                </button>
                <button 
                  className={activeTab === 'schedule' ? 'active' : ''}
                  onClick={() => setActiveTab('schedule')}
                >
                  <FaClockIcon /> תזמון
                </button>
              </div>
              
              <div className="tab-content">
                {loading ? (
                  <div className="loading">טוען נתונים...</div>
                ) : (
                  <>
                    {activeTab === 'status' && (
                      <div className="status-content">
                        <h3>סטטוס סוכן</h3>
                        {agents.find(a => a.id === selectedAgent) && (
                          <div className="agent-status-details">
                            <p>
                              <strong>שם:</strong> {agents.find(a => a.id === selectedAgent).name}
                            </p>
                            <p>
                              <strong>סטטוס:</strong> {
                                agents.find(a => a.id === selectedAgent).active 
                                  ? 'פעיל' 
                                  : 'לא פעיל'
                              }
                            </p>
                            <p>
                              <strong>סוג:</strong> {agents.find(a => a.id === selectedAgent).type}
                            </p>
                            <p>
                              <strong>תיאור:</strong> {agents.find(a => a.id === selectedAgent).description}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {activeTab === 'memory' && (
                      <div className="memory-content">
                        <div className="memory-search">
                          <input 
                            type="text" 
                            placeholder="חפש בזיכרון..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                          <button onClick={() => searchMemory(selectedAgent, searchQuery)}>
                            <FaSearchIcon /> חפש
                          </button>
                        </div>
                        
                        <h3>זיכרון הסוכן</h3>
                        <div className="memory-list">
                          {agentMemory.length > 0 ? (
                            agentMemory.map((item, index) => (
                              <div key={index} className="memory-item">
                                <div className="memory-timestamp">
                                  {new Date(item.timestamp).toLocaleString()}
                                </div>
                                <div className={`memory-status ${item.success ? 'success' : 'failure'}`}>
                                  {item.success ? 'הצלחה' : 'כישלון'}
                                </div>
                                <div className="memory-content">
                                  <strong>{item.type}:</strong> {item.content}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p>אין נתוני זיכרון זמינים.</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {activeTab === 'schedule' && (
                      <div className="schedule-content">
                        <h3>משימות מתוזמנות</h3>
                        <div className="new-schedule-form">
                          <h4>צור משימה חדשה</h4>
                          <div className="form-row">
                            <label>שם:</label>
                            <input 
                              type="text" 
                              value={newSchedule.name}
                              onChange={(e) => setNewSchedule({...newSchedule, name: e.target.value})}
                              placeholder="שם המשימה"
                            />
                          </div>
                          <div className="form-row">
                            <label>ביטוי Cron:</label>
                            <input 
                              type="text" 
                              value={newSchedule.cronExpression}
                              onChange={(e) => setNewSchedule({...newSchedule, cronExpression: e.target.value})}
                              placeholder="*/5 * * * *"
                            />
                          </div>
                          <div className="form-row">
                            <label>פעולה:</label>
                            <select 
                              value={newSchedule.action}
                              onChange={(e) => setNewSchedule({...newSchedule, action: e.target.value})}
                            >
                              <option value="run">הפעל</option>
                              <option value="stop">עצור</option>
                              <option value="custom">מותאם אישית</option>
                            </select>
                          </div>
                          <div className="form-row">
                            <label>פרמטרים (JSON):</label>
                            <textarea 
                              value={newSchedule.params}
                              onChange={(e) => setNewSchedule({...newSchedule, params: e.target.value})}
                              placeholder='{"key": "value"}'
                            />
                          </div>
                          <button onClick={handleCreateSchedule}>צור משימה</button>
                        </div>
                        
                        <div className="schedule-list">
                          {schedules.length > 0 ? (
                            <table>
                              <thead>
                                <tr>
                                  <th>שם</th>
                                  <th>ביטוי Cron</th>
                                  <th>פעולה</th>
                                  <th>אפשרויות</th>
                                </tr>
                              </thead>
                              <tbody>
                                {schedules.map(schedule => (
                                  <tr key={schedule.id}>
                                    <td>{schedule.name}</td>
                                    <td>{schedule.cronExpression}</td>
                                    <td>{schedule.action}</td>
                                    <td>
                                      <button 
                                        onClick={() => handleDeleteSchedule(schedule.id)}
                                        title="מחק משימה"
                                      >
                                        <FaTrash />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p>אין משימות מתוזמנות לסוכן זה.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p>בחר סוכן מהרשימה כדי לצפות בפרטים.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentComponent; 