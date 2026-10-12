@echo off
REM ============================================================================================
REM  PAKETE-ABLEGEN: holt alle fertigen Pakete aus GitHub (RhetorixPro, Branch claude/blueprint-eckhaus-1940)
REM  und legt sie in den Haeuser-Katalog und die Asset-Bibliothek. Zu Hause einmal doppelklicken (braucht git).
REM  Enthalten: eckhaus1940, beethoven9, b268
REM ============================================================================================
setlocal
if "%KATALOG%"=="" set KATALOG=G:\Meine Ablage\Brain\02_Bauplan_Brain\Haeuser-Katalog
if "%ASSETS%"=="" set ASSETS=G:\Meine Ablage\Bauplan-App\Training\Trainingssatz-100\models\kundensim
set TMPD=%TEMP%\bauplan_pakete_holen
if exist "%TMPD%" rmdir /s /q "%TMPD%"
git clone --depth 1 -b claude/blueprint-eckhaus-1940 https://github.com/Sonderling84/RhetorixPro.git "%TMPD%" || exit /b 1
set Q=%TMPD%\blueprint

REM ---- Eckhaus 1940 ----
set ZIEL=%KATALOG%\Haus_eckhaus1940
if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /y "%Q%\bauplan_app\paket_eckhaus1940\*.png" "%ZIEL%\" >nul
copy /y "%Q%\bauplan_app\nacht\*.png" "%ZIEL%\" >nul
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

REM ---- Beethovenstrasse 9 ----
set ZIEL=%KATALOG%\Haus_beethoven9
if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /y "%Q%\beethoven9\paket\*.*" "%ZIEL%\" >nul
copy /y "%Q%\beethoven9\*.json" "%ZIEL%\" >nul
if not exist "%ZIEL%\fotos" mkdir "%ZIEL%\fotos"
copy /y "%Q%\beethoven9\fotos\*.*" "%ZIEL%\fotos\" >nul
set AZ=%ASSETS%\beethoven9
if not exist "%AZ%" mkdir "%AZ%"
copy /y "%Q%\beethoven9\paket\ansichten\*.png" "%AZ%\" >nul
copy /y "%Q%\beethoven9\paket\*.png" "%AZ%\" >nul

REM ---- B268 Nr. 9 (Wohnanlage) ----
set ZIEL=%KATALOG%\Haus_b268
if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /y "%Q%\b268\paket\*.*" "%ZIEL%\" >nul
copy /y "%Q%\b268\v2\*.json" "%ZIEL%\" >nul
if not exist "%ZIEL%\fotos" mkdir "%ZIEL%\fotos"
copy /y "%Q%\b268\fotos\*.*" "%ZIEL%\fotos\" >nul
set AZ=%ASSETS%\b268
if not exist "%AZ%" mkdir "%AZ%"
copy /y "%Q%\b268\paket\ansichten\*.png" "%AZ%\" >nul
copy /y "%Q%\b268\paket\*.png" "%AZ%\" >nul

echo FERTIG: %KATALOG%  und  %ASSETS%
rmdir /s /q "%TMPD%"
endlocal
pause
