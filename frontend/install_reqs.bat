@echo off

cls

set node_modules = "./node_modules/"

if exist %node_modules% (
    rmdir /s /q %node_modules%
)

CALL npm i

CALL npm install @mui/material @mui/icons-material @emotion/react @emotion/styled react-router-dom axios

CALL npm install -D @types/react-router-dom

echo.

pause