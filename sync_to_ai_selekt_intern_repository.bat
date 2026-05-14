@echo off
cls
SETLOCAL ENABLEDELAYEDEXPANSION

SET "SCRIPT_DIR=%~dp0"
IF "%SCRIPT_DIR:~-1%"=="\" SET "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
SET "SOURCE_DIR=%SCRIPT_DIR%"
SET "TARGET_DIR=%SCRIPT_DIR%\..\hirexit_intern"

IF NOT EXIST "%TARGET_DIR%" (
  SET "TARGET_DIR_OLD=%TARGET_DIR%"
  SET "TARGET_DIR=%SCRIPT_DIR%\..\ai_selekt_intern"
  ECHO WARN: Target repo "%TARGET_DIR_OLD%" not found, setting target repo from "TARGET_DIR_OLD" to "%TARGET_DIR%"...
  
)

IF NOT EXIST "%TARGET_DIR%" (
  ECHO ERROR: Target repo "%TARGET_DIR%" not found!
  EXIT /B 1
)

IF NOT EXIST "%TARGET_DIR%\backend" (
  ECHO WARN: Target repo "%TARGET_DIR%" missing backend folder.
)

IF NOT EXIST "%TARGET_DIR%\frontend" (
  ECHO WARN: Target repo "%TARGET_DIR%" missing frontend folder.
)

ECHO Removing existing files and folders (except .git)...

pushd "%TARGET_DIR%" || (ECHO ERROR: Failed to enter "%TARGET_DIR%" & EXIT /B 1)
for /d %%D in (*) do if /I not "%%D"==".git" rd /s /q "%%D"
for %%F in (*) do if /I not "%%F"==".git" del /q "%%F"
popd



ECHO Synchronizing changes from "%SOURCE_DIR%" to "%TARGET_DIR%"...

robocopy "%SOURCE_DIR%" "%TARGET_DIR%" /E /IS /IT /Z /MT:8 /R:3 /W:5 /XO /FFT /COPY:DAT /DCOPY:T /XD ".git" "node_modules"

IF ERRORLEVEL 8 (
  ECHO ERROR: copy failed with exit code %ERRORLEVEL%. Check the logs above.
  EXIT /B %ERRORLEVEL%
)

ECHO Sync complete...
ECHO.
