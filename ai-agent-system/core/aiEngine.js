const OpenAI = require('openai');
const { default: Anthropic } = require('anthropic');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');
const dotenv = require('dotenv');

// טען משתנים סביבתיים
dotenv.config();

// קרא את מפתחות ה-API מקובץ התצורה
const configPath = path.join(__dirname, '../config/apiKeys.json');
let config;

try {
  config = fs.readJsonSync(configPath);
} catch (error) {
  logger.error(`שגיאה בטעינת קובץ התצורה: ${error.message}`);
  config = {
    openai: { api_key: process.env.OPENAI_API_KEY },
    anthropic: { api_key: process.env.CLAUDE_API_KEY },
    huggingface: { api_key: process.env.HUGGINGFACE_API_KEY }
  };
}

// החלף מפתחות מהקובץ במפתחות מה-env אם הם מוגדרים כך
if (config.openai.api_key === "OPENAI_API_KEY_FROM_ENV") {
  config.openai.api_key = process.env.OPENAI_API_KEY;
}
if (config.anthropic.api_key === "CLAUDE_API_KEY_FROM_ENV") {
  config.anthropic.api_key = process.env.CLAUDE_API_KEY;
}
if (config.huggingface.api_key === "HUGGINGFACE_API_KEY_FROM_ENV") {
  config.huggingface.api_key = process.env.HUGGINGFACE_API_KEY;
}

// אתחול לקוחות ה-API
const openai = new OpenAI({
  apiKey: config.openai.api_key
});

const anthropic = new Anthropic({
  apiKey: config.anthropic.api_key
});

// מיפוי מודלים מועדפים לכל סוכן
const AGENT_MODEL_MAPPING = {
  'dev': 'gpt-4',
  'qa': 'gpt-3.5-turbo',
  'executor': 'gpt-3.5-turbo',
  'git_sync': 'gpt-3.5-turbo',
  'scheduler': 'gpt-3.5-turbo',
  'summary': 'gpt-4'
};

/**
 * מנוע ה-AI המרכזי שמנהל את הבקשות לספקי ה-AI השונים
 */
class AIEngine {
  constructor() {
    // מיפוי של מודלים מועדפים לפי סוכן
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
   * מחזיר את המודל והספק המומלצים לסוכן מסוים
   * @param {string} agentName - שם הסוכן
   * @returns {Object} - אובייקט המכיל את ספק ומודל ה-AI המומלצים
   */
  getRecommendedModelForAgent(agentName) {
    if (this.agentModelMapping[agentName]) {
      return { ...this.agentModelMapping[agentName] };
    }

    // ברירת מחדל אם הסוכן לא נמצא במיפוי
    return { provider: 'openai', model: 'gpt-4-turbo' };
  }

  /**
   * שולח שאילתה למודל ה-AI המתאים
   * @param {string} prompt - הטקסט לשליחה ל-AI
   * @param {Object} options - אפשרויות נוספות
   * @param {string} options.provider - ספק ה-AI לשימוש (openai/anthropic/huggingface)
   * @param {string} options.model - מודל ה-AI לשימוש
   * @param {string} options.agentName - שם הסוכן השולח את השאילתה (אופציונלי)
   * @returns {Promise<string>} - תשובת ה-AI
   */
  async query(prompt, options = {}) {
    // אם נמסר שם סוכן ולא צוין מודל או ספק, השתמש במיפוי
    if (options.agentName && (!options.provider || !options.model)) {
      const recommended = this.getRecommendedModelForAgent(options.agentName);
      options.provider = options.provider || recommended.provider;
      options.model = options.model || recommended.model;
      logger.info(`בחירת מודל אוטומטית עבור ${options.agentName}: ${options.provider}/${options.model}`);
    }

    const provider = options.provider || 'openai';
    const model = options.model || this._getDefaultModel(provider);
    
    logger.info(`שולח שאילתה ל-${provider} עם מודל ${model}`);
    
    try {
      switch (provider) {
        case 'openai':
          return await this._queryOpenAI(prompt, model);
        case 'anthropic':
          return await this._queryAnthropic(prompt, model);
        case 'huggingface':
          return await this._queryHuggingFace(prompt, model);
        default:
          throw new Error(`ספק AI לא נתמך: ${provider}`);
      }
    } catch (error) {
      logger.error(`שגיאה בשאילתה ל-${provider}: ${error.message}`);
      throw error;
    }
  }

  /**
   * מחזיר את מודל ברירת המחדל לספק מסוים
   * @param {string} provider - ספק ה-AI
   * @returns {string} - מודל ברירת המחדל
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
   * שולח שאילתה ל-OpenAI
   * @param {string} prompt - הטקסט לשליחה
   * @param {string} model - מודל ה-AI לשימוש
   * @returns {Promise<string>} - תשובת ה-AI
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
   * שולח שאילתה ל-Anthropic (Claude)
   * @param {string} prompt - הטקסט לשליחה
   * @param {string} model - מודל ה-AI לשימוש
   * @returns {Promise<string>} - תשובת ה-AI
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
   * שולח שאילתה ל-HuggingFace
   * @param {string} prompt - הטקסט לשליחה
   * @param {string} model - מודל ה-AI לשימוש
   * @returns {Promise<string>} - תשובת ה-AI
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

// בחירת מודל מתאים לסוכן
const selectModelForAgent = (agentType) => {
  return AGENT_MODEL_MAPPING[agentType] || process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo';
};

// שליחת בקשה למודל AI עם בחירת מודל אוטומטית לפי סוכן
const sendPromptWithAgentContext = async (prompt, options = {}, agentType = null) => {
  const model = agentType ? selectModelForAgent(agentType) : (options.model || process.env.DEFAULT_AI_MODEL || 'gpt-3.5-turbo');
  
  return sendPrompt(prompt, { 
    ...options,
    model
  });
};

module.exports = {
  sendPrompt,
  sendPromptWithAgentContext,
  selectModelForAgent,
  // ... existing exports ...
}; 