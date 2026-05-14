@echo off

cls

CALL npm install -g npm@latest

if exist %~dp0package-lock.json (
    del %~dp0package-lock.json
)

if exist %~dp0backend\package-lock.json (
    del %~dp0backend\package-lock.json
)

if exist %~dp0frontend\package-lock.json (
    del %~dp0frontend\package-lock.json
)

CALL npm run update:all
CALL npm run ci:all

echo.
