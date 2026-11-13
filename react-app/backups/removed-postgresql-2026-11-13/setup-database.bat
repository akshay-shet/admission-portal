@echo off
cd /d "%~dp0"
echo ============================================================
echo   Student Portal - connect to PostgreSQL (first-time setup)
echo ============================================================
if exist "server\.env" goto :haveenv
echo.
echo Type the password you chose when installing PostgreSQL
echo (user "postgres"). Nothing is shown while you type - that is normal.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Read-Host 'PostgreSQL password' -AsSecureString; $p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); $lines = @('# Made by setup-database.bat','DATABASE_URL=','PGHOST=localhost','PGPORT=5432','PGUSER=postgres','PGPASSWORD=' + $p,'PGDATABASE=student_portal','PORT=3000','SESSION_SECRET='); Set-Content -Path 'server\.env' -Value $lines -Encoding ASCII"
if not exist "server\.env" goto :fail
:haveenv
echo.
echo [1/3] Installing packages...
call npm install --no-audit --no-fund || goto :fail
echo.
echo [2/3] Creating the database, tables and links, and loading your records...
call npm run db:setup || goto :badpw
echo.
echo [3/3] Building the portal page...
call npm run build || goto :fail
echo.
echo ============================================================
echo   Done. Double-click start-portal.bat to open the portal.
echo ============================================================
pause
exit /b 0
:badpw
echo.
echo Could not set up the database. If the message above says "password authentication failed",
echo delete the file server\.env and run setup-database.bat again with the right password.
pause
exit /b 1
:fail
echo.
echo Setup stopped because of the error above. See README-DATABASE.md
pause
exit /b 1
