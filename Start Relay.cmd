@echo off
cd /d "%~dp0"
echo Starting Relay at http://127.0.0.1:4310
echo Keep this window open while using Relay.
node server.mjs
pause
