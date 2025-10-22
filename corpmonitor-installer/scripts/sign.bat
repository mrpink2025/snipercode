@echo off
echo ========================================
echo  CorpMonitor MSI Code Signing
echo ========================================
echo.

REM ===== CONFIGURACOES - PREENCHER ANTES DE EXECUTAR =====
set MSI_PATH=%~dp0..\build\CorpMonitor.msi
set SIGNTOOL="C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
set CERT_THUMBPRINT=[PREENCHER_CERTIFICATE_THUMBPRINT]
set TIMESTAMP_SERVER=http://timestamp.digicert.com
set PRODUCT_NAME="CorpMonitor Extension Installer"
set PRODUCT_URL="https://monitorcorporativo.com"

REM Verificar se MSI existe
if not exist "%MSI_PATH%" (
    echo [ERRO] MSI nao encontrado em: %MSI_PATH%
    echo Execute build.bat primeiro!
    pause
    exit /b 1
)

REM Verificar se SignTool existe
if not exist %SIGNTOOL% (
    echo [ERRO] SignTool nao encontrado!
    echo.
    echo Instale o Windows SDK de:
    echo https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
    echo.
    pause
    exit /b 1
)

REM Verificar se certificado está configurado
if "%CERT_THUMBPRINT%"=="[PREENCHER_CERTIFICATE_THUMBPRINT]" (
    echo [ERRO] Certificate thumbprint nao configurado!
    echo.
    echo Para obter o thumbprint:
    echo 1. Conecte o token USB com o certificado EV
    echo 2. Execute: certutil -store -user My
    echo 3. Copie o valor de "Cert Hash(sha1)"
    echo 4. Cole em CERT_THUMBPRINT neste script
    echo.
    pause
    exit /b 1
)

echo [IMPORTANTE] Conecte o token USB do certificado EV!
echo.
echo Se o token ja esta conectado, pressione qualquer tecla...
pause

echo.
echo [1/3] Assinando MSI com certificado EV...
echo Arquivo: %MSI_PATH%
echo.

%SIGNTOOL% sign /fd SHA256 ^
  /tr %TIMESTAMP_SERVER% /td SHA256 ^
  /sha1 %CERT_THUMBPRINT% ^
  /d %PRODUCT_NAME% ^
  /du %PRODUCT_URL% ^
  "%MSI_PATH%"

if errorlevel 1 (
    echo.
    echo [ERRO] Falha na assinatura!
    echo.
    echo Possiveis causas:
    echo - Token USB nao conectado ou nao reconhecido
    echo - Certificate thumbprint incorreto
    echo - Driver do token nao instalado
    echo - Certificado expirado
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Verificando assinatura digital...
%SIGNTOOL% verify /pa /v "%MSI_PATH%"

if errorlevel 1 (
    echo.
    echo [ERRO] Assinatura invalida!
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Recalculando hash SHA256...
certutil -hashfile "%MSI_PATH%" SHA256 > "%MSI_PATH%.sha256"

echo.
echo ========================================
echo  MSI ASSINADO COM SUCESSO!
echo ========================================
echo.
echo Arquivo: %MSI_PATH%
echo Hash: %MSI_PATH%.sha256
echo.
echo O MSI agora pode ser distribuido sem avisos de seguranca.
echo.
echo PROXIMOS PASSOS:
echo.
echo 1. Testar instalacao local:
echo    scripts\test-install.bat
echo.
echo 2. Deploy via GPO:
echo    PowerShell: scripts\deploy-gpo.ps1
echo.
pause
