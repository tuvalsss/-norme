/**
 * שירות לניהול תזרימי עבודה
 */

// קבע את כתובת ה-API
const API_URL = 'http://localhost:3001';

/**
 * קבלת כל תזרימי העבודה
 * @returns {Promise<Array>} - רשימת תזרימי העבודה
 */
export const getWorkflows = async () => {
  try {
    const response = await fetch(`${API_URL}/workflows`);
    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('שגיאה בקבלת תזרימי עבודה:', error);
    throw error;
  }
};

/**
 * קבלת פרטי תזרים עבודה ספציפי
 * @param {string} id - מזהה תזרים העבודה
 * @returns {Promise<Object>} - פרטי תזרים העבודה
 */
export const getWorkflow = async (id) => {
  try {
    const response = await fetch(`${API_URL}/workflows/${id}`);
    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`שגיאה בקבלת תזרים עבודה ${id}:`, error);
    throw error;
  }
};

/**
 * יצירת תזרים עבודה חדש
 * @param {Object} config - תצורת תזרים העבודה
 * @param {string} [id] - מזהה אופציונלי לתזרים העבודה
 * @returns {Promise<Object>} - המזהה של תזרים העבודה החדש
 */
export const createWorkflow = async (config, id = null) => {
  try {
    const response = await fetch(`${API_URL}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        config
      }),
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('שגיאה ביצירת תזרים עבודה:', error);
    throw error;
  }
};

/**
 * הפעלת תזרים עבודה
 * @param {string} id - מזהה תזרים העבודה
 * @param {Object} context - קונטקסט התחלתי
 * @param {Object} options - אפשרויות נוספות להפעלה
 * @returns {Promise<Object>} - מזהה הרצת תזרים העבודה
 */
export const runWorkflow = async (id, context = {}, options = {}) => {
  try {
    const response = await fetch(`${API_URL}/workflows/${id}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context,
        options
      }),
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`שגיאה בהפעלת תזרים עבודה ${id}:`, error);
    throw error;
  }
};

/**
 * קבלת כל תזרימי העבודה הפעילים
 * @returns {Promise<Array>} - רשימת תזרימי העבודה הפעילים
 */
export const getActiveWorkflows = async () => {
  try {
    const response = await fetch(`${API_URL}/workflow-runs`);
    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('שגיאה בקבלת תזרימי עבודה פעילים:', error);
    throw error;
  }
};

/**
 * קבלת סטטוס תזרים עבודה פעיל
 * @param {string} runId - מזהה הרצת תזרים העבודה
 * @returns {Promise<Object>} - סטטוס תזרים העבודה
 */
export const getWorkflowStatus = async (runId) => {
  try {
    const response = await fetch(`${API_URL}/workflow-runs/${runId}`);
    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`שגיאה בקבלת סטטוס תזרים עבודה ${runId}:`, error);
    throw error;
  }
};

/**
 * עצירת תזרים עבודה פעיל
 * @param {string} runId - מזהה הרצת תזרים העבודה
 * @returns {Promise<Object>} - תוצאת העצירה
 */
export const stopWorkflow = async (runId) => {
  try {
    const response = await fetch(`${API_URL}/workflow-runs/${runId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`שגיאה בעצירת תזרים עבודה ${runId}:`, error);
    throw error;
  }
}; 