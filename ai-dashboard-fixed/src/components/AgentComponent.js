import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './AgentComponent.css';

const API_URL = 'http://localhost:3001';

/**
 * Agent Component - Manages and displays the status of a single agent
 */
const AgentComponent = ({
  agent,
  name,
  description,
  agentStatus,
  setAgentStatus
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastActionTime, setLastActionTime] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Periodic status check
  const checkAgentStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/agent-status`);
      console.log("Agent status check response:", response.data);

      if (setAgentStatus) {
        setAgentStatus(response.data);
      }
    } catch (err) {
      console.error("Error checking agent status:", err);
    }
  }, [setAgentStatus]);

  // Start the agent
  const handleStartAgent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsAnimating(true);

      // Request to start the agent
      const response = await axios.post(`${API_URL}/run-agent`, { agent });
      console.log("Agent start response:", response.data);

      // Update status locally
      if (setAgentStatus) {
        setAgentStatus(prev => ({ ...prev, [agent]: true }));
      }

      setLastActionTime(new Date());

      // Animation will disappear after 2 seconds
      setTimeout(() => {
        setIsAnimating(false);
      }, 2000);

    } catch (err) {
      console.error("Error starting agent:", err);
      setError(`Error starting agent: ${err.response?.data?.error || err.message}`);
      setIsAnimating(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop the agent
  const handleStopAgent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsAnimating(true);

      // Request to stop the agent
      const response = await axios.post(`${API_URL}/stop-agent`, { agent });
      console.log("Agent stop response:", response.data);

      // Update status locally
      if (setAgentStatus) {
        setAgentStatus(prev => ({ ...prev, [agent]: false }));
      }

      setLastActionTime(new Date());

      // Animation will disappear after 2 seconds
      setTimeout(() => {
        setIsAnimating(false);
      }, 2000);

    } catch (err) {
      console.error("Error stopping agent:", err);
      setError(`Error stopping agent: ${err.response?.data?.error || err.message}`);
      setIsAnimating(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Is the agent active?
  const isActive = agentStatus[agent] || false;

  const handleStartStop = async () => {
    setIsLoading(true);
    
    try {
      const endpoint = isActive ? '/stop-agent' : '/run-agent';
      const response = await axios.post(`${API_URL}${endpoint}`, { agent });
      
      if (response.data && response.data.success !== false) {
        // Local status update until next refresh
        setAgentStatus(prev => ({
          ...prev,
          [agent]: !isActive
        }));
      }
    } catch (err) {
      console.error('Error toggling agent:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-black border border-gray-800 rounded-lg p-3 mb-2 transition-all duration-200 hover:bg-gray-900">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold">{name}</h3>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
        <div className="flex items-center">
          <span 
            className={`inline-block w-3 h-3 rounded-full mr-2 ${isActive ? 'bg-gray-300' : 'bg-gray-600'}`}
          ></span>
          <button
            onClick={handleStartStop}
            disabled={isLoading}
            className={`px-2 py-1 rounded text-xs font-medium ${
              isActive 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            } transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? '...' : isActive ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentComponent; 