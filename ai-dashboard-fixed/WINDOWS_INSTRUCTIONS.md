# הוראות הפעלה מיוחדות ל-Windows PowerShell

## הקדמה

מסמך זה מכיל הוראות מיוחדות להפעלת מערכת AI Agents Dashboard בסביבת Windows עם PowerShell. בשל מגבלות מסוימות ב-PowerShell, יש מספר שינויים בהוראות ההפעלה הרגילות.

## התקנה

```powershell
# התקנת חבילות נדרשות למערכת הסוכנים
cd ai-agent-system
npm install

# חזרה לתיקיית האב
cd ..

# התקנת חבילות נדרשות לדאשבורד
cd ai-dashboard-fixed
npm install

# חזרה לתיקיית האב
cd ..
```

## הפעלת המערכת

### 1. הפעלת שרת הסוכנים

פתח חלון PowerShell חדש וכתוב:

```powershell
cd ai-agent-system
node server.js
```

### 2. הפעלת שרת הדאשבורד

פתח חלון PowerShell נוסף וכתוב:

```powershell
cd ai-dashboard-fixed
node server.js
```

### 3. הפעלת ממשק המשתמש

פתח חלון PowerShell נוסף וכתוב:

```powershell
cd ai-dashboard-fixed
npm run start
```

## הפעלת תזרימי עבודה

בעת יצירת תזרימי עבודה דרך ה-API, יש להשתמש בשיטה שונה מאשר הוראות לינוקס/מק:

```powershell
# יצירת תזרים עבודה מקובץ JSON
$content = Get-Content -Path "feature_workflow.json" -Raw
Invoke-RestMethod -Uri "http://localhost:3001/workflows" -Method Post -ContentType "application/json" -Body $content
```

## קיצורי דרך להפעלה

ניתן להשתמש בקבצי ההפעלה הבאים (מצורפים למערכת):

1. `start.bat` - הפעלת כל חלקי המערכת
2. `stop.bat` - עצירת כל חלקי המערכת
3. `cleanup.bat` - ניקוי נתונים זמניים

## הפעלה אוטומטית

ליצירת עבודה מתוזמנת ב-Windows:

1. פתח את Task Scheduler
2. צור משימה חדשה
3. בחר את קובץ ה-bat שברצונך להפעיל
4. קבע את הזמן והתדירות
5. שמור את המשימה

## שימוש בסקריפטים חלופיים

ניתן גם להשתמש בסקריפטי PowerShell המצורפים:

- `start.ps1` - הפעלת המערכת
- `stop.ps1` - עצירת המערכת

להפעלה, יש לכתוב:

```powershell
powershell -ExecutionPolicy Bypass -File start.ps1
```

## שימוש בפקודת curl ב-PowerShell

ב-PowerShell, פקודת `curl` היא למעשה קיצור דרך ל-`Invoke-WebRequest`. כדי להשתמש בפקודת curl המקורית, יש לכתוב `curl.exe`:

```powershell
# במקום
curl -X POST -H "Content-Type: application/json" -d @feature_workflow.json http://localhost:3001/workflows

# יש לכתוב
curl.exe -X POST -H "Content-Type: application/json" -d @feature_workflow.json http://localhost:3001/workflows

# או לחילופין להשתמש בפקודה הייעודית של PowerShell
Invoke-RestMethod -Uri "http://localhost:3001/workflows" -Method Post -ContentType "application/json" -Body (Get-Content -Path "feature_workflow.json" -Raw)
```

## פתרון בעיות נפוצות ב-Windows

### שגיאת הרשאות

אם מופיעה שגיאת הרשאות, נסה להפעיל את PowerShell כמנהל:
- לחץ קליק ימני על קיצור דרך של PowerShell
- בחר "הפעל כמנהל" (Run as Administrator)

### שגיאת ExecutionPolicy

אם מופיעה שגיאה בנוגע למדיניות הרצת סקריפטים, הפעל את הפקודה הבאה:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### שגיאת תפוס פורט

אם הפורט 3000 או 3001 תפוסים, אפשר לשנות את הפורט בקובץ התצורה:
1. פתח את קובץ `config.json` בכל אחד מהפרויקטים
2. שנה את ערך ה-`port` לפורט פנוי אחר
3. עדכן את כתובת ה-API בהתאם בקובץ `ai-dashboard-fixed/src/api/base.js` 