@echo off
title AI-SYSTEM RESET AND START
SETLOCAL EnableDelayedExpansion

REM ===== Reset and Start Agent System =====
echo ==================================
echo RESETTING AND STARTING AI AGENT SYSTEM
echo ==================================
echo.

REM Kill any running processes
echo Stopping any running processes...
taskkill /F /FI "WINDOWTITLE eq AI-AGENT SERVER" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI Agent System Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI-DASHBOARD" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI Dashboard Server" > nul 2>&1
timeout /t 2 /nobreak > nul

REM Ensure we're in the correct directory
cd /d "%~dp0"

REM Create WORKSPACE directory if it doesn't exist
if not exist "%~dp0ai-dashboard-fixed\WORKSPACE\" (
    echo Creating WORKSPACE directory...
    mkdir "%~dp0ai-dashboard-fixed\WORKSPACE"
)

REM Create demo project structure in agent system projects
if not exist "%~dp0ai-agent-system\projects\123\" (
    echo Creating demo project structure...
    mkdir "%~dp0ai-agent-system\projects\123\src"
    echo // Demo file > "%~dp0ai-agent-system\projects\123\src\demo.js"
)

REM Fix workspace.json with proper content
echo Fixing workspace.json...
echo {"path": "./WORKSPACE"} > "%~dp0ai-dashboard-fixed\workspace.json"

REM Fix projects.json with a demo project
echo Fixing projects.json...
echo [{"id": "123", "name": "Initial Project", "description": "Project for system testing", "path": "123", "status": "active", "created": "2024-03-21T12:00:00.000Z", "updated": "2024-03-21T12:00:00.000Z", "agents": ["dev_agent", "qa_agent", "executor_agent", "summary_agent"]}] > "%~dp0ai-dashboard-fixed\projects.json"

REM Install required packages only if node_modules doesn't exist or is empty
echo Checking AI-AGENT SERVER packages...
if not exist "%~dp0ai-agent-system\node_modules\" (
    echo Installing packages for AI-AGENT SERVER (this may take a few minutes)...
    cd /d "%~dp0ai-agent-system" && npm install
    cd /d "%~dp0"
    if errorlevel 1 (
        echo ERROR: Failed to install AI-AGENT SERVER packages!
        goto :ERROR
    )
) else (
    echo AI-AGENT SERVER packages already installed.
)

REM Check for dashboard packages
echo Checking AI-DASHBOARD packages...
if not exist "%~dp0ai-dashboard-fixed\node_modules\" (
    echo Installing packages for AI-DASHBOARD (this may take a few minutes)...
    cd /d "%~dp0ai-dashboard-fixed" && npm install
    cd /d "%~dp0"
    if errorlevel 1 (
        echo ERROR: Failed to install AI-DASHBOARD packages!
        goto :ERROR
    )
) else (
    echo AI-DASHBOARD packages already installed.
)

echo.
echo Package installation and reset complete.
echo.

REM Check if server.js file exists in ai-agent-system directory
if not exist "%~dp0ai-agent-system\server.js" (
    echo ERROR: server.js not found in ai-agent-system directory!
    goto :ERROR
)

echo Starting Agent Server on port 5001...
REM Start with "cmd /k" instead of "cmd /c" so the window stays open
start "AI-AGENT SERVER" cmd /k "cd /d "%~dp0ai-agent-system" && node server.js"

REM Wait 5 seconds to ensure the first server starts before the second
timeout /t 5 /nobreak > nul

REM Check if server.js file exists in ai-dashboard-fixed directory
if not exist "%~dp0ai-dashboard-fixed\server.js" (
    echo ERROR: server.js not found in ai-dashboard-fixed directory!
    goto :ERROR
)

echo Starting Dashboard Server on port 3001...
REM Start with "cmd /k" instead of "cmd /c" so the window stays open
start "AI-DASHBOARD" cmd /k "cd /d "%~dp0ai-dashboard-fixed" && node server.js"

REM Wait 10 seconds before opening the browser - longer time for full initialization
timeout /t 10 /nobreak > nul
echo Opening Dashboard in browser...
start http://localhost:3001

echo.
echo ==================================
echo System reset and started successfully!
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