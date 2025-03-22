@echo off
title AI-SYSTEM LAUNCHER
setlocal

REM ===== Start Agent System and Management Interface =====
echo ==================================
echo STARTING ENORME AI AGENT SYSTEM
echo ==================================
echo.

REM Check if server.js file exists in ai-agent-system directory
if not exist "ai-agent-system\server.js" (
    echo ERROR: server.js not found in ai-agent-system directory!
    goto :ERROR
)

echo Starting Agent Server on port 5001...
start "AI-AGENT SERVER" cmd /k "cd /d "%~dp0ai-agent-system" && node server.js"

REM Wait 5 seconds to ensure the first server starts before the second
timeout /t 5 /nobreak > nul

REM Check if server.js file exists in ai-dashboard-fixed directory
if not exist "ai-dashboard-fixed\server.js" (
    echo ERROR: server.js not found in ai-dashboard-fixed directory!
    goto :ERROR
)

echo Starting Dashboard Server on port 3001...
start "AI-DASHBOARD" cmd /k "cd /d "%~dp0ai-dashboard-fixed" && node server.js"

REM Wait 10 seconds before opening the browser
timeout /t 10 /nobreak > nul
echo Opening Dashboard in browser...
start http://localhost:3001

echo.
echo ==================================
echo System started successfully!
echo ==================================
echo.
echo Agent server running on port 5001
echo Management interface running on port 3001
echo.
echo To close the system, run stop_system.bat or close all CMD windows
echo.
echo Press any key to exit this window (servers will keep running)...
pause > nul
goto :EOF

:ERROR
echo.
echo ==================================
echo Failed to start the system!
echo ==================================
echo Please check the error messages above.
echo.
pause
exit /b 1 