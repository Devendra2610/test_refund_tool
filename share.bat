@echo off
echo ===================================================
echo        GST Refund Tool - Server and Sharing Tunnel
echo ===================================================
echo.
echo [INFO] Initializing backend, frontend, and generating shareable link...
echo.

:: Run share.py with unbuffered python to display output immediately
python -u share.py

echo.
echo [INFO] Stopped sharing.
pause
