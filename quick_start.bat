@echo off
echo Quick start of AI Agent system...
echo.

REM Set the correct working directory - absolute path to botSys
set "BOTSYS_PATH=C:\Users\tuval\botSys"

REM Start the main file
cd /d "%BOTSYS_PATH%"
call "%BOTSYS_PATH%\start_system.bat" 