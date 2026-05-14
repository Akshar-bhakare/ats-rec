@echo off

cls

CALL npm install -g npm@latest

CALL npm run install:all
CALL npm run ci:all

pause