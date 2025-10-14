@echo off
echo ========================================
echo  CorpMonitor Desktop - Instalacao
echo ========================================
echo.

echo [1/5] Verificando Python...
python --version
if %errorlevel% neq 0 (
    echo ERRO: Python nao encontrado! Por favor, instale Python 3.12+
    pause
    exit /b 1
)
echo.

echo [2/5] Atualizando pip...
python -m pip install --upgrade pip
echo.

echo [3/5] Instalando dependencias Python...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERRO: Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo.

echo [4/5] Instalando Playwright (navegador Chromium)...
playwright install chromium
if %errorlevel% neq 0 (
    echo AVISO: Falha ao instalar Playwright. Tente manualmente: playwright install chromium
)
echo.

echo [5/5] Configurando arquivo .env...
if not exist .env (
    copy .env.example .env
    echo Arquivo .env criado! Verifique se as credenciais estao corretas.
) else (
    echo Arquivo .env ja existe.
)
echo.

echo ========================================
echo  Instalacao concluida com sucesso!
echo ========================================
echo.
echo Para iniciar o CorpMonitor Desktop, execute:
echo   python main.py
echo.
pause
