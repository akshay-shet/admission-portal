@echo off
title Student Portal - reset owner login
cd /d "%~dp0"
echo Use this only if the owner password and the recovery code are both lost.
echo.
node server\reset-login.js
echo.
pause
