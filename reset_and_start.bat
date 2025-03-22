@echo off
title AI-SYSTEM RESET AND START
SETLOCAL EnableDelayedExpansion

REM ===== Reset and Start Agent System =====
echo ==================================
echo RESETTING AND STARTING AI AGENT SYSTEM
echo ==================================
echo.

REM Set the correct working directory - absolute path to botSys
set "BOTSYS_PATH=C:\Users\tuval\botSys"

REM Kill any running processes
echo Stopping any running processes...
taskkill /F /FI "WINDOWTITLE eq AI-AGENT SERVER" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI Agent System Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI-DASHBOARD" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI Dashboard Server" > nul 2>&1
timeout /t 2 /nobreak > nul

REM Change to the correct directory
cd /d "%BOTSYS_PATH%"

REM Create WORKSPACE directory if it doesn't exist
if not exist "%BOTSYS_PATH%\ai-dashboard-fixed\WORKSPACE\" (
    echo Creating WORKSPACE directory...
    mkdir "%BOTSYS_PATH%\ai-dashboard-fixed\WORKSPACE"
)

REM Create demo project structure in agent system projects
if not exist "%BOTSYS_PATH%\ai-agent-system\projects\123\" (
    echo Creating demo project structure...
    mkdir "%BOTSYS_PATH%\ai-agent-system\projects\123\src"
    echo // Demo file > "%BOTSYS_PATH%\ai-agent-system\projects\123\src\demo.js"
)

REM Create demo project structure in dashboard projects
if not exist "%BOTSYS_PATH%\ai-dashboard-fixed\projects\123\" (
    echo Creating dashboard demo project structure...
    mkdir "%BOTSYS_PATH%\ai-dashboard-fixed\projects\123\src"
    echo // Demo file > "%BOTSYS_PATH%\ai-dashboard-fixed\projects\123\src\demo.js"
)

REM Create workspace.json if it doesn't exist
if not exist "%BOTSYS_PATH%\ai-dashboard-fixed\workspace.json" (
    echo Creating workspace.json...
    echo {"workspaceId":"enorme_ai"} > "%BOTSYS_PATH%\ai-dashboard-fixed\workspace.json"
)

REM Create projects.json if it doesn't exist
if not exist "%BOTSYS_PATH%\ai-dashboard-fixed\projects.json" (
    echo Creating projects.json...
    echo {"projects":[{"id":"123","name":"Demo Project","description":"A demo project for testing"}]} > "%BOTSYS_PATH%\ai-dashboard-fixed\projects.json"
)

REM Install required packages only if node_modules doesn't exist or is empty
echo Checking node modules...

if not exist "%BOTSYS_PATH%\ai-dashboard-fixed\node_modules\" (
    echo Installing dashboard dependencies...
    cd /d "%BOTSYS_PATH%\ai-dashboard-fixed"
    call npm install --no-fund --no-audit
) else (
    echo Dashboard dependencies already installed.
)

if not exist "%BOTSYS_PATH%\ai-agent-system\node_modules\" (
    echo Installing agent system dependencies...
    cd /d "%BOTSYS_PATH%\ai-agent-system"
    call npm install --no-fund --no-audit
) else (
    echo Agent system dependencies already installed.
)

REM Reset log files
echo Resetting log files...
if exist "%BOTSYS_PATH%\ai-dashboard-fixed\logs\" (
    del /F /Q "%BOTSYS_PATH%\ai-dashboard-fixed\logs\*.*"
) else (
    mkdir "%BOTSYS_PATH%\ai-dashboard-fixed\logs"
)

if exist "%BOTSYS_PATH%\ai-agent-system\logs\" (
    del /F /Q "%BOTSYS_PATH%\ai-agent-system\logs\*.*"
) else (
    mkdir "%BOTSYS_PATH%\ai-agent-system\logs"
)

echo.
echo ====================================
echo System reset complete! Starting now...
echo ====================================
echo.

REM Start the system after reset
cd /d "%BOTSYS_PATH%"
call "%BOTSYS_PATH%\start_system.bat"

exit /b 0

:ERROR
echo.
echo ==================================
echo Failed to reset and start the system!
echo ==================================
echo Please check the error messages above.
echo.
pause
exit /b 1 