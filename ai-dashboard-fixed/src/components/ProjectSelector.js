import React, { useEffect, useState, useCallback } from "react";

/**
 * Component for selecting an active project from a list of projects
 */
const ProjectSelector = ({ projects, selectedProject, onSelectProject, onAddProject }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);

  // Select active project
  const handleSelectProject = async (project) => {
    try {
      if (!project || !project.id) {
        console.error("Error: Project missing or missing project ID", project);
        return;
      }

      setLoading(true);
      
      // Call the parent's callback
      if (typeof onSelectProject === 'function') {
        onSelectProject(project);
      } else {
        console.error("Error selecting project: onSelectProject is not a function");
      }
    } catch (err) {
      console.error("Error selecting project:", err);
      setError("Problem selecting project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Add new project
  const handleAddProject = async (e) => {
    e.preventDefault();
    
    if (!newProjectName.trim() || !newProjectPath.trim()) {
      alert("Please enter project name and path");
      return;
    }
    
    try {
      setLoading(true);
      
      // Call the parent's callback
      if (typeof onAddProject === 'function') {
        await onAddProject({
          name: newProjectName.trim(),
          path: newProjectPath.trim()
        });
        
        // Reset form
        setNewProjectName("");
        setNewProjectPath("");
        setShowAddForm(false);
      } else {
        console.error("Error adding project: onAddProject is not a function");
      }
    } catch (err) {
      console.error("Error adding project:", err);
      setError("Problem adding project. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Open folder browser dialog
  const handleBrowseFolder = async () => {
    try {
      setFolderBrowserOpen(true);
      setError(null);
      
      // Try to use system dialog interface if supported
      try {
        // Check if the new folder picker interface is supported
        if (window.showDirectoryPicker) {
          const directoryHandle = await window.showDirectoryPicker({
            mode: 'read',
            startIn: 'desktop'
          });
          const path = directoryHandle.name;
          setNewProjectPath(path);
          setFolderBrowserOpen(false);
          return;
        }
      } catch (browserError) {
        console.warn("Browser directory picker not supported or canceled:", browserError);
        // Continue to alternative method if failed
      }
      
      // Alternative method using server
      const response = await fetch("http://localhost:3001/browse-folder", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });
      
      // Check if response is valid and in JSON format
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server response is not in valid JSON format");
      }
      
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error opening folder browser. Please enter path manually.");
      }
      
      if (data.path) {
        setNewProjectPath(data.path);
      }
    } catch (err) {
      console.error("Error opening folder browser:", err);
      
      // Show manual input if failed
      const manualPath = window.prompt("Unable to open folder browser. Please enter the path manually:");
      if (manualPath) {
        setNewProjectPath(manualPath);
      } else {
        setError("Please enter folder path manually.");
      }
    } finally {
      setFolderBrowserOpen(false);
    }
  };

  if (loading && projects.length === 0) {
    return <div className="p-4 bg-gray-800 rounded">Loading projects...</div>;
  }

  return (
    <div className="project-selector">
      {error && <div className="bg-gray-900 bg-opacity-30 p-3 rounded-lg mb-3 text-sm">{error}</div>}
      
      <div className="flex justify-between items-center mb-3">
        <button 
          className="bg-gray-800 hover:bg-gray-700 text-white text-xs py-1 px-2 rounded"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "Add Project"}
        </button>
      </div>
      
      {showAddForm && (
        <div className="bg-black border border-gray-800 p-3 rounded-lg mb-3">
          <form onSubmit={handleAddProject}>
            <div className="mb-2">
              <label className="block text-sm mb-1">Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
                className="w-full bg-gray-900 text-white border border-gray-800 rounded p-1 text-sm"
                required
              />
            </div>
            
            <div className="mb-3">
              <div className="flex flex-row gap-2">
                <div className="flex-grow">
                  <label className="block text-sm mb-1">Project Path</label>
                  <input
                    type="text"
                    value={newProjectPath}
                    onChange={(e) => setNewProjectPath(e.target.value)}
                    placeholder="C:\path\to\project"
                    className="w-full bg-gray-900 text-white border border-gray-800 rounded p-1 text-sm"
                    required
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={folderBrowserOpen}
                    className="bg-gray-800 hover:bg-gray-700 text-white text-xs py-1 px-2 rounded"
                  >
                    {folderBrowserOpen ? "Browsing..." : "Browse..."}
                  </button>
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="bg-gray-800 hover:bg-gray-700 text-white text-xs py-1 px-3 rounded w-full"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Project"}
            </button>
          </form>
        </div>
      )}
      
      <div className="space-y-2 custom-scrollbar max-h-[300px] overflow-y-auto pr-1">
        {projects && projects.length > 0 ? (
          projects.map((project) => (
            <div
              key={project.id}
              className={`p-3 bg-black border border-gray-800 rounded cursor-pointer hover:bg-gray-900 transition-colors ${
                selectedProject && selectedProject.id === project.id ? "border-r-2 border-gray-400" : ""
              }`}
              onClick={() => handleSelectProject(project)}
            >
              <div className="text-sm font-medium">{project.name}</div>
              <div className="text-xs text-gray-400 mt-1 truncate">
                {project.path}
              </div>
              {selectedProject && selectedProject.id === project.id && (
                <div className="mt-1">
                  <span className="bg-gray-800 text-xs px-2 py-0.5 rounded-full">Active</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-black border border-gray-800 p-3 rounded text-sm text-gray-400">
            No projects found. Add a new project to get started.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSelector; 