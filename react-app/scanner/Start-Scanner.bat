@echo off
title Student Portal - Scanner Helper
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0scan-helper.ps1"
echo.
echo The scanner helper has stopped.
pause
