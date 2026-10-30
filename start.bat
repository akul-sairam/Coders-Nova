@echo off
title MedicScribe EMS Launcher
cd /d "%~dp0"

echo ==================================================
echo  Starting MedicScribe EMS - Edge EMS AI System
echo ==================================================
echo.

echo Starting FastAPI Backend (Port 8000)...
start "MedicScribe Backend" cmd /k "cd /d ""%~dp0backend"" && python main.py"

timeout /t 2 /nobreak >nul

echo Starting Vite Frontend (Port 5173)...
start "MedicScribe Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173...
start http://localhost:5173

echo.
echo ==================================================
echo  Application is running!
echo  - Frontend: http://localhost:5173
echo  - Backend API: http://localhost:8000/docs
echo ==================================================
echo.

