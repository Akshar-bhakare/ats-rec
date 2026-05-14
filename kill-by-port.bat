@echo off
:: kill-by-port.bat  ── ask for a TCP port, show each PID using it, and (optionally) kill them

rem ——— ask user which port ———
set /p PORT=Enter the TCP port to search for (e.g. 8080) : 

echo(
echo === Scanning for LISTENING sockets on port %PORT%...
echo(

setlocal enabledelayedexpansion
set FOUND=0

rem ——— netstat: find rows that end in LISTENING, capture the 5th token (=PID) ———
for /f "tokens=5" %%P in ('
    netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"
') do (
    set PID=%%P
    set /a FOUND+=1
    echo * PID !PID! is listening on port %PORT%
    call :KillPrompt !PID!
)

if %FOUND%==0 (
    echo No process is listening on port %PORT%.
) else (
    echo(
    echo Finished processing %FOUND% PID(s).
)

pause
goto :EOF


:: -----------------------------------------------------
:KillPrompt
:: %1 = PID we just found
choice /M "Force-kill PID %1 ?"
:: choice sets ERRORLEVEL: 1 = Yes, 2 = No
if errorlevel 2 (
    echo   ↳ skipped PID %1
    echo(
    goto :EOF
)

echo   ↳ killing PID %1 …
taskkill /F /PID %1 >nul 2>&1

if errorlevel 1 (
    echo   ! ERROR: could not kill PID %1  — you may need admin rights.
) else (
    echo   ✓ PID %1 terminated.
)
echo(
goto :EOF
