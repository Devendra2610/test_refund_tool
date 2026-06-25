#!/bin/bash
echo "==================================================="
echo "            GST Refund Tool Startup"
echo "==================================================="
echo

# Check if Docker is running
docker info >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "[INFO] Docker is running. Starting using Docker Compose..."
    docker compose up --build
    exit 0
fi

# Check if docker is installed but not running
docker --version >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "[WARNING] Docker is installed but not running. Please start Docker Desktop first."
    echo
fi

echo "[INFO] Falling back to native local startup..."
echo

# Start Backend
echo "[INFO] Launching FastAPI Backend on port 8000..."
cd backend
source venv/bin/activate 2>/dev/null || source .venv/bin/activate 2>/dev/null
python3 -m uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "[INFO] Launching Vite Frontend on port 5173..."
cd frontend
npm run dev -- --port 5173 &
FRONTEND_PID=$!
cd ..

echo
echo "[SUCCESS] Both servers are starting up!"
echo "- Frontend Dashboard: http://localhost:5173"
echo "- Backend API Docs: http://localhost:8000/docs"
echo
echo "Press Ctrl+C to stop both servers."

# Handle cleanup on exit
cleanup() {
    echo
    echo "[INFO] Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

# Keep script running
wait
