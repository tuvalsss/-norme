@echo off
title AI Agent System - Control Panel
color 0A
setlocal EnableDelayedExpansion

:MENU
cls
echo ===================================================
echo             AI AGENT SYSTEM CONTROL PANEL
echo ===================================================
echo.
echo  [1] Start All Systems
echo  [2] Stop All Systems
echo  [3] Restart All Systems
echo  [4] View System Status
echo  [5] Check Prerequisites
echo  [6] Exit
echo.
echo ===================================================
set /p choice=Choose an option (1-6): 

if "%choice%"=="1" goto START_ALL
if "%choice%"=="2" goto STOP_ALL
if "%choice%"=="3" goto RESTART_ALL
if "%choice%"=="4" goto VIEW_STATUS
if "%choice%"=="5" goto CHECK_PREREQ
if "%choice%"=="6" goto EXIT

echo Invalid choice, please try again...
timeout /t 2 > nul
goto MENU

:START_ALL
cls
echo ===================================================
echo           STARTING AI AGENT SYSTEM
echo ===================================================
echo.

REM Install required packages only if node_modules doesn't exist or is empty
echo Checking AI-AGENT SERVER packages...
if not exist "%~dp0ai-agent-system\node_modules\" (
    echo Installing packages for AI-AGENT SERVER (this may take a few minutes)...
    cd /d "%~dp0ai-agent-system" && npm install
    cd /d "%~dp0"
    if errorlevel 1 (
        echo ERROR: Failed to install AI-AGENT SERVER packages!
        echo Press any key to return to the main menu...
        pause > nul
        goto MENU
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
        echo Press any key to return to the main menu...
        pause > nul
        goto MENU
    )
) else (
    echo AI-DASHBOARD packages already installed.
)

echo.
echo Package installation complete.
echo.

echo [1/2] Starting AI Agent System Server (port 5001)...
if exist "%~dp0ai-agent-system\server.js" (
    start "AI Agent System Server" cmd /k "cd /d "%~dp0ai-agent-system" && node server.js"
    timeout /t 3 /nobreak > nul
) else (
    echo ERROR: server.js not found in ai-agent-system directory!
    echo Press any key to return to the main menu...
    pause > nul
    goto MENU
)

echo [2/2] Starting Dashboard Server (port 3001)...
if exist "%~dp0ai-dashboard-fixed\server.js" (
    start "AI Dashboard Server" cmd /k "cd /d "%~dp0ai-dashboard-fixed" && node server.js"
    timeout /t 3 /nobreak > nul
) else (
    echo ERROR: server.js not found in ai-dashboard-fixed directory!
    echo Press any key to return to the main menu...
    pause > nul
    goto MENU
)

echo.
echo ===================================================
echo           All systems are running!
echo ===================================================

echo.
echo Opening Dashboard in browser...
start http://localhost:3001

echo.
echo Press any key to return to the main menu...
pause > nul
goto MENU

:STOP_ALL
cls
echo ===================================================
echo           SHUTTING DOWN AI AGENT SYSTEM
echo ===================================================
echo.

echo Stopping AI Agent System Server...
taskkill /F /FI "WINDOWTITLE eq AI Agent System Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI-AGENT SERVER" > nul 2>&1
if errorlevel 0 (
    echo AI Agent System Server stopped successfully.
) else (
    echo AI Agent System Server was not running or already stopped.
)

echo Stopping AI Dashboard Server...
taskkill /F /FI "WINDOWTITLE eq AI Dashboard Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI-DASHBOARD" > nul 2>&1
if errorlevel 0 (
    echo AI Dashboard Server stopped successfully.
) else (
    echo AI Dashboard Server was not running or already stopped.
)

echo.
echo ===================================================
echo      All systems stopped successfully!
echo ===================================================

echo.
echo Press any key to return to the main menu...
pause > nul
goto MENU

:RESTART_ALL
cls
echo ===================================================
echo           RESTARTING AI AGENT SYSTEM
echo ===================================================
echo.

