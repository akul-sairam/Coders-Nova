#!/usr/bin/env bash

# Resolve project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================="
echo " Starting MedicScribe EMS • Edge EMS AI System"
echo "=================================================="

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill "$BACKEND_PID" 2>/dev/null
    kill "$FRONTEND_PID" 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start Backend
echo "Starting FastAPI Backend on http://127.0.0.1:8000..."
cd "$SCRIPT_DIR/backend"
python main.py &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 2. Start Frontend
echo "Starting Vite Frontend on http://localhost:5173..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# 3. Automatically open browser
sleep 2
echo ""
echo "=================================================="
echo " Application is running!"
echo " Frontend:    http://localhost:5173"
echo " Backend API: http://localhost:8000/docs"
echo " Press Ctrl+C in this terminal to stop all servers."
echo "=================================================="
echo ""

if command -v start &> /dev/null; then
    start http://localhost:5173 2>/dev/null || true
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173 2>/dev/null || true
elif command -v open &> /dev/null; then
    open http://localhost:5173 2>/dev/null || true
fi

# Wait for both processes
wait

