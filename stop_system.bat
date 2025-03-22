@echo off
title AI SYSTEM SHUTDOWN

echo ============================
echo STOPPING AI AGENT SYSTEM
echo ============================
echo.

REM Kill only the Node.js processes related to our system
echo Stopping AI-AGENT SERVER...
taskkill /FI "WINDOWTITLE eq AI-AGENT SERVER" /F > nul 2>&1
taskkill /FI "WINDOWTITLE eq AI Agent System Server" /F > nul 2>&1
if %errorlevel% equ 0 (
    echo AI-AGENT SERVER stopped successfully.
) else (
    echo AI-AGENT SERVER was not running or already stopped.
)

echo Stopping AI-DASHBOARD...
taskkill /FI "WINDOWTITLE eq AI-DASHBOARD" /F > nul 2>&1
taskkill /FI "WINDOWTITLE eq AI Dashboard Server" /F > nul 2>&1
if %errorlevel% equ 0 (
    echo AI-DASHBOARD stopped successfully.
) else (
    echo AI-DASHBOARD was not running or already stopped.
)

echo.
echo System shutdown complete
echo.
echo Press any key to exit...
pause > nul 