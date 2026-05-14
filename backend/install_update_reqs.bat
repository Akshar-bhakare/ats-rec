@echo off

cls

:: point at the local node_modules folder (no spaces around the =)
set "NODE_MODULES=.\node_modules"

:: if it exists, delete it quietly
if exist "%NODE_MODULES%" (
    rmdir /s /q "%NODE_MODULES%"
)

CALL npm update -g npm

:: install everything from package.json
CALL npm ci
CALL npm update

echo.
