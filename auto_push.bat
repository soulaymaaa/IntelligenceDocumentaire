@echo off
title Auto-Push GitHub
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File .\auto_push.ps1
pause
