@echo off
title AI Agent System - Cleanup
color 0E
echo ===================================================
echo           CLEANING UP OLD SYSTEM FILES
echo ===================================================
echo.

echo Removing old BAT files...
if exist start_all.bat del /f /q start_all.bat
if exist start_all_new.bat del /f /q start_all_new.bat
if exist start_all_fixed.bat del /f /q start_all_fixed.bat
if exist start_interactive.bat del /f /q start_interactive.bat
if exist start_interactive_fixed.bat del /f /q start_interactive_fixed.bat
if exist stop_all.bat del /f /q stop_all.bat
echo.

echo Removing old PowerShell files...
if exist start_powershell.ps1 del /f /q start_powershell.ps1
if exist start_interactive.ps1 del /f /q start_interactive.ps1
echo.

echo Removing old Hebrew documentation...
if exist ai-dashboard-fixed/README_HEBREW.md del /f /q ai-dashboard-fixed\README_HEBREW.md
if exist operating_instructions.txt del /f /q operating_instructions.txt
echo.

echo ===================================================
echo      Cleanup completed successfully!
echo      New files to use:
echo        - start_system.bat (simple startup)
echo        - stop_system.bat (simple shutdown)
echo        - manager.bat (interactive management console)
echo        - quick_start.bat (quick startup)
echo ===================================================

timeout /t 5 /nobreak > nul
exit 