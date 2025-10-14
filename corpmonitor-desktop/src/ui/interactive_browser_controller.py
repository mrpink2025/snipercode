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
        self._is_loading = False
        
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
        
        # Controles de navegação
        nav_frame = ctk.CTkFrame(self, fg_color="transparent")
        nav_frame.pack(fill="x", padx=10, pady=5)
        
        ctk.CTkLabel(
            nav_frame,
            text="🧭 Navegação",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(fill="x", pady=(0, 5))
        
        # Botões de navegação em linha
        nav_buttons_frame = ctk.CTkFrame(nav_frame, fg_color="transparent")
        nav_buttons_frame.pack(fill="x")
        
        self.btn_back = ctk.CTkButton(
            nav_buttons_frame,
            text="◄",
            command=self.go_back,
            width=50,
            height=35,
            font=("Roboto", 14),
            fg_color="#475569",
            hover_color="#334155",
            state="disabled"
        )
        self.btn_back.pack(side="left", padx=2)
        
        self.btn_forward = ctk.CTkButton(
            nav_buttons_frame,
            text="►",
            command=self.go_forward,
            width=50,
            height=35,
            font=("Roboto", 14),
            fg_color="#475569",
            hover_color="#334155",
            state="disabled"
        )
        self.btn_forward.pack(side="left", padx=2)
        
        self.btn_stop = ctk.CTkButton(
            nav_buttons_frame,
            text="⬛",
            command=self.stop_loading,
            width=50,
            height=35,
            font=("Roboto", 14),
            fg_color="#ef4444",
            hover_color="#dc2626",
            state="disabled"
        )
        self.btn_stop.pack(side="left", padx=2)
        
        self.loading_label = ctk.CTkLabel(
            nav_buttons_frame,
            text="",
            font=("Roboto", 10),
            text_color="#f59e0b"
        )
        self.loading_label.pack(side="left", padx=10)
        
        # Barra de URL (somente leitura)
        url_label = ctk.CTkLabel(
            nav_frame,
            text="🔗 URL Atual:",
            font=("Roboto", 10),
            anchor="w"
        )
        url_label.pack(fill="x", pady=(10, 2))
        
        self.url_entry = ctk.CTkEntry(
            nav_frame,
            height=30,
            font=("Roboto", 10),
            state="readonly",
            fg_color="#1e293b",
            border_color="#334155"
        )
        self.url_entry.pack(fill="x")
        self.url_entry.configure(state="normal")
        self.url_entry.insert(0, self.incident.get('tab_url', ''))
        self.url_entry.configure(state="readonly")
        
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
        # Verificar se janela foi destruída antes de começar
        if self._destroyed:
            print("[Controller] ❌ Janela foi destruída, cancelando inicialização do navegador")
            return
        
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
        self.btn_back.configure(state="normal")
        self.btn_forward.configure(state="normal")
        
        # Iniciar polling de URL
        self.poll_url_changes()
    
    def on_browser_error(self, retry=False):
        """Callback quando há erro ao iniciar navegador"""
        self.status_label.configure(text="❌ Status: Erro ao conectar", text_color="#ef4444")
        
        # Tentar uma vez após 500ms
        if retry:
            self.status_label.configure(text="🔄 Tentando novamente...", text_color="#f59e0b")
            self.after(500, lambda: threading.Thread(target=self.start_browser_threaded, daemon=True).start())
    
    def refresh_page(self):
        """Recarregar página atual"""
        if not self.session_id or self._is_loading:
            return
        
        def refresh():
            try:
                self._is_loading = True
                self.after(0, lambda: self.update_loading_indicator(True))
                
                new_url = run_async(self.browser_manager.reload(self.session_id))
                
                if new_url:
                    self.after(0, lambda: self.update_url_bar(new_url))
                    self.after(0, lambda: self.show_message("✅ Página recarregada!"))
                
                self._is_loading = False
                self.after(0, lambda: self.update_loading_indicator(False))
            except Exception as e:
                print(f"[Controller] Erro ao recarregar: {e}")
                self.after(0, lambda: self.show_message("❌ Erro ao recarregar"))
                self._is_loading = False
                self.after(0, lambda: self.update_loading_indicator(False))
        
        threading.Thread(target=refresh, daemon=True).start()
    
    def go_back(self):
        """Voltar para página anterior"""
        if not self.session_id or self._is_loading:
            return
        
        def navigate_back():
            try:
                self._is_loading = True
                self.after(0, lambda: self.update_loading_indicator(True))
                
                new_url = run_async(self.browser_manager.go_back(self.session_id))
                
                if new_url:
                    self.after(0, lambda: self.update_url_bar(new_url))
                    self.after(0, lambda: self.show_message("✅ Voltou"))
                
                self._is_loading = False
                self.after(0, lambda: self.update_loading_indicator(False))
            except Exception as e:
                print(f"[Controller] Erro ao voltar: {e}")
                self._is_loading = False
                self.after(0, lambda: self.update_loading_indicator(False))
        
        threading.Thread(target=navigate_back, daemon=True).start()

    def go_forward(self):
        """Avançar para próxima página"""
        if not self.session_id or self._is_loading:
            return
        
        def navigate_forward():
            try:
                self._is_loading = True
                self.after(0, lambda: self.update_loading_indicator(True))
                
                new_url = run_async(self.browser_manager.go_forward(self.session_id))
                
                if new_url:
                    self.after(0, lambda: self.update_url_bar(new_url))
                    self.after(0, lambda: self.show_message("✅ Avançou"))
                
                self._is_loading = False
                self.after(0, lambda: self.update_loading_indicator(False))
            except Exception as e:
                print(f"[Controller] Erro ao avançar: {e}")
                self._is_loading = False
                self.after(0, lambda: self.update_loading_indicator(False))
        
        threading.Thread(target=navigate_forward, daemon=True).start()

    def stop_loading(self):
        """Parar carregamento"""
        if not self.session_id or not self._is_loading:
            return
        
        def stop():
            run_async(self.browser_manager.stop_loading(self.session_id))
            self._is_loading = False
            self.after(0, lambda: self.update_loading_indicator(False))
            self.after(0, lambda: self.show_message("⏸️ Carregamento parado"))
        
        threading.Thread(target=stop, daemon=True).start()

    def update_url_bar(self, url: str):
        """Atualizar barra de URL"""
        self.url_entry.configure(state="normal")
        self.url_entry.delete(0, "end")
        self.url_entry.insert(0, url)
        self.url_entry.configure(state="readonly")

    def update_loading_indicator(self, is_loading: bool):
        """Atualizar indicador de carregamento"""
        if is_loading:
            self.loading_label.configure(text="⏳ Carregando...")
            self.btn_stop.configure(state="normal")
            self.btn_back.configure(state="disabled")
            self.btn_forward.configure(state="disabled")
            self.btn_refresh.configure(state="disabled")
        else:
            self.loading_label.configure(text="")
            self.btn_stop.configure(state="disabled")
            self.btn_back.configure(state="normal")
            self.btn_forward.configure(state="normal")
            self.btn_refresh.configure(state="normal")

    def poll_url_changes(self):
        """Polling para detectar mudanças de URL"""
        if not self._destroyed and self.session_id:
            def check_url():
                try:
                    current_url = run_async(self.browser_manager.get_current_url(self.session_id))
                    if current_url and current_url != self.url_entry.get():
                        self.after(0, lambda: self.update_url_bar(current_url))
                except:
                    pass
            
            threading.Thread(target=check_url, daemon=True).start()
            self.after(1000, self.poll_url_changes)
    
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
            user_id=self.auth_manager.get_user_id(),
            access_token=self.auth_manager.get_access_token(),
            refresh_token=self.auth_manager.get_refresh_token()
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
        """Fechar janela e encerrar COMPLETAMENTE o Playwright"""
        if self._destroyed:
            return
        
        # Desabilitar todos os controles
        self.btn_refresh.configure(state="disabled")
        self.btn_popup.configure(state="disabled")
        self.btn_block.configure(state="disabled")
        self.btn_back.configure(state="disabled")
        self.btn_forward.configure(state="disabled")
        self.btn_stop.configure(state="disabled")
        
        self.status_label.configure(text="🔄 Encerrando navegador...", text_color="#f59e0b")
        
        # Fechar sessão do browser em thread NON-DAEMON
        if self.session_id:
            def close_and_cleanup():
                import os
                try:
                    # 1. Fechar sessão (page + context + browser)
                    run_async(self.browser_manager.close_session(self.session_id))
                    print(f"[Controller] ✓ Sessão {self.session_id} encerrada")
                    
                    # 2. Matar processos zumbis do Playwright
                    try:
                        import psutil
                        current_pid = os.getpid()
                        
                        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                            try:
                                # Procurar por processos Chromium do Playwright
                                if proc.info['name'] and 'chrome' in proc.info['name'].lower():
                                    cmdline = proc.info.get('cmdline', [])
                                    if cmdline and any('playwright' in str(arg).lower() for arg in cmdline):
                                        if proc.pid != current_pid:
                                            print(f"[Controller] Matando processo Playwright: {proc.pid}")
                                            proc.kill()
                            except (psutil.NoSuchProcess, psutil.AccessDenied):
                                pass
                        
                        print(f"[Controller] ✓ Cleanup completo de processos")
                    except ImportError:
                        print(f"[Controller] ⚠️ psutil não instalado, pulando cleanup de processos")
                    except Exception as e:
                        print(f"[Controller] Aviso ao limpar processos: {e}")
                    
                except Exception as e:
                    print(f"[Controller] Aviso ao fechar sessão: {e}")
                finally:
                    # Destruir janela na thread principal
                    self.after(0, self.destroy)
            
            # Thread NÃO-DAEMON
            threading.Thread(target=close_and_cleanup, daemon=False).start()
        else:
            self.destroy()
    
    def destroy(self):
        """Override de destroy para garantir cleanup completo"""
        if self._destroyed:
            return
        
        self._destroyed = True
        
        # Log de destruição
        print(f"[Controller] Destruindo janela do controle de navegação")
        
        # Chamar destroy do pai
        try:
            super().destroy()
        except Exception as e:
            print(f"[Controller] Aviso ao destruir: {e}")
