@echo off
title BugBay Daemon
color 05
cls

:: Cambia la directory di lavoro a quella del file .bat
cd /d "%~dp0"

echo =======================================================
echo               BUGBAY STARTUP CONTROL
echo =======================================================
echo.

:: Verifica se Node.js e' installato
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [ERRORE] Node.js non e' installato o non e' presente nel PATH.
    echo Per favore, installa Node.js (versione >= 22.13) da:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Ottieni la porta configurata (default 7331)
for /f "delims=" %%A in ('powershell -Command "$p=7331; if (Test-Path 'bugbay.config.json') { $c=Get-Content 'bugbay.config.json' | ConvertFrom-Json; if ($c.server -and $c.server.port) { $p=$c.server.port } }; Write-Output $p"') do set PORT=%%A

:: Pulisce eventuali processi orfani rimasti da esecuzioni precedenti
echo Pulizia dei processi BugBay orfani in corso...
powershell -Command "$ids = Get-CimInstance Win32_Process -Filter 'Name = ''node.exe''' | Where CommandLine -like '*\.bugbay-cache*' | Select -Expand ProcessId; if ($ids) { Stop-Process -Id $ids -Force -ErrorAction SilentlyContinue }"

:: Ottieni il PID del terminale cmd corrente
for /f %%A in ('powershell -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = $pid').ParentProcessId"') do set MYPID=%%A

:: Avvia il watcher in background:
:: 1. Apre il browser non appena la porta e' attiva.
:: 2. Chiude tutti i processi orfani non appena il terminale (MYPID) viene chiuso.
start /b powershell -Command "$parentPid = %MYPID%; $port = %PORT%; $url = 'http://localhost:' + $port; $browserOpened = $false; $start = Get-Date; while ($true) { if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { $ids = Get-CimInstance Win32_Process -Filter 'Name = ''node.exe''' | Where CommandLine -like '*\.bugbay-cache*' | Select -Expand ProcessId; if ($ids) { Stop-Process -Id $ids -Force -ErrorAction SilentlyContinue }; break }; if (-not $browserOpened -and ((Get-Date) - $start).TotalSeconds -lt 60) { try { $socket = New-Object System.Net.Sockets.TcpClient('127.0.0.1', $port); $socket.Close(); Start-Process $url; $browserOpened = $true } catch {} }; Start-Sleep -Seconds 1 }"

:: Selezione della modalita' con timeout di 3 secondi
echo.
echo Seleziona la modalita' di avvio (Default: Sviluppo)
echo [D] Sviluppo (hot-reload, log live)
echo [S] Produzione (build + start)
echo.

choice /c DS /t 3 /d D /m "Scelta:"
if %errorlevel% equ 2 (
    echo.
    echo -------------------------------------------------------
    echo Avvio del daemon di BugBay in modalita' PRODUZIONE...
    echo -------------------------------------------------------
    node bin/bugbay.mjs start
) else (
    echo.
    echo -------------------------------------------------------
    echo Avvio del daemon di BugBay in modalita' SVILUPPO...
    echo -------------------------------------------------------
    node bin/bugbay.mjs dev
)

:: Mantiene la finestra aperta in caso di arresto manuale (Ctrl+C)
echo.
echo -------------------------------------------------------
echo Il processo di BugBay e' terminato.
echo -------------------------------------------------------
pause
