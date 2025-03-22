@echo off
echo ==============================================================
echo           DEV_AGENT - AI AGENT SYSTEM
echo ==============================================================
echo Agent Starting...
echo.

REM Check if the central server is available
curl -s --connect-timeout 3 --max-time 5 --head http://localhost:5001/status > nul 2>&1
if %errorlevel% neq 0 (
  echo [31mError: Cannot connect to the central server at http://localhost:5001[0m
  echo Checking if the server is active...
  tasklist /FI "IMAGENAME eq node.exe" | find "node.exe" > nul
  if %errorlevel% neq 0 (
    echo [31mSystem server is not active. Try running start.bat[0m
  ) else (
    echo [33mSystem server appears to be active, but not responding. You may need to restart it.[0m
  )
  echo.
  echo Waiting for the issue to be fixed... Press CTRL+C to exit
  timeout /t 10
  goto :retry
)

:start_agent
REM Running the actual agent through the API
echo [36mStarting the agent...[0m
curl -s -X POST http://localhost:5001/run-agent -H "Content-Type: application/json" -d "{\"agent\":\"dev_agent\"}" > response.tmp
type response.tmp | findstr /i "success" > nul
if %errorlevel% neq 0 (
  echo [31mError starting the agent. Server response:[0m
  type response.tmp
  echo.
  del response.tmp
  echo [33mTrying again in 5 seconds...[0m
  timeout /t 5
  goto start_agent
)
del response.tmp

echo.
echo [32mRequest to start dev_agent was sent successfully via API (port 5001)[0m
echo.
echo [36mThis window will remain open as long as the agent is active.[0m
echo [36mClosing this window will shut down the agent.[0m
echo.
echo [32mStatus: Active[0m
title dev_agent [Active]
echo.

REM Periodic check that the agent is still active
:check_status
REM Wait 30 seconds
timeout /t 30 > nul
REM Check that the agent is still active
curl -s --connect-timeout 3 --max-time 5 http://localhost:5001/agent-status/dev_agent > status.tmp
type status.tmp | findstr /i "true" > nul
if %errorlevel% neq 0 (
  echo [33mThe agent is not reporting as active. Trying to restart...[0m
  goto start_agent
)
del status.tmp
goto check_status

:retry
REM Rechecking server availability
curl -s --connect-timeout 3 --max-time 5 --head http://localhost:5001/status > nul 2>&1
if %errorlevel% equ 0 (
  echo [32mConnection to server established successfully, starting the agent...[0m
  goto start_agent
) else (
  echo [33mStill unable to connect to the server. Continuing to try...[0m
  timeout /t 5
  goto retry
)

:exit
REM When the window is closed, shut down the agent
curl -s -X POST http://localhost:5001/stop-agent -H "Content-Type: application/json" -d "{\"agent\":\"dev_agent\"}" > nul 2>&1
