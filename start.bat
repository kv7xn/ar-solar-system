@echo off
title AR Solar System Server
echo ========================================================
echo        AR Solar System (MindAR + Three.js)
echo ========================================================
echo.
echo [1/2] Launching local web server on port 3000...
echo [2/2] Opening http://localhost:3000 in your browser...
echo.
echo Press Ctrl + C in this window to stop the server anytime.
echo ========================================================
echo.

:: Open default browser after a 1 second delay
start "" http://localhost:3000

:: Run static server with npx serve
npx serve . -l 3000

pause
