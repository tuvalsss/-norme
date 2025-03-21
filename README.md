# AI Agent System

מערכת סוכני AI חכמה לאוטומציה של תהליכי פיתוח תוכנה

## סקירת המערכת

מערכת AI Agent מורכבת ממספר רכיבים:

- **שרת מערכת הסוכנים**: שרת ליבה המטפל בתיאום הסוכנים וניהול משימות
- **שרת לוח בקרה**: שרת ה-backend לממשק המשתמש המבוסס דפדפן
- **לקוח לוח בקרה**: ממשק משתמש לניטור ושליטה בסוכנים

## הפעלה מהירה

### אפשרות 1: הפעלה עם קובץ BAT (מומלץ ל-Windows)
```
start.bat
```

### אפשרות 2: הפעלה עם PowerShell
```
start_powershell.cmd
```
פקודה זו תריץ את סקריפט PowerShell עם הרשאות הריצה הנכונות.

### אפשרות 3: פאנל שליטה אינטראקטיבי
```
manager.bat
```

## סוכני המערכת

המערכת כוללת מספר סוכנים מתמחים:

- **סוכן פיתוח (DEV)**: מסייע במשימות פיתוח תוכנה
- **סוכן בדיקות (QA)**: מבצע בדיקות איכות ובדיקות תוכנה
- **סוכן הרצה (Executor)**: מריץ פקודות וסקריפטים
- **סוכן סיכום (Summary)**: מייצר סיכומים ודוחות, מנתח פעילות ומדווח על בעיות
- **סוכן סנכרון Git**: מבצע פעולות סנכרון מול מאגרי קוד
- **סוכן תזמון (Scheduler)**: מתזמן פעולות של סוכנים אחרים

## שיפורים עיקריים בגרסה האחרונה

- **איחוד מודולי סיכום**: איחוד והרחבה של סוכן הסיכום לקובץ מקיף אחד
- **שיפור תמיכה במודלי LLM**: תמיכה ב-GPT-4 ו-Claude 3.7
- **מערכת דיווח בעיות משופרת**: יכולת לאתר ולדווח על בעיות בזמן אמת
- **ממשק משתמש משופר**: לוח בקרה עם יכולות מורחבות לניהול פרויקטים וסוכנים

## דרישות מערכת

- Node.js v14 ומעלה
- מערכת הפעלה Windows (לקבצי BAT) או PowerShell 5.0+
- דפדפן אינטרנט מודרני

## תצורה

הגדרות פרויקטים ואזור העבודה נשמרות בקבצים הבאים:
- `ai-dashboard-fixed/projects.json`: רשימת הפרויקטים הזמינים
- `ai-dashboard-fixed/workspace.json`: הפרויקט הפעיל כרגע

## הפעלה אוטומטית של סוכנים

להפעלה אוטומטית של סוכנים:
1. בקובץ `ai-agent-system/.env`, וודא שמוגדר:
   ```
   SCHEDULER_AUTO_INIT=true
   ```
2. בחר פרויקט פעיל דרך לוח הבקרה
3. הסוכנים יהיו מוכנים להפעלה

## פתרון בעיות

### בעיות PowerShell
אם בשימוש ב-PowerShell מופיעה שגיאה:
```
&& : The token '&&' is not a valid statement separator in this version.
```
השתמש באחד מהפתרונות הבאים:
1. השתמש בקבצי ה-`.cmd` המצורפים שמטפלים בזה אוטומטית
2. הרץ פקודות בנפרד (קודם `cd` ואז הפקודה)
3. השתמש בנקודה-פסיק (`;`) במקום `&&` ב-PowerShell

### בעיות בהפעלת סוכנים
אם הסוכנים לא מתחילים:
1. וודא שקבצי ה-BAT של הסוכנים קיימים ב-`ai-dashboard-fixed/agents/`
2. בדוק את יומני הקונסול להודעות שגיאה ספציפיות
3. נסה להפעיל מחדש את כל המערכת

### בעיות אחרות
1. וודא שכל חבילות Node.js הנדרשות מותקנות:
   ```
   cd ai-agent-system && npm install
   cd ai-dashboard-fixed && npm install
   ```

2. בדוק את קבצי הלוג ב:
   - `ai-agent-system/logs/`
   - `ai-dashboard-fixed/logs/`

3. הפעל מחדש את המערכת באמצעות:
   ```
   stop.bat
   start.bat
   ```

## כיבוי

לעצירת כל רכיבי המערכת:
```
stop.bat
```
או באמצעות PowerShell:
```
stop_powershell.cmd
```
