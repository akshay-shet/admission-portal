@echo off
cd /d "%~dp0"
title Student Portal - PostgreSQL (keep this window open)
echo ============================================================
echo   Student Portal  -  PostgreSQL
echo ============================================================
if exist "server\.env" goto :haveenv
echo.
echo First time only: type the password you chose when installing
echo PostgreSQL (user "postgres"). Nothing is shown while you type.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Read-Host 'PostgreSQL password' -AsSecureString; $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); $lines = @('# Made by start-portal.bat','DATABASE_URL=','PGHOST=localhost','PGPORT=5432','PGUSER=postgres','PGPASSWORD=' + $p,'PGDATABASE=student_portal','PORT=3000','SESSION_SECRET='); Set-Content -Path 'server\.env' -Value $lines -Encoding ASCII"
if not exist "server\.env" goto :fail
:haveenv
node -e "process.exit(require('./node_modules/express/package.json').version==='4.22.3' && require('./node_modules/pg/package.json').version==='8.23.1' ? 0 : 1)" 2>nul
if errorlevel 1 (
  echo Installing / updating packages ^(one time^)...
  call npm install --no-audit --no-fund || goto :fail
)
if not exist "dist\index.html" (
  echo Building the page...
  call npm run build || goto :fail
)
echo.
echo Connecting to PostgreSQL and checking the tables...
node server\setup.js || goto :badpw
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server\index.js
echo.
echo The server stopped. See the message above.
pause
exit /b 1
:badpw
echo.
echo Could not connect to PostgreSQL.
echo  - "password authentication failed": delete server\.env and double-click start-portal.bat again.
echo  - "ECONNREFUSED": PostgreSQL is not running - open Windows "Services" and start "postgresql-x64-18".
pause
exit /b 1
:fail
echo.
echo Stopped because of the error above. See README-DATABASE.md
pause
exit /b 1
