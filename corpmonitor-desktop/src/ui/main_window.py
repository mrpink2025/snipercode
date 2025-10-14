import customtkinter as ctk
from src.managers.auth_manager import AuthManager
from src.managers.incident_manager import IncidentManager
from src.managers.domain_manager import DomainManager
from typing import Dict

class MainWindow(ctk.CTk):
    def __init__(self, auth_manager: AuthManager):
        super().__init__()
        
        self.auth_manager = auth_manager
        self.incident_manager = IncidentManager(auth_manager.supabase)
        self.domain_manager = DomainManager(
            auth_manager.supabase,
            auth_manager.current_user.id
        )
        
        # Configuração da janela
        self.title("CorpMonitor Desktop")
        self.geometry("1400x900")
        
        # Centralizar janela
        self.center_window()
        
        # Configurar tema
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        
        # Criar UI
        self.create_widgets()
        
        # Carregar dados iniciais
        self.load_dashboard_data()
    
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
        
        info_label = ctk.CTkLabel(
            incidents_tab,
            text="Lista de incidentes será implementada em breve",
            font=ctk.CTkFont(size=14),
            text_color="gray"
        )
        info_label.pack(expand=True)
    
    def create_monitored_domains_tab(self):
        """Criar aba de domínios monitorados"""
        monitored_tab = self.tabview.tab("🌐 Domínios Monitorados")
        
        info_label = ctk.CTkLabel(
            monitored_tab,
            text="Lista de domínios monitorados será implementada em breve",
            font=ctk.CTkFont(size=14),
            text_color="gray"
        )
        info_label.pack(expand=True)
    
    def create_blocked_domains_tab(self):
        """Criar aba de domínios bloqueados"""
        blocked_tab = self.tabview.tab("🚫 Domínios Bloqueados")
        
        info_label = ctk.CTkLabel(
            blocked_tab,
            text="Lista de domínios bloqueados será implementada em breve",
            font=ctk.CTkFont(size=14),
            text_color="gray"
        )
        info_label.pack(expand=True)
    
    def load_dashboard_data(self):
        """Carregar dados do dashboard"""
        # Carregar KPIs
        kpis = self.incident_manager.get_kpis()
        
        for key, card in self.kpi_cards.items():
            value = kpis.get(key, 0)
            card.value_label.configure(text=str(value))
    
    def handle_logout(self):
        """Processar logout"""
        self.auth_manager.sign_out()
        self.destroy()
