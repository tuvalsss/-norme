const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const logger = require('./logger');

/**
 * File management system
 * Handles file operations, search, and workspace management
 */
class FileManager {
  constructor() {
    this.workspacePath = path.join(process.cwd(), 'workspace');
    fs.ensureDirSync(this.workspacePath);
    logger.info('File Manager initialized');
  }

  /**
   * Creates a file with content
   * @param {string} filePath - Path to the file, relative to workspace
   * @param {string} content - File content
   * @returns {Object} File information
   */
  async createFile(filePath, content) {
    try {
      const fullPath = path.join(this.workspacePath, filePath);
      const dirPath = path.dirname(fullPath);

      await fs.ensureDir(dirPath);
      await fs.writeFile(fullPath, content);

      logger.info(`Created file: ${filePath}`);

      return {
        path: filePath,
        fullPath,
        size: content.length
      };
    } catch (error) {
      logger.error(`Error creating file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reads a file's content
   * @param {string} filePath - Path to the file, relative to workspace
   * @returns {string} File content
   */
  async readFile(filePath) {
    try {
      const fullPath = path.join(this.workspacePath, filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = await fs.readFile(fullPath, 'utf8');
      return content;
    } catch (error) {
      logger.error(`Error reading file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates an existing file
   * @param {string} filePath - Path to the file, relative to workspace
   * @param {string} content - New file content
   * @returns {Object} File information
   */
  async updateFile(filePath, content) {
    try {
      const fullPath = path.join(this.workspacePath, filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      await fs.writeFile(fullPath, content);
      logger.info(`Updated file: ${filePath}`);

      return {
        path: filePath,
        fullPath,
        size: content.length
      };
    } catch (error) {
      logger.error(`Error updating file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes a file
   * @param {string} filePath - Path to the file, relative to workspace
   * @returns {boolean} Success status
   */
  async deleteFile(filePath) {
    try {
      const fullPath = path.join(this.workspacePath, filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      await fs.unlink(fullPath);
      logger.info(`Deleted file: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lists files in a directory
   * @param {string} dirPath - Directory path, relative to workspace
   * @returns {Array} List of files and directories
   */
  async listDirectory(dirPath = '') {
    try {
      const fullPath = path.join(this.workspacePath, dirPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      const items = await fs.readdir(fullPath);
      const result = [];

      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const stats = await fs.stat(itemPath);
        const relativePath = path.join(dirPath, item);

        result.push({
          name: item,
          path: relativePath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        });
      }

      return result;
    } catch (error) {
      logger.error(`Error listing directory ${dirPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Searches for files using patterns
   * @param {string} pattern - Glob pattern
   * @param {Object} options - Search options
   * @returns {Array} Matching files
   */
  async searchFiles(pattern, options = {}) {
    try {
      const fullPattern = path.join(this.workspacePath, pattern);
      const files = await new Promise((resolve, reject) => {
        glob(fullPattern, options, (err, matches) => {
          if (err) {
            reject(err);
          } else {
            resolve(matches);
          }
        });
      });

      return files.map(file => {
        const relativePath = path.relative(this.workspacePath, file);
        return {
          path: relativePath,
          fullPath: file
        };
      });
    } catch (error) {
      logger.error(`Error searching files with pattern ${pattern}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a directory
   * @param {string} dirPath - Directory path, relative to workspace
   * @returns {Object} Directory information
   */
  async createDirectory(dirPath) {
    try {
      const fullPath = path.join(this.workspacePath, dirPath);
      await fs.ensureDir(fullPath);
      logger.info(`Created directory: ${dirPath}`);

      return {
        path: dirPath,
        fullPath
      };
    } catch (error) {
      logger.error(`Error creating directory ${dirPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes a directory
   * @param {string} dirPath - Directory path, relative to workspace
   * @param {Object} options - Options like recursive
   * @returns {boolean} Success status
   */
  async deleteDirectory(dirPath, options = { recursive: false }) {
    try {
      const fullPath = path.join(this.workspacePath, dirPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      if (options.recursive) {
        await fs.remove(fullPath);
      } else {
        await fs.rmdir(fullPath);
      }

      logger.info(`Deleted directory: ${dirPath}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting directory ${dirPath}: ${error.message}`);
      throw error;
    }
  }
}

// Create and export singleton instance
const fileManager = new FileManager();
module.exports = fileManager; 