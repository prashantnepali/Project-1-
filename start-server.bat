@echo off
title Samparka Server
cd /d "%~dp0"

:: Pre-check: ensure node_modules exists
if not exist "node_modules" (
  echo node_modules not found. Running npm install first...
  call npm install
  if %errorlevel% neq 0 (
    echo ERROR: npm install failed. Cannot start server.
    exit /b 1
  )
  echo npm install complete.
)

:: Pre-check: ensure node is available
where node > nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: node not found in PATH. Please install Node.js.
  exit /b 1
)

:: Kill any previous server on the same port
taskkill /F /IM node.exe > nul 2>&1

if exist server.log del server.log
echo Starting Samparka server in background...
start "Samparka Server" /min start-bg.cmd

:: Wait for the server to actually be listening on the port (max 15 seconds)
set /a retries=0
:waitloop
if %retries% geq 15 goto timeout
netstat -an | findstr ":3001" | findstr /i "LISTENING" > nul 2>&1
if %errorlevel% equ 0 goto check_health
timeout /t 1 /nobreak > nul
set /a retries+=1
goto waitloop

:check_health
:: Verify the server actually responds (not just listening)
set /a hretries=0
:healthloop
if %hretries% geq 5 goto running
curl -s http://localhost:3001/api/health | findstr "ok" > nul 2>&1
if %errorlevel% equ 0 goto running
timeout /t 1 /nobreak > nul
set /a hretries+=1
goto healthloop

:running
echo Server is running on http://localhost:3001
exit /b 0

:timeout
echo ERROR: Server failed to start within 15 seconds.
echo --- Last 20 lines of server.log ---
if exist server.log (
  powershell -NoProfile -Command "Get-Content server.log -Tail 20"
) else (
  echo server.log not found
)
exit /b 1
