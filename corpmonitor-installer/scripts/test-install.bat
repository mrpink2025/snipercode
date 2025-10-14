@echo off
echo ========================================
echo  Teste de Instalacao CorpMonitor
echo ========================================
echo.

set MSI_PATH=%~dp0..\build\CorpMonitor.msi
set LOG_PATH=%~dp0..\build\install.log

if not exist "%MSI_PATH%" (
    echo [ERRO] MSI nao encontrado em: %MSI_PATH%
    echo Execute build.bat primeiro!
    pause
    exit /b 1
)

echo [AVISO] Este script instalara o MSI no seu computador.
echo Voce podera desinstalar via Painel de Controle depois.
echo.
echo Pressione qualquer tecla para continuar ou Ctrl+C para cancelar...
pause >nul

echo.
echo [1/5] Instalando MSI (modo silencioso)...
echo Log: %LOG_PATH%
echo.

msiexec /i "%MSI_PATH%" /qn /l*v "%LOG_PATH%"

if errorlevel 1 (
    echo.
    echo [ERRO] Falha na instalacao!
    echo.
    echo Veja o log detalhado em: %LOG_PATH%
    echo.
    echo Erros comuns:
    echo - Error 1722: Problema com CustomActions
    echo - Error 1603: Falha generica (ver log)
    echo - Error 2503/2502: Permissoes insuficientes (executar como Admin)
    echo.
    pause
    exit /b 1
)

echo [OK] Instalacao concluida!
echo.

echo [2/5] Verificando arquivos da extensao...
if exist "C:\Program Files\CorpMonitor\Extension\manifest.json" (
    echo [OK] Arquivos copiados com sucesso
    dir "C:\Program Files\CorpMonitor\Extension\"
) else (
    echo [ERRO] Arquivos nao encontrados!
    pause
    exit /b 1
)

echo.
echo [3/5] Verificando registry keys (64-bit)...
reg query "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" >nul 2>&1
if errorlevel 1 (
    echo [WARN] Registry 64-bit NAO configurado
) else (
    echo [OK] Registry 64-bit configurado
    reg query "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
)

echo.
echo [4/5] Verificando registry keys (32-bit)...
reg query "HKLM\SOFTWARE\Wow6432Node\Policies\Google\Chrome\ExtensionInstallForcelist" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Registry 32-bit nao configurado (normal em sistemas 64-bit puros)
) else (
    echo [OK] Registry 32-bit configurado
    reg query "HKLM\SOFTWARE\Wow6432Node\Policies\Google\Chrome\ExtensionInstallForcelist"
)

echo.
echo [5/5] Verificando desinstalador...
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s /f "CorpMonitor" >nul 2>&1
if errorlevel 1 (
    echo [WARN] Desinstalador nao registrado
) else (
    echo [OK] Desinstalador registrado no Painel de Controle
)

echo.
echo ========================================
echo  TESTE CONCLUIDO
echo ========================================
echo.
echo VERIFICACAO MANUAL NO CHROME:
echo.
echo 1. Abra o Chrome (ou reinicie se ja estava aberto)
echo 2. Acesse: chrome://extensions/
echo 3. Verifique se "CorpMonitor" aparece instalado
echo 4. O icone deve aparecer na toolbar do Chrome
echo.
echo Se a extensao NAO aparecer:
echo - Execute: chrome://policy/ e verifique se as politicas foram aplicadas
echo - Reinicie o Chrome completamente (feche todos os processos)
echo - Verifique o Event Viewer do Windows para erros
echo.
echo Para desinstalar:
echo - Painel de Controle -^> Programas -^> Desinstalar "CorpMonitor Extension"
echo.
pause
