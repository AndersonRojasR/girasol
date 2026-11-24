@echo off
title Smart IoT Control - Puerto 4205
cd /d "%~dp0frontend"
where node >nul 2>&1
if errorlevel 1 (
  echo Necesitas instalar Node.js LTS desde https://nodejs.org
  pause
  exit /b 1
)
if not exist "node_modules\@angular\build\package.json" (
  echo Instalando dependencias. Espera a que termine...
  call npm.cmd install --cache .npm-cache --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo No fue posible instalar las dependencias. Comparte el error mostrado arriba.
    pause
    exit /b 1
  )
)
echo.
echo Iniciando Smart IoT Control en http://localhost:4205
echo Espera a que Angular indique que esta listo y abre esa direccion.
echo Manten esta ventana abierta. No necesitas conectar una ESP32 para el modo DEMO.
echo.
call npm.cmd start
if errorlevel 1 pause
