@echo off
echo ===================================================
echo             GST Refund Tool Startup
echo ===================================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Docker is running. Starting using Docker Compose...
    docker compose up --build
    goto end
)

:: Check if docker is installed but maybe not running
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Docker is installed but not running. Please start Docker Desktop first.
    echo.
)

:: Fallback to local native run if Docker is not available
echo [INFO] Falling back to native local startup...
echo.

:: Start Backend
echo [INFO] Launching FastAPI Backend on port 8000...
start "GST Backend" cmd /c "cd backend && .\venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"

:: Start Frontend
echo [INFO] Launching Vite Frontend on port 5173...
start "GST Frontend" cmd /c "cd frontend && cmd /c npm run dev"

echo.
echo [SUCCESS] Both servers are starting up!
echo - Frontend Dashboard: http://localhost:5173
echo - Backend API Docs: http://localhost:8000/docs
echo.
echo Close the opened command prompt windows to stop the servers.
echo.

:end
pause
