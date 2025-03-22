#!/usr/bin/env node
/**
 * Memory Report Tool
 * 
 * A simple command-line tool for displaying AI agent memory reports
 * Allows viewing statistics and searching in memory
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const memoryManager = require('../core/memoryManager');
const readline = require('readline');

// Create input/output interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Memory directory
const MEMORY_DIR = path.resolve(__dirname, '../memory');

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue.bold('\n=== AI Agent Memory Report ===\n'));
  
  try {
    // Check that memory directory exists
    if (!(await fs.pathExists(MEMORY_DIR))) {
      console.log(chalk.red('Error: Memory directory does not exist.'));
      return;
    }
    
    // Display main menu
    await showMainMenu();
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
  } finally {
    rl.close();
  }
}

/**
 * Display main menu
 */
async function showMainMenu() {
  console.log(chalk.cyan('Select action:'));
  console.log('1. Show memory statistics for all agents');
  console.log('2. Search in agent memory');
  console.log('3. Show recent sessions of an agent');
  console.log('4. Clear agent memory');
  console.log('0. Exit');
  
  rl.question('\nChoice: ', async (choice) => {
    switch (choice) {
      case '1':
        await showAllAgentsStats();
        break;
      case '2':
        await searchAgentMemory();
        break;
      case '3':
        await showRecentSessions();
        break;
      case '4':
        await clearAgentMemory();
        break;
      case '0':
        console.log(chalk.blue('Goodbye!'));
        rl.close();
        return;
      default:
        console.log(chalk.yellow('Invalid choice, try again.'));
    }
    
    // Return to main menu
    setTimeout(() => {
      console.log('\n');
      showMainMenu();
    }, 1000);
  });
}

/**
 * Show statistics for all agents
 */
async function showAllAgentsStats() {
  console.log(chalk.blue.bold('\n=== Agent Memory Statistics ===\n'));
  
  try {
    // Get statistics from all agents
    const stats = await memoryManager.getAllAgentsMemoryStats();
    
    if (stats.length === 0) {
      console.log(chalk.yellow('No agents with memory found.'));
      return;
    }
    
    // Display statistics in a table
    console.log(chalk.cyan('Agent Name\t\tSessions\tActions\tLast Update\t\tMemory Size'));
    console.log(chalk.gray('------------------------------------------------------------'));
    
    stats.forEach(stat => {
      // Adjust agent name for display
      const agentName = stat.agent.padEnd(16, ' ');
      
      // Display row in table
      console.log(
        `${agentName}\t${stat.totalSessions}\t${stat.totalActions}\t` +
        `${new Date(stat.lastUpdated).toLocaleString()}\t` +
        `${formatBytes(stat.memorySize || 0)}`
      );
    });
  } catch (err) {
    console.error(chalk.red(`Error loading statistics: ${err.message}`));
  }
}

/**
 * Search in agent memory
 */
