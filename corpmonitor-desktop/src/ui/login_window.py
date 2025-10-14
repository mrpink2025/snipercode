import customtkinter as ctk
from src.managers.auth_manager import AuthManager
import threading

class LoginWindow(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.auth_manager = AuthManager()
        self.logged_in = False
        self._destroyed = False
        self._after_ids = []
        
        # Configuração da janela
        self.title("CorpMonitor Desktop - Login")
        self.geometry("500x600")
        self.resizable(False, False)
        
        # Centralizar janela
        self.center_window()
        
        # Configurar tema
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        
        # Criar UI
        self.create_widgets()
    
    def center_window(self):
        """Centralizar janela na tela"""
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f'{width}x{height}+{x}+{y}')
    
    def withdraw(self):
        """Ocultar janela e cancelar updates pendentes"""
        self._destroyed = True
        
        # Cancelar todos os afters conhecidos
        for after_id in self._after_ids:
            try:
                self.after_cancel(after_id)
            except:
                pass
        
        # Tentar cancelar afters internos do CustomTkinter
        try:
            # Obter todos os IDs de after pendentes
            pending = self.tk.call('after', 'info')
            for after_id in pending:
                try:
                    self.after_cancel(after_id)
                except:
                    pass
        except:
            pass
        
        super().withdraw()
    
    def create_widgets(self):
        """Criar elementos da interface"""
        # Container principal
        main_frame = ctk.CTkFrame(self, fg_color="transparent")
        main_frame.pack(expand=True, fill="both", padx=40, pady=40)
        
        # Logo/Título
        title_label = ctk.CTkLabel(
            main_frame,
            text="🔒 CorpMonitor",
            font=ctk.CTkFont(size=32, weight="bold")
        )
        title_label.pack(pady=(0, 10))
        
        subtitle_label = ctk.CTkLabel(
            main_frame,
            text="Painel de Controle Desktop",
            font=ctk.CTkFont(size=14),
            text_color="gray"
        )
        subtitle_label.pack(pady=(0, 40))
        
        # Email
        email_label = ctk.CTkLabel(main_frame, text="Email", anchor="w")
        email_label.pack(fill="x", pady=(0, 5))
        
        self.email_entry = ctk.CTkEntry(
            main_frame,
            placeholder_text="admin@empresa.com",
            height=40,
            font=ctk.CTkFont(size=14)
        )
        self.email_entry.pack(fill="x", pady=(0, 20))
        
        # Senha
        password_label = ctk.CTkLabel(main_frame, text="Senha", anchor="w")
        password_label.pack(fill="x", pady=(0, 5))
        
        self.password_entry = ctk.CTkEntry(
            main_frame,
            placeholder_text="Digite sua senha",
            show="●",
            height=40,
            font=ctk.CTkFont(size=14)
        )
        self.password_entry.pack(fill="x", pady=(0, 30))
        
        # Botão de login
        self.login_button = ctk.CTkButton(
            main_frame,
            text="Entrar",
            height=45,
            font=ctk.CTkFont(size=16, weight="bold"),
            command=self.handle_login
        )
        self.login_button.pack(fill="x", pady=(0, 15))
        
        # Mensagem de erro
        self.error_label = ctk.CTkLabel(
            main_frame,
            text="",
            text_color="red",
            wraplength=380,
            font=ctk.CTkFont(size=12)
        )
        self.error_label.pack(pady=(10, 0))
        
        # Info
        info_label = ctk.CTkLabel(
            main_frame,
            text="Use as mesmas credenciais do painel web.\nApenas administradores têm acesso.",
            text_color="gray",
            font=ctk.CTkFont(size=11),
            wraplength=380
        )
        info_label.pack(side="bottom", pady=(20, 0))
        
        # Bind Enter key
        self.password_entry.bind("<Return>", lambda e: self.handle_login())
    
    def handle_login(self):
        """Processar login"""
        email = self.email_entry.get().strip()
        password = self.password_entry.get().strip()
        
        # Validações básicas
        if not email or not password:
            self.show_error("Por favor, preencha todos os campos.")
            return
        
        # Desabilitar botão durante login
        self.login_button.configure(state="disabled", text="Autenticando...")
        self.error_label.configure(text="")
        
        # Executar login em thread separada para não travar a UI
        thread = threading.Thread(target=self.perform_login, args=(email, password))
        thread.daemon = True
        thread.start()
    
    def safe_after(self, ms, callback, *args):
        """Versão segura do after() que verifica se a janela existe"""
        if not self._destroyed:
            after_id = self.after(ms, lambda: self._safe_callback(callback, *args))
            self._after_ids.append(after_id)
            return after_id
    
    def _safe_callback(self, callback, *args):
        """Executa callback apenas se a janela ainda existe"""
        if not self._destroyed:
            try:
                callback(*args)
            except Exception as e:
                from src.utils.logger import logger
                logger.error(f"Erro em callback: {e}", exc_info=True)
    
    def perform_login(self, email: str, password: str):
        """Executar login de forma assíncrona em thread"""
        success, message = self.auth_manager.sign_in(email, password)
        
        # Atualizar UI usando safe_after() para thread-safety
        if success:
            self.safe_after(0, self._on_login_success)
        else:
            self.safe_after(0, lambda: self._on_login_error(message))
    
    def _on_login_success(self):
        """Callback executado na thread principal após login bem-sucedido"""
        self.logged_in = True
        # Ocultar janela primeiro para reduzir callbacks pendentes
        self.withdraw()
        # Aguardar mais tempo antes de destruir completamente
        self.safe_after(200, self._final_destroy)
    
    def _final_destroy(self):
        """Destruição final da janela após aguardar callbacks"""
        try:
            super().destroy()
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao destruir janela de login: {e}")
    
    def _on_login_error(self, message: str):
        """Callback executado na thread principal após erro de login"""
        self.show_error(message)
        self.login_button.configure(state="normal", text="Entrar")
    
    def show_error(self, message: str):
        """Exibir mensagem de erro"""
        self.error_label.configure(text=message)
    
    def get_auth_manager(self) -> AuthManager:
        """Retornar auth_manager após login bem-sucedido"""
        return self.auth_manager
    
    def destroy(self):
        """Sobrescrever destroy para cancelar callbacks pendentes"""
        self._destroyed = True
        
        # Cancelar todos os callbacks pendentes
        for after_id in self._after_ids:
            try:
                self.after_cancel(after_id)
            except:
                pass
        
        super().destroy()
