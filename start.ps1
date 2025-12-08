# GradeBuilder Application Startup Script (PowerShell)
# This script starts both backend (FastAPI) and frontend (React) servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GradeBuilder Application Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the script's directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Check if virtual environment exists
if (-not (Test-Path ".venv\Scripts\Activate.ps1")) {
    Write-Host "[ERROR] Python virtual environment not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create virtual environment!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[SUCCESS] Virtual environment created!" -ForegroundColor Green
    Write-Host ""
}

# Install/Update Python dependencies
Write-Host "[Step 1/5] Checking Python dependencies..." -ForegroundColor Green
& ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
& ".venv\Scripts\pip.exe" install --quiet -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install Python dependencies!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[SUCCESS] Python dependencies installed!" -ForegroundColor Green
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "front\node_modules")) {
    Write-Host "[Step 2/5] Installing Node.js dependencies..." -ForegroundColor Green
    Set-Location front
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install Node.js dependencies!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Set-Location ..
    Write-Host "[SUCCESS] Node.js dependencies installed!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[Step 2/5] Node.js dependencies already installed!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "[Step 3/5] Starting Backend Server..." -ForegroundColor Green
Write-Host ""

# Start backend in a new PowerShell window
$backendScript = @"
& '.venv\Scripts\Activate.ps1'
Set-Location backend
Write-Host 'Starting FastAPI backend on http://localhost:8000' -ForegroundColor Green
Write-Host ''
uvicorn main:app --reload --host 0.0.0.0 --port 8000
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript -WindowStyle Normal

Write-Host "[Backend] Server starting in new window..." -ForegroundColor Gray
Write-Host "[Backend] API will be available at: http://localhost:8000" -ForegroundColor Gray
Write-Host "[Backend] API Documentation: http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""

# Wait for backend to initialize
Write-Host "[Step 4/5] Waiting for backend to initialize (8 seconds)..." -ForegroundColor Green
Start-Sleep -Seconds 8
Write-Host ""

Write-Host "[Step 5/5] Starting Frontend Server..." -ForegroundColor Green
Write-Host ""

# Navigate to frontend directory
Set-Location front

Write-Host "[Frontend] Starting React development server..." -ForegroundColor Gray
Write-Host "[Frontend] Application will open at: http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Both servers are starting!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the frontend server" -ForegroundColor Yellow
Write-Host "Close the backend window to stop the backend server" -ForegroundColor Yellow
Write-Host ""

# Start frontend in current window
npm start
