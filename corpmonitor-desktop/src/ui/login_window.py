import customtkinter as ctk
from src.managers.auth_manager import AuthManager
import asyncio

class LoginWindow(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.auth_manager = AuthManager()
        self.logged_in = False
        
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
        
        # Executar login assíncrono
        asyncio.run(self.perform_login(email, password))
    
    async def perform_login(self, email: str, password: str):
        """Executar login de forma assíncrona"""
        success, message = await self.auth_manager.sign_in(email, password)
        
        if success:
            self.logged_in = True
            self.destroy()  # Fechar janela de login
        else:
            self.show_error(message)
            self.login_button.configure(state="normal", text="Entrar")
    
    def show_error(self, message: str):
        """Exibir mensagem de erro"""
        self.error_label.configure(text=message)
    
    def get_auth_manager(self) -> AuthManager:
        """Retornar auth_manager após login bem-sucedido"""
        return self.auth_manager