echo [1/3] Stopping all services...
call :STOP_ALL_SILENT

echo [2/3] Waiting for services to stop...
timeout /t 5 /nobreak > nul

echo [3/3] Starting all services...
call :START_ALL_SILENT

echo.
echo ===================================================
echo      System restarted successfully!
echo ===================================================

echo.
echo Press any key to return to the main menu...
pause > nul
goto MENU

:VIEW_STATUS
cls
echo ===================================================
echo                 SYSTEM STATUS
echo ===================================================
echo.

echo Checking AI Agent Server status...
tasklist /FI "WINDOWTITLE eq AI Agent System Server" | findstr "cmd.exe" > nul
if errorlevel 1 (
    tasklist /FI "WINDOWTITLE eq AI-AGENT SERVER" | findstr "cmd.exe" > nul
    if errorlevel 1 (
        echo AI Agent Server: STOPPED [OFFLINE]
    ) else (
        echo AI Agent Server: RUNNING [OK]
    )
) else (
    echo AI Agent Server: RUNNING [OK]
)

echo.
echo Checking Dashboard Server status...
tasklist /FI "WINDOWTITLE eq AI Dashboard Server" | findstr "cmd.exe" > nul
if errorlevel 1 (
    tasklist /FI "WINDOWTITLE eq AI-DASHBOARD" | findstr "cmd.exe" > nul
    if errorlevel 1 (
        echo Dashboard Server: STOPPED [OFFLINE]
    ) else (
        echo Dashboard Server: RUNNING [OK]
    )
) else (
    echo Dashboard Server: RUNNING [OK]
)

echo.
echo Checking if node_modules are installed...
if exist "%~dp0ai-agent-system\node_modules\" (
    echo AI Agent Server Packages: INSTALLED [OK]
) else (
    echo AI Agent Server Packages: MISSING [!]
)

if exist "%~dp0ai-dashboard-fixed\node_modules\" (
    echo Dashboard Server Packages: INSTALLED [OK]
) else (
    echo Dashboard Server Packages: MISSING [!]
)

echo.
echo ===================================================
echo.
echo Press any key to return to the main menu...
pause > nul
goto MENU

:CHECK_PREREQ
cls
echo ===================================================
echo             CHECKING PREREQUISITES
echo ===================================================
echo.

REM Check for Node.js
echo Checking for Node.js...
node --version > nul 2>&1
if errorlevel 1 (
    echo Node.js: NOT FOUND [!]
    echo Please install Node.js from https://nodejs.org/
) else (
    echo Node.js: INSTALLED [OK]
    for /f "tokens=*" %%n in ('node --version') do echo Version: %%n
)

echo.
echo Checking for server files...
if exist "%~dp0ai-agent-system\server.js" (
    echo AI Agent Server: FOUND [OK]
) else (
    echo AI Agent Server: MISSING [!]
)

if exist "%~dp0ai-dashboard-fixed\server.js" (
    echo Dashboard Server: FOUND [OK]
) else (
    echo Dashboard Server: MISSING [!]
)

echo.
echo ===================================================
echo.
echo Press any key to return to the main menu...
pause > nul
goto MENU

:STOP_ALL_SILENT
taskkill /F /FI "WINDOWTITLE eq AI Agent System Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI-AGENT SERVER" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI Dashboard Server" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AI-DASHBOARD" > nul 2>&1
exit /b

:START_ALL_SILENT
if exist "%~dp0ai-agent-system\server.js" (
    start "AI Agent System Server" cmd /k "cd /d "%~dp0ai-agent-system" && node server.js"
    timeout /t 3 /nobreak > nul
)
if exist "%~dp0ai-dashboard-fixed\server.js" (
    start "AI Dashboard Server" cmd /k "cd /d "%~dp0ai-dashboard-fixed" && node server.js"
    timeout /t 3 /nobreak > nul
)
start http://localhost:3001
exit /b

:EXIT
cls
echo.
echo ===================================================
echo             Exiting Control Panel...
echo ===================================================
timeout /t 2 > nul
exit 