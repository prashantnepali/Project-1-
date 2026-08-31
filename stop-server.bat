@echo off
title Stop Samparka Server
taskkill /F /IM node.exe > nul 2>&1
echo If any server was running, it has been stopped.