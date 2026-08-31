@echo off
title Samparka Server Restart
cd /d "%~dp0"

echo Stopping any running server...
taskkill /F /IM node.exe > nul 2>&1
timeout /t 2 /nobreak > nul

echo Starting server...
call start-server.bat