async function searchAgentMemory() {
  console.log(chalk.blue.bold('\n=== Search in Agent Memory ===\n'));
  
  try {
    // Get list of agents
    const agents = await getAgentsList();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents with memory found.'));
      return;
    }
    
    // Display list of agents
    console.log(chalk.cyan('Select agent:'));
    agents.forEach((agent, idx) => {
      console.log(`${idx + 1}. ${agent}`);
    });
    
    rl.question('\nChoice (number): ', (agentIdx) => {
      const idx = parseInt(agentIdx) - 1;
      
      if (isNaN(idx) || idx < 0 || idx >= agents.length) {
        console.log(chalk.yellow('Invalid choice.'));
        return;
      }
      
      const selectedAgent = agents[idx];
      
      // Ask for search keyword
      rl.question('Enter search keyword: ', async (keyword) => {
        if (!keyword.trim()) {
          console.log(chalk.yellow('Empty keyword, search canceled.'));
          return;
        }
        
        // Perform search
        const results = await memoryManager.searchMemory(selectedAgent, keyword);
        
        if (results.length === 0) {
          console.log(chalk.yellow(`No results found for "${keyword}" in ${selectedAgent}'s memory.`));
          return;
        }
        
        // Display results
        console.log(chalk.green(`\nFound ${results.length} results:`));
        results.forEach((result, idx) => {
          const timestamp = new Date(result.timestamp || result.startTime).toLocaleString();
          
          if (result.action) {
            // Action
            console.log(chalk.white(`\n${idx + 1}. [${timestamp}] ${result.action.title}`));
            console.log(chalk.gray(`   ${result.action.description || ''}`));
            
            if (result.action.result) {
              const resultStr = typeof result.action.result === 'object' ? 
                JSON.stringify(result.action.result, null, 2) : result.action.result;
              console.log(chalk.gray(`   Result: ${resultStr.substring(0, 100)}${resultStr.length > 100 ? '...' : ''}`));
            }
            
            if (result.action.error) {
              console.log(chalk.red(`   Error: ${result.action.error}`));
            }
          } else if (result.summary) {
            // Session summary
            console.log(chalk.white(`\n${idx + 1}. [${timestamp}] Session summary ${result.sessionId}`));
            console.log(chalk.gray(`   ${JSON.stringify(result.summary)}`));
          }
        });
      });
    });
  } catch (err) {
    console.error(chalk.red(`Search error: ${err.message}`));
  }
}

/**
 * Show recent sessions
 */
async function showRecentSessions() {
  console.log(chalk.blue.bold('\n=== Recent Sessions ===\n'));
  
  try {
    // Get list of agents
    const agents = await getAgentsList();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents with memory found.'));
      return;
    }
    
    // Display list of agents
    console.log(chalk.cyan('Select agent:'));
    agents.forEach((agent, idx) => {
      console.log(`${idx + 1}. ${agent}`);
    });
    
    rl.question('\nChoice (number): ', async (agentIdx) => {
      const idx = parseInt(agentIdx) - 1;
      
      if (isNaN(idx) || idx < 0 || idx >= agents.length) {
        console.log(chalk.yellow('Invalid choice.'));
        return;
      }
      
      const selectedAgent = agents[idx];
      
      // Load agent memory
      const memory = await memoryManager.loadMemory(selectedAgent);
      
      if (!memory || !memory.sessions || memory.sessions.length === 0) {
        console.log(chalk.yellow(`No sessions found for agent ${selectedAgent}.`));
        return;
      }
      
      // Sort from newest to oldest
      const sortedSessions = [...memory.sessions].sort((a, b) => 
        new Date(b.startTime) - new Date(a.startTime)
      );
      
      // Limit to 10 most recent sessions
      const recentSessions = sortedSessions.slice(0, 10);
      
      // Display sessions
      console.log(chalk.green(`\nRecent sessions for agent ${selectedAgent}:`));
      
      recentSessions.forEach((session, idx) => {
        const startTime = new Date(session.startTime).toLocaleString();
        const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'active';
        const status = session.status === 'active' ? chalk.green('active') : 
                      session.status === 'completed' ? chalk.blue('completed') : 
                      session.status === 'failed' ? chalk.red('failed') : 
                      chalk.gray(session.status);
        
        console.log(chalk.white(`\n${idx + 1}. Session ${session.id}`));
        console.log(chalk.gray(`    Start: ${startTime}`));
        console.log(chalk.gray(`    End: ${endTime}`));
        console.log(chalk.gray(`    Status: ${status}`));
        console.log(chalk.gray(`    Actions: ${session.actions.length}`));
        
        if (session.summary) {
          console.log(chalk.gray(`    Summary: ${typeof session.summary === 'object' ? 
            JSON.stringify(session.summary) : session.summary}`));
        }
      });
      
      // Display option for additional details on a specific session
      rl.question('\nEnter session number for additional details (or Enter to return): ', (sessionIdx) => {
        if (!sessionIdx.trim()) {
          return;
        }
        
        const sIdx = parseInt(sessionIdx) - 1;
        
        if (isNaN(sIdx) || sIdx < 0 || sIdx >= recentSessions.length) {
          console.log(chalk.yellow('Invalid choice.'));
          return;
        }
        
        const selectedSession = recentSessions[sIdx];
        
        // Display session actions
        console.log(chalk.green(`\nActions in session ${selectedSession.id}:`));
        
        if (!selectedSession.actions || selectedSession.actions.length === 0) {
          console.log(chalk.yellow('   No actions in this session.'));
          return;
        }
        
        selectedSession.actions.forEach((action, idx) => {
          const timestamp = new Date(action.timestamp).toLocaleString();
          
          console.log(chalk.white(`\n  ${idx + 1}. [${timestamp}] ${action.title}`));
          console.log(chalk.gray(`     ${action.description || ''}`));
          
          if (action.params && Object.keys(action.params).length > 0) {
            console.log(chalk.gray(`      Parameters: ${JSON.stringify(action.params)}`));
          }
          
          if (action.result) {
            const resultStr = typeof action.result === 'object' ? 
              JSON.stringify(action.result, null, 2) : action.result;
            console.log(chalk.gray(`      Result: ${resultStr.substring(0, 100)}${resultStr.length > 100 ? '...' : ''}`));
          }
          
          if (action.error) {
            console.log(chalk.red(`      Error: ${action.error}`));
          }
        });
      });
    });
  } catch (err) {
    console.error(chalk.red(`Error displaying sessions: ${err.message}`));
  }
}

