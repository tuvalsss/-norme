/**
 * שירות לניהול מדדים ואנליטיקה
 */

// קבע את כתובת ה-API
const API_URL = 'http://localhost:3001';

/**
 * קבלת מדדי מערכת
 * @param {number} period - תקופת הזמן לניתוח בשעות (0 לכל הזמן)
 * @returns {Promise<Object>} - מדדי המערכת
 */
export const getSystemMetrics = async (period = 24) => {
  try {
    const response = await fetch(`${API_URL}/metrics/system?period=${period}`);
    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('שגיאה בקבלת מדדי מערכת:', error);
    throw error;
  }
};

/**
 * קבלת מדדי סוכן
 * @param {string} agentId - מזהה הסוכן
 * @param {number} period - תקופת הזמן לניתוח בשעות (0 לכל הזמן)
 * @returns {Promise<Object>} - מדדי הסוכן
 */
export const getAgentMetrics = async (agentId, period = 24) => {
  try {
    const response = await fetch(`${API_URL}/metrics/agent/${agentId}?period=${period}`);
    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`שגיאה בקבלת מדדי סוכן ${agentId}:`, error);
    throw error;
  }
};

/**
 * קבלת רשימת סוכנים
 * @returns {Promise<Array>} - רשימת הסוכנים
 */
export const getAgents = async () => {
  try {
    const response = await fetch(`${API_URL}/agents`);
    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('שגיאה בקבלת רשימת סוכנים:', error);
    throw error;
  }
}; 