import customtkinter as ctk
from src.managers.auth_manager import AuthManager
from src.managers.incident_manager import IncidentManager
from src.managers.domain_manager import DomainManager
from src.managers.browser_manager import BrowserManager
from src.managers.realtime_manager import RealtimeManager
from src.managers.machine_manager import MachineManager
from src.ui.site_viewer import SiteViewer
from src.utils.async_helper import run_async
from src.utils.logger import logger
from typing import Dict, List, Optional
import threading
from datetime import datetime

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
        self.machine_manager = MachineManager(auth_manager.supabase, user_id)
        
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
        self.machines_list: List[Dict] = []
        self.site_viewer: Optional[SiteViewer] = None
        
        # Contador de alertas para tocar som
        self.last_pending_alerts_count = 0
        
        # Variáveis de paginação
        self.incidents_page = 0
        self.incidents_per_page = 50
        self.incidents_total = 0
        
        # Auto-refresh
        self.auto_refresh_enabled = True
        self.refresh_interval_ms = 10000  # 10 segundos
        self.refresh_job_id = None
        
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
        # Header com título e status
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill="x", padx=20, pady=(20, 10))
        
        title = ctk.CTkLabel(
            header_frame,
            text="🛡️ CorpMonitor Desktop",
            font=("Segoe UI", 24, "bold")
        )
        title.pack(side="left")
        
        # Realtime connection status badge
        self.realtime_status_badge = ctk.CTkLabel(
            header_frame,
            text="🔴 Desconectado",
            font=("Segoe UI", 11),
            fg_color="#ef4444",
            corner_radius=6,
            padx=10,
            pady=4
        )
        self.realtime_status_badge.pack(side="left", padx=10)
        
        # Test sound button
        test_sound_btn = ctk.CTkButton(
            header_frame,
            text="🔊 Testar Som",
            command=self.test_alert_sound,
            width=120,
            height=32
        )
        test_sound_btn.pack(side="right", padx=5)
        
        # User info
        user_name = self.auth_manager.get_user_name()
        user_role = self.auth_manager.get_user_role().upper()
        
        user_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
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
        
        # Status de conexão realtime
        self.realtime_status_badge = ctk.CTkLabel(
            user_frame,
            text="⚪ Conectando...",
            font=ctk.CTkFont(size=11),
            fg_color="#64748b",
            corner_radius=6,
            padx=10,
            pady=4
        )
        self.realtime_status_badge.pack(side="left", padx=(0, 15))
        
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
        self.tabview.add("📖 Incidentes Lidos")
        self.tabview.add("🖥️ Máquinas Monitoradas")
        self.tabview.add("🌐 Domínios Monitorados")
        self.tabview.add("🚫 Domínios Bloqueados")
        self.tabview.add("🚨 Alertas Monitorados")
        
        # Tab Incidentes (não lidos)
        self.create_incidents_tab(viewed=False)
        
        # Tab Incidentes Lidos
        self.create_incidents_tab(viewed=True)
        
        # Tab Máquinas Monitoradas
        self.create_machines_tab()
        
        # Tab Domínios Monitorados
        self.create_monitored_domains_tab()
        
        # Tab Domínios Bloqueados
        self.create_blocked_domains_tab()
        
        # Tab Alertas Monitorados
        self.create_alerts_tab()
    
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
    
    def create_incidents_tab(self, viewed: bool = False):
        """
        Criar aba de incidentes
        
        Args:
            viewed: False = incidentes não visualizados, True = visualizados
        """
        tab_name = "📖 Incidentes Lidos" if viewed else "📋 Incidentes"
        incidents_tab = self.tabview.tab(tab_name)
        
        # Inicializar variáveis específicas da aba
        if viewed:
            self.viewed_incidents_page = 0
            self.viewed_incidents_per_page = 15
            self.viewed_incidents_list = []
            self.viewed_incidents_total = 0
        
        # Filtros
        filters_frame = ctk.CTkFrame(incidents_tab, fg_color="transparent")
        filters_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(filters_frame, text="Filtros:", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left", padx=5)
        
        # Para aba de não lidos, mostrar filtro de status
        if not viewed:
            self.status_filter = ctk.CTkOptionMenu(
                filters_frame,
                values=["Todos", "new", "in_progress", "resolved"],
                command=lambda _: self.load_incidents(viewed=viewed),
                width=150
            )
            self.status_filter.pack(side="left", padx=5)
        
        severity_filter = ctk.CTkOptionMenu(
            filters_frame,
            values=["Todas", "critical", "high", "medium", "low"],
            command=lambda _: self.load_incidents(viewed=viewed),
            width=150
        )
        severity_filter.pack(side="left", padx=5)
        
        if viewed:
            self.viewed_severity_filter = severity_filter
        else:
            self.severity_filter = severity_filter
        
        refresh_btn = ctk.CTkButton(
            filters_frame,
            text="🔄 Atualizar",
            width=100,
            command=lambda: self.load_incidents(viewed=viewed)
        )
        refresh_btn.pack(side="left", padx=5)
        
        # Campo de busca
        ctk.CTkLabel(filters_frame, text="|", text_color="gray").pack(side="left", padx=10)
        
        search_entry = ctk.CTkEntry(
            filters_frame,
            placeholder_text="Buscar por email ou nome do computador...",
            width=300
        )
        search_entry.pack(side="left", padx=5)
        
        if viewed:
            self.viewed_search_entry = search_entry
        else:
            self.search_entry = search_entry
        
        search_btn = ctk.CTkButton(
            filters_frame,
            text="🔍",
            width=40,
            command=lambda: self.apply_search_filter(viewed=viewed)
        )
        search_btn.pack(side="left", padx=2)
        
        # Controles de paginação
        pagination_frame = ctk.CTkFrame(incidents_tab, fg_color="transparent")
        pagination_frame.pack(fill="x", padx=10, pady=5)
        
        prev_btn = ctk.CTkButton(
            pagination_frame,
            text="◀ Anterior",
            width=100,
            command=lambda: self.prev_page(viewed=viewed),
            state="disabled"
        )
        prev_btn.pack(side="left", padx=5)
        
        page_label = ctk.CTkLabel(
            pagination_frame,
            text="Página 1 de 1 (0 incidentes)",
            font=ctk.CTkFont(size=12)
        )
        page_label.pack(side="left", padx=10)
        
        next_btn = ctk.CTkButton(
            pagination_frame,
            text="Próxima ▶",
            width=100,
            command=lambda: self.next_page(viewed=viewed),
            state="disabled"
        )
        next_btn.pack(side="left", padx=5)
        
        if viewed:
            self.viewed_prev_btn = prev_btn
            self.viewed_page_label = page_label
            self.viewed_next_btn = next_btn
        else:
            self.prev_btn = prev_btn
            self.page_label = page_label
            self.next_btn = next_btn
        
        # Lista de incidentes (ScrollableFrame)
        incidents_scroll = ctk.CTkScrollableFrame(incidents_tab)
        incidents_scroll.pack(fill="both", expand=True, padx=10, pady=10)
        
        if viewed:
            self.viewed_incidents_scroll = incidents_scroll
        else:
            self.incidents_scroll = incidents_scroll
        
        # Carregar incidentes
        self.load_incidents(viewed=viewed)
    
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
    
    def create_machines_tab(self):
        """Criar aba de máquinas monitoradas"""
        machines_tab = self.tabview.tab("🖥️ Máquinas Monitoradas")
        
        # Filtros
        filters_frame = ctk.CTkFrame(machines_tab, fg_color="transparent")
        filters_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(
            filters_frame,
            text="Filtros:",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(side="left", padx=5)
        
        # Filtro de status
        self.machines_status_filter = ctk.CTkOptionMenu(
            filters_frame,
            values=["Apenas Ativas", "Todas"],
            command=lambda _: self.load_machines(),
            width=150
        )
        self.machines_status_filter.pack(side="left", padx=5)
        
        # Botão atualizar
        refresh_btn = ctk.CTkButton(
            filters_frame,
            text="🔄 Atualizar",
            width=100,
            command=self.load_machines
        )
        refresh_btn.pack(side="left", padx=5)
        
        # Campo de busca
        ctk.CTkLabel(filters_frame, text="|", text_color="gray").pack(side="left", padx=10)
        
        self.machines_search_entry = ctk.CTkEntry(
            filters_frame,
            placeholder_text="Buscar por email/nome da máquina...",
            width=300
        )
        self.machines_search_entry.pack(side="left", padx=5)
        
        search_btn = ctk.CTkButton(
            filters_frame,
            text="🔍",
            width=40,
            command=self.apply_machines_search
        )
        search_btn.pack(side="left", padx=2)
        
        # KPIs de máquinas
        kpi_frame = ctk.CTkFrame(machines_tab, fg_color="transparent", height=100)
        kpi_frame.pack(fill="x", padx=10, pady=10)
        kpi_frame.pack_propagate(False)
        
        self.machines_kpi_cards = {}
        machine_kpis = [
            ("total_machines", "Total de Máquinas", "🖥️"),
            ("active_machines", "Máquinas Ativas", "🟢"),
            ("total_tabs", "Abas Abertas", "📑"),
            ("unique_domains", "Domínios Únicos", "🌐")
        ]
        
        for i, (key, label, icon) in enumerate(machine_kpis):
            card = self.create_mini_kpi_card(kpi_frame, label, "0", icon)
            card.grid(row=0, column=i, padx=5, sticky="ew")
            kpi_frame.grid_columnconfigure(i, weight=1)
            self.machines_kpi_cards[key] = card
        
        # Lista de máquinas (ScrollableFrame)
        self.machines_scroll = ctk.CTkScrollableFrame(machines_tab)
        self.machines_scroll.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Carregar máquinas
        self.load_machines()
    
    def load_dashboard_data(self):
        """Carregar dados do dashboard"""
        # Carregar KPIs
        kpis = self.incident_manager.get_kpis()
        
        for key, card in self.kpi_cards.items():
            value = kpis.get(key, 0)
            card.value_label.configure(text=str(value))
    
    def load_incidents(self, viewed: bool = False):
        """Carregar lista de incidentes com paginação"""
        # Selecionar widgets corretos baseado na aba
        if viewed:
            scroll = self.viewed_incidents_scroll
            page = self.viewed_incidents_page
            per_page = self.viewed_incidents_per_page
            severity_filter = self.viewed_severity_filter
            status_filter_value = None
        else:
            scroll = self.incidents_scroll
            page = self.incidents_page
            per_page = self.incidents_per_page
            severity_filter = self.severity_filter
            status_filter_value = None if self.status_filter.get() == "Todos" else self.status_filter.get()
        
        # Limpar lista atual
        for widget in scroll.winfo_children():
            widget.destroy()
        
        # Buscar incidentes
        severity = None if severity_filter.get() == "Todas" else severity_filter.get()
        
        # Buscar com paginação e filtro de visualização
        offset = page * per_page
        incidents_list = self.incident_manager.get_incidents(
            status=status_filter_value,
            severity=severity,
            viewed=viewed,
            limit=per_page,
            offset=offset
        )
        
        # Buscar total para paginação
        total = self.incident_manager.get_incidents_count(
            status=status_filter_value,
            severity=severity,
            viewed=viewed
        )
        
        # Armazenar referências
        if viewed:
            self.viewed_incidents_list = incidents_list
            self.viewed_incidents_total = total
        else:
            self.incidents_list = incidents_list
            self.incidents_total = total
        
        # Atualizar controles de paginação
        self.update_pagination_controls(viewed=viewed)
        
        if not incidents_list:
            msg = "Nenhum incidente lido" if viewed else "Nenhum incidente encontrado"
            no_data = ctk.CTkLabel(scroll, text=msg, text_color="gray")
            no_data.pack(pady=20)
            return
        
        # Criar cards de incidentes
        for incident in incidents_list:
            self.create_incident_card(incident, parent_scroll=scroll)
    
    def update_pagination_controls(self, viewed: bool = False):
        """Atualizar controles de paginação"""
        if viewed:
            total = self.viewed_incidents_total
            per_page = self.viewed_incidents_per_page
            page = self.viewed_incidents_page
            page_label = self.viewed_page_label
            prev_btn = self.viewed_prev_btn
            next_btn = self.viewed_next_btn
        else:
            total = self.incidents_total
            per_page = self.incidents_per_page
            page = self.incidents_page
            page_label = self.page_label
            prev_btn = self.prev_btn
            next_btn = self.next_btn
        
        total_pages = max(1, (total + per_page - 1) // per_page)
        current_page = page + 1
        
        # Atualizar label
        page_label.configure(
            text=f"Página {current_page} de {total_pages} ({total} incidentes)"
        )
        
        # Atualizar botões
        prev_btn.configure(state="normal" if page > 0 else "disabled")
        next_btn.configure(state="normal" if current_page < total_pages else "disabled")
    
    def prev_page(self, viewed: bool = False):
        """Ir para página anterior"""
        if viewed:
            if self.viewed_incidents_page > 0:
                self.viewed_incidents_page -= 1
                self.load_incidents(viewed=True)
        else:
            if self.incidents_page > 0:
                self.incidents_page -= 1
                self.load_incidents(viewed=False)
    
    def next_page(self, viewed: bool = False):
        """Ir para próxima página"""
        if viewed:
            total_pages = max(1, (self.viewed_incidents_total + self.viewed_incidents_per_page - 1) // self.viewed_incidents_per_page)
            if self.viewed_incidents_page < total_pages - 1:
                self.viewed_incidents_page += 1
                self.load_incidents(viewed=True)
        else:
            total_pages = max(1, (self.incidents_total + self.incidents_per_page - 1) // self.incidents_per_page)
            if self.incidents_page < total_pages - 1:
                self.incidents_page += 1
                self.load_incidents(viewed=False)
    
    def filter_incidents(self, _=None):
        """Filtrar incidentes"""
        self.incidents_page = 0
        self.load_incidents(viewed=False)
    
    def apply_search_filter(self, viewed: bool = False):
        """Aplicar filtro de busca"""
        if viewed:
            search_entry = self.viewed_search_entry
            scroll = self.viewed_incidents_scroll
            incidents_list = self.viewed_incidents_list
        else:
            search_entry = self.search_entry
            scroll = self.incidents_scroll
            incidents_list = self.incidents_list
        
        search_term = search_entry.get().strip().lower()
        
        # Limpar lista de incidentes
        for widget in scroll.winfo_children():
            widget.destroy()
        
        # Filtrar incidentes
        filtered = incidents_list
        if search_term:
            filtered = [
                inc for inc in incidents_list
                if search_term in inc.get('machine_id', '').lower()
            ]
        
        if not filtered:
            no_data = ctk.CTkLabel(
                scroll,
                text=f"Nenhum incidente encontrado para '{search_term}'",
                text_color="gray"
            )
            no_data.pack(pady=20)
            return
        
        # Recriar cards
        for incident in filtered:
            self.create_incident_card(incident, parent_scroll=scroll)
    
    def create_incident_card(self, incident: Dict, parent_scroll=None):
        """Criar card de incidente"""
        if parent_scroll is None:
            parent_scroll = self.incidents_scroll
        
        card = ctk.CTkFrame(parent_scroll, fg_color="#1e293b", corner_radius=8)
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
        
        # Botão Ver Site (Interativo)
        view_btn = ctk.CTkButton(
            header,
            text="🌐 Ver Site",
            width=130,
            height=28,
            fg_color="#22c55e",
            hover_color="#16a34a",
            command=lambda: self.open_interactive_browser(incident)
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
    
    def open_interactive_browser(self, incident: Dict):
        """Abrir controlador de navegador interativo"""
        from src.ui.interactive_browser_controller import InteractiveBrowserController
        
        # Marcar incidente como visualizado em background
        incident_id = incident.get('id')
        if incident_id:
            def mark_viewed():
                try:
                    success = self.incident_manager.mark_incident_as_viewed(incident_id)
                    logger.info(f"Incidente {incident_id} marcado como visualizado: {success}")
                except Exception as e:
                    logger.error(f"Erro ao marcar incidente como visualizado: {e}", exc_info=True)
            
            import threading
            threading.Thread(target=mark_viewed, daemon=True).start()
        
        controller = InteractiveBrowserController(
            parent=self,
            incident=incident,
            browser_manager=self.browser_manager,
            auth_manager=self.auth_manager
        )
        controller.focus()
        
        # Agendar atualização das abas após 2 segundos
        def refresh_after_view():
            import time
            time.sleep(2)
            self.safe_after(0, lambda: self.load_incidents(viewed=False))
            self.safe_after(0, lambda: self.load_incidents(viewed=True))
        
        threading.Thread(target=refresh_after_view, daemon=True).start()
    
    def create_alerts_tab(self):
        """Criar aba de alertas monitorados"""
        alerts_tab = self.tabview.tab("🚨 Alertas Monitorados")
        
        # Frame de controles
        controls = ctk.CTkFrame(alerts_tab, fg_color="transparent")
        controls.pack(fill="x", pady=(0, 10))
        
        # Filtros
        filter_frame = ctk.CTkFrame(controls, fg_color="transparent")
        filter_frame.pack(side="left", fill="x", expand=True)
        
        ctk.CTkLabel(filter_frame, text="Status:", font=("Segoe UI", 12)).pack(side="left", padx=5)
        
        self.alert_status_filter = ctk.CTkComboBox(
            filter_frame,
            values=["Todos", "Pendentes", "Reconhecidos"],
            width=150,
            command=lambda _: self.load_alerts()
        )
        self.alert_status_filter.set("Pendentes")
        self.alert_status_filter.pack(side="left", padx=5)
        
        # Botão atualizar
        refresh_btn = ctk.CTkButton(
            controls,
            text="🔄 Atualizar",
            width=100,
            command=self.load_alerts
        )
        refresh_btn.pack(side="right", padx=5)
        
        # Lista de alertas (scrollable)
        self.alerts_list_frame = ctk.CTkScrollableFrame(alerts_tab)
        self.alerts_list_frame.pack(fill="both", expand=True)
    
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
        
        # Verificar se há URL completa
        metadata = domain_data.get('metadata', {})
        full_url = metadata.get('full_url') if isinstance(metadata, dict) else None
        display_text = full_url if full_url else domain_data['domain']
        
        domain_label = ctk.CTkLabel(
            content,
            text=f"🌐 {display_text}",
            font=ctk.CTkFont(size=13, weight="bold")
        )
        domain_label.pack(side="left")
        
        # Badge de tipo de alerta
        alert_type = domain_data.get('alert_type', 'sound')
        is_critical = alert_type == 'critical'
        
        alert_badge = ctk.CTkLabel(
            content,
            text="🚨 CRÍTICO" if is_critical else "🔔 Normal",
            fg_color="#dc2626" if is_critical else "#3b82f6",
            corner_radius=4,
            padx=8,
            pady=2,
            font=ctk.CTkFont(size=10, weight="bold")
        )
        alert_badge.pack(side="left", padx=15)
        
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
    
    def create_mini_kpi_card(self, parent, title: str, value: str, icon: str):
        """Criar card mini de KPI para máquinas"""
        card = ctk.CTkFrame(parent, fg_color="#1e293b", corner_radius=8)
        
        content = ctk.CTkFrame(card, fg_color="transparent")
        content.pack(fill="both", expand=True, padx=10, pady=8)
        
        icon_label = ctk.CTkLabel(
            content,
            text=icon,
            font=ctk.CTkFont(size=20)
        )
        icon_label.pack(side="left", padx=(0, 10))
        
        text_frame = ctk.CTkFrame(content, fg_color="transparent")
        text_frame.pack(side="left", fill="both", expand=True)
        
        value_label = ctk.CTkLabel(
            text_frame,
            text=value,
            font=ctk.CTkFont(size=20, weight="bold")
        )
        value_label.pack(anchor="w")
        
        title_label = ctk.CTkLabel(
            text_frame,
            text=title,
            font=ctk.CTkFont(size=10),
            text_color="gray"
        )
        title_label.pack(anchor="w")
        
        # Armazenar referência
        card.value_label = value_label
        
        return card
    
    def load_machines(self):
        """Carregar lista de máquinas monitoradas"""
        # Limpar lista atual
        for widget in self.machines_scroll.winfo_children():
            widget.destroy()
        
        # Obter filtros
        active_only = self.machines_status_filter.get() == "Apenas Ativas"
        search_term = self.machines_search_entry.get().strip()
        
        # Buscar máquinas
        self.machines_list = self.machine_manager.get_monitored_machines(
            active_only=active_only,
            search_term=search_term
        )
        
        # Atualizar KPIs
        self.update_machines_kpis()
        
        if not self.machines_list:
            no_data = ctk.CTkLabel(
                self.machines_scroll,
                text="Nenhuma máquina encontrada",
                text_color="gray"
            )
            no_data.pack(pady=20)
            return
        
        # Criar cards de máquinas
        for machine in self.machines_list:
            self.create_machine_card(machine)
    
    def load_alerts(self):
        """Carregar alertas do backend"""
        def fetch():
            try:
                # Buscar admin_alerts da API
                status_filter = self.alert_status_filter.get()
                
                query = self.auth_manager.supabase.table("admin_alerts").select("*")
                
                if status_filter == "Pendentes":
                    query = query.is_("acknowledged_by", "null")
                elif status_filter == "Reconhecidos":
                    query = query.not_.is_("acknowledged_by", "null")
                
                response = query.order("triggered_at", desc=True).limit(100).execute()
                
                alerts = response.data if response.data else []
                
                # Atualizar UI
                self.safe_after(0, lambda: self._update_alerts_ui(alerts))
                
            except Exception as e:
                logger.error(f"Erro ao carregar alertas: {e}", exc_info=True)
        
        threading.Thread(target=fetch, daemon=True).start()
    
    def _update_alerts_ui(self, alerts: List[Dict]):
        """Atualizar interface com lista de alertas"""
        
        # CONTADOR DE ALERTAS - Tocar som se aumentou
        pending_alerts = [a for a in alerts if a.get('acknowledged_by') is None]
        pending_count = len(pending_alerts)
        
        if pending_count > self.last_pending_alerts_count:
            new_alerts_count = pending_count - self.last_pending_alerts_count
            logger.info(f"🔊 NOVO(S) ALERTA(S) DETECTADO(S): {new_alerts_count}")
            
            # Verificar se há alertas críticos novos
            has_critical = any(
                a.get('metadata', {}).get('is_critical', False) or 
                a.get('metadata', {}).get('alert_type') == 'critical'
                for a in pending_alerts[:new_alerts_count]
            )
            
            # Tocar som apropriado
            if has_critical:
                logger.info("🚨 Tocando som CRÍTICO (5 beeps)")
                self._play_critical_alert_sound()
            else:
                logger.info("🔔 Tocando som de alerta normal")
                self._play_alert_sound()
        
        # Atualizar contador
        self.last_pending_alerts_count = pending_count
        
        # Limpar lista
        for widget in self.alerts_list_frame.winfo_children():
            widget.destroy()
        
        if not alerts:
            no_data = ctk.CTkLabel(
                self.alerts_list_frame,
                text="Nenhum alerta encontrado",
                font=("Segoe UI", 14)
            )
            no_data.pack(pady=20)
            return
        
        # Criar card para cada alerta
        for alert in alerts:
            self._create_alert_card(alert)
    
    def _create_alert_card(self, alert: Dict):
        """Criar card visual para um alerta"""
        metadata = alert.get("metadata", {})
        is_critical = metadata.get("is_critical", False) or metadata.get("alert_type") == "critical"
        acknowledged = alert.get("acknowledged_by") is not None
        
        # Card frame
        card = ctk.CTkFrame(
            self.alerts_list_frame,
            fg_color="#1a1a1a" if not is_critical else "#3a1010",
            corner_radius=8,
            border_width=2,
            border_color="#ef4444" if is_critical else "#64748b"
        )
        card.pack(fill="x", pady=5, padx=5)
        
        # Header
        header = ctk.CTkFrame(card, fg_color="transparent")
        header.pack(fill="x", padx=10, pady=(10, 5))
        
        # Criticidade badge
        criticality_badge = ctk.CTkLabel(
            header,
            text="🚨 CRÍTICO" if is_critical else "⚠️ Alerta",
            font=("Segoe UI", 11, "bold"),
            fg_color="#dc2626" if is_critical else "#f59e0b",
            corner_radius=4,
            padx=8,
            pady=4
        )
        criticality_badge.pack(side="left", padx=(0, 10))
        
        # Domínio
        domain_label = ctk.CTkLabel(
            header,
            text=f"🌐 {alert.get('domain', 'N/A')}",
            font=("Segoe UI", 13, "bold")
        )
        domain_label.pack(side="left")
        
        # Status badge
        if acknowledged:
            status_badge = ctk.CTkLabel(
                header,
                text="✓ Reconhecido",
                font=("Segoe UI", 10),
                fg_color="#16a34a",
                corner_radius=4,
                padx=6,
                pady=2
            )
            status_badge.pack(side="right")
        
        # Detalhes
        details = ctk.CTkFrame(card, fg_color="transparent")
        details.pack(fill="x", padx=10, pady=5)
        
        info_text = f"💻 Máquina: {alert.get('machine_id', 'N/A')}\n"
        info_text += f"🔗 URL: {alert.get('url', 'N/A')}\n"
        info_text += f"🕐 {alert.get('triggered_at', 'N/A')}"
        
        info_label = ctk.CTkLabel(
            details,
            text=info_text,
            font=("Consolas", 10),
            justify="left"
        )
        info_label.pack(side="left", anchor="w")
        
        # Botões de ação
        action_buttons = ctk.CTkFrame(details, fg_color="transparent")
        action_buttons.pack(side="right", padx=10)
        
        # Botão Ver Site
        view_site_btn = ctk.CTkButton(
            action_buttons,
            text="🌐 Ver Site",
            width=110,
            height=28,
            fg_color="#3b82f6",
            hover_color="#2563eb",
            command=lambda: self.open_alert_site_viewer(alert)
        )
        view_site_btn.pack(side="left", padx=5)
        
        # Botão reconhecer (se não reconhecido)
        if not acknowledged:
            ack_btn = ctk.CTkButton(
                action_buttons,
                text="✓ Reconhecer",
                width=120,
                height=28,
                fg_color="#16a34a",
                hover_color="#15803d",
                command=lambda: self.acknowledge_alert(alert['id'])
            )
            ack_btn.pack(side="left", padx=5)
    
    def acknowledge_alert(self, alert_id: str):
        """Marcar alerta como reconhecido e criar incidente correspondente"""
        def update():
            try:
                user_id = self.auth_manager.get_user_id()
                
                # 1. Buscar dados completos do alerta
                alert_response = self.auth_manager.supabase.table("admin_alerts") \
                    .select("*") \
                    .eq("id", alert_id) \
                    .single() \
                    .execute()
                
                if not alert_response.data:
                    logger.error(f"Alerta {alert_id} não encontrado")
                    return
                
                alert = alert_response.data
                
                # 2. Criar incidente correspondente
                incident_data = {
                    'host': alert.get('domain'),
                    'machine_id': alert.get('machine_id'),
                    'tab_url': alert.get('url'),
                    'cookie_excerpt': f"Alerta reconhecido: {alert.get('domain')}",
                    'severity': 'critical' if alert.get('metadata', {}).get('is_critical') else 'medium',
                    'status': 'resolved',
                    'is_red_list': False,
                    'viewed_at': datetime.now().isoformat(),
                    'resolved_at': datetime.now().isoformat(),
                    'resolution_notes': f"Criado automaticamente a partir do alerta {alert_id}"
                }
                
                incident_response = self.auth_manager.supabase.table("incidents") \
                    .insert(incident_data) \
                    .execute()
                
                logger.info(f"✅ Incidente criado a partir do alerta: {incident_response.data}")
                
                # 3. Marcar alerta como reconhecido
                self.auth_manager.supabase.table("admin_alerts") \
                    .update({
                        "acknowledged_by": user_id,
                        "acknowledged_at": datetime.now().isoformat()
                    }) \
                    .eq("id", alert_id) \
                    .execute()
                
                logger.info(f"✅ Alerta {alert_id} reconhecido e incidente criado")
                
                # 4. Recarregar listas
                self.safe_after(0, self.load_alerts)
                self.safe_after(0, lambda: self.load_incidents(viewed=True))
                
            except Exception as e:
                logger.error(f"Erro ao reconhecer alerta e criar incidente: {e}", exc_info=True)
        
        threading.Thread(target=update, daemon=True).start()
    
    def open_alert_site_viewer(self, alert: Dict):
        """Abrir navegador interativo para um alerta (mesmo sistema dos incidentes)"""
        try:
            logger.info(f"Abrindo navegador interativo para alerta em {alert.get('domain')}")
            
            # Converter estrutura de alerta para formato de incidente
            pseudo_incident = {
                'id': alert.get('id'),
                'host': alert.get('domain'),
                'machine_id': alert.get('machine_id'),
                'tab_url': alert.get('url'),
                'incident_id': f"ALERT-{str(alert.get('id'))[:8]}",
                'severity': 'critical' if alert.get('metadata', {}).get('is_critical') else 'medium',
                'status': 'new',
                'created_at': alert.get('triggered_at')
            }
            
            # Usar o MESMO sistema dos incidentes (navegador interativo)
            from src.ui.interactive_browser_controller import InteractiveBrowserController
            
            controller = InteractiveBrowserController(
                parent=self,
                incident=pseudo_incident,
                browser_manager=self.browser_manager,
                auth_manager=self.auth_manager
            )
            controller.focus()
            
        except Exception as e:
            logger.error(f"Erro ao abrir navegador para alerta: {e}", exc_info=True)
    
    def update_machines_kpis(self):
        """Atualizar KPIs de máquinas"""
        kpis = self.machine_manager.get_machines_kpis()
        
        self.machines_kpi_cards["total_machines"].value_label.configure(text=str(kpis.get("total_machines", 0)))
        self.machines_kpi_cards["active_machines"].value_label.configure(text=str(kpis.get("active_machines", 0)))
        self.machines_kpi_cards["total_tabs"].value_label.configure(text=str(kpis.get("total_tabs", 0)))
        self.machines_kpi_cards["unique_domains"].value_label.configure(text=str(kpis.get("unique_domains", 0)))
    
    def apply_machines_search(self):
        """Aplicar busca de máquinas"""
        self.load_machines()
    
    def create_machine_card(self, machine: Dict):
        """Criar card de máquina monitorada"""
        card = ctk.CTkFrame(self.machines_scroll, fg_color="#1e293b", corner_radius=10)
        card.pack(fill="x", pady=8, padx=5)
        
        content = ctk.CTkFrame(card, fg_color="transparent")
        content.pack(fill="x", padx=15, pady=12)
        
        # Header: Machine ID + Status
        header_frame = ctk.CTkFrame(content, fg_color="transparent")
        header_frame.pack(fill="x", pady=(0, 10))
        
        # Ícone de máquina + ID
        machine_label = ctk.CTkLabel(
            header_frame,
            text=f"🖥️ {machine['machine_id']}",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        machine_label.pack(side="left")
        
        # Badge de status
        is_active = machine.get('is_recently_active', False)
        status_badge = ctk.CTkLabel(
            header_frame,
            text="🟢 ATIVA" if is_active else "⚫ INATIVA",
            fg_color="#22c55e" if is_active else "#64748b",
            corner_radius=4,
            padx=8,
            pady=2,
            font=ctk.CTkFont(size=10, weight="bold")
        )
        status_badge.pack(side="left", padx=15)
        
        # Última atividade
        from datetime import datetime
        last_activity = datetime.fromisoformat(machine['last_activity'].replace('Z', '+00:00'))
        time_ago = self.format_time_ago(last_activity)
        
        time_label = ctk.CTkLabel(
            header_frame,
            text=f"🕒 Última atividade: {time_ago}",
            font=ctk.CTkFont(size=11),
            text_color="gray"
        )
        time_label.pack(side="left", padx=10)
        
        # Estatísticas
        stats_frame = ctk.CTkFrame(content, fg_color="#0f172a", corner_radius=6)
        stats_frame.pack(fill="x", pady=(0, 10))
        
        stats_content = ctk.CTkFrame(stats_frame, fg_color="transparent")
        stats_content.pack(fill="x", padx=10, pady=8)
        
        # Tabs abertas
        tabs_label = ctk.CTkLabel(
            stats_content,
            text=f"📑 {machine['tabs_count']} abas abertas",
            font=ctk.CTkFont(size=12)
        )
        tabs_label.pack(side="left", padx=10)
        
        # Domínios únicos
        domains_label = ctk.CTkLabel(
            stats_content,
            text=f"🌐 {machine['domains_count']} domínios únicos",
            font=ctk.CTkFont(size=12)
        )
        domains_label.pack(side="left", padx=10)
        
        # Top 5 domínios
        if machine['domains']:
            domains_text = ", ".join(machine['domains'][:5])
            if len(machine['domains']) > 5:
                domains_text += f" (+{len(machine['domains']) - 5} mais)"
            
            domains_list_label = ctk.CTkLabel(
                content,
                text=f"Domínios: {domains_text}",
                font=ctk.CTkFont(size=11),
                text_color="gray",
                wraplength=1200,
                justify="left"
            )
            domains_list_label.pack(fill="x", pady=(0, 10))
        
        # Botões de ação
        actions_frame = ctk.CTkFrame(content, fg_color="transparent")
        actions_frame.pack(fill="x")
        
        view_details_btn = ctk.CTkButton(
            actions_frame,
            text="📋 Ver Detalhes",
            width=120,
            height=32,
            fg_color="#3b82f6",
            command=lambda: self.show_machine_details(machine)
        )
        view_details_btn.pack(side="left", padx=(0, 10))
        
        view_sessions_btn = ctk.CTkButton(
            actions_frame,
            text="🌐 Ver Abas",
            width=120,
            height=32,
            fg_color="#8b5cf6",
            command=lambda: self.show_machine_sessions(machine)
        )
        view_sessions_btn.pack(side="left")
    
    def test_alert_sound(self):
        """Testar som de alerta crítico"""
        try:
            logger.info("🔊 Testando som de alerta...")
            self.realtime_manager._play_critical_alert_sound()
            
            # Mostrar feedback visual
            def show_feedback():
                try:
                    from tkinter import messagebox
                    messagebox.showinfo(
                        "Teste de Som",
                        "Som de alerta reproduzido!\n\nVocê ouviu 3 bips?"
                    )
                except Exception as e:
                    logger.error(f"Erro ao mostrar feedback: {e}")
            
            # Agendar feedback após som terminar (1 segundo)
            self.after(1000, show_feedback)
            
        except Exception as e:
            logger.error(f"Erro ao testar som: {e}", exc_info=True)
    
    def format_time_ago(self, dt: datetime) -> str:
        """Formatar tempo relativo (há X minutos/horas)"""
        from datetime import datetime, timedelta
        
        now = datetime.now(dt.tzinfo)
        diff = now - dt
        
        if diff < timedelta(minutes=1):
            return "agora"
        elif diff < timedelta(hours=1):
            minutes = int(diff.total_seconds() / 60)
            return f"há {minutes} min"
        elif diff < timedelta(days=1):
            hours = int(diff.total_seconds() / 3600)
            return f"há {hours}h"
        else:
            days = diff.days
            return f"há {days} dias"
    
    def show_machine_details(self, machine: Dict):
        """Mostrar detalhes detalhados da máquina em janela modal"""
        logger.info(f"Ver detalhes da máquina: {machine['machine_id']}")
        # TODO: Implementar diálogo com todas as informações
    
    def show_machine_sessions(self, machine: Dict):
        """Mostrar todas as abas/sessões abertas da máquina"""
        logger.info(f"Ver sessões da máquina: {machine['machine_id']}")
        # TODO: Implementar diálogo listando todas as abas com URLs completas
    
    def show_add_monitored_domain_dialog(self):
        """Exibir diálogo para adicionar domínio monitorado"""
        dialog = ctk.CTkToplevel(self)
        dialog.title("Adicionar Domínio/URL Monitorado")
        dialog.geometry("550x350")
        dialog.transient(self)
        dialog.grab_set()
        
        # Centralizar
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - (275)
        y = (dialog.winfo_screenheight() // 2) - (175)
        dialog.geometry(f"550x350+{x}+{y}")
        
        # Frame principal
        main_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Título
        ctk.CTkLabel(
            main_frame,
            text="Adicionar Domínio/URL Monitorado",
            font=ctk.CTkFont(size=16, weight="bold")
        ).pack(pady=(0, 20))
        
        # Campo de domínio/URL
        ctk.CTkLabel(main_frame, text="Domínio ou URL completa:", anchor="w").pack(anchor="w")
        domain_entry = ctk.CTkEntry(
            main_frame, 
            width=510, 
            placeholder_text="exemplo.com ou https://exemplo.com/pagina/especifica"
        )
        domain_entry.pack(pady=(5, 15))
        
        # Tipo de alerta
        ctk.CTkLabel(main_frame, text="Tipo de Alerta:", anchor="w").pack(anchor="w")
        alert_type_var = ctk.StringVar(value="critical")
        
        alert_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        alert_frame.pack(fill="x", pady=(5, 15))
        
        ctk.CTkRadioButton(
            alert_frame,
            text="🚨 Crítico (3 beeps altos e repetidos - 1500Hz)",
            variable=alert_type_var,
            value="critical"
        ).pack(anchor="w", pady=2)
        
        ctk.CTkRadioButton(
            alert_frame,
            text="🔔 Normal (1 beep simples - 1200Hz)",
            variable=alert_type_var,
            value="sound"
        ).pack(anchor="w", pady=2)
        
        # Label de exemplo
        example_label = ctk.CTkLabel(
            main_frame,
            text="💡 Exemplo: https://pje1g.trf1.jus.br/pje/QuadroAviso/listViewQuadroAvisoMensagem.seam",
            font=ctk.CTkFont(size=10),
            text_color="gray",
            wraplength=500
        )
        example_label.pack(pady=(0, 20))
        
        # Botões
        btn_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        btn_frame.pack(fill="x", pady=(20, 0))
        
        def add_domain():
            domain_or_url = domain_entry.get().strip()
            if not domain_or_url:
                return
            
            alert_type = alert_type_var.get()
            success = self.domain_manager.add_monitored_domain(domain_or_url, alert_type=alert_type)
            
            if success:
                dialog.destroy()
                self.load_monitored_domains()
        
        ctk.CTkButton(
            btn_frame,
            text="❌ Cancelar",
            width=150,
            height=40,
            fg_color="#64748b",
            hover_color="#475569",
            font=ctk.CTkFont(size=13, weight="bold"),
            command=dialog.destroy
        ).pack(side="left")
        
        ctk.CTkButton(
            btn_frame,
            text="✅ Adicionar",
            width=150,
            height=40,
            fg_color="#22c55e",
            hover_color="#16a34a",
            font=ctk.CTkFont(size=13, weight="bold"),
            command=add_domain
        ).pack(side="right")
    
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
                self.load_alerts()
                logger.info("Dados iniciais carregados com sucesso")
                
                # Iniciar auto-refresh após carregar
                self.start_auto_refresh()
            except Exception as e:
                logger.error(f"Erro ao carregar dados iniciais: {e}", exc_info=True)
        
        thread = threading.Thread(target=load)
        thread.daemon = True
        thread.start()
    
    def start_auto_refresh(self):
        """Iniciar atualização automática"""
        if self.auto_refresh_enabled and not self.refresh_job_id:
            self.refresh_job_id = self.safe_after(self.refresh_interval_ms, self.auto_refresh_callback)
            logger.info("🔄 Auto-refresh ativado (10s)")
    
    def auto_refresh_callback(self):
        """Callback para atualização automática"""
        try:
            # Atualizar KPIs
            self.load_dashboard_data()
            
            # Atualizar incidentes (manter página atual)
            self.load_incidents()
            
            # Atualizar alertas monitorados
            self.load_alerts()
            
            logger.info("✅ Auto-refresh executado")
        except Exception as e:
            logger.error(f"Erro no auto-refresh: {e}", exc_info=True)
        finally:
            # Reagendar próximo refresh
            if self.auto_refresh_enabled:
                self.refresh_job_id = self.safe_after(self.refresh_interval_ms, self.auto_refresh_callback)
    
    def stop_auto_refresh(self):
        """Parar atualização automática"""
        if self.refresh_job_id:
            try:
                self.after_cancel(self.refresh_job_id)
            except:
                pass
            self.refresh_job_id = None
            logger.info("⏸️ Auto-refresh desativado")
    
    def safe_after(self, ms: int, callback, *args):
        """Agendar callback de forma segura"""
        if self._destroyed:
            logger.debug("safe_after: janela já destruída, callback ignorado")
            return None
        
        # Verificar se a janela ainda existe
        try:
            if not self.winfo_exists():
                logger.debug("safe_after: janela não existe mais, callback ignorado")
                return None
        except:
            return None
        
        def safe_callback():
            if not self._destroyed and self.winfo_exists():
                try:
                    callback(*args)
                except Exception as e:
                    logger.error(f"Erro em callback agendado: {e}", exc_info=True)
        
        try:
            after_id = self.after(ms, safe_callback)
            self._after_ids.append(after_id)
            return after_id
        except Exception as e:
            logger.error(f"Erro ao agendar callback: {e}")
            return None
    
    def cancel_after(self, after_id):
        """Cancelar callback agendado de forma segura"""
        if after_id and after_id in self._after_ids:
            try:
                self.after_cancel(after_id)
                self._after_ids.remove(after_id)
            except Exception as e:
                logger.debug(f"Erro ao cancelar callback {after_id}: {e}")
    
    def _safe_callback(self, callback, *args):
        """Wrapper para callbacks agendados"""
        if self._destroyed:
            return
            
        if not hasattr(self, 'winfo_exists') or not self.winfo_exists():
            return
            
        try:
            callback(*args)
        except Exception as e:
            logger.error(f"Erro em callback: {e}", exc_info=True)
    
    def setup_realtime(self):
        """Configurar subscriptions realtime"""
        def on_alert(alert: Dict):
            if self._destroyed or not self.winfo_exists():
                logger.debug("on_alert: janela destruída, callback ignorado")
                return
            logger.info(f"🔔 Novo alerta recebido: {alert}")
            # Recarregar dashboard quando houver novos alertas (usar safe_after)
            self.safe_after(0, self.load_dashboard_data)
            # Recarregar alertas se estiver na aba de alertas
            try:
                current_tab = self.sidebar.get()
                if current_tab == "Alertas Monitorados":
                    self.safe_after(0, self.load_alerts)
            except Exception as e:
                logger.debug(f"Erro ao verificar aba atual: {e}")
        
        def on_sessions_change(event):
            if self._destroyed or not self.winfo_exists():
                logger.debug("on_sessions_change: janela destruída, callback ignorado")
                return
            logger.info(f"📡 Sessão alterada: {event.get('eventType')}")
            # Recarregar máquinas após 1 segundo
            self.safe_after(1000, self.load_machines)
        
        def on_connection_status(status: str):
            """Callback de mudança de status da conexão realtime"""
            if self._destroyed or not self.winfo_exists():
                logger.debug("on_connection_status: janela destruída, callback ignorado")
                return
                
            def update_ui():
                if self._destroyed or not hasattr(self, 'realtime_status_badge'):
                    return
                    
                try:
                    if status == "websocket":
                        self.realtime_status_badge.configure(
                            text="🟢 Websocket ativo",
                            fg_color="#10b981"
                        )
                        logger.info("✅ Realtime: WebSocket conectado")
                    elif status == "polling":
                        self.realtime_status_badge.configure(
                            text="🟡 Polling (fallback)",
                            fg_color="#f59e0b"
                        )
                        logger.warning("⚠️ Realtime: Modo polling (WebSocket falhou)")
                    else:
                        self.realtime_status_badge.configure(
                            text="🔴 Desconectado",
                            fg_color="#ef4444"
                        )
                        logger.error("❌ Realtime: Desconectado")
                except Exception as e:
                    logger.error(f"Erro ao atualizar badge de status: {e}")
            
            self.safe_after(0, update_ui)
        
        self.realtime_manager.on_connection_status_change(on_connection_status)
        self.realtime_manager.start(on_alert=on_alert)
        self.realtime_manager.subscribe_to_sessions(on_sessions_change)
    
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
        if self._destroyed:
            return
        
        logger.info("Cancelando callbacks pendentes...")
        
        # Cancelar TODOS os callbacks pendentes ANTES de marcar como destruído
        for after_id in list(self._after_ids):
            try:
                self.after_cancel(after_id)
            except:
                pass
        self._after_ids.clear()
        
        # AGORA marcar como destruído
        self._destroyed = True
        
        # Parar auto-refresh
        self.stop_auto_refresh()
        
        # Fechar managers
        try:
            self.realtime_manager.stop()
        except:
            pass
        
        try:
            import asyncio
            from src.utils.async_helper import run_async
            run_async(self.browser_manager.close_all_sessions())
        except:
            pass
        
        super().destroy()
    
    def _play_alert_sound(self):
        """Tocar som de alerta normal"""
        import winsound
        import threading
        try:
            def play():
                try:
                    winsound.Beep(1200, 500)
                except Exception as e:
                    logger.warning(f"Erro ao tocar som: {e}")
            threading.Thread(target=play, daemon=True).start()
        except Exception as e:
            logger.warning(f"Erro ao criar thread de som: {e}")

    def _play_critical_alert_sound(self):
        """Tocar som de alerta CRÍTICO (5 beeps altos)"""
        import winsound
        import threading
        import time
        try:
            logger.info("🔊 Playing CRITICAL alert sound (5 beeps)...")
            def play():
                try:
                    for i in range(5):
                        winsound.Beep(2000, 300)
                        time.sleep(0.2)
                    logger.info("✅ Critical alert sound played")
                except Exception as e:
                    logger.error(f"❌ Error playing sound: {e}")
            threading.Thread(target=play, daemon=True).start()
        except Exception as e:
            logger.warning(f"Erro ao tocar som crítico: {e}")
