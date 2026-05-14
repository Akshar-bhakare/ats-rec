@echo off
SETLOCAL ENABLEDELAYEDEXPANSION


SET "FRONTEND_DIR=frontend"
SET "BACKEND_DIR=backend"
SET "DEPLOY_DIR=..\ai_selekt_production"

IF NOT EXIST "%DEPLOY_DIR%" (
  ECHO WARN: Deployment folder "%DEPLOY_DIR%" not found! Changing to hirexit_production
  SET "DEPLOY_DIR=..\hirexit_production"
)

IF NOT EXIST "%FRONTEND_DIR%" (
  ECHO ERROR: Frontend folder "%FRONTEND_DIR%" not found!
  EXIT /B 1
)
IF NOT EXIST "%BACKEND_DIR%" (
  ECHO ERROR: Backend folder "%BACKEND_DIR%" not found!
  EXIT /B 1
)


PUSHD "%FRONTEND_DIR%"
IF ERRORLEVEL 1 (
  ECHO Failed to enter "%FRONTEND_DIR%". Aborting.
  EXIT /B 1
)

CALL load_frontend_to_backend.bat
IF ERRORLEVEL 1 (
  ECHO Frontend build/copy step failed. Aborting.
  POPD
  EXIT /B 1
)

POPD

ECHO Synchronizing backend into "%DEPLOY_DIR%"...


ECHO Removing existing files and folders (except .git) of "%DEPLOY_DIR%"...

pushd "%DEPLOY_DIR%" || (ECHO ERROR: Failed to enter "%DEPLOY_DIR%" & EXIT /B 1)
for /d %%D in (*) do if /I not "%%D"==".git" rd /s /q "%%D"
for %%F in (*) do if /I not "%%F"==".git" del /q "%%F"
popd


:: Temporarily move node_modules
IF EXIST "%BACKEND_DIR%\node_modules" (
  ECHO Temporarily moving node_modules...
  MOVE /Y "%BACKEND_DIR%\node_modules" "%BACKEND_DIR%\..\..\..\node_modules_backup"
)

robocopy "%BACKEND_DIR%" "%DEPLOY_DIR%" /E /IS /IT /Z /MT:8 /R:3 /W:5 /XO /FFT /COPY:DAT /DCOPY:T /XO

:: Restore node_modules after success
IF EXIST "%BACKEND_DIR%\..\..\..\node_modules_backup" (
  ECHO Restoring node_modules...
  MOVE /Y "%BACKEND_DIR%\..\..\..\node_modules_backup" "%BACKEND_DIR%\node_modules"
)

IF ERRORLEVEL 8 (
  ECHO ERROR: copy failed with exit code %ERRORLEVEL%. Check the logs above.
  EXIT /B %ERRORLEVEL%
)

ECHO Sync changes to deployment repository is complete...
ECHO.
ECHO.

CALL sync_to_ai_selekt_intern_repository.bat
ECHO.