/**
 * Clear agent memory
 */
async function clearAgentMemory() {
  console.log(chalk.blue.bold('\n=== Clear Agent Memory ===\n'));
  
  try {
    // Get list of agents
    const agents = await getAgentsList();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents with memory found.'));
      return;
    }
    
    // Display list of agents
    console.log(chalk.cyan('Select agent:'));
    agents.forEach((agent, idx) => {
      console.log(`${idx + 1}. ${agent}`);
    });
    
    console.log(`${agents.length + 1}. All agents`);
    
    rl.question('\nChoice (number): ', (agentIdx) => {
      const idx = parseInt(agentIdx) - 1;
      
      if (isNaN(idx) || idx < 0 || idx > agents.length) {
        console.log(chalk.yellow('Invalid choice.'));
        return;
      }
      
      // Ask for confirmation
      const confirmMessage = idx === agents.length ? 
        'Are you sure you want to clear the memory of all agents? (yes/no): ' :
        `Are you sure you want to clear the memory of ${agents[idx]}? (yes/no): `;
      
      rl.question(chalk.red(confirmMessage), async (answer) => {
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
          console.log(chalk.yellow('Operation canceled.'));
          return;
        }
        
        // Perform clearing
        if (idx === agents.length) {
          // Clear memory of all agents
          let successCount = 0;
          
          for (const agent of agents) {
            const success = await memoryManager.clearMemory(agent);
            if (success) successCount++;
          }
          
          console.log(chalk.green(`Memory cleared successfully for ${successCount} out of ${agents.length} agents.`));
        } else {
          // Clear memory of specific agent
          const selectedAgent = agents[idx];
          const success = await memoryManager.clearMemory(selectedAgent);
          
          if (success) {
            console.log(chalk.green(`Memory for agent ${selectedAgent} cleared successfully.`));
          } else {
            console.log(chalk.red(`Error clearing memory for agent ${selectedAgent}.`));
          }
        }
      });
    });
  } catch (err) {
    console.error(chalk.red(`Error clearing memory: ${err.message}`));
  }
}

/**
 * Get list of agents from memory directory
 * @returns {Promise<string[]>} List of agents
 */
async function getAgentsList() {
  try {
    const files = await fs.readdir(MEMORY_DIR);
    return files
      .filter(file => file.endsWith('.json') && !file.includes('.backup.'))
      .map(file => file.replace('.json', ''));
  } catch (err) {
    console.error(chalk.red(`Error getting agent list: ${err.message}`));
    return [];
  }
}

/**
 * Format bytes to readable string
 * @param {number} bytes - Bytes size
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the script
main(); 