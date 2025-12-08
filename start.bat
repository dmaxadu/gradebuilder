@echo off
REM GradeBuilder Application Startup Script
REM This script starts both backend (FastAPI) and frontend (React) servers

echo ========================================
echo   GradeBuilder Application Launcher
echo ========================================
echo.

REM Check if virtual environment exists
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] Python virtual environment not found!
    echo.
    echo Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo [SUCCESS] Virtual environment created!
    echo.
)

REM Install/Update Python dependencies
echo [Step 1/5] Checking Python dependencies...
.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
.venv\Scripts\pip.exe install --quiet -r backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies!
    pause
    exit /b 1
)
echo [SUCCESS] Python dependencies installed!
echo.

REM Check if node_modules exists
if not exist "front\node_modules" (
    echo [Step 2/5] Installing Node.js dependencies...
    cd front
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install Node.js dependencies!
        pause
        exit /b 1
    )
    cd ..
    echo [SUCCESS] Node.js dependencies installed!
    echo.
) else (
    echo [Step 2/5] Node.js dependencies already installed!
    echo.
)

echo [Step 3/5] Starting Backend Server...
echo.

REM Start backend in a new window
start "GradeBuilder Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\activate && cd backend && echo Starting FastAPI backend on http://localhost:8000 && echo. && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [Backend] Server starting in new window...
echo [Backend] API will be available at: http://localhost:8000
echo [Backend] API Documentation: http://localhost:8000/docs
echo.

REM Wait for backend to initialize
echo [Step 4/5] Waiting for backend to initialize (8 seconds)...
timeout /t 8 /nobreak >nul
echo.

echo [Step 5/5] Starting Frontend Server...
echo.

REM Navigate to frontend directory and start
cd front

echo [Frontend] Starting React development server...
echo [Frontend] Application will open at: http://localhost:3000
echo.
echo ========================================
echo   Both servers are starting!
echo ========================================
echo.
echo Press Ctrl+C to stop the frontend server
echo Close the backend window to stop the backend server
echo.

REM Start frontend in current window
npm start
