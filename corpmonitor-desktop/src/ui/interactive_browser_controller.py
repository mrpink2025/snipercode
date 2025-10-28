"""
Janela de controle lateral para navegador interativo
"""
import customtkinter as ctk
from typing import Dict, Optional
import threading
import asyncio
from src.managers.browser_manager import BrowserManager
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
        self._loop = None  # Event loop dedicado para Playwright
        
        # Marcar incidente como visualizado
        self._mark_incident_viewed()
        
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
            domain=self.incident.get('host'),
            supabase_client=self.auth_manager.supabase
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
        """Iniciar navegador em thread separada com event loop dedicado"""
        # Verificar se janela foi destruída antes de começar
        if self._destroyed:
            print("[Controller] ❌ Janela foi destruída, cancelando inicialização do navegador")
            return
        
        try:
            # Criar event loop dedicado para esta thread
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            print("[Controller] 🔄 Event loop dedicado criado")
            
            # Criar task para iniciar browser
            async def start_browser():
                try:
                    session_id = await self.browser_manager.open_interactive_browser(self.incident)
                    return session_id
                except Exception as e:
                    print(f"[Controller] ❌ Erro ao iniciar navegador: {e}")
                    import traceback
                    traceback.print_exc()
                    return None
            
            # Executar task
            task = self._loop.create_task(start_browser())
            
            def on_task_done(future):
                try:
                    self.session_id = future.result()
                    if self.session_id:
                        self.after(0, self.on_browser_ready)
                    else:
                        self.after(0, lambda: self.on_browser_error(retry=True))
                except Exception as e:
                    print(f"[Controller] ❌ Erro no callback: {e}")
                    self.after(0, lambda: self.on_browser_error(retry=True))
            
            task.add_done_callback(on_task_done)
            
            # Manter loop rodando para processar eventos do Playwright
            print("[Controller] ♻️ Mantendo event loop ativo para sessão interativa...")
            self._loop.run_forever()
            print("[Controller] 🛑 Event loop encerrado")
            
        except Exception as e:
            print(f"[Controller] ❌ Erro fatal ao iniciar navegador: {e}")
            import traceback
            traceback.print_exc()
            self.after(0, lambda: self.on_browser_error(retry=False))
    
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
    
    def submit_async(self, coro):
        """Enviar coroutine para o event loop dedicado do Playwright"""
        if not self._loop or not self._loop.is_running():
            print("[Controller] ⚠️ Event loop não está disponível")
            return None
        
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future
    
    def refresh_page(self):
        """Atualizar página do navegador"""
        if not self.session_id:
            return
        
        def refresh():
            try:
                # Usar submit_async para enviar ao event loop do Playwright
                future = self.submit_async(
                    self.browser_manager.navigate(self.session_id, self.incident['tab_url'])
                )
                
                if future:
                    future.result(timeout=30)  # Aguardar até 30s
                    self.after(0, lambda: self.show_message("✅ Página atualizada!"))
                else:
                    self.after(0, lambda: self.show_message("❌ Event loop indisponível"))
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
            user_id=self.auth_manager.get_user_id(),
            access_token=self.auth_manager.get_access_token(),
            refresh_token=self.auth_manager.get_refresh_token(),
            current_session_id=self.session_id,
            browser_manager=self.browser_manager
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
        """Fechar janela e sessão do navegador com timeout"""
        if self._destroyed:
            return
        
        # Marcar como destruído IMEDIATAMENTE
        self._destroyed = True
        
        # Desabilitar botões
        self.btn_refresh.configure(state="disabled")
        self.btn_popup.configure(state="disabled")
        self.btn_block.configure(state="disabled")
        self.status_label.configure(text="🔄 Encerrando...", text_color="#f59e0b")
        
        # Fechar sessão e event loop
        if self.session_id and self._loop and self._loop.is_running():
            def close_session_with_timeout():
                try:
                    # Enviar close_session ao event loop do Playwright
                    future = asyncio.run_coroutine_threadsafe(
                        self.browser_manager.close_session(self.session_id),
                        self._loop
                    )
                    
                    # ✅ Aguardar até 3s para close_session completar
                    future.result(timeout=3)
                    print(f"[Controller] ✓ Sessão {self.session_id} encerrada")
                    
                except Exception as e:
                    print(f"[Controller] Aviso ao fechar sessão: {e}")
                
                # ✅ FASE 1: Parar event loop APÓS close_session completar ou falhar
                if self._loop and self._loop.is_running():
                    self._loop.call_soon_threadsafe(self._loop.stop)
                    print("[Controller] 🛑 Event loop parado")
                
                try:
                    self.after(0, self.force_destroy)
                except:
                    pass
            
            # Thread DAEMON (não bloqueia fechamento do app)
            threading.Thread(target=close_session_with_timeout, daemon=True).start()
            
            # Garantir que janela fecha após 4 segundos no máximo
            self.after(4000, self.force_destroy)
        else:
            # Se não há loop ativo, fechar diretamente
            if self._loop:
                self._loop.call_soon_threadsafe(self._loop.stop)
            self.force_destroy()
    
    def force_destroy(self):
        """Forçar destruição da janela (mesmo se close_session falhar)"""
        if not self.winfo_exists():
            return
        
        try:
            super().destroy()
            print(f"[Controller] Janela destruída")
        except Exception as e:
            print(f"[Controller] Aviso ao destruir: {e}")
    
    def _mark_incident_viewed(self):
        """Marcar incidente como visualizado em background"""
        def mark():
            try:
                from src.managers.incident_manager import IncidentManager
                incident_manager = IncidentManager(
                    supabase=self.auth_manager.supabase,
                    user_id=self.auth_manager.get_user_id()  # ✅ CORRIGIDO: usar método ao invés de atributo
                )
                success = incident_manager.mark_incident_as_viewed(self.incident['id'])
                if success:
                    print(f"[Controller] ✓ Incidente marcado como visualizado")
                else:
                    print(f"[Controller] ⚠️ Falha ao marcar incidente como visualizado")
            except Exception as e:
                print(f"[Controller] Erro ao marcar incidente como visualizado: {e}")
                import traceback
                traceback.print_exc()
        
        import threading
        threading.Thread(target=mark, daemon=True).start()
