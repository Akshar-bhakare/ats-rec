@echo off

cls

:: point at the local node_modules folder (no spaces around the =)
set "NODE_MODULES=.\node_modules"

:: if it exists, delete it quietly
if exist "%NODE_MODULES%" (
    rmdir /s /q "%NODE_MODULES%"
)

CALL npm install fastify mongoose bcrypt @fastify/cookie @fastify/csrf-protection @fastify/static @fastify/helmet @fastify/session @fastify/jwt dotenv

CALL npm install --save-dev nodemon

CALL npm ci

echo.

pause
