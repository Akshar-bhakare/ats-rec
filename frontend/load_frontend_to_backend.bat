@echo off
setlocal

cls

::–– 1. Clean the build folder if it exists
if exist "./build/" (
    rmdir /s /q "./build/"
)

::–– 2. Run your build
CALL npm run build

::–– 3. Clean (or create) the backend static folder
CALL :EnsureCleanDir "..\backend\static"
CALL :EnsureCleanDir "..\backend\html_templates"

::–– 4. Copy the new build artifacts
xcopy build\static ..\backend\static /E /I /Y /Q
copy build\index.html ..\backend\html_templates

echo.

goto :eof

::––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
:: Subroutine: EnsureCleanDir
:: Usage:  CALL :EnsureCleanDir "path\to\dir"
:: Ensures the directory is empty: deletes if present, then recreates.
::––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––
:EnsureCleanDir
set "target=%~1"
if exist "%target%" (
    rmdir /s /q "%target%"
)
mkdir "%target%"
goto :eof
