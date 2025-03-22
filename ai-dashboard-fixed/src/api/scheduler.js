/**
 * שירות לניהול סוכן התזמון
 */

// קבע את כתובת ה-API
const API_URL = 'http://localhost:3001';

/**
 * מקבל את כל המשימות המתוזמנות של סוכן מסוים
 * @param {string} agentId - מזהה הסוכן
 * @returns {Promise<Array>} - רשימת המשימות המתוזמנות
 */
export const getScheduledTasksForAgent = async (agentId) => {
  try {
    const response = await fetch(`${API_URL}/scheduler/tasks/${agentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('שגיאה בקבלת משימות מתוזמנות:', error);
    throw error;
  }
};

/**
 * יוצר משימה מתוזמנת חדשה
 * @param {string} agentId - מזהה הסוכן
 * @param {string} name - שם המשימה
 * @param {string} cronExpression - ביטוי CRON לתזמון
 * @param {string} action - הפעולה שיש לבצע (run/stop/custom)
 * @param {object} params - פרמטרים נוספים לפעולה
 * @returns {Promise<object>} - מידע על המשימה שנוצרה
 */
export const createScheduledTask = async (agentId, name, cronExpression, action, params = {}) => {
  try {
    const response = await fetch(`${API_URL}/scheduler/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId,
        name,
        cronExpression,
        action,
        params
      }),
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('שגיאה ביצירת משימה מתוזמנת:', error);
    throw error;
  }
};

/**
 * מוחק משימה מתוזמנת
 * @param {string} taskId - מזהה המשימה
 * @returns {Promise<object>} - תוצאת המחיקה
 */
export const deleteScheduledTask = async (taskId) => {
  try {
    const response = await fetch(`${API_URL}/scheduler/delete/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`שגיאת שרת: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('שגיאה במחיקת משימה מתוזמנת:', error);
    throw error;
  }
}; 