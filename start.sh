#!/bin/bash

echo "========================================"
echo "  GradeBuilder Application Launcher"
echo "========================================"
echo

# Check if virtual environment exists
if [ ! -f ".venv/bin/activate" ]; then
    echo "[ERROR] Python virtual environment not found!"
    echo
    echo "Creating virtual environment..."
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create virtual environment!"
        exit 1
    fi
    echo "[SUCCESS] Virtual environment created!"
    echo
fi

# Install/Update Python dependencies
echo "[Step 1/5] Checking Python dependencies..."
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r backend/requirements.txt
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install Python dependencies!"
    exit 1
fi
echo "[SUCCESS] Python dependencies installed!"
echo

# Check if node_modules exists
if [ ! -d "front/node_modules" ]; then
    echo "[Step 2/5] Installing Node.js dependencies..."
    cd front
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install Node.js dependencies!"
        exit 1
    fi
    cd ..
    echo "[SUCCESS] Node.js dependencies installed!"
    echo
else
    echo "[Step 2/5] Node.js dependencies already installed!"
    echo
fi

echo "[Step 3/5] Starting Backend Server..."
echo

# Start backend server in background
source .venv/bin/activate
cd backend
echo "[Backend] Starting FastAPI backend on http://localhost:8000"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo "[Backend] Server started in background (PID: $BACKEND_PID)"
echo "[Backend] API available at: http://localhost:8000"
echo "[Backend] Docs: http://localhost:8000/docs"
echo

# Wait for backend
echo "[Step 4/5] Waiting for backend to initialize (8 seconds)..."
sleep 8
echo

echo "[Step 5/5] Starting Frontend Server..."
echo

cd front

echo "[Frontend] Starting React development server..."
echo "[Frontend] Application will open at: http://localhost:3000"
echo
echo "========================================"
echo "  Both servers are starting!"
echo "========================================"
echo
echo "Press Ctrl+C to stop the frontend server."
echo "Backend will keep running (PID: $BACKEND_PID)."
echo "Use: kill $BACKEND_PID  to stop the backend."
echo

# Start frontend (foreground)
npm start
