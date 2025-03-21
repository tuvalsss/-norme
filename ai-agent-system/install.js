#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// פונקציה ליצירת תיקייה אם היא לא קיימת
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`יוצר תיקייה: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

// פונקציה להעתקת קובץ אם הוא לא קיים
function copyFileIfNotExists(source, target) {
  if (!fs.existsSync(target) && fs.existsSync(source)) {
    console.log(`מעתיק קובץ: ${source} ל-${target}`);
    fs.copyFileSync(source, target);
    return true;
  }
  return false;
}

// הגדר את תיקיות התשתית
const requiredDirs = [
  './logs',
  './workspace',
  './logs/dev_agent',
  './logs/qa_agent',
  './logs/executor_agent',
  './logs/summary_agent'
];

// צור את כל התיקיות הנדרשות
console.log('יוצר את המבנה הבסיסי של המערכת...');
let dirsCreated = 0;
requiredDirs.forEach(dir => {
  if (ensureDirectoryExists(path.join(__dirname, dir))) {
    dirsCreated++;
  }
});
console.log(`${dirsCreated} תיקיות נוצרו, ${requiredDirs.length - dirsCreated} תיקיות כבר קיימות.`);

// העתק קובץ .env אם הוא לא קיים
const envSource = path.join(__dirname, '.env.example');
const envTarget = path.join(__dirname, '.env');
if (copyFileIfNotExists(envSource, envTarget)) {
  console.log('.env הועתק מהדוגמא. אנא ערוך אותו כדי להתאים להגדרות הסביבה שלך.');
} else if (!fs.existsSync(envTarget)) {
  console.error('קובץ .env.example לא נמצא! אנא צור קובץ .env ידנית.');
} else {
  console.log('קובץ .env קיים כבר.');
}

// התקן תלויות
console.log('מתקין תלויות npm...');
try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  console.log('התקנת התלויות הושלמה בהצלחה!');
} catch (error) {
  console.error('שגיאה בהתקנת התלויות:', error.message);
}

console.log(`
============================================================
           התקנת מערכת סוכני ה-AI הושלמה!
============================================================

כדי להפעיל את המערכת:
1. ערוך את קובץ .env להגדרות המתאימות
2. הפעל את השרת עם הפקודה: npm start
   או בסביבת פיתוח: npm run dev

פרטים נוספים ב-README.md
============================================================
`); 