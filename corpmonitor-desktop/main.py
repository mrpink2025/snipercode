#!/usr/bin/env python3
"""
CorpMonitor Desktop
Aplicação desktop para monitoramento corporativo
Compatível com o painel web React (mesmo backend Supabase)
"""

import sys
from src.ui.login_window import LoginWindow
from src.ui.main_window import MainWindow

def main():
    """Iniciar aplicação"""
    # Criar janela de login
    login_window = LoginWindow()
    login_window.mainloop()
    
    # Se login foi bem-sucedido, abrir dashboard
    if login_window.logged_in:
        auth_manager = login_window.get_auth_manager()
        
        # Criar janela principal
        main_window = MainWindow(auth_manager)
        main_window.mainloop()
    else:
        print("Login cancelado ou falhou.")
        sys.exit(0)

if __name__ == "__main__":
    main()
