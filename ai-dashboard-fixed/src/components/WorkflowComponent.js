import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WorkflowComponent.css';

/**
 * Component for workflow management
 * @returns {JSX.Element} - React component
 */
function WorkflowComponent() {
  const [workflows, setWorkflows] = useState([]);
  const [activeWorkflows, setActiveWorkflows] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    steps: [
      { agentId: '', action: '', params: '', description: '' }
    ]
  });

  // Load workflows and active workflows when component loads
  useEffect(() => {
    loadWorkflows();
    loadActiveWorkflows();
    loadAgents();
    
    // Refresh data every 5 seconds
    const intervalId = setInterval(() => {
      loadWorkflows();
      loadActiveWorkflows();
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Function to load workflows
  const loadWorkflows = async () => {
    try {
      const response = await axios.get('http://localhost:3001/workflows');
      if (response.status !== 200) {
        throw new Error(`Server error: ${response.status}`);
      }
      setWorkflows(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading workflows:', err);
      setError('Could not load workflows. Please try again later.');
      setLoading(false);
    }
  };

  // Function to load active workflows
  const loadActiveWorkflows = async () => {
    try {
      const response = await axios.get('http://localhost:3001/workflow-runs');
      if (response.status !== 200) {
        throw new Error(`Server error: ${response.status}`);
      }
      setActiveWorkflows(response.data);
    } catch (err) {
      console.error('Error loading active workflows:', err);
    }
  };

  // Function to load available agents
  const loadAgents = async () => {
    try {
      const response = await axios.get('http://localhost:3001/agents');
      if (response.status !== 200) {
        throw new Error(`Server error: ${response.status}`);
      }
      setAvailableAgents(response.data.agents || []);
    } catch (err) {
      console.error('Error loading agents:', err);
    }
  };

  // Handle workflow selection
  const handleSelectWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
  };

  // Handle run workflow
  const handleRunWorkflow = async (workflowId) => {
    try {
      setLoading(true);
      const response = await axios.post(`http://localhost:3001/workflows/${workflowId}/run`);
      if (response.status !== 201) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Reload active workflows to show the new one
      await loadActiveWorkflows();
      setLoading(false);
    } catch (err) {
      console.error('Error running workflow:', err);
      setLoading(false);
    }
  };

  // Stop a running workflow
  const handleStopWorkflow = async (runId) => {
    try {
      setLoading(true);
      const response = await axios.delete(`http://localhost:3001/workflow-runs/${runId}`);
      if (response.status !== 200) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Reload active workflows to reflect changes
      await loadActiveWorkflows();
      setLoading(false);
    } catch (err) {
      console.error('Error stopping workflow:', err);
      setLoading(false);
    }
  };

  // Handle changes to new workflow form
  const handleNewWorkflowChange = (e) => {
    const { name, value } = e.target;
    setNewWorkflow({
      ...newWorkflow,
      [name]: value
    });
  };

  // Handle changes to a workflow step
  const handleStepChange = (index, field, value) => {
    const updatedSteps = [...newWorkflow.steps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      [field]: value
    };
    
    setNewWorkflow({
      ...newWorkflow,
      steps: updatedSteps
    });
  };

  // Add a new step to the workflow being created
  const handleAddStep = () => {
    setNewWorkflow({
      ...newWorkflow,
      steps: [
        ...newWorkflow.steps,
        { agentId: '', action: '', params: '', description: '' }
      ]
    });
  };

  // Remove a step from the workflow being created
  const handleRemoveStep = (index) => {
    if (newWorkflow.steps.length > 1) {
      const updatedSteps = newWorkflow.steps.filter((_, i) => i !== index);
      setNewWorkflow({
        ...newWorkflow,
        steps: updatedSteps
      });
    }
  };

  // Create a new workflow
  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Process steps to ensure params is an object
      const processedSteps = newWorkflow.steps.map(step => ({
        ...step,
        params: step.params 
          ? (typeof step.params === 'string' ? JSON.parse(step.params) : step.params)
          : {}
      }));
      
      const workflowConfig = {
        name: newWorkflow.name,
        description: newWorkflow.description,
        steps: processedSteps
      };
      
      const response = await axios.post('http://localhost:3001/workflows', {
        id: `workflow_${Date.now()}`,
        config: workflowConfig
      });
      
      if (response.status !== 201) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Reset form and reload workflows
      setNewWorkflow({
        name: '',
        description: '',
        steps: [
          { agentId: '', action: '', params: '', description: '' }
        ]
      });
      setShowCreateForm(false);
      
      // Refresh the workflow list
      await loadWorkflows();
      setLoading(false);
    } catch (err) {
      console.error('Error creating workflow:', err);
      setLoading(false);
    }
  };

  if (loading && workflows.length === 0) {
    return <div className="loading">Loading workflows...</div>;
  }

  return (
    <div className="workflow-component">
      <div className="main-header">
        <h2>Workflow Management</h2>
        {!showCreateForm && (
          <button 
            className="create-button"
            onClick={() => setShowCreateForm(true)}
          >
            Create New Workflow
          </button>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {showCreateForm && (
        <div className="create-workflow-form">
          <h3>Create New Workflow</h3>
          <form onSubmit={handleCreateWorkflow}>
            <div className="form-group">
              <label htmlFor="name">Workflow Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={newWorkflow.name}
                onChange={handleNewWorkflowChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description:</label>
              <textarea
                id="description"
                name="description"
                value={newWorkflow.description}
                onChange={handleNewWorkflowChange}
              ></textarea>
            </div>
            
            <div className="steps-container">
              <h4>Workflow Steps</h4>
              {newWorkflow.steps.map((step, index) => (
                <div key={index} className="step-item">
                  <div className="step-header">
                    <span>Step {index + 1}</span>
                    <button 
                      type="button" 
                      className="remove-step-button"
                      onClick={() => handleRemoveStep(index)}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="step-body">
                    <div className="form-group">
                      <label htmlFor={`agentId-${index}`}>Agent:</label>
                      <select
                        id={`agentId-${index}`}
                        value={step.agentId}
                        onChange={(e) => handleStepChange(index, 'agentId', e.target.value)}
                        required
                      >
                        <option value="">Select agent...</option>
                        {availableAgents.map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor={`action-${index}`}>Action:</label>
                      <input
                        type="text"
                        id={`action-${index}`}
                        value={step.action}
                        onChange={(e) => handleStepChange(index, 'action', e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor={`params-${index}`}>Parameters (JSON):</label>
                      <textarea
                        id={`params-${index}`}
                        value={step.params}
                        onChange={(e) => handleStepChange(index, 'params', e.target.value)}
                        placeholder="{}"
                      ></textarea>
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor={`description-${index}`}>Step Description:</label>
                      <input
                        type="text"
                        id={`description-${index}`}
                        value={step.description}
                        onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              <button 
                type="button" 
                className="add-step-button"
                onClick={handleAddStep}
              >
                + Add Step
              </button>
            </div>
            
            <div className="form-actions">
              <button type="submit" className="create-workflow-button">
                Create Workflow
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="workflows-panel">
        <h3>Existing Workflows</h3>
        
        {workflows.length === 0 ? (
          <p>No workflows available</p>
        ) : (
          <div className="workflows-list">
            {workflows.map(workflow => (
              <div 
                key={workflow.id} 
                className={`workflow-item ${selectedWorkflow?.id === workflow.id ? 'selected' : ''}`}
                onClick={() => handleSelectWorkflow(workflow)}
              >
                <div className="workflow-header">
                  <h4>{workflow.name}</h4>
                  <button 
                    className="run-workflow-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunWorkflow(workflow.id);
                    }}
                  >
                    Run
                  </button>
                </div>
                <p className="workflow-description">{workflow.description}</p>
                <div className="workflow-meta">
                  <span className="step-count">{workflow.steps && Array.isArray(workflow.steps) ? workflow.steps.length : 0} steps</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="active-workflows-panel">
        <h3>Active Workflows</h3>
        
        {activeWorkflows.length === 0 ? (
          <p>No active workflows</p>
        ) : (
          <div className="active-workflows-list">
            {activeWorkflows.map(workflow => (
              <div key={workflow.runId} className="active-workflow-item">
                <div className="active-workflow-header">
                  <h4>{workflow.workflowName || workflow.workflowId}</h4>
                  <button 
                    className="stop-workflow-button"
                    onClick={() => handleStopWorkflow(workflow.runId)}
                  >
                    Stop
                  </button>
                </div>
                <div className="workflow-status">
                  <span className="status-label">Status:</span>
                  <span className={`status-value status-${workflow.status.toLowerCase()}`}>
                    {workflow.status}
                  </span>
                </div>
                <div className="workflow-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${workflow.progress || 0}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{workflow.progress || 0}%</span>
                </div>
                <div className="current-step">
                  <span>Current step: {workflow.currentStep?.description || 'Initializing...'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {selectedWorkflow && (
        <div className="workflow-details">
          <h3>Workflow Details: {selectedWorkflow.name}</h3>
          <p className="workflow-details-description">{selectedWorkflow.description}</p>
          
          <div className="workflow-steps">
            <h4>Steps</h4>
            {selectedWorkflow.steps && Array.isArray(selectedWorkflow.steps) ? selectedWorkflow.steps.map((step, index) => (
              <div key={index} className="workflow-step">
                <div className="step-number">{index + 1}</div>
                <div className="step-details">
                  <span className="step-agent">Agent: {step.agentId}</span>
                  <span className="step-action">Action: {step.action}</span>
                  {step.description && (
                    <span className="step-description">{step.description}</span>
                  )}
                  {step.params && Object.keys(step.params).length > 0 && (
                    <div className="step-params">
                      <span>Parameters:</span>
                      <pre>{JSON.stringify(step.params, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <p>No steps available for this workflow</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowComponent; 