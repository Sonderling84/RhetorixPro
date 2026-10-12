@echo off
REM ============================================================================================
REM  BAUPLAN-PAKET (Standard je Haus, Tobi 12.10.2026) - ein Befehl, immer gleiches Ergebnis:
REM    1_STUECKLISTE   2_ANSICHTEN (S/W/O/N + Draufsicht)   3_3D (vorne + hinten)   (Master Cyanotype)
REM    NACHT_BLATT (Neon dunkel nach Vorlage: dunkle Fassade, leuchtende Fenster, Roentgen-Kanten)
REM    + BAUPLAN_<tag>.blend + <tag>.glb (3D-Tab der App)
REM  Ablage automatisch in:  Haeuser-Katalog\Haus_<tag>   und   Asset-Bibliothek (kundensim\<tag>)
REM
REM  Aufruf:  BAUPLAN-PAKET.bat <tag> <haus_tag.json | foto.jpg/png | Ordner mit Fotos> ["TITEL"] ["Hinweise"]
REM  Mit Foto: Schritt 0 = OpenRouter-Bildmodell vermisst das Haus -> haus_<tag>.json (OPENROUTER_API_KEY noetig)
REM  Beispiel: BAUPLAN-PAKET.bat eckhaus1940 haus_eckhaus1940.json "ECKGEBAEUDE 1940"
REM ============================================================================================
setlocal
set TAG=%~1
set HAUS=%~f2
set TITEL=%~3
if "%TITEL%"=="" set TITEL=%TAG%
if "%TAG%"=="" ( echo Aufruf: BAUPLAN-PAKET.bat ^<tag^> ^<haus.json^> ["TITEL"] & exit /b 1 )

REM ---- Pfade (bei Bedarf anpassen) ----
if "%BLENDER%"=="" set BLENDER=C:\Program Files\Blender Foundation\Blender 5.2\blender.exe
if "%PY%"=="" set PY=C:\ComfyUI_windows_portable\python_embeded\python.exe
if "%KATALOG%"=="" set KATALOG=G:\Meine Ablage\Brain\02_Bauplan_Brain\Haeuser-Katalog
if "%ASSETS%"=="" set ASSETS=G:\Meine Ablage\Bauplan-App\Training\Trainingssatz-100\models\kundensim
if "%BAUPLAN_DEVICE%"=="" set BAUPLAN_DEVICE=GPU
set TOOLS=%~dp0
set OUT=%TOOLS%..\Ergebnisse\paket_%TAG%
if not exist "%OUT%\render" mkdir "%OUT%\render"

REM ---- Schritt 0 nur bei Foto/Ordner (ohne goto, damit die Datei auch mit LF-Zeilenenden laeuft) ----
set EXT=%~x2
set FOTO=0
if exist "%~2\*" set FOTO=1
if /i "%EXT%"==".jpg" set FOTO=1
if /i "%EXT%"==".jpeg" set FOTO=1
if /i "%EXT%"==".png" set FOTO=1
if "%FOTO%"=="1" echo [0/6] OpenRouter vermisst das Foto (%OPENROUTER_MODEL%)
if "%FOTO%"=="1" "%PY%" "%TOOLS%foto_zu_haus.py" "%HAUS%" %TAG% "%OUT%\haus_%TAG%.json" "%~4" || exit /b 1
if "%FOTO%"=="1" if not exist "%~2\*" copy /y "%HAUS%" "%OUT%\foto_%TAG%%EXT%" >nul
if "%FOTO%"=="1" set HAUS=%OUT%\haus_%TAG%.json
echo [1/6] Stueckliste
"%PY%" "%TOOLS%bauplan_stueckliste.py" "%HAUS%" "%OUT%\stueckliste_%TAG%.json" || exit /b 1

echo [2/6] Blender baut das Modell
set BAUPLAN_GLB=%OUT%\%TAG%.glb
"%BLENDER%" -b --python "%TOOLS%bauplan_builder_blender.py" -- "%OUT%\stueckliste_%TAG%.json" "%OUT%" %TAG% 32 1 || exit /b 1

echo [3/6] Linien-Renders (Stueckliste-Modell, Roentgen)
set BP3D_KAMERAS=iso_sw,iso_no,elev_sued,elev_west,elev_ost,elev_nord,drauf
"%BLENDER%" -b "%OUT%\BAUPLAN_%TAG%.blend" --python "%TOOLS%bp3d_rundum.py" -- "%OUT%\render" %TAG% 4 || exit /b 1

echo [4/6] Nacht-Look (Neon dunkel)
set NACHT_KAMERAS=ecke,iso_sw,vogel,iso_no
"%BLENDER%" -b "%OUT%\BAUPLAN_%TAG%.blend" --python "%TOOLS%nacht_render.py" -- "%OUT%\render" %TAG% 64 || exit /b 1

echo [5/6] Blaetter
"%PY%" "%TOOLS%paket_blaetter.py" "%OUT%\render" "%OUT%\stueckliste_%TAG%.json" %TAG% "%OUT%" "%TITEL%" || exit /b 1
"%PY%" "%TOOLS%nacht_blatt.py" "%OUT%\render" %TAG% "%OUT%\4_NACHT_%TAG%.png" || exit /b 1

echo Abschluss: Zeit je Schritt + Token-Verbrauch
"%PY%" "%TOOLS%abschluss.py" "%OUT%" %TAG%
echo [6/6] Ablage: Katalog + Asset-Bibliothek
set ZIEL=%KATALOG%\Haus_%TAG%
if not exist "%ZIEL%" mkdir "%ZIEL%"
copy /y "%OUT%\*.png" "%ZIEL%\" >nul
copy /y "%OUT%\*.json" "%ZIEL%\" >nul
copy /y "%OUT%\ABSCHLUSS_%TAG%.md" "%ZIEL%\" >nul
copy /y "%HAUS%" "%ZIEL%\" >nul
copy /y "%OUT%\%TAG%.glb" "%ZIEL%\" >nul
copy /y "%OUT%\BAUPLAN_%TAG%.blend" "%ZIEL%\" >nul
set AZ=%ASSETS%\%TAG%
if not exist "%AZ%" mkdir "%AZ%"
copy /y "%OUT%\render\BP3D_*.png" "%AZ%\" >nul
copy /y "%OUT%\*.png" "%AZ%\" >nul
echo FERTIG: %ZIEL%
echo         %AZ%
endlocal
