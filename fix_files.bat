@echo off
title AI-SYSTEM FIX FILES
setlocal

echo ==================================
echo FIXING SYSTEM FILES
echo ==================================
echo.

REM Create WORKSPACE directory if it doesn't exist
if not exist "ai-dashboard-fixed\WORKSPACE\" (
    echo Creating WORKSPACE directory...
    mkdir "ai-dashboard-fixed\WORKSPACE"
)

REM Create demo project structure in agent system projects
if not exist "ai-agent-system\projects\123\" (
    echo Creating demo project structure...
    mkdir "ai-agent-system\projects\123\src"
    echo // Demo file > "ai-agent-system\projects\123\src\demo.js"
)

REM Fix workspace.json
echo Fixing workspace.json...
echo {"path": "./WORKSPACE"} > "ai-dashboard-fixed\workspace.json"

REM Fix projects.json
echo Fixing projects.json...
echo [] > "ai-dashboard-fixed\projects.json"

REM Now append the project to projects.json
echo Adding project to projects.json...
type "ai-dashboard-fixed\projects.json" | findstr "[" > nul
if %errorlevel% equ 0 (
    echo Appending project...
    powershell -Command "(Get-Content 'ai-dashboard-fixed\projects.json') -replace '\[\]', '[{\"id\": \"123\", \"name\": \"Demo Project\", \"description\": \"Project for testing the system\", \"path\": \"123\", \"status\": \"active\", \"created\": \"2024-03-21T12:00:00.000Z\", \"updated\": \"2024-03-21T12:00:00.000Z\", \"agents\": [\"dev_agent\", \"qa_agent\", \"executor_agent\", \"summary_agent\"]}]' | Set-Content 'ai-dashboard-fixed\projects.json'"
)

echo.
echo ==================================
echo Files fixed successfully
echo ==================================
echo.
echo Press any key to continue...
pause > nul 