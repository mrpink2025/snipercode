#!/usr/bin/env python3
"""
CorpMonitor Desktop
Aplicação desktop para monitoramento corporativo
Compatível com o painel web React (mesmo backend Supabase)
"""

import sys
import os
from src.ui.login_window import LoginWindow
from src.ui.main_window import MainWindow
from src.utils.logger import logger

# Adicionar diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    """Iniciar aplicação"""
    try:
        logger.info("=" * 50)
        logger.info("CorpMonitor Desktop - Iniciando...")
        logger.info("=" * 50)
        
        # Criar janela de login
        login_window = LoginWindow()
        login_window.mainloop()
        
        # Se login foi bem-sucedido, abrir dashboard
        if login_window.logged_in:
            auth_manager = login_window.get_auth_manager()
            logger.info(f"Login bem-sucedido: {auth_manager.get_user_name()}")
            
            # Criar janela principal
            main_window = MainWindow(auth_manager)
            main_window.mainloop()
        else:
            logger.info("Login cancelado ou falhou.")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Erro crítico na aplicação: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
