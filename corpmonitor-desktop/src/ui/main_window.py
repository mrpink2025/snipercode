import customtkinter as ctk
from src.managers.auth_manager import AuthManager
from src.managers.incident_manager import IncidentManager
from src.managers.domain_manager import DomainManager
from src.managers.browser_manager import BrowserManager
from src.managers.realtime_manager import RealtimeManager
from src.ui.site_viewer import SiteViewer
from src.utils.async_helper import run_async
from src.utils.logger import logger
from typing import Dict, List, Optional
import threading

class MainWindow(ctk.CTk):
    def __init__(self, auth_manager: AuthManager):
        super().__init__()
        
        self.auth_manager = auth_manager
        self._destroyed = False
        self._after_ids = []
        
        # Validar que o usuário está autenticado
        if not auth_manager.current_user or not auth_manager.current_user.get("id"):
            logger.error("Tentativa de criar MainWindow sem usuário autenticado")
            raise ValueError("Usuário não autenticado")
        
        user_id = auth_manager.current_user["id"]
        self.incident_manager = IncidentManager(auth_manager.supabase, user_id)
        self.domain_manager = DomainManager(auth_manager.supabase, user_id)
        self.browser_manager = BrowserManager(auth_manager.supabase)
        self.realtime_manager = RealtimeManager(auth_manager.supabase)
        
        # Configuração da janela
        self.title("CorpMonitor Desktop")
        self.geometry("1400x900")
        
        # Centralizar janela
        self.center_window()
        
        # Configurar tema
        ctk.set_appearance_mode("dark")
        
        # Inicializar estado
        self.incidents_list: List[Dict] = []
        self.monitored_domains_list: List[Dict] = []
        self.blocked_domains_list: List[Dict] = []
        self.site_viewer: Optional[SiteViewer] = None
        
        # Criar UI
        self.create_widgets()
        
        # Carregar dados iniciais em thread separada
        self._load_initial_data()
        
        # Configurar realtime
        self.setup_realtime()
        
        logger.info(f"MainWindow inicializada para usuário {auth_manager.get_user_name()}")
    
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
        header = ctk.CTkFrame(self, height=70, fg_color="#1a1a1a")
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)
        
        # Título
        title = ctk.CTkLabel(
            header,
            text="🔒 CorpMonitor Desktop",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        title.pack(side="left", padx=20)
        
        # User info
        user_name = self.auth_manager.get_user_name()
        user_role = self.auth_manager.get_user_role().upper()
        
        user_frame = ctk.CTkFrame(header, fg_color="transparent")
        user_frame.pack(side="right", padx=20)
        
        user_label = ctk.CTkLabel(
            user_frame,
            text=f"👤 {user_name}",
            font=ctk.CTkFont(size=13)
        )
        user_label.pack(side="left", padx=(0, 10))
        
        role_badge = ctk.CTkLabel(
            user_frame,
            text=user_role,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="#2563eb",
            corner_radius=6,
            padx=10,
            pady=4
        )
        role_badge.pack(side="left", padx=(0, 15))
        
        logout_btn = ctk.CTkButton(
            user_frame,
            text="Sair",
            width=80,
            height=32,
            fg_color="#dc2626",
            hover_color="#991b1b",
            command=self.handle_logout
        )
        logout_btn.pack(side="left")
        
        # Main container
        main_container = ctk.CTkFrame(self, fg_color="transparent")
        main_container.pack(fill="both", expand=True, padx=20, pady=20)
        
        # KPIs Section
        kpi_frame = ctk.CTkFrame(main_container, fg_color="transparent")
        kpi_frame.pack(fill="x", pady=(0, 20))
        
        self.kpi_cards = {}
        kpi_definitions = [
            ("total", "Total de Incidentes", "📊"),
            ("critical", "Críticos Abertos", "🚨"),
            ("in_progress", "Em Progresso", "⚙️"),
            ("resolved_today", "Resolvidos Hoje", "✅")
        ]
        
        for i, (key, label, icon) in enumerate(kpi_definitions):
            card = self.create_kpi_card(kpi_frame, label, "0", icon)
            card.grid(row=0, column=i, padx=10, sticky="ew")
            kpi_frame.grid_columnconfigure(i, weight=1)
            self.kpi_cards[key] = card
        
        # Content area (tabs)
        self.tabview = ctk.CTkTabview(main_container)
        self.tabview.pack(fill="both", expand=True)
        
        # Criar abas
        self.tabview.add("📋 Incidentes")
        self.tabview.add("🌐 Domínios Monitorados")
        self.tabview.add("🚫 Domínios Bloqueados")
        
        # Tab Incidentes
        self.create_incidents_tab()
        
        # Tab Domínios Monitorados
        self.create_monitored_domains_tab()
        
        # Tab Domínios Bloqueados
        self.create_blocked_domains_tab()
    
    def create_kpi_card(self, parent, title: str, value: str, icon: str):
        """Criar card de KPI"""
        card = ctk.CTkFrame(parent, fg_color="#1e293b", corner_radius=10)
        card.pack_propagate(False)
        
        icon_label = ctk.CTkLabel(
            card,
            text=icon,
            font=ctk.CTkFont(size=32)
        )
        icon_label.pack(pady=(15, 5))
        
        value_label = ctk.CTkLabel(
            card,
            text=value,
            font=ctk.CTkFont(size=28, weight="bold")
        )
        value_label.pack()
        
        title_label = ctk.CTkLabel(
            card,
            text=title,
            font=ctk.CTkFont(size=12),
            text_color="gray"
        )
        title_label.pack(pady=(5, 15))
        
        # Armazenar referência ao value_label para atualização
        card.value_label = value_label
        
        return card
    
    def create_incidents_tab(self):
        """Criar aba de incidentes"""
        incidents_tab = self.tabview.tab("📋 Incidentes")
        
        # Filtros
        filters_frame = ctk.CTkFrame(incidents_tab, fg_color="transparent")
        filters_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(filters_frame, text="Filtros:", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left", padx=5)
        
        self.status_filter = ctk.CTkOptionMenu(
            filters_frame,
            values=["Todos", "new", "in_progress", "resolved"],
            command=self.filter_incidents,
            width=150
        )
        self.status_filter.pack(side="left", padx=5)
        
        self.severity_filter = ctk.CTkOptionMenu(
            filters_frame,
            values=["Todas", "critical", "high", "medium", "low"],
            command=self.filter_incidents,
            width=150
        )
        self.severity_filter.pack(side="left", padx=5)
        
        refresh_btn = ctk.CTkButton(
            filters_frame,
            text="🔄 Atualizar",
            width=100,
            command=self.load_incidents
        )
        refresh_btn.pack(side="left", padx=5)
        
        # Lista de incidentes (ScrollableFrame)
        self.incidents_scroll = ctk.CTkScrollableFrame(incidents_tab)
        self.incidents_scroll.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Carregar incidentes
        self.load_incidents()
    
    def create_monitored_domains_tab(self):
        """Criar aba de domínios monitorados"""
        monitored_tab = self.tabview.tab("🌐 Domínios Monitorados")
        
        # Header com botão de adicionar
        header_frame = ctk.CTkFrame(monitored_tab, fg_color="transparent")
        header_frame.pack(fill="x", padx=10, pady=10)
        
        add_btn = ctk.CTkButton(
            header_frame,
            text="➕ Adicionar Domínio",
            width=150,
            fg_color="#2563eb",
            command=self.show_add_monitored_domain_dialog
        )
        add_btn.pack(side="left")
        
        refresh_btn = ctk.CTkButton(
            header_frame,
            text="🔄 Atualizar",
            width=100,
            command=self.load_monitored_domains
        )
        refresh_btn.pack(side="left", padx=10)
        
        # Lista de domínios
        self.monitored_scroll = ctk.CTkScrollableFrame(monitored_tab)
        self.monitored_scroll.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Carregar domínios
        self.load_monitored_domains()
    
    def create_blocked_domains_tab(self):
        """Criar aba de domínios bloqueados"""
        blocked_tab = self.tabview.tab("🚫 Domínios Bloqueados")
        
        # Header
        header_frame = ctk.CTkFrame(blocked_tab, fg_color="transparent")
        header_frame.pack(fill="x", padx=10, pady=10)
        
        refresh_btn = ctk.CTkButton(
            header_frame,
            text="🔄 Atualizar",
            width=100,
            command=self.load_blocked_domains
        )
        refresh_btn.pack(side="left")
        
        # Lista de domínios bloqueados
        self.blocked_scroll = ctk.CTkScrollableFrame(blocked_tab)
        self.blocked_scroll.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Carregar domínios
        self.load_blocked_domains()
    
    def load_dashboard_data(self):
        """Carregar dados do dashboard"""
        # Carregar KPIs
        kpis = self.incident_manager.get_kpis()
        
        for key, card in self.kpi_cards.items():
            value = kpis.get(key, 0)
            card.value_label.configure(text=str(value))
    
    def load_incidents(self):
        """Carregar lista de incidentes"""
        # Limpar lista atual
        for widget in self.incidents_scroll.winfo_children():
            widget.destroy()
        
        # Buscar incidentes
        status = None if self.status_filter.get() == "Todos" else self.status_filter.get()
        severity = None if self.severity_filter.get() == "Todas" else self.severity_filter.get()
        
        self.incidents_list = self.incident_manager.get_incidents(status, severity)
        
        if not self.incidents_list:
            no_data = ctk.CTkLabel(
                self.incidents_scroll,
                text="Nenhum incidente encontrado",
                text_color="gray"
            )
            no_data.pack(pady=20)
            return
        
        # Criar cards de incidentes
        for incident in self.incidents_list:
            self.create_incident_card(incident)
    
    def filter_incidents(self, _=None):
        """Filtrar incidentes"""
        self.load_incidents()
    
    def create_incident_card(self, incident: Dict):
        """Criar card de incidente"""
        card = ctk.CTkFrame(self.incidents_scroll, fg_color="#1e293b", corner_radius=8)
        card.pack(fill="x", pady=5, padx=5)
        
        # Header do card
        header = ctk.CTkFrame(card, fg_color="transparent")
        header.pack(fill="x", padx=15, pady=10)
        
        # ID + Severidade
        incident_id = incident.get('incident_id', 'N/A')
        severity = incident.get('severity', 'medium')
        severity_colors = {
            'critical': '#dc2626',
            'high': '#ea580c',
            'medium': '#f59e0b',
            'low': '#84cc16'
        }
        
        id_label = ctk.CTkLabel(header, text=incident_id, font=ctk.CTkFont(size=13, weight="bold"))
        id_label.pack(side="left")
        
        severity_badge = ctk.CTkLabel(
            header,
            text=severity.upper(),
            fg_color=severity_colors.get(severity, '#6b7280'),
            corner_radius=4,
            padx=8,
            pady=2,
            font=ctk.CTkFont(size=10, weight="bold")
        )
        severity_badge.pack(side="left", padx=10)
        
        # Status badge
        status = incident.get('status', 'new')
        status_badge = ctk.CTkLabel(
            header,
            text=status.replace('_', ' ').title(),
            fg_color="#334155",
            corner_radius=4,
            padx=8,
            pady=2,
            font=ctk.CTkFont(size=10)
        )
        status_badge.pack(side="left")
        
        # Botão visualizar
        view_btn = ctk.CTkButton(
            header,
            text="👁️ Visualizar Site",
            width=130,
            height=28,
            fg_color="#2563eb",
            command=lambda: self.open_site_viewer(incident)
        )
        view_btn.pack(side="right")
        
        # Detalhes
        details = ctk.CTkFrame(card, fg_color="transparent")
        details.pack(fill="x", padx=15, pady=(0, 10))
        
        host = incident.get('host', 'Desconhecido')
        machine_id = incident.get('machine_id', 'Desconhecido')
        
        info_text = f"🌐 {host} | 💻 {machine_id}"
        info_label = ctk.CTkLabel(details, text=info_text, text_color="#94a3b8", font=ctk.CTkFont(size=11))
        info_label.pack(anchor="w")
    
    def open_site_viewer(self, incident: Dict):
        """Abrir visualizador de site"""
        if self.site_viewer and self.site_viewer.winfo_exists():
            self.site_viewer.focus()
            return
        
        self.site_viewer = SiteViewer(self, incident, self.browser_manager)
    
    def load_monitored_domains(self):
        """Carregar domínios monitorados"""
        for widget in self.monitored_scroll.winfo_children():
            widget.destroy()
        
        self.monitored_domains_list = self.domain_manager.get_monitored_domains()
        
        if not self.monitored_domains_list:
            no_data = ctk.CTkLabel(self.monitored_scroll, text="Nenhum domínio monitorado", text_color="gray")
            no_data.pack(pady=20)
            return
        
        for domain_data in self.monitored_domains_list:
            self.create_monitored_domain_card(domain_data)
    
    def create_monitored_domain_card(self, domain_data: Dict):
        """Criar card de domínio monitorado"""
        card = ctk.CTkFrame(self.monitored_scroll, fg_color="#1e293b", corner_radius=8)
        card.pack(fill="x", pady=5, padx=5)
        
        content = ctk.CTkFrame(card, fg_color="transparent")
        content.pack(fill="x", padx=15, pady=12)
        
        domain_label = ctk.CTkLabel(content, text=f"🌐 {domain_data['domain']}", font=ctk.CTkFont(size=13, weight="bold"))
        domain_label.pack(side="left")
        
        alert_type = domain_data.get('alert_type', 'sound')
        type_label = ctk.CTkLabel(content, text=f"🔔 {alert_type}", text_color="gray", font=ctk.CTkFont(size=11))
        type_label.pack(side="left", padx=15)
        
        remove_btn = ctk.CTkButton(
            content,
            text="🗑️ Remover",
            width=100,
            height=28,
            fg_color="#dc2626",
            command=lambda: self.remove_monitored_domain(domain_data['id'])
        )
        remove_btn.pack(side="right")
    
    def load_blocked_domains(self):
        """Carregar domínios bloqueados"""
        for widget in self.blocked_scroll.winfo_children():
            widget.destroy()
        
        self.blocked_domains_list = self.domain_manager.get_blocked_domains()
        
        if not self.blocked_domains_list:
            no_data = ctk.CTkLabel(self.blocked_scroll, text="Nenhum domínio bloqueado", text_color="gray")
            no_data.pack(pady=20)
            return
        
        for domain_data in self.blocked_domains_list:
            self.create_blocked_domain_card(domain_data)
    
    def create_blocked_domain_card(self, domain_data: Dict):
        """Criar card de domínio bloqueado"""
        card = ctk.CTkFrame(self.blocked_scroll, fg_color="#1e293b", corner_radius=8)
        card.pack(fill="x", pady=5, padx=5)
        
        content = ctk.CTkFrame(card, fg_color="transparent")
        content.pack(fill="x", padx=15, pady=12)
        
        domain_label = ctk.CTkLabel(content, text=f"🚫 {domain_data['domain']}", font=ctk.CTkFont(size=13, weight="bold"))
        domain_label.pack(side="left")
        
        reason = domain_data.get('reason', 'N/A')
        reason_label = ctk.CTkLabel(content, text=f"Motivo: {reason[:40]}...", text_color="gray", font=ctk.CTkFont(size=11))
        reason_label.pack(side="left", padx=15)
    
    def show_add_monitored_domain_dialog(self):
        """Exibir diálogo para adicionar domínio monitorado"""
        dialog = ctk.CTkInputDialog(text="Digite o domínio a ser monitorado:", title="Adicionar Domínio")
        domain = dialog.get_input()
        
        if domain:
            success = self.domain_manager.add_monitored_domain(domain)
            if success:
                self.load_monitored_domains()
    
    def remove_monitored_domain(self, domain_id: str):
        """Remover domínio monitorado"""
        success = self.domain_manager.remove_monitored_domain(domain_id)
        if success:
            self.load_monitored_domains()
    
    def _load_initial_data(self):
        """Carregar dados iniciais em thread separada"""
        def load():
            try:
                self.load_dashboard_data()
                self.load_incidents()
                self.load_monitored_domains()
                self.load_blocked_domains()
                logger.info("Dados iniciais carregados com sucesso")
            except Exception as e:
                logger.error(f"Erro ao carregar dados iniciais: {e}", exc_info=True)
        
        thread = threading.Thread(target=load)
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
                logger.error(f"Erro em callback: {e}", exc_info=True)
    
    def setup_realtime(self):
        """Configurar subscriptions realtime"""
        def on_alert(alert: Dict):
            logger.info(f"🔔 Novo alerta recebido: {alert}")
            # Recarregar dashboard quando houver novos alertas (usar safe_after)
            self.safe_after(0, self.load_dashboard_data)
        
        self.realtime_manager.start(on_alert=on_alert)
    
    def handle_logout(self):
        """Processar logout"""
        try:
            logger.info("Iniciando logout...")
            
            # Limpar subscriptions realtime
            self.realtime_manager.stop()
            
            # Fechar todas as sessões do browser em thread separada
            def close_browsers():
                try:
                    run_async(self.browser_manager.close_all_sessions())
                except Exception as e:
                    logger.error(f"Erro ao fechar browsers: {e}")
            
            thread = threading.Thread(target=close_browsers)
            thread.daemon = True
            thread.start()
            
            # Deslogar
            self.auth_manager.sign_out()
            
            logger.info("Logout concluído")
        except Exception as e:
            logger.error(f"Erro durante logout: {e}", exc_info=True)
        finally:
            # Fechar janela
            self.destroy()
    
    def destroy(self):
        """Sobrescrever destroy para limpar recursos"""
        self._destroyed = True
        
        # Cancelar callbacks pendentes
        for after_id in self._after_ids:
            try:
                self.after_cancel(after_id)
            except:
                pass
        
        # Limpar recursos
        try:
            self.realtime_manager.stop()
        except:
            pass
        
        super().destroy()
