@echo off
cls

SET "FRONTEND_DIR=frontend"
SET "BACKEND_DIR=backend"


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

CALL sync_to_ai_selekt_intern_repository.bat
ECHO.
