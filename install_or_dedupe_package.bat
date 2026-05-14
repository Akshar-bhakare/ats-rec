@echo off
setlocal enabledelayedexpansion

cls

echo ----------------------------------------
echo   Monorepo Package Installation Utility
echo ----------------------------------------
echo.

:: Ask for package name
set /p pkg="Enter NPM package name to install: "

if "%pkg%"=="" (
    echo Package name is required. Exiting...
    exit /b 1
)
echo.

:: Ask for target workspace
echo Select target workspace:
echo   1) frontend
echo   2) backend
echo.
set /p target="Enter 1 or 2: "

if "%target%"=="1" (
    set workspace=frontend
) else if "%target%"=="2" (
    set workspace=backend
) else (
    echo Invalid selection. Exiting...
    exit /b 1
)

echo.
echo Installing "%pkg%" into workspace "%workspace%"...
echo.

:: Execute installation
cd %workspace%
call npm install "%pkg%"
if %errorlevel% neq 0 (
    echo Installation failed. Exiting...
    exit /b 1
)
cd ..


@REM echo.
@REM cd %workspace%
@REM echo Running targeted npm dedupe on "%pkg%"...
@REM call npm dedupe "%pkg%"
@REM if %errorlevel% neq 0 (
@REM     echo Dedupe encountered an issue. Continuing...
@REM )
@REM cd ..


echo.
echo Running npm ci at monorepo root...
call install_deps.bat

echo.
echo ----------------------------------------
echo   Operation completed successfully.
echo ----------------------------------------
echo.

endlocal
pause
