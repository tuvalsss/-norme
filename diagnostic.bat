@echo off
title AI Agent System - Diagnostic Tool
color 0E
setlocal EnableDelayedExpansion

echo ===================================================
echo             AI AGENT SYSTEM DIAGNOSTICS
echo ===================================================
echo.

REM Check for Node.js installation
echo Checking for Node.js...
node --version > nul 2>&1
if %errorlevel% equ 0 (
    echo [√] Node.js installed successfully
    for /f "tokens=*" %%n in ('node --version') do echo    Version: %%n
) else (
    echo [X] Node.js not installed - Install from https://nodejs.org/
    echo    The system will not work without Node.js
)

echo.
echo Checking for NPM...
npm --version > nul 2>&1
if %errorlevel% equ 0 (
    echo [√] NPM installed successfully
    for /f "tokens=*" %%n in ('npm --version') do echo    Version: %%n
) else (
    echo [X] NPM not installed - Reinstall Node.js
)

echo.
echo Checking for required directories...
if exist "%~dp0ai-agent-system\" (
    echo [√] ai-agent-system directory exists
) else (
    echo [X] ai-agent-system directory is missing
)

if exist "%~dp0ai-dashboard-fixed\" (
    echo [√] ai-dashboard-fixed directory exists
) else (
    echo [X] ai-dashboard-fixed directory is missing
)

echo.
echo Checking for server files...
if exist "%~dp0ai-agent-system\server.js" (
    echo [√] server.js file exists in ai-agent-system directory
) else (
    echo [X] server.js file is missing in ai-agent-system directory
)

if exist "%~dp0ai-dashboard-fixed\server.js" (
    echo [√] server.js file exists in ai-dashboard-fixed directory
) else (
    echo [X] server.js file is missing in ai-dashboard-fixed directory
)

echo.
echo Checking for package.json files...
if exist "%~dp0ai-agent-system\package.json" (
    echo [√] package.json file exists in ai-agent-system directory
) else (
    echo [X] package.json file is missing in ai-agent-system directory
)

if exist "%~dp0ai-dashboard-fixed\package.json" (
    echo [√] package.json file exists in ai-dashboard-fixed directory
) else (
    echo [X] package.json file is missing in ai-dashboard-fixed directory
)

echo.
echo Checking for node_modules...
if exist "%~dp0ai-agent-system\node_modules\" (
    echo [√] Packages installed in ai-agent-system directory
) else (
    echo [X] Packages missing in ai-agent-system directory - Run npm install
)

if exist "%~dp0ai-dashboard-fixed\node_modules\" (
    echo [√] Packages installed in ai-dashboard-fixed directory
) else (
    echo [X] Packages missing in ai-dashboard-fixed directory - Run npm install
)

echo.
echo Checking port availability...
netstat -ano | findstr ":5001" > nul
if %errorlevel% equ 0 (
    echo [!] Port 5001 is already in use - Server may already be running or another process is using this port
) else (
    echo [√] Port 5001 is available
)

netstat -ano | findstr ":3001" > nul
if %errorlevel% equ 0 (
    echo [!] Port 3001 is already in use - Dashboard may already be running or another process is using this port
) else (
    echo [√] Port 3001 is available
)

echo.
echo ===================================================
echo         System Diagnostic Summary
echo ===================================================

REM Check overall system readiness
set READY=1
node --version > nul 2>&1 || set READY=0
if not exist "%~dp0ai-agent-system\server.js" set READY=0
if not exist "%~dp0ai-dashboard-fixed\server.js" set READY=0

if %READY% equ 1 (
    echo The system is ready to run! If you still have problems:
    echo 1. Make sure no other Node.js processes are running (close them via Task Manager)
    echo 2. Try using manager.bat to start the system from there
    echo 3. Check for errors in the console windows that open
) else (
    echo [X] The system is not ready to run - Fix the issues mentioned above
)

echo.
echo ===================================================
echo.
echo Press any key to exit...
pause > nul 