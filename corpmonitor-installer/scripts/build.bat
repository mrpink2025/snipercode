@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo  CorpMonitor MSI Builder v1.0
echo ========================================
echo.

REM ===== CONFIGURACOES - AJUSTAR PATHS SE NECESSARIO =====
set PROJECT_ROOT=%~dp0..
set WIX_PATH=C:\Program Files (x86)\WiX Toolset v3.11\bin
set SOURCE_DIR=%PROJECT_ROOT%\source
set BUILD_DIR=%PROJECT_ROOT%\build
set WIX_DIR=%SOURCE_DIR%\wix
set EXTENSION_SOURCE=..\chrome-extension

REM Verificar se WiX está instalado
if not exist "%WIX_PATH%\candle.exe" (
    echo [ERRO] WiX Toolset nao encontrado em: %WIX_PATH%
    echo.
    echo Por favor, instale o WiX Toolset v3.11+ de:
    echo https://wixtoolset.org/releases/
    echo.
    pause
    exit /b 1
)

REM Limpar build anterior
if exist "%BUILD_DIR%" (
    echo [INFO] Limpando build anterior...
    rmdir /s /q "%BUILD_DIR%"
)
mkdir "%BUILD_DIR%"

REM Copiar arquivos da extensão
echo [1/6] Copiando arquivos da extensao...
if not exist "%SOURCE_DIR%\extension" mkdir "%SOURCE_DIR%\extension"
if not exist "%SOURCE_DIR%\extension\icons" mkdir "%SOURCE_DIR%\extension\icons"

xcopy /Y "%EXTENSION_SOURCE%\manifest.json" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\background.js" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\content.js" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\popup.html" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\popup.js" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\options.html" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\options.js" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\config.js" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\debug-console.js" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\service-worker-utils.js" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\privacy-policy.html" "%SOURCE_DIR%\extension\" >nul
xcopy /Y "%EXTENSION_SOURCE%\icons\*" "%SOURCE_DIR%\extension\icons\" >nul

echo [2/6] Compilando Product.wxs...
"%WIX_PATH%\candle.exe" -arch x64 -out "%BUILD_DIR%\Product.wixobj" "%WIX_DIR%\Product.wxs"
if errorlevel 1 goto error

echo [3/6] Compilando Files.wxs...
"%WIX_PATH%\candle.exe" -arch x64 -out "%BUILD_DIR%\Files.wixobj" "%WIX_DIR%\Files.wxs"
if errorlevel 1 goto error

echo [4/6] Compilando Registry.wxs...
"%WIX_PATH%\candle.exe" -arch x64 -out "%BUILD_DIR%\Registry.wixobj" "%WIX_DIR%\Registry.wxs"
if errorlevel 1 goto error

echo [5/6] Linkando objetos WiX...
"%WIX_PATH%\light.exe" ^
  -out "%BUILD_DIR%\CorpMonitor.msi" ^
  -ext WixUIExtension ^
  -cultures:en-US ^
  -spdb ^
  "%BUILD_DIR%\Product.wixobj" ^
  "%BUILD_DIR%\Files.wixobj" ^
  "%BUILD_DIR%\Registry.wixobj"
if errorlevel 1 goto error

echo [6/6] Calculando hash SHA256...
certutil -hashfile "%BUILD_DIR%\CorpMonitor.msi" SHA256 > "%BUILD_DIR%\CorpMonitor.msi.sha256"

echo.
echo ========================================
echo  BUILD CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo MSI gerado em: %BUILD_DIR%\CorpMonitor.msi
echo Hash SHA256: %BUILD_DIR%\CorpMonitor.msi.sha256
echo.
echo PROXIMOS PASSOS:
echo.
echo 1. Assinar o MSI com certificado EV:
echo    scripts\sign.bat
echo.
echo 2. Testar instalacao local:
echo    scripts\test-install.bat
echo.
echo 3. Deploy via GPO:
echo    PowerShell: scripts\deploy-gpo.ps1
echo.
goto end

:error
echo.
echo ========================================
echo  ERRO NA COMPILACAO!
echo ========================================
echo.
echo Verifique:
echo - Se todos os placeholders [PREENCHER_*] foram substituidos
echo - Se os GUIDs sao validos e unicos
echo - Se o Extension ID esta correto
echo.
echo Logs de erro estao acima.
echo.
pause
exit /b 1

:end
pause
