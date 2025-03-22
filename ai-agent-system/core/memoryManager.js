const fs = require('fs-extra');
const path = require('path');
const NodeCache = require('node-cache');
const logger = require('./logger');
const { getConfig } = require('../config/config');

/**
 * Memory management system for AI agents
 * Handles short-term and long-term memory storage and retrieval
 */
class MemoryManager {
  constructor() {
    this.logPrefix = '[memory_manager]';
    this.memoryDir = path.join(process.cwd(), 'memory');
    this.memoryMode = process.env.MEMORY_MODE || 'json';
    this.cache = new NodeCache({ 
      stdTTL: 3600, // Default TTL: 1 hour
      checkperiod: 600 // Check for expired items every 10 minutes
    });
    this.queryCache = {}; // מטמון לשאילתות נפוצות
    
    // פורמט חותמות זמן
    this.timeFormat = {
      timestamp: true, // האם להשתמש בחותמות זמן
      format: 'ISO' // 'ISO' או 'UNIX'
    };
    
    // וודא שהתיקייה קיימת
    fs.ensureDirSync(this.memoryDir);
    
    // Agent-specific memories
    this.agentMemories = {};
    
    logger.info(`${this.logPrefix} Memory Manager initialized`);
  }
  
  /**
   * Creates a new memory space for an agent
   * @param {string} agentId - Unique identifier for the agent
   * @returns {Object} Memory interface for the agent
   */
  createAgentMemory(agentId) {
    if (this.agentMemories[agentId]) {
      return this.agentMemories[agentId];
    }
    
    // Create agent's memory directory
    const agentMemoryPath = path.join(this.memoryDir, agentId);
    fs.ensureDirSync(agentMemoryPath);
    
    // Initialize agent's memory cache
    const agentCache = new NodeCache({ stdTTL: 7200 }); // 2 hours TTL for agent memory
    
    // Create memory interface
    const memory = {
      // Add a memory entry
      addEntry: (content, metadata = {}) => this._addMemoryEntry(agentId, content, metadata),
      
      // Search for memories
      search: (query, options = {}) => this._searchMemories(agentId, query, options),
      
      // Get a specific memory by ID
      get: (memoryId) => this._getMemory(agentId, memoryId),
      
      // Store temporary data
      store: (key, value, ttl = 3600) => {
        const fullKey = `${agentId}:${key}`;
        agentCache.set(fullKey, value, ttl);
        return true;
      },
      
      // Retrieve temporary data
      retrieve: (key) => {
        const fullKey = `${agentId}:${key}`;
        return agentCache.get(fullKey);
      },
      
      // Delete a memory entry
      delete: (memoryId) => this._deleteMemory(agentId, memoryId),
      
      // Clear all agent memories
      clear: () => this._clearAgentMemory(agentId)
    };
    
    this.agentMemories[agentId] = memory;
    logger.info(`${this.logPrefix} Created memory for agent: ${agentId}`);
    
    return memory;
  }
  
