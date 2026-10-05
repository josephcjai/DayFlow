@echo off
title DayFlow - Pixel 6 Emulator Launcher
echo ===================================================
echo Starting DayFlow Pixel 6 Virtual Device...
echo ===================================================

start "" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd Pixel_6

echo Waiting for emulator to boot up...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" wait-for-device shell "while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done"

echo.
echo Emulator booted! Launching DayFlow...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" wait-for-device shell am start -n com.dayflow.app/.presentation.MainActivity

echo.
echo DayFlow is running on your Pixel 6 emulator.
echo You can now test offline sync, habits, and schedule timeline!
pause
