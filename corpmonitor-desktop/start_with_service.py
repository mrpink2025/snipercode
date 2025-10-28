#!/usr/bin/env python3
"""
Launcher que inicia o Go WebSocket Service e depois o Python Desktop
"""
import subprocess
import sys
import os
import time
import platform
import requests

def check_service_health(max_retries=5):
    """Verifica se o Go Service está respondendo"""
    url = "http://localhost:8765/health"
    
    for i in range(max_retries):
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                print("✅ Go WebSocket Service está respondendo")
                return True
        except:
            print(f"⏳ Aguardando Go Service iniciar... ({i+1}/{max_retries})")
            time.sleep(1)
    
    return False

def main():
    """Iniciar serviços"""
    print("=" * 50)
    print("CorpMonitor Desktop + Go WebSocket Service")
    print("=" * 50)
    
    # Determinar binário do Go Service baseado no OS
    if platform.system() == "Windows":
        service_binary = "corpmonitor-ws.exe"
    elif platform.system() == "Darwin":
        service_binary = "corpmonitor-ws-macos"
    else:
        service_binary = "corpmonitor-ws-linux"
    
    # Caminho do binário (assumindo que está no diretório raiz)
    service_path = os.path.join(os.path.dirname(__file__), "..", service_binary)
    
    if not os.path.exists(service_path):
        print(f"❌ Binário Go Service não encontrado: {service_path}")
        print("💡 Execute o build primeiro: cd corpmonitor-go-websocket-service && build.bat")
        sys.exit(1)
    
    # Iniciar Go Service
    print(f"🚀 Iniciando Go WebSocket Service: {service_path}")
    
    try:
        service_process = subprocess.Popen(
            [service_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        
        # Aguardar service iniciar
        if not check_service_health():
            print("❌ Go Service não respondeu. Verifique os logs.")
            service_process.terminate()
            sys.exit(1)
        
        print("🚀 Iniciando CorpMonitor Desktop...")
        
        # Iniciar Python Desktop
        from main import main as desktop_main
        desktop_main()
        
    except KeyboardInterrupt:
        print("\n⚠️  Interrompido pelo usuário")
    except Exception as e:
        print(f"❌ Erro ao iniciar aplicações: {e}")
    finally:
        print("🛑 Parando Go WebSocket Service...")
        if 'service_process' in locals():
            service_process.terminate()
            service_process.wait(timeout=5)
        print("✅ Serviços parados")

if __name__ == "__main__":
    main()