  /**
   * Adds a memory entry for an agent
   * @param {string} agentId - Agent identifier
   * @param {string} content - Memory content
   * @param {Object} metadata - Additional metadata
   * @returns {string} ID of the created memory
   * @private
   */
  _addMemoryEntry(agentId, content, metadata = {}) {
    try {
      const timestamp = new Date().toISOString();
      const memoryId = `mem_${timestamp}_${Math.random().toString(36).substring(2, 10)}`;
      
      const entry = {
        id: memoryId,
        agentId,
        content,
        metadata,
        created: timestamp,
        accessed: timestamp,
        accessCount: 0
      };
      
      // Store in both cache and file
      const cacheKey = `memory:${agentId}:${memoryId}`;
      this.cache.set(cacheKey, entry);
      
      // Write to disk
      const filePath = path.join(this.memoryDir, agentId, `${memoryId}.json`);
      fs.writeJsonSync(filePath, entry);
      
      // Update memory index
      this._updateMemoryIndex(agentId, entry);
      
      logger.info(`${this.logPrefix} Added memory for agent ${agentId}: ${memoryId}`);
      return memoryId;
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to add memory for agent ${agentId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Retrieves a specific memory
   * @param {string} agentId - Agent identifier
   * @param {string} memoryId - Memory identifier
   * @returns {Object} The memory object if found
   * @private
   */
  _getMemory(agentId, memoryId) {
    try {
      // Try to get from cache first
      const cacheKey = `memory:${agentId}:${memoryId}`;
      let memory = this.cache.get(cacheKey);
      
      // If not in cache, try to read from disk
      if (!memory) {
        const filePath = path.join(this.memoryDir, agentId, `${memoryId}.json`);
        if (fs.existsSync(filePath)) {
          memory = fs.readJsonSync(filePath);
          // Add to cache for future access
          this.cache.set(cacheKey, memory);
        } else {
          logger.warn(`${this.logPrefix} Memory ${memoryId} not found for agent ${agentId}`);
          return null;
        }
      }
      
      // Update access metadata
      memory.accessed = new Date().toISOString();
      memory.accessCount += 1;
      
      // Update file with new access data
      const filePath = path.join(this.memoryDir, agentId, `${memoryId}.json`);
      fs.writeJsonSync(filePath, memory);
      
      return memory;
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to get memory ${memoryId} for agent ${agentId}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Searches for memories matching a query
   * @param {string} agentId - Agent identifier
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching memories
   * @private
   */
  _searchMemories(agentId, query, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        sortBy = 'created',
        sortOrder = 'desc'
      } = options;
      
      // Simple search implementation
      // In a production system, this would use a vector DB or search index
      const memoryDir = path.join(this.memoryDir, agentId);
      const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.json'));
      
      const results = [];
      
      for (const file of files) {
        const filePath = path.join(memoryDir, file);
        const memory = fs.readJsonSync(filePath);
        
        // Check if the query matches content or metadata
        const contentMatch = memory.content.toLowerCase().includes(query.toLowerCase());
        
        // Check metadata match
        let metadataMatch = false;
        if (memory.metadata) {
          const metadataStr = JSON.stringify(memory.metadata).toLowerCase();
          metadataMatch = metadataStr.includes(query.toLowerCase());
        }
        
        if (contentMatch || metadataMatch) {
          results.push(memory);
        }
      }
      
      // Sort results
      results.sort((a, b) => {
        if (sortOrder.toLowerCase() === 'asc') {
          return a[sortBy] > b[sortBy] ? 1 : -1;
        } else {
          return a[sortBy] < b[sortBy] ? 1 : -1;
        }
      });
      
      // Apply pagination
      return results.slice(offset, offset + limit);
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to search memories for agent ${agentId}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Deletes a specific memory
   * @param {string} agentId - Agent identifier
   * @param {string} memoryId - Memory identifier
   * @returns {boolean} Whether the deletion was successful
   * @private
   */
  _deleteMemory(agentId, memoryId) {
    try {
      // Remove from cache
      const cacheKey = `memory:${agentId}:${memoryId}`;
      this.cache.del(cacheKey);
      
      // Remove from disk
      const filePath = path.join(this.memoryDir, agentId, `${memoryId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`${this.logPrefix} Deleted memory ${memoryId} for agent ${agentId}`);
        return true;
      } else {
        logger.warn(`${this.logPrefix} Memory ${memoryId} not found for agent ${agentId}`);
        return false;
      }
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to delete memory ${memoryId} for agent ${agentId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Clears all memories for an agent
   * @param {string} agentId - Agent identifier
   * @returns {boolean} Whether the operation was successful
   * @private
   */
  _clearAgentMemory(agentId) {
    try {
      const agentMemoryPath = path.join(this.memoryDir, agentId);
      
      // Clear cache keys for this agent
      const keys = this.cache.keys();
      const agentKeys = keys.filter(k => k.startsWith(`memory:${agentId}:`));
      agentKeys.forEach(k => this.cache.del(k));
      
      // Clear files
      if (fs.existsSync(agentMemoryPath)) {
        fs.emptyDirSync(agentMemoryPath);
      }
      
      logger.info(`${this.logPrefix} Cleared all memories for agent ${agentId}`);
      return true;
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to clear memories for agent ${agentId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Updates the memory index for an agent
   * @param {string} agentId - Agent identifier
   * @param {Object} entry - Memory entry
   * @private
   */
  _updateMemoryIndex(agentId, entry) {
    try {
      const indexPath = path.join(this.memoryDir, agentId, 'index.json');
      let index = {};
      
      // Load existing index if it exists
      if (fs.existsSync(indexPath)) {
        index = fs.readJsonSync(indexPath);
      }
      
      // Add entry to index
      index[entry.id] = {
        id: entry.id,
        created: entry.created,
        summary: entry.content.substring(0, 100)
      };
      
      // Write updated index
      fs.writeJsonSync(indexPath, index);
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to update memory index for agent ${agentId}: ${error.message}`);
    }
  }
  
  /**
   * Logs an agent action
   * @param {string} agentId - Agent identifier
   * @param {string} action - Action performed
   * @param {boolean} success - Whether the action was successful
   * @returns {string} Memory ID
   */
  logAction(agentId, action, success = true) {
    return this._addMemoryEntry(agentId, action, {
      type: 'action',
      success,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Logs a system event
   * @param {string} event - Event type
   * @param {string} description - Event description
   * @returns {string} Memory ID
   */
  logSystemEvent(event, description) {
    return this._addMemoryEntry('system', description, {
      type: 'system_event',
      event,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Saves shared knowledge between agents
   * @param {string} key - Knowledge key
   * @param {any} value - Knowledge value
   * @param {Object} metadata - Additional metadata
   * @returns {boolean} Whether the operation was successful
   */
  saveSharedKnowledge(key, value, metadata = {}) {
    try {
      const timestamp = new Date().toISOString();
      
      const entry = {
        key,
        value,
        metadata: {
          ...metadata,
          timestamp,
          type: 'shared_knowledge'
        }
      };
      
      // Store in shared knowledge area
      const sharedPath = path.join(this.memoryDir, 'shared');
      fs.ensureDirSync(sharedPath);
      
      const filePath = path.join(sharedPath, `${key}.json`);
      fs.writeJsonSync(filePath, entry);
      
      // Also cache it
      this.cache.set(`shared:${key}`, entry);
      
      logger.info(`${this.logPrefix} Saved shared knowledge: ${key}`);
      return true;
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to save shared knowledge ${key}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Retrieves shared knowledge
   * @param {string} key - Knowledge key
   * @returns {any} The stored knowledge value
   */
  getSharedKnowledge(key) {
    try {
      // Try cache first
      const cached = this.cache.get(`shared:${key}`);
      if (cached) {
        return cached.value;
      }
      
      // Try file system
      const filePath = path.join(this.memoryDir, 'shared', `${key}.json`);
      if (fs.existsSync(filePath)) {
        const entry = fs.readJsonSync(filePath);
        // Update cache
        this.cache.set(`shared:${key}`, entry);
        return entry.value;
      }
      
      return null;
    } catch (error) {
      logger.error(`${this.logPrefix} Failed to get shared knowledge ${key}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * טעינת זיכרון של סוכן
   * @param {string} agentName - שם הסוכן
   * @returns {Promise<Object>} - אובייקט הזיכרון
   */
  async loadMemory(agentName) {
    try {
      // אם הזיכרון נמצא במטמון, החזר אותו
      if (this.cache[agentName]) {
        logger.debug(`${this.logPrefix} זיכרון עבור ${agentName} נטען מהמטמון`);
        return this.cache[agentName];
      }
      
      // בחר את המנגנון המתאים בהתאם למצב הזיכרון
      if (this.memoryMode === 'json') {
        return await this._loadMemoryFromJson(agentName);
      } else if (this.memoryMode === 'sqlite') {
        return await this._loadMemoryFromSqlite(agentName);
      } else {
        throw new Error(`מצב זיכרון לא נתמך: ${this.memoryMode}`);
      }
    } catch (error) {
      // אם יש שגיאה בטעינה, יצור זיכרון חדש
      if (error.code === 'ENOENT') {
        logger.info(`${this.logPrefix} לא נמצא זיכרון קודם עבור ${agentName}, יוצר חדש`);
        return this._createNewMemory(agentName);
      }
      
      logger.error(`${this.logPrefix} שגיאה בטעינת זיכרון עבור ${agentName}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * שמירת זיכרון של סוכן
   * @param {string} agentName - שם הסוכן
   * @param {Object} memory - אובייקט הזיכרון
   * @returns {Promise<boolean>} - האם השמירה הצליחה
   */
  async saveMemory(agentName, memory) {
    try {
      // הוסף חותמת זמן עדכון
      memory.lastUpdated = this._getTimestamp();
      
      // שמור במטמון
      this.cache[agentName] = memory;
      
      // נקה את מטמון השאילתות לסוכן זה
      delete this.queryCache[agentName];
      
      // בחר את המנגנון המתאים בהתאם למצב הזיכרון
      if (this.memoryMode === 'json') {
        return await this._saveMemoryToJson(agentName, memory);
      } else if (this.memoryMode === 'sqlite') {
        return await this._saveMemoryToSqlite(agentName, memory);
      } else {
        throw new Error(`מצב זיכרון לא נתמך: ${this.memoryMode}`);
      }
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בשמירת זיכרון עבור ${agentName}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * הוספת פעולה למפגש ספציפי בזיכרון
   * @param {string} agentName - שם הסוכן
   * @param {string} sessionId - מזהה המפגש
   * @param {Object} action - פרטי הפעולה
   * @returns {Promise<boolean>} - האם השמירה הצליחה
   */
  async saveAction(agentName, sessionId, action) {
    try {
      // טען את הזיכרון
      const memory = await this.loadMemory(agentName);
      
      // וודא שהמפגש קיים
      if (!memory.sessions[sessionId]) {
        memory.sessions[sessionId] = {
          id: sessionId,
          startTime: this._getTimestamp(),
          endTime: null,
          status: 'active',
          actions: []
        };
      }
      
      // הוסף חותמת זמן אם לא סופקה
      if (!action.timestamp) {
        action.timestamp = this._getTimestamp();
      }
      
      // הוסף מזהה אם לא סופק
      if (!action.id) {
        action.id = `action_${Date.now()}`;
      }
      
      // הוסף מידע על הצלחה/כישלון אם לא סופק
      if (!action.result) {
        action.result = { success: true };
      }
      
      // הוסף את הפעולה למפגש
      memory.sessions[sessionId].actions = memory.sessions[sessionId].actions || [];
      memory.sessions[sessionId].actions.push(action);
      
      // עדכן סטטיסטיקות
      memory.stats = memory.stats || {};
      memory.stats.totalActions = (memory.stats.totalActions || 0) + 1;
      memory.stats.lastActionTime = this._getTimestamp();
      
      // עדכן מידע על הצלחה/כישלון אחרון
      if (action.result.success) {
        memory.stats.lastSuccess = this._getTimestamp();
        memory.stats.successCount = (memory.stats.successCount || 0) + 1;
      } else {
        memory.stats.lastFailure = this._getTimestamp();
        memory.stats.failureCount = (memory.stats.failureCount || 0) + 1;
      }
      
      // שמור את הזיכרון המעודכן
      await this.saveMemory(agentName, memory);
      
      return true;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בשמירת פעולה עבור ${agentName}/${sessionId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * סיום מפגש בזיכרון
   * @param {string} agentName - שם הסוכן
   * @param {string} sessionId - מזהה המפגש
   * @param {Object} summary - סיכום המפגש
   * @returns {Promise<boolean>} - האם העדכון הצליח
   */
  async completeSession(agentName, sessionId, summary = {}) {
    try {
      // טען את הזיכרון
      const memory = await this.loadMemory(agentName);
      
      // וודא שהמפגש קיים
      if (!memory.sessions[sessionId]) {
        throw new Error(`מפגש ${sessionId} לא קיים בזיכרון של הסוכן ${agentName}`);
      }
      
      const session = memory.sessions[sessionId];
      
      // עדכן את זמן הסיום ומצב המפגש
      session.endTime = this._getTimestamp();
      session.status = summary.status || 'completed';
      
      // חישוב סטטיסטיקות מפגש
      const actions = session.actions || [];
      const actionsCount = actions.length;
      const successCount = actions.filter(a => a.result && a.result.success).length;
      const failureCount = actionsCount - successCount;
      
      // הוסף סיכום למפגש
      session.summary = {
        ...summary,
        actionsCount,
        successCount,
        failureCount,
        duration: this._calculateDuration(session.startTime, session.endTime)
      };
      
      // עדכן סטטיסטיקות כלליות
      memory.stats = memory.stats || {};
      memory.stats.totalSessions = (memory.stats.totalSessions || 0) + 1;
      memory.stats.lastSessionTime = this._getTimestamp();
      
      // שמור את הזיכרון המעודכן
      await this.saveMemory(agentName, memory);
      
      return true;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בסיום מפגש ${sessionId} עבור ${agentName}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * מחיקת זיכרון של סוכן
   * @param {string} agentName - שם הסוכן
   * @returns {Promise<boolean>} - האם המחיקה הצליחה
   */
  async deleteMemory(agentName) {
    try {
      // הסר מהמטמון
      delete this.cache[agentName];
      delete this.queryCache[agentName];
      
      // בחר את המנגנון המתאים בהתאם למצב הזיכרון
      if (this.memoryMode === 'json') {
        return await this._deleteMemoryFromJson(agentName);
      } else if (this.memoryMode === 'sqlite') {
        return await this._deleteMemoryFromSqlite(agentName);
      } else {
        throw new Error(`מצב זיכרון לא נתמך: ${this.memoryMode}`);
      }
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה במחיקת זיכרון עבור ${agentName}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * חיפוש בזיכרון של סוכן
   * @param {string} agentName - שם הסוכן
   * @param {string} query - מחרוזת חיפוש
   * @param {Object} options - אפשרויות נוספות לחיפוש
   * @returns {Promise<Object>} - תוצאות החיפוש
   */
  async searchMemory(agentName, query, options = {}) {
    try {
      // בדוק אם החיפוש נמצא במטמון
      const cacheKey = `${agentName}_${query}_${JSON.stringify(options)}`;
      if (this.queryCache[cacheKey] && options.useCache !== false) {
        logger.debug(`${this.logPrefix} תוצאת חיפוש מהמטמון עבור ${agentName}: ${query}`);
        return this.queryCache[cacheKey];
      }
      
      // טען את הזיכרון
      const memory = await this.loadMemory(agentName);
      
      // בצע חיפוש בסיסי (ניתן להרחיב)
      const results = {
        query,
        timestamp: this._getTimestamp(),
        matched_sessions: [],
        matched_actions: []
      };
      
      // הגדר מגבלות ברירת מחדל
      const limit = options.limit || 20;
      const sessionLimit = options.sessionLimit || 10;
      const startTime = options.startTime || null;
      const endTime = options.endTime || null;
      
      // חפש בתוך פעולות ומפגשים
      if (memory.sessions) {
        for (const [sessionId, session] of Object.entries(memory.sessions)) {
          // בדוק מגבלת זמן אם קיימת
          if (startTime && session.startTime < startTime) continue;
          if (endTime && session.endTime && session.endTime > endTime) continue;
          
          // בדוק התאמה בסיכום המפגש
          let sessionMatched = false;
          if (session.summary && JSON.stringify(session.summary).toLowerCase().includes(query.toLowerCase())) {
            sessionMatched = true;
            results.matched_sessions.push({
              sessionId,
              startTime: session.startTime,
              endTime: session.endTime,
              status: session.status,
              summary: session.summary
            });
          }
          
          // בדוק התאמה בפעולות
          if (session.actions) {
            for (const action of session.actions) {
              if (JSON.stringify(action).toLowerCase().includes(query.toLowerCase())) {
                results.matched_actions.push({
                  sessionId,
                  actionId: action.id,
                  type: action.type,
                  timestamp: action.timestamp,
                  success: action.result?.success,
                  details: action
                });
                
                // אם המפגש לא נמצא כבר, הוסף אותו
                if (!sessionMatched && results.matched_sessions.length < sessionLimit) {
                  results.matched_sessions.push({
                    sessionId,
                    startTime: session.startTime,
                    endTime: session.endTime,
                    status: session.status,
                    summary: session.summary
                  });
                  sessionMatched = true;
                }
              }
              
              // בדוק מגבלת תוצאות
              if (results.matched_actions.length >= limit) break;
            }
          }
          
          // בדוק מגבלת מפגשים
          if (results.matched_sessions.length >= sessionLimit) break;
        }
      }
      
      // מיין תוצאות לפי זמן (מהחדש לישן)
      results.matched_sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      results.matched_actions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // שמור תוצאה במטמון אם נדרש
      if (options.cache !== false) {
        this.queryCache[cacheKey] = results;
      }
      
      return results;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בחיפוש בזיכרון עבור ${agentName}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * קבלת סטטיסטיקות זיכרון לכל הסוכנים
   * @returns {Promise<Object>} - מידע סטטיסטי על כל הסוכנים
   */
  async getAllAgentsMemoryStats() {
    try {
      const stats = [];
      
      if (this.memoryMode === 'json') {
        // קרא את כל קבצי ה-JSON בתיקיית הזיכרון
        const files = await fs.readdir(this.memoryDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        for (const file of jsonFiles) {
          const agentName = path.basename(file, '.json');
          const filePath = path.join(this.memoryDir, file);
          const fileStats = await fs.stat(filePath);
          
          try {
            let memory;
            
            // בדוק אם הזיכרון במטמון
            if (this.cache[agentName]) {
              memory = this.cache[agentName];
            } else {
              memory = await fs.readJson(filePath);
            }
            
            const agentStats = {
              agent: agentName,
              memorySize: fileStats.size,
              lastUpdated: memory.lastUpdated || null,
              totalSessions: memory.sessions ? Object.keys(memory.sessions).length : 0,
              totalActions: this._countActions(memory),
              successRate: this._calculateSuccessRate(memory),
              lastSuccess: memory.stats?.lastSuccess || null,
              lastFailure: memory.stats?.lastFailure || null
            };
            
            stats.push(agentStats);
          } catch (error) {
            stats.push({
              agent: agentName,
              error: `שגיאה בקריאת קובץ: ${error.message}`,
              memorySize: fileStats.size,
              lastModified: fileStats.mtime
            });
          }
        }
      } else if (this.memoryMode === 'sqlite') {
        // בעתיד: מימוש עבור SQLite
        throw new Error('SQLite לא נתמך עדיין');
      }
      
      return stats;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בקבלת סטטיסטיקות זיכרון: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * קבלת נתוני זיכרון עבור סוכן ספציפי לתצוגה ב-API
   * @param {string} agentName - שם הסוכן
   * @returns {Promise<Object>} - נתוני זיכרון מסוכמים
   */
  async getMemoryForApi(agentName) {
    try {
      // טען את זיכרון הסוכן
      const memory = await this.loadMemory(agentName);
      
      // חשב סטטיסטיקות כלליות
      const totalSessions = memory.sessions ? Object.keys(memory.sessions).length : 0;
      const totalActions = this._countActions(memory);
      const successRate = this._calculateSuccessRate(memory);
      
      // יצירת אובייקט התשובה
      const result = {
        agent: agentName,
        createdAt: memory.createdAt,
        lastUpdated: memory.lastUpdated,
        stats: {
          ...memory.stats,
          totalSessions,
          totalActions,
          successRate
        },
        // 10 המפגשים האחרונים לפי זמן התחלה
        recentSessions: this._getRecentSessions(memory, 10)
      };
      
      return result;
    } catch (error) {
      logger.error(`${this.logPrefix} שגיאה בהכנת נתוני זיכרון ל-API עבור ${agentName}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * יצירת אובייקט זיכרון חדש
   * @param {string} agentName - שם הסוכן
   * @returns {Object} - אובייקט זיכרון חדש
   * @private
   */
  _createNewMemory(agentName) {
    const timestamp = this._getTimestamp();
    
    return {
      agentName,
      createdAt: timestamp,
      lastUpdated: timestamp,
      sessions: {},
      stats: {
        totalSessions: 0,
        totalActions: 0,
        successCount: 0,
        failureCount: 0,
        lastSuccess: null,
        lastFailure: null
      }
    };
  }
  
  /**
   * ספירת מספר הפעולות בכל המפגשים
   * @param {Object} memory - אובייקט זיכרון
   * @returns {number} - מספר הפעולות
   * @private
   */
  _countActions(memory) {
    let count = 0;
    
    if (memory.sessions) {
      for (const session of Object.values(memory.sessions)) {
        if (session.actions) {
          count += session.actions.length;
        }
      }
    }
    
    return count;
  }
  
  /**
   * חישוב אחוז ההצלחה של פעולות
   * @param {Object} memory - אובייקט זיכרון
   * @returns {number} - אחוז ההצלחה (0-100)
   * @private
   */
  _calculateSuccessRate(memory) {
    const successCount = memory.stats?.successCount || 0;
    const failureCount = memory.stats?.failureCount || 0;
    const totalCount = successCount + failureCount;
    
    if (totalCount === 0) return 100; // אין פעולות = 100% הצלחה
    
    return Math.round((successCount / totalCount) * 100);
  }
  
  /**
   * קבלת המפגשים האחרונים מהזיכרון
   * @param {Object} memory - אובייקט זיכרון
   * @param {number} limit - מספר מקסימלי של מפגשים להחזיר
   * @returns {Array} - מערך המפגשים האחרונים
   * @private
   */
  _getRecentSessions(memory, limit = 10) {
    if (!memory.sessions) return [];
    
    // המר את המפגשים למערך
    const sessions = Object.values(memory.sessions);
    
    // מיין לפי זמן התחלה (מהחדש לישן)
    sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    // החזר את המפגשים המוגבלים
    return sessions.slice(0, limit).map(session => ({
      id: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      actionsCount: session.actions?.length || 0,
      summary: session.summary || {}
    }));
  }
  
  /**
   * חישוב משך זמן בין שתי חותמות זמן
   * @param {string} startTime - זמן התחלה
   * @param {string} endTime - זמן סיום
   * @returns {number} - משך הזמן בשניות
   * @private 
   */
  _calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    return Math.floor((end - start) / 1000);
  }
  
  /**
   * יצירת חותמת זמן במבנה הנכון
   * @returns {string|number} - חותמת זמן
   * @private
   */
  _getTimestamp() {
    if (!this.timeFormat.timestamp) {
      return null;
    }
    
    if (this.timeFormat.format === 'UNIX') {
      return Date.now();
    }
    
    return new Date().toISOString();
  }

  /**
   * טעינת זיכרון מקובץ JSON
   * @param {string} agentName - שם הסוכן
   * @returns {Promise<Object>} - אובייקט הזיכרון
   * @private
   */
  async _loadMemoryFromJson(agentName) {
    const filePath = path.join(this.memoryDir, `${agentName}.json`);
    const memory = await fs.readJson(filePath);
    
    // שמור במטמון
    this.cache[agentName] = memory;
    
    return memory;
  }
  
  /**
   * שמירת זיכרון לקובץ JSON
   * @param {string} agentName - שם הסוכן
   * @param {Object} memory - אובייקט הזיכרון
   * @returns {Promise<boolean>} - האם השמירה הצליחה
   * @private
   */
  async _saveMemoryToJson(agentName, memory) {
    const filePath = path.join(this.memoryDir, `${agentName}.json`);
    await fs.writeJson(filePath, memory, { spaces: 2 });
    
    return true;
  }
  
  /**
   * מחיקת קובץ זיכרון JSON
   * @param {string} agentName - שם הסוכן
   * @returns {Promise<boolean>} - האם המחיקה הצליחה
   * @private
   */
  async _deleteMemoryFromJson(agentName) {
    const filePath = path.join(this.memoryDir, `${agentName}.json`);
    await fs.remove(filePath);
    
    return true;
  }
  
  /**
   * טעינת זיכרון מ-SQLite
   * @param {string} agentName - שם הסוכן
   * @returns {Promise<Object>} - אובייקט הזיכרון
   * @private
   */
  async _loadMemoryFromSqlite(agentName) {
    throw new Error('SQLite לא נתמך עדיין');
  }
  
  /**
   * שמירת זיכרון ל-SQLite
   * @param {string} agentName - שם הסוכן
   * @param {Object} memory - אובייקט הזיכרון
   * @returns {Promise<boolean>} - האם השמירה הצליחה
   * @private
   */
  async _saveMemoryToSqlite(agentName, memory) {
    throw new Error('SQLite לא נתמך עדיין');
  }
  
  /**
   * מחיקת זיכרון מ-SQLite
   * @param {string} agentName - שם הסוכן
   * @returns {Promise<boolean>} - האם המחיקה הצליחה
   * @private
   */
  async _deleteMemoryFromSqlite(agentName) {
    throw new Error('SQLite לא נתמך עדיין');
  }
  
  /**
   * ניקוי המטמון
   */
  clearCache() {
    this.cache = {};
    this.queryCache = {};
    logger.debug(`${this.logPrefix} המטמון נוקה`);
  }
}

module.exports = new MemoryManager(); 