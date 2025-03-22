const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Read API keys from configuration file
const configPath = path.join(__dirname, '../config/apiKeys.json');
let config;

try {
  config = fs.readJsonSync(configPath);
} catch (error) {
  logger.error(`Error loading configuration file: ${error.message}`);
  config = {
    openai: { api_key: process.env.OPENAI_API_KEY },
    anthropic: { api_key: process.env.CLAUDE_API_KEY },
    huggingface: { api_key: process.env.HUGGINGFACE_API_KEY }
  };
}

// Replace keys from the file with env variables if defined
if (config.openai.api_key === "OPENAI_API_KEY_FROM_ENV") {
  config.openai.api_key = process.env.OPENAI_API_KEY;
}
if (config.anthropic.api_key === "CLAUDE_API_KEY_FROM_ENV") {
  config.anthropic.api_key = process.env.CLAUDE_API_KEY;
}
if (config.huggingface.api_key === "HUGGINGFACE_API_KEY_FROM_ENV") {
  config.huggingface.api_key = process.env.HUGGINGFACE_API_KEY;
}

// Initialize API clients
const openai = new OpenAI({
  apiKey: config.openai.api_key
});

const anthropic = new Anthropic({
  apiKey: config.anthropic.api_key
});

// Mapping of preferred models for each agent
const AGENT_MODEL_MAPPING = {
  'dev': 'gpt-4',
  'qa': 'gpt-3.5-turbo',
  'executor': 'gpt-3.5-turbo',
  'git_sync': 'gpt-3.5-turbo',
  'scheduler': 'gpt-3.5-turbo',
  'summary': 'gpt-4'
};

/**
 * The central AI Engine that manages requests to different AI providers
 */
class AIEngine {
  constructor() {
    // Mapping of preferred models by agent
    this.agentModelMapping = {
      dev_agent: { provider: 'openai', model: 'gpt-4' },
      qa_agent: { provider: 'anthropic', model: 'claude-3.7-sonnet' },
      executor_agent: { provider: 'openai', model: 'gpt-4-turbo' },
      summary_agent: { provider: 'openai', model: 'gpt-4' },
      git_sync_agent: { provider: 'anthropic', model: 'claude-3.7-sonnet' },
      db_agent: { provider: 'openai', model: 'gpt-4' },
      ui_agent: { provider: 'openai', model: 'gpt-4' },
      economics_agent: { provider: 'anthropic', model: 'claude-3.7-sonnet' },
      scheduler_agent: { provider: 'anthropic', model: 'claude-3.7-sonnet' }
    };
  }

  /**
   * Returns the recommended model and provider for a specific agent
   * @param {string} agentName - The agent name
   * @returns {Object} - Object containing the recommended AI provider and model
   */
  getRecommendedModelForAgent(agentName) {
    if (this.agentModelMapping[agentName]) {
      return { ...this.agentModelMapping[agentName] };
    }

    // Default if the agent is not found in the mapping
    return { provider: 'openai', model: 'gpt-4-turbo' };
  }

  /**
   * Sends a query to the appropriate AI model
   * @param {string} prompt - The text to send to the AI
   * @param {Object} options - Additional options
   * @param {string} options.provider - The AI provider to use (openai/anthropic/huggingface)
   * @param {string} options.model - The AI model to use
   * @param {string} options.agentName - The name of the agent sending the query (optional)
   * @returns {Promise<string>} - The AI response
   */
  async query(prompt, options = {}) {
    // If an agent name is provided but no model or provider is specified, use the mapping
    if (options.agentName && (!options.provider || !options.model)) {
      const recommended = this.getRecommendedModelForAgent(options.agentName);
      options.provider = options.provider || recommended.provider;
      options.model = options.model || recommended.model;
      logger.info(`Automatic model selection for ${options.agentName}: ${options.provider}/${options.model}`);
    }

    const provider = options.provider || 'openai';
    const model = options.model || this._getDefaultModel(provider);
    
    logger.info(`Sending query to ${provider} with model ${model}`);
    
    try {
      switch (provider) {
        case 'openai':
          return await this._queryOpenAI(prompt, model);
        case 'anthropic':
          return await this._queryAnthropic(prompt, model);
        case 'huggingface':
          return await this._queryHuggingFace(prompt, model);
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Error in query to ${provider}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Returns the default model for a specific provider
   * @param {string} provider - The AI provider
   * @returns {string} - The default model
   */
  _getDefaultModel(provider) {
    switch (provider) {
      case 'openai':
        return 'gpt-4-turbo';
      case 'anthropic':
        return 'claude-3.7-sonnet';
      case 'huggingface':
        return 'mistralai/Mixtral-8x7B-Instruct-v0.1';
      default:
        return 'gpt-4-turbo';
    }
  }

  /**
   * Sends a query to OpenAI
   * @param {string} prompt - The text to send
   * @param {string} model - The AI model to use
   * @returns {Promise<string>} - The AI response
   */
  async _queryOpenAI(prompt, model) {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    
    return response.choices[0].message.content;
  }

  /**
   * Sends a query to Anthropic (Claude)
   * @param {string} prompt - The text to send
   * @param {string} model - The AI model to use
   * @returns {Promise<string>} - The AI response
   */
  async _queryAnthropic(prompt, model) {
    const response = await anthropic.messages.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    });
    
    return response.content[0].text;
  }

  /**
   * Sends a query to HuggingFace
   * @param {string} prompt - The text to send
   * @param {string} model - The AI model to use
   * @returns {Promise<string>} - The AI response
   */
  async _queryHuggingFace(prompt, model) {
    const endpoint = `https://api-inference.huggingface.co/models/${model}`;
    
    const response = await axios.post(
      endpoint,
      { inputs: prompt },
      {
        headers: {
          'Authorization': `Bearer ${config.huggingface.api_key}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data[0].generated_text;
  }
}

// Select appropriate model for an agent
const selectModelForAgent = (agentType) => {
  return AGENT_MODEL_MAPPING[agentType] || process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo';
};

// Send request to AI model with automatic model selection based on agent
const sendPromptWithAgentContext = async (prompt, options = {}, agentType = null) => {
  const model = agentType ? selectModelForAgent(agentType) : (options.model || process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo');
  
  return sendPrompt(prompt, { 
    ...options,
    model
  });
};

/**
 * Creates text using an AI model
 * @param {Object} options - Options for text generation
 * @param {string} options.model - The AI model to use (supports provider/model format)
 * @param {string} options.prompt - The query to send to the model
 * @param {number} options.temperature - The model's creativity level (0-1)
 * @param {number} options.maxTokens - Maximum number of tokens for the response
 * @returns {Promise<string>} - The model's response
 */
const generateText = async (options) => {
  const { model, prompt, temperature = 0.7, maxTokens = 1000 } = options;
  
  if (!prompt) {
    throw new Error('Missing query');
  }
  
  // Check if the model comes in provider/model format
  let provider = 'openai';
  let modelName = model;
  
  if (model.includes('/')) {
    const parts = model.split('/');
    provider = parts[0];
    modelName = parts[1];
  }
  
  logger.info(`Generating text with model ${modelName} from ${provider}`);
  
  try {
    switch (provider) {
      case 'openai':
        const openaiResponse = await openai.chat.completions.create({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens
        });
        return openaiResponse.choices[0].message.content;
        
      case 'anthropic':
        const anthropicResponse = await anthropic.messages.create({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens
        });
        return anthropicResponse.content[0].text;
        
      case 'huggingface':
        const huggingfaceResponse = await axios.post(
          `https://api-inference.huggingface.co/models/${modelName}`,
          { inputs: prompt },
          {
            headers: {
              'Authorization': `Bearer ${config.huggingface.api_key}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return huggingfaceResponse.data[0].generated_text;
        
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (error) {
    logger.error(`Error generating text with ${provider}/${modelName}: ${error.message}`);
    throw error;
  }
};

// Export the AIEngine instance and utility functions
module.exports = new AIEngine();
module.exports.generateText = generateText;
module.exports.selectModelForAgent = selectModelForAgent;
module.exports.sendPromptWithAgentContext = sendPromptWithAgentContext; 