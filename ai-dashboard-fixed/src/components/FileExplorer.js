import React, { useEffect, useState } from "react";

/**
 * File tree component that displays all files in a project and allows opening in external editor
 */
const FileExplorer = ({ activeProject }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});

  // Load the file structure when the active project changes
  useEffect(() => {
    if (activeProject) {
      fetchFiles();
    } else {
      setFiles([]);
    }
  }, [activeProject]);

  // Get the file structure from the server
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:3001/active-project/files");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error loading files");
      }

      setFiles(data.files || []);
      setError(null);
    } catch (err) {
      console.error("Error loading file structure:", err);
      setError("Could not load the file structure. Please try again.");
      
      // When there's an error, try an alternative method to get the file structure
      try {
        if (activeProject && activeProject.path) {
          const fallbackResponse = await fetch("http://localhost:3001/dir-structure", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              path: activeProject.path 
            }),
          });
          
          const fallbackData = await fallbackResponse.json();
          
          if (fallbackData.success && fallbackData.files) {
            console.log("Retrieved alternative file structure");
            setFiles(fallbackData.files);
            setError(null);
          }
        }
      } catch (fallbackErr) {
        console.error("Error in fallback attempt:", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Open file in default editor
  const handleOpenFile = async (filePath) => {
    try {
      console.log("Opening file:", filePath);
      const response = await fetch("http://localhost:3001/open-file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error opening file");
      }
    } catch (err) {
      console.error("Error opening file:", err);
      alert(`Error opening file: ${err.message}`);
    }
  };

  // Function to get icon for file type
  const getFileType = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    return extension || 'unknown';
  };

  // Toggle folder expansion
  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Recursive rendering of file tree
  const renderFileTree = (items, level = 0) => {
    return items
      .sort((a, b) => {
        // Folders first, then files (alphabetically)
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      })
      .map((item) => {
        const paddingLeft = `${level * 1.2 + 0.5}rem`;
        // Use relativePath for display and full path for actions
        const displayPath = item.relativePath || item.name;

        if (item.type === 'directory') {
          const isExpanded = expandedFolders[item.path] || false;
          
          return (
            <React.Fragment key={item.path}>
              <div
                className="flex items-center py-1 hover:bg-gray-900 cursor-pointer border-b border-gray-900"
                style={{ paddingLeft }}
                onClick={() => toggleFolder(item.path)}
              >
                <span className="w-4 h-4 mr-2 inline-block border-r border-b border-gray-600" style={{ transform: isExpanded ? 'rotate(45deg)' : 'rotate(-45deg)' }}></span>
                <span className="truncate" title={displayPath}>{item.name}</span>
              </div>
              
              {isExpanded && item.children && (
                <div className="directory-children">
                  {renderFileTree(item.children, level + 1)}
                </div>
              )}
            </React.Fragment>
          );
        } else {
          const fileType = getFileType(item.name);
          return (
            <div
              key={item.path}
              className="flex items-center py-1 hover:bg-gray-900 cursor-pointer border-b border-gray-900"
              style={{ paddingLeft }}
              onDoubleClick={() => handleOpenFile(item.path)}
              onClick={() => console.log(`Selected file: ${item.path}`)}
            >
              <span className="w-2 h-2 mr-2 inline-block bg-gray-600 rounded-full"></span>
              <span className="truncate" title={displayPath}>{item.name}</span>
              <span className="ml-auto text-xs text-gray-500">{fileType}</span>
            </div>
          );
        }
      });
  };

  // When there's no active project
  if (!activeProject) {
    return (
      <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-xl relative">
        <h2 className="text-2xl font-bold text-gray-400 mb-3">File Explorer</h2>
        <p className="text-gray-400">Please select a project to view files.</p>
      </div>
    );
  }

  return (
    <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-xl relative">
      <h2 className="text-2xl font-bold text-gray-400 mb-3">File Explorer</h2>
      
      <p className="text-gray-400 text-sm mb-3">
        <small>Double-click a file to open it in your code editor</small>
      </p>

      {loading && <p className="text-gray-400">Loading file structure...</p>}
      
      {error && <p className="text-gray-500">{error}</p>}

      {!loading && !error && files.length === 0 && (
        <p className="text-gray-400">
          Project is empty or files are not accessible.
        </p>
      )}

      {!loading && !error && files.length > 0 && (
        <div className="file-tree text-gray-300 overflow-auto max-h-96 rounded-md bg-black border border-gray-800 p-2">
          {renderFileTree(files)}
        </div>
      )}
      
      <div className="mt-4 bg-black border border-gray-800 p-2 rounded-md text-sm">
        <p className="text-gray-400">
          Active Project: <span className="text-white">{activeProject.name}</span>
        </p>
        <p className="text-gray-400 text-xs truncate">
          Working Directory: <span className="text-gray-300">WORKSPACE</span>
        </p>
      </div>
    </div>
  );
};

export default FileExplorer; 