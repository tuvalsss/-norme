/**
 * Workspace management functionality
 * Handles setting up the workspace for projects
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get configuration
const workspacePath = (() => {
  try {
    const configFile = path.join(__dirname, '..', 'workspace.json');
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      return path.resolve(path.join(__dirname, '..', config.path || 'WORKSPACE'));
    }
  } catch (err) {
    console.error('Error reading workspace config:', err);
  }
  return path.resolve(path.join(__dirname, '..', 'WORKSPACE'));
})();

/**
 * Set up a project as the active workspace
 * @param {Object} req - Request object with project details
 * @param {Object} res - Response object
 */
const setWorkspace = (req, res) => {
  try {
    const { projectId, projectName, projectPath } = req.body;
    
    if (!projectId || !projectName || !projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Missing required project information'
      });
    }
    
    console.log(`Setting workspace for project: ${projectName} (${projectId}) from ${projectPath}`);
    
    // Create workspace directory if it doesn't exist
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
      console.log(`Created workspace directory: ${workspacePath}`);
    }
    
    // Clear existing workspace files
    try {
      const files = fs.readdirSync(workspacePath);
      for (const file of files) {
        const filePath = path.join(workspacePath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
      console.log('Cleared existing workspace files');
    } catch (err) {
      console.error('Error clearing workspace:', err);
    }
    
    // Copy project files to workspace
    const copyDirectory = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      const entries = fs.readdirSync(src, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        // Skip node_modules and hidden directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          copyDirectory(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    };
    
    // Perform the copy
    try {
      copyDirectory(projectPath, workspacePath);
      console.log(`Copied project files from ${projectPath} to workspace`);
      
      // Create a project info file in the workspace
      const projectInfo = {
        id: projectId,
        name: projectName,
        originalPath: projectPath,
        lastModified: new Date().toISOString()
      };
      
      fs.writeFileSync(
        path.join(workspacePath, '.project-info.json'),
        JSON.stringify(projectInfo, null, 2)
      );
      
      // Update active project in config
      const activeProjectPath = path.join(__dirname, '..', 'active-project.json');
      fs.writeFileSync(
        activeProjectPath,
        JSON.stringify({ id: projectId, name: projectName, path: projectPath }, null, 2)
      );
      
      return res.json({
        success: true,
        message: `Project ${projectName} set as active workspace`,
        workspace: {
          path: workspacePath,
          projectId,
          projectName
        }
      });
    } catch (copyErr) {
      console.error('Error copying project files:', copyErr);
      return res.status(500).json({
        success: false,
        error: 'Error copying project files',
        message: copyErr.message
      });
    }
  } catch (err) {
    console.error('Error setting workspace:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

// Create WORKSPACE directory if it doesn't exist
if (!fs.existsSync(workspacePath)) {
  try {
    fs.mkdirSync(workspacePath, { recursive: true });
    console.log(`Created workspace directory: ${workspacePath}`);
  } catch (err) {
    console.error(`Error creating workspace directory: ${err.message}`);
  }
}

module.exports = {
  setWorkspace,
  workspacePath
}; 