@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-crm.ps1" -StopDatabase
pause
