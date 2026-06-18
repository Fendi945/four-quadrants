@echo off
title 要事第一 - 四象限法则
echo ==================================
echo   要事第一 - 四象限法则
echo   正在启动...
echo ==================================
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
exit
