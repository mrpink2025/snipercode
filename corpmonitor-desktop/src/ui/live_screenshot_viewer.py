import customtkinter as ctk
from supabase import Client
from src.utils.logger import logger
from typing import Dict, Optional
import base64
from io import BytesIO
from PIL import Image, ImageTk
import threading
from datetime import datetime

class LiveScreenshotViewer(ctk.CTkToplevel):
    """Visualizador de screenshot em tempo real de uma máquina"""
    
    def __init__(self, parent, machine: Dict, supabase: Client):
        super().__init__(parent)
        
        self.machine = machine
        self.supabase = supabase
        self.machine_id = machine['machine_id']
        self.screenshot_label = None
        self.current_image = None
        self._destroyed = False
        self._refresh_job = None
        
        # Configuração da janela
        self.title(f"🎥 Tela ao Vivo - {self.machine_id}")
        self.geometry("1200x800")
        
        # Centralizar janela
        self.center_window()
        
        # Criar UI
        self.create_widgets()
        
        # Carregar screenshot inicial
        self.refresh_screenshot()
        
        # Auto-refresh a cada 3 segundos
        self.start_auto_refresh()
    
    def center_window(self):
        """Centralizar janela na tela"""
        self.update_idletasks()
        width = 1200
        height = 800
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f'{width}x{height}+{x}+{y}')
    
    def create_widgets(self):
        """Criar elementos da interface"""
        # Header
        header = ctk.CTkFrame(self, height=70, fg_color="#1a1a1a")
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)
        
        # Info da máquina
        info_frame = ctk.CTkFrame(header, fg_color="transparent")
        info_frame.pack(side="left", padx=20)
        
        machine_label = ctk.CTkLabel(
            info_frame,
            text=f"🖥️ {self.machine_id}",
            font=ctk.CTkFont(size=16, weight="bold")
        )
        machine_label.pack(anchor="w")
        
        status_label = ctk.CTkLabel(
            info_frame,
            text="🟢 Visualização em tempo real (atualiza a cada 3s)",
            font=ctk.CTkFont(size=11),
            text_color="#10b981"
        )
        status_label.pack(anchor="w")
        
        # Botões de ação
        actions_frame = ctk.CTkFrame(header, fg_color="transparent")
        actions_frame.pack(side="right", padx=20)
        
        self.refresh_btn = ctk.CTkButton(
            actions_frame,
            text="🔄 Atualizar Agora",
            width=140,
            height=35,
            command=self.refresh_screenshot
        )
        self.refresh_btn.pack(side="left", padx=5)
        
        close_btn = ctk.CTkButton(
            actions_frame,
            text="✕ Fechar",
            width=100,
            height=35,
            fg_color="#dc2626",
            hover_color="#991b1b",
            command=self.close_viewer
        )
        close_btn.pack(side="left", padx=5)
        
        # Status bar
        self.status_bar = ctk.CTkLabel(
            self,
            text="⚪ Carregando screenshot...",
            font=ctk.CTkFont(size=12),
            height=30,
            fg_color="#0f172a"
        )
        self.status_bar.pack(fill="x")
        
        # Área de screenshot (ScrollableFrame)
        screenshot_frame = ctk.CTkScrollableFrame(self, fg_color="#0f172a")
        screenshot_frame.pack(fill="both", expand=True, padx=0, pady=0)
        
        # Label para exibir imagem
        self.screenshot_label = ctk.CTkLabel(
            screenshot_frame,
            text="",
            fg_color="#1e293b"
        )
        self.screenshot_label.pack(fill="both", expand=True, padx=20, pady=20)
    
    def refresh_screenshot(self):
        """Buscar e exibir screenshot mais recente"""
        def fetch():
            try:
                logger.info(f"🔍 Buscando screenshot para {self.machine_id}")
                
                # Buscar do Supabase
                response = self.supabase.table('live_screenshots') \
                    .select('*') \
                    .eq('machine_id', self.machine_id) \
                    .single() \
                    .execute()
                
                if response.data:
                    screenshot_data = response.data.get('screenshot_data')
                    domain = response.data.get('domain', 'Desconhecido')
                    url = response.data.get('url', '')
                    captured_at = response.data.get('captured_at')
                    
                    if screenshot_data:
                        # Converter Base64 para imagem
                        self.update_screenshot(screenshot_data, domain, url, captured_at)
                    else:
                        self.show_no_screenshot()
                else:
                    self.show_no_screenshot()
                    
            except Exception as e:
                logger.error(f"Erro ao buscar screenshot: {e}", exc_info=True)
                self.show_error(str(e))
        
        # Executar em thread separada
        threading.Thread(target=fetch, daemon=True).start()
    
    def update_screenshot(self, base64_data: str, domain: str, url: str, captured_at: str):
        """Atualizar imagem na UI"""
        try:
            # Remover prefixo data:image/jpeg;base64, se existir
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            # Decodificar Base64
            image_bytes = base64.b64decode(base64_data)
            
            # Converter para PIL Image
            image = Image.open(BytesIO(image_bytes))
            
            # Redimensionar se muito grande (manter aspect ratio)
            max_width = 1100
            if image.width > max_width:
                ratio = max_width / image.width
                new_height = int(image.height * ratio)
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Converter para PhotoImage
            photo = ImageTk.PhotoImage(image)
            
            # Atualizar label (precisa ser na thread principal)
            def update_ui():
                if not self._destroyed:
                    self.screenshot_label.configure(image=photo, text="")
                    self.screenshot_label.image = photo  # Manter referência
                    
                    # Atualizar status bar
                    time_ago = self.format_time_ago(captured_at)
                    self.status_bar.configure(
                        text=f"✅ Screenshot capturada {time_ago} | 🌐 {domain}",
                        text_color="#10b981"
                    )
                    
                    logger.info(f"✓ Screenshot atualizada: {domain}")
            
            self.after(0, update_ui)
            
        except Exception as e:
            logger.error(f"Erro ao processar screenshot: {e}", exc_info=True)
            self.show_error(str(e))
    
    def show_no_screenshot(self):
        """Mostrar mensagem quando não há screenshot"""
        def update_ui():
            if not self._destroyed:
                self.screenshot_label.configure(
                    text="📷 Nenhuma screenshot disponível\n\nAguardando captura da máquina...",
                    image=None,
                    font=ctk.CTkFont(size=16),
                    text_color="gray"
                )
                self.status_bar.configure(
                    text="⚪ Aguardando screenshot...",
                    text_color="gray"
                )
        
        self.after(0, update_ui)
    
    def show_error(self, error_msg: str):
        """Mostrar mensagem de erro"""
        def update_ui():
            if not self._destroyed:
                self.screenshot_label.configure(
                    text=f"❌ Erro ao carregar screenshot\n\n{error_msg}",
                    image=None,
                    font=ctk.CTkFont(size=14),
                    text_color="#ef4444"
                )
                self.status_bar.configure(
                    text="❌ Erro ao carregar",
                    text_color="#ef4444"
                )
        
        self.after(0, update_ui)
    
    def format_time_ago(self, timestamp: str) -> str:
        """Formatar tempo relativo"""
        try:
            captured_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            now = datetime.now(captured_time.tzinfo)
            diff = now - captured_time
            
            seconds = int(diff.total_seconds())
            if seconds < 60:
                return f"há {seconds}s"
            elif seconds < 3600:
                return f"há {seconds // 60}min"
            else:
                return f"há {seconds // 3600}h"
        except:
            return "agora"
    
    def start_auto_refresh(self):
        """Iniciar auto-refresh a cada 3 segundos"""
        if not self._destroyed:
            self._refresh_job = self.after(3000, self.auto_refresh_callback)
    
    def auto_refresh_callback(self):
        """Callback do auto-refresh"""
        if not self._destroyed:
            self.refresh_screenshot()
            self.start_auto_refresh()
    
    def close_viewer(self):
        """Fechar janela"""
        logger.info(f"Fechando LiveScreenshotViewer para {self.machine_id}")
        self._destroyed = True
        
        # Cancelar auto-refresh
        if self._refresh_job:
            self.after_cancel(self._refresh_job)
        
        self.destroy()
