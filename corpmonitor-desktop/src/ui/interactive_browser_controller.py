"""
Janela de controle lateral para navegador interativo
"""
import customtkinter as ctk
from typing import Dict, Optional
import threading
from src.managers.browser_manager import BrowserManager
from src.utils.async_helper import run_async
from src.config.supabase_config import supabase


class InteractiveBrowserController(ctk.CTkToplevel):
    """Janela de controle que acompanha o navegador interativo"""
    
    def __init__(self, parent, incident: Dict, browser_manager: BrowserManager, auth_manager):
        super().__init__(parent)
        
        self.incident = incident
        self.browser_manager = browser_manager
        self.auth_manager = auth_manager
        self.session_id = None
        self._destroyed = False
        
        # Configurar janela
        self.title("🌐 Controle de Navegação")
        self.geometry("350x700")
        self.position_window()
        
        # Prevenir fechamento acidental
        self.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Criar interface
        self.create_widgets()
        
        # Iniciar navegador em thread
        threading.Thread(target=self.start_browser_threaded, daemon=True).start()
    
    def position_window(self):
        """Posicionar janela no lado direito da tela"""
        self.update_idletasks()
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        
        window_width = 350
        window_height = 700
        x = screen_width - window_width - 20
        y = (screen_height - window_height) // 2
        
        self.geometry(f"{window_width}x{window_height}+{x}+{y}")
    
    def create_widgets(self):
        """Criar widgets da interface"""
        # Header
        header = ctk.CTkFrame(self, fg_color="#1e293b", height=80)
        header.pack(fill="x", padx=10, pady=10)
        header.pack_propagate(False)
        
        title = ctk.CTkLabel(
            header,
            text="🌐 Controle de Navegação",
            font=("Roboto", 18, "bold"),
            text_color="#f1f5f9"
        )
        title.pack(pady=10)
        
        # Status
        self.status_label = ctk.CTkLabel(
            header,
            text="📊 Status: Iniciando...",
            font=("Roboto", 12),
            text_color="#94a3b8"
        )
        self.status_label.pack()
        
        # Info do incidente
        info_frame = ctk.CTkFrame(self, fg_color="transparent")
        info_frame.pack(fill="x", padx=10, pady=10)
        
        domain = self.incident.get('host', 'N/A')
        url = self.incident.get('tab_url', 'N/A')
        
        ctk.CTkLabel(
            info_frame,
            text=f"🌍 Domínio:",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(fill="x")
        
        ctk.CTkLabel(
            info_frame,
            text=domain,
            font=("Roboto", 10),
            text_color="#64748b",
            anchor="w",
            wraplength=320
        ).pack(fill="x", pady=(0, 10))
        
        ctk.CTkLabel(
            info_frame,
            text=f"🔗 URL:",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(fill="x")
        
        ctk.CTkLabel(
            info_frame,
            text=url,
            font=("Roboto", 10),
            text_color="#64748b",
            anchor="w",
            wraplength=320
        ).pack(fill="x")
        
        # Separator
        ctk.CTkFrame(self, height=2, fg_color="#334155").pack(fill="x", padx=20, pady=15)
        
        # Botões de ação
        buttons_frame = ctk.CTkFrame(self, fg_color="transparent")
        buttons_frame.pack(fill="both", expand=True, padx=10)
        
        # Botão Atualizar
        self.btn_refresh = ctk.CTkButton(
            buttons_frame,
            text="🔄 Atualizar Página",
            command=self.refresh_page,
            height=45,
            font=("Roboto", 13),
            fg_color="#3b82f6",
            hover_color="#2563eb",
            state="disabled"
        )
        self.btn_refresh.pack(fill="x", pady=8)
        
        # Botão Solicitar Popup
        self.btn_popup = ctk.CTkButton(
            buttons_frame,
            text="📨 Solicitar Popup",
            command=self.open_popup_dialog,
            height=45,
            font=("Roboto", 13),
            fg_color="#8b5cf6",
            hover_color="#7c3aed",
            state="disabled"
        )
        self.btn_popup.pack(fill="x", pady=8)
        
        # Botão Bloquear Domínio
        self.btn_block = ctk.CTkButton(
            buttons_frame,
            text="🚫 Bloquear Domínio",
            command=self.open_block_dialog,
            height=45,
            font=("Roboto", 13),
            fg_color="#ef4444",
            hover_color="#dc2626",
            state="disabled"
        )
        self.btn_block.pack(fill="x", pady=8)
        
        # Painel de Respostas
        responses_label = ctk.CTkLabel(
            buttons_frame,
            text="📬 Respostas de Popup",
            font=("Roboto", 12, "bold"),
            anchor="w"
        )
        responses_label.pack(fill="x", pady=(15, 5))
        
        from src.ui.realtime_response_panel import RealtimeResponsePanel
        self.response_panel = RealtimeResponsePanel(
            buttons_frame,
            machine_id=self.incident.get('machine_id'),
            domain=self.incident.get('host')
        )
        self.response_panel.pack(fill="both", expand=True, pady=5)
        
        # Separator
        ctk.CTkFrame(self, height=2, fg_color="#334155").pack(fill="x", padx=20, pady=15)
        
        # Botão Fechar
        btn_close = ctk.CTkButton(
            self,
            text="✕ Fechar",
            command=self.on_closing,
            height=45,
            font=("Roboto", 13),
            fg_color="#64748b",
            hover_color="#475569"
        )
        btn_close.pack(fill="x", padx=10, pady=(0, 10))
    
    def start_browser_threaded(self):
        """Iniciar navegador em thread separada"""
        try:
            self.session_id = run_async(
                self.browser_manager.open_interactive_browser(self.incident)
            )
            
            if self.session_id:
                self.after(0, self.on_browser_ready)
            else:
                self.after(0, lambda: self.on_browser_error(retry=True))
        except Exception as e:
            print(f"[Controller] Erro ao iniciar navegador: {e}")
            import traceback
            traceback.print_exc()
            self.after(0, lambda: self.on_browser_error(retry=True))
    
    def on_browser_ready(self):
        """Callback quando navegador está pronto"""
        self.status_label.configure(text="✅ Status: Conectado", text_color="#22c55e")
        
        # Habilitar botões
        self.btn_refresh.configure(state="normal")
        self.btn_popup.configure(state="normal")
        self.btn_block.configure(state="normal")
    
    def on_browser_error(self, retry=False):
        """Callback quando há erro ao iniciar navegador"""
        self.status_label.configure(text="❌ Status: Erro ao conectar", text_color="#ef4444")
        
        # Tentar uma vez após 500ms
        if retry:
            self.status_label.configure(text="🔄 Tentando novamente...", text_color="#f59e0b")
            self.after(500, lambda: threading.Thread(target=self.start_browser_threaded, daemon=True).start())
    
    def refresh_page(self):
        """Atualizar página do navegador"""
        if not self.session_id:
            return
        
        def refresh():
            try:
                run_async(self.browser_manager.navigate(self.session_id, self.incident['tab_url']))
                self.after(0, lambda: self.show_message("✅ Página atualizada!"))
            except Exception as e:
                print(f"[Controller] Erro ao atualizar: {e}")
                self.after(0, lambda: self.show_message("❌ Erro ao atualizar"))
        
        threading.Thread(target=refresh, daemon=True).start()
    
    def open_popup_dialog(self):
        """Abrir dialog de popup"""
        from src.ui.popup_control_dialog import PopupControlDialog
        
        dialog = PopupControlDialog(
            parent=self,
            session_data={
                'machine_id': self.incident.get('machine_id'),
                'tab_id': self.incident.get('id'),
                'domain': self.incident.get('host'),
                'url': self.incident.get('tab_url'),
                'title': self.incident.get('cookie_excerpt', '')[:50]
            },
            user_id=self.auth_manager.get_user_id()
        )
        dialog.focus()
    
    def open_block_dialog(self):
        """Abrir dialog de bloqueio de domínio"""
        from src.ui.block_domain_dialog import BlockDomainDialog
        
        dialog = BlockDomainDialog(
            parent=self,
            domain=self.incident.get('host'),
            incident_id=self.incident.get('incident_id'),
            user_id=self.auth_manager.get_user_id()
        )
        dialog.focus()
    
    def show_message(self, message: str):
        """Mostrar mensagem temporária"""
        # Criar label temporário
        msg_label = ctk.CTkLabel(
            self,
            text=message,
            font=("Roboto", 11),
            fg_color="#1e293b",
            corner_radius=6,
            padx=10,
            pady=5
        )
        msg_label.place(relx=0.5, rely=0.95, anchor="center")
        
        # Remover após 2s
        self.after(2000, msg_label.destroy)
    
    def on_closing(self):
        """Fechar janela e sessão do navegador"""
        if self._destroyed:
            return
        
        self._destroyed = True
        
        # Desabilitar botões imediatamente
        self.btn_refresh.configure(state="disabled")
        self.btn_popup.configure(state="disabled")
        self.btn_block.configure(state="disabled")
        self.status_label.configure(text="🔄 Encerrando...", text_color="#f59e0b")
        
        # Fechar sessão do browser em thread
        if self.session_id:
            def close_session():
                try:
                    run_async(self.browser_manager.close_session(self.session_id))
                    print(f"[Controller] ✓ Sessão {self.session_id} encerrada")
                except Exception as e:
                    print(f"[Controller] Aviso ao fechar sessão: {e}")
                finally:
                    # Destruir janela após fechar
                    self.after(0, self.destroy)
            
            threading.Thread(target=close_session, daemon=True).start()
        else:
            # Destruir imediatamente se não há sessão
            self.destroy()
