import customtkinter as ctk
from src.managers.browser_manager import BrowserManager
from src.utils.async_helper import run_async
from src.utils.logger import logger
from typing import Dict, Optional
import threading
from io import BytesIO
from PIL import Image, ImageTk

class SiteViewer(ctk.CTkToplevel):
    def __init__(self, parent, incident: Dict, browser_manager: BrowserManager):
        super().__init__(parent)
        
        self.incident = incident
        self.browser_manager = browser_manager
        self.session_id: Optional[str] = None
        self.screenshot_label = None
        self.current_image = None
        
        # Configuração da janela
        self.title(f"Visualizador - {incident.get('host', 'Site')}")
        self.geometry("1400x900")
        
        # Centralizar janela
        self.center_window()
        
        # Criar UI
        self.create_widgets()
        
        # Iniciar sessão do browser em thread separada
        self.after(100, self.start_browser_session_threaded)
    
    def center_window(self):
        """Centralizar janela na tela"""
        self.update_idletasks()
        width = 1400
        height = 900
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f'{width}x{height}+{x}+{y}')
    
    def create_widgets(self):
        """Criar elementos da interface"""
        # Header
        header = ctk.CTkFrame(self, height=60, fg_color="#1a1a1a")
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)
        
        # Info do incidente
        info_frame = ctk.CTkFrame(header, fg_color="transparent")
        info_frame.pack(side="left", padx=20)
        
        incident_id = self.incident.get('incident_id', 'N/A')
        host = self.incident.get('host', 'Desconhecido')
        
        info_label = ctk.CTkLabel(
            info_frame,
            text=f"📋 {incident_id} | 🌐 {host}",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        info_label.pack(anchor="w")
        
        url_label = ctk.CTkLabel(
            info_frame,
            text=self.incident.get('tab_url', '')[:80] + '...',
            font=ctk.CTkFont(size=11),
            text_color="gray"
        )
        url_label.pack(anchor="w")
        
        # Botões de ação
        actions_frame = ctk.CTkFrame(header, fg_color="transparent")
        actions_frame.pack(side="right", padx=20)
        
        self.refresh_btn = ctk.CTkButton(
            actions_frame,
            text="🔄 Atualizar",
            width=120,
            height=35,
            command=self.refresh_screenshot_threaded
        )
        self.refresh_btn.pack(side="left", padx=5)
        
        self.popup_btn = ctk.CTkButton(
            actions_frame,
            text="💬 Solicitar Popup",
            width=140,
            height=35,
            fg_color="#2563eb",
            command=self.show_popup_selector
        )
        self.popup_btn.pack(side="left", padx=5)
        
        self.block_btn = ctk.CTkButton(
            actions_frame,
            text="🚫 Bloquear Domínio",
            width=150,
            height=35,
            fg_color="#dc2626",
            command=self.show_block_domain_dialog
        )
        self.block_btn.pack(side="left", padx=5)
        
        close_btn = ctk.CTkButton(
            actions_frame,
            text="✕ Fechar",
            width=100,
            height=35,
            fg_color="#4b5563",
            command=self.close_viewer
        )
        close_btn.pack(side="left", padx=5)
        
        # Status bar
        self.status_bar = ctk.CTkFrame(self, height=30, fg_color="#1e293b")
        self.status_bar.pack(fill="x", side="bottom")
        self.status_bar.pack_propagate(False)
        
        self.status_label = ctk.CTkLabel(
            self.status_bar,
            text="⏳ Carregando navegador...",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
        )
        self.status_label.pack(side="left", padx=15)
        
        # Container principal para screenshot
        screenshot_container = ctk.CTkFrame(self, fg_color="#0f172a")
        screenshot_container.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Label para exibir screenshot
        self.screenshot_label = ctk.CTkLabel(
            screenshot_container,
            text="",
            fg_color="#1e293b"
        )
        self.screenshot_label.pack(fill="both", expand=True, padx=5, pady=5)
    
    def start_browser_session_threaded(self):
        """Iniciar sessão do browser em thread separada"""
        def start_session():
            try:
                self.after(0, lambda: self.update_status("Iniciando navegador..."))
                
                # Inicializar e iniciar sessão
                run_async(self.browser_manager.initialize())
                session_id, screenshot_bytes = run_async(
                    self.browser_manager.start_session(self.incident)
                )
                
                if session_id and screenshot_bytes:
                    self.session_id = session_id
                    self.after(0, lambda: self.update_screenshot(screenshot_bytes))
                    self.after(0, lambda: self.update_status(f"Conectado - {self.incident['tab_url']}"))
                    
                    # Iniciar auto-refresh
                    self.after(0, self.auto_refresh)
                else:
                    self.after(0, lambda: self.show_error_message("Erro ao iniciar sessão do navegador"))
                    
            except Exception as e:
                logger.error(f"Erro ao iniciar browser session: {e}")
                self.after(0, lambda: self.show_error_message(f"Erro: {str(e)}"))
        
        thread = threading.Thread(target=start_session)
        thread.daemon = True
        thread.start()
    
    def refresh_screenshot_threaded(self):
        """Atualizar screenshot em thread separada"""
        if not self.session_id:
            return
        
        def refresh():
            try:
                screenshot_bytes = run_async(
                    self.browser_manager.get_screenshot(self.session_id)
                )
                if screenshot_bytes:
                    self.after(0, lambda: self.update_screenshot(screenshot_bytes))
            except Exception as e:
                logger.error(f"Erro ao atualizar screenshot: {e}")
        
        thread = threading.Thread(target=refresh)
        thread.daemon = True
        thread.start()
    
    def auto_refresh(self):
        """Auto-refresh do screenshot a cada 2 segundos"""
        if self.session_id and self.winfo_exists():
            self.refresh_screenshot_threaded()
            self.after(2000, self.auto_refresh)
    
    def update_screenshot(self, screenshot_bytes: bytes):
        """Atualizar imagem do screenshot"""
        try:
            # Converter bytes para imagem PIL
            image = Image.open(BytesIO(screenshot_bytes))
            
            # Redimensionar para caber na janela (manter aspect ratio)
            max_width = 1380
            max_height = 750
            image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
            
            # Converter para PhotoImage
            photo = ImageTk.PhotoImage(image)
            
            # Atualizar label
            self.screenshot_label.configure(image=photo, text="")
            self.screenshot_label.image = photo  # Manter referência
            
        except Exception as e:
            print(f"[SiteViewer] Erro ao atualizar screenshot: {e}")
    
    def update_status(self, message: str):
        """Atualizar mensagem de status"""
        self.status_label.configure(text=message)
    
    def show_error_message(self, message: str):
        """Exibir mensagem de erro"""
        error_label = ctk.CTkLabel(
            self.screenshot_label,
            text=f"❌ {message}",
            font=ctk.CTkFont(size=16),
            text_color="#ef4444"
        )
        error_label.place(relx=0.5, rely=0.5, anchor="center")
    
    def show_popup_selector(self):
        """Exibir seletor de templates de popup"""
        # TODO: Implementar seletor de templates
        self.update_status("💬 Funcionalidade de popup em desenvolvimento")
    
    def show_block_domain_dialog(self):
        """Exibir diálogo para bloquear domínio"""
        # TODO: Implementar diálogo de bloqueio
        self.update_status("🚫 Funcionalidade de bloqueio em desenvolvimento")
    
    def close_viewer(self):
        """Fechar viewer e sessão do browser"""
        if self.session_id:
            def close_session():
                try:
                    run_async(self.browser_manager.close_session(self.session_id))
                except Exception as e:
                    logger.error(f"Erro ao fechar sessão do browser: {e}")
            
            thread = threading.Thread(target=close_session)
            thread.daemon = True
            thread.start()
        
        self.destroy()
