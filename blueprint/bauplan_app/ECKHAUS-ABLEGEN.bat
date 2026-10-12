@echo off
REM ============================================================================================
REM  ECKHAUS-ABLEGEN: holt die fertigen Eckhaus-1940-Ergebnisse aus GitHub (RhetorixPro, Branch
REM  claude/blueprint-eckhaus-1940) und legt sie in den Haeuser-Katalog und die Asset-Bibliothek.
REM  Einmal zu Hause doppelklicken. Braucht git (mit deinem GitHub-Login).
REM ============================================================================================
setlocal
if "%KATALOG%"=="" set KATALOG=G:\Meine Ablage\Brain\02_Bauplan_Brain\Haeuser-Katalog
if "%ASSETS%"=="" set ASSETS=G:\Meine Ablage\Bauplan-App\Training\Trainingssatz-100\models\kundensim
set TMPD=%TEMP%\eckhaus1940_holen
if exist "%TMPD%" rmdir /s /q "%TMPD%"
git clone --depth 1 -b claude/blueprint-eckhaus-1940 https://github.com/Sonderling84/RhetorixPro.git "%TMPD%" || exit /b 1
set Q=%TMPD%\blueprint
set ZIEL=%KATALOG%\Haus_eckhaus1940
if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /y "%Q%\bauplan_app\paket_eckhaus1940\*.png" "%ZIEL%\" >nul
copy /y "%Q%\bauplan_app\nacht\*.png" "%ZIEL%\" >nul
copy /y "%Q%\bauplan_app\BP3D_RUNDUM_eckhaus1940_blau.png" "%ZIEL%\" >nul
copy /y "%Q%\bauplan_app\*.json" "%ZIEL%\" >nul
copy /y "%Q%\bauplan_app\eckhaus1940.glb" "%ZIEL%\" >nul
copy /y "%Q%\bauplan_app\BAUPLAN_eckhaus1940.blend" "%ZIEL%\" >nul
copy /y "%Q%\eckhaus_1940*.png" "%ZIEL%\" >nul
copy /y "%Q%\referenzfoto_1940.png" "%ZIEL%\" >nul
set AZ=%ASSETS%\eckhaus1940
if not exist "%AZ%" mkdir "%AZ%"
copy /y "%Q%\bauplan_app\ansichten\*.png" "%AZ%\" >nul
copy /y "%Q%\bauplan_app\paket_eckhaus1940\*.png" "%AZ%\" >nul
copy /y "%Q%\bauplan_app\nacht\*.png" "%AZ%\" >nul
echo FERTIG: %ZIEL%
echo         %AZ%
rmdir /s /q "%TMPD%"
endlocal
pause
