import React, { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import './AnalyticsComponent.css';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Analytics Component - Displays charts and metrics about agent activity
 * @returns {JSX.Element} React component
 */
function AnalyticsComponent() {
  const [agentData, setAgentData] = useState([]);
  const [timeRange, setTimeRange] = useState('day');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds
  const [lastUpdated, setLastUpdated] = useState(null);

  // Function to load agent data
  const loadAgentData = async () => {
    try {
      setIsLoading(true);
      
      const response = await axios.get('http://localhost:3001/analytics/agents');
      setAgentData(response.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error loading agent data:', err);
      setError('Could not load agent data. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when component mounts and at regular intervals
  useEffect(() => {
    loadAgentData();
    
    const intervalId = setInterval(() => {
      loadAgentData();
    }, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  // Handle time range change
  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value);
  };

  // Handle refresh interval change
  const handleRefreshIntervalChange = (e) => {
    setRefreshInterval(parseInt(e.target.value));
  };

  // Prepare data for the agent activity chart
  const activityData = {
    labels: agentData.map(agent => agent.name),
    datasets: [
      {
        label: 'Active Time (hours)',
        data: agentData.map(agent => agent.activeTime / 3600), // Convert seconds to hours
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Prepare data for the task completion chart
  const taskCompletionData = {
    labels: agentData.map(agent => agent.name),
    datasets: [
      {
        label: 'Completed Tasks',
        data: agentData.map(agent => agent.tasksCompleted),
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Prepare data for the resource usage chart
  const resourceUsageData = {
    labels: ['CPU', 'Memory', 'Network', 'Disk I/O'],
    datasets: [
      {
        label: 'Resource Usage (%)',
        data: [
          Math.round(agentData.reduce((sum, agent) => sum + agent.cpuUsage, 0) / agentData.length || 0),
          Math.round(agentData.reduce((sum, agent) => sum + agent.memoryUsage, 0) / agentData.length || 0),
          Math.round(agentData.reduce((sum, agent) => sum + agent.networkUsage, 0) / agentData.length || 0),
          Math.round(agentData.reduce((sum, agent) => sum + agent.diskUsage, 0) / agentData.length || 0)
        ],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#e0e0e0'
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#e0e0e0'
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: '#e0e0e0'
        }
      }
    }
  };

  // Pie chart options
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e0e0e0'
        }
      }
    }
  };

  // Return loading state if data is loading
  if (isLoading && agentData.length === 0) {
    return (
      <div className="analytics-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  // Return error state if there's an error
  if (error && agentData.length === 0) {
    return (
      <div className="analytics-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={loadAgentData}>Try Again</button>
        </div>
      </div>
    );
  }

  // Format the last updated time
  const formattedLastUpdated = lastUpdated 
    ? `${lastUpdated.toLocaleDateString()} ${lastUpdated.toLocaleTimeString()}`
    : 'Not yet updated';

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>System Analytics</h2>
        <div className="analytics-controls">
          <div className="control-group">
            <label htmlFor="timeRange">Time Range:</label>
            <select 
              id="timeRange" 
              value={timeRange} 
              onChange={handleTimeRangeChange}
              className="analytics-select"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="refreshInterval">Refresh Every:</label>
            <select 
              id="refreshInterval" 
              value={refreshInterval} 
              onChange={handleRefreshIntervalChange}
              className="analytics-select"
            >
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
              <option value={60000}>1 minute</option>
              <option value={300000}>5 minutes</option>
            </select>
          </div>
          <button 
            onClick={loadAgentData} 
            className="refresh-button"
          >
            Refresh Now
          </button>
        </div>
      </div>
      
      <div className="last-updated">
        Last updated: {formattedLastUpdated}
      </div>
      
      <div className="analytics-grid">
        <div className="chart-card">
          <h3>Agent Activity</h3>
          <div className="chart-container">
            <Bar data={activityData} options={chartOptions} />
          </div>
        </div>
        
        <div className="chart-card">
          <h3>Task Completion</h3>
          <div className="chart-container">
            <Bar data={taskCompletionData} options={chartOptions} />
          </div>
        </div>
        
        <div className="chart-card">
          <h3>Resource Usage</h3>
          <div className="chart-container pie-container">
            <Pie data={resourceUsageData} options={pieChartOptions} />
          </div>
        </div>
        
        <div className="chart-card analytics-summary">
          <h3>System Summary</h3>
          <div className="summary-content">
            <div className="summary-item">
              <span className="summary-label">Total Agents:</span>
              <span className="summary-value">{agentData.length}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Active Agents:</span>
              <span className="summary-value">
                {agentData.filter(agent => agent.status === 'active').length}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Tasks Completed:</span>
              <span className="summary-value">
                {agentData.reduce((sum, agent) => sum + agent.tasksCompleted, 0)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Average CPU Usage:</span>
              <span className="summary-value">
                {Math.round(agentData.reduce((sum, agent) => sum + agent.cpuUsage, 0) / agentData.length || 0)}%
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Average Memory Usage:</span>
              <span className="summary-value">
                {Math.round(agentData.reduce((sum, agent) => sum + agent.memoryUsage, 0) / agentData.length || 0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsComponent; 