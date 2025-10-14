"""
Dialog para bloquear domínio
"""
import customtkinter as ctk
from typing import Optional
import threading
from src.config.supabase_config import supabase


class BlockDomainDialog(ctk.CTkToplevel):
    """Dialog para confirmar bloqueio de domínio"""
    
    def __init__(self, parent, domain: str, incident_id: str, user_id: str):
        super().__init__(parent)
        
        self.domain = domain
        self.incident_id = incident_id
        self.user_id = user_id
        self.is_blocking = False
        
        # Configurar janela
        self.title("🚫 Bloquear Domínio")
        self.geometry("450x350")
        self.center_window()
        
        # Criar widgets
        self.create_widgets()
    
    def center_window(self):
        """Centralizar janela na tela"""
        self.update_idletasks()
        x = (self.winfo_screenwidth() // 2) - 225
        y = (self.winfo_screenheight() // 2) - 175
        self.geometry(f'450x350+{x}+{y}')
    
    def create_widgets(self):
        """Criar widgets da interface"""
        # Ícone e título
        ctk.CTkLabel(
            self,
            text="⚠️",
            font=("Roboto", 48)
        ).pack(pady=(20, 10))
        
        ctk.CTkLabel(
            self,
            text="Bloquear Domínio",
            font=("Roboto", 18, "bold")
        ).pack(pady=5)
        
        # Aviso
        warning_frame = ctk.CTkFrame(self, fg_color="#fef3c7", corner_radius=8)
        warning_frame.pack(fill="x", padx=20, pady=15)
        
        ctk.CTkLabel(
            warning_frame,
            text=f"Você está prestes a bloquear o domínio:",
            font=("Roboto", 11),
            text_color="#92400e"
        ).pack(pady=(10, 5))
        
        ctk.CTkLabel(
            warning_frame,
            text=self.domain,
            font=("Roboto", 12, "bold"),
            text_color="#78350f"
        ).pack(pady=(0, 10))
        
        # Informação de impacto
        ctk.CTkLabel(
            self,
            text="⚠️ Todas as máquinas com a extensão instalada\nserão impedidas de acessar este domínio.",
            font=("Roboto", 10),
            text_color="#ef4444",
            justify="center"
        ).pack(pady=10)
        
        # Input de confirmação
        ctk.CTkLabel(
            self,
            text='Digite "BLOCK" para confirmar:',
            font=("Roboto", 11),
            anchor="w"
        ).pack(fill="x", padx=20, pady=(15, 5))
        
        self.confirmation_input = ctk.CTkEntry(
            self,
            placeholder_text="BLOCK",
            font=("Roboto", 12),
            height=40
        )
        self.confirmation_input.pack(fill="x", padx=20, pady=5)
        self.confirmation_input.bind("<Return>", lambda e: self.block_domain())
        
        # Botões
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="x", padx=20, pady=(20, 10))
        
        ctk.CTkButton(
            btn_frame,
            text="Cancelar",
            command=self.destroy,
            fg_color="#64748b",
            hover_color="#475569",
            width=120,
            height=40
        ).pack(side="left", padx=5)
        
        self.btn_block = ctk.CTkButton(
            btn_frame,
            text="🚫 Bloquear",
            command=self.block_domain,
            fg_color="#ef4444",
            hover_color="#dc2626",
            width=150,
            height=40,
            font=("Roboto", 12, "bold")
        )
        self.btn_block.pack(side="right", padx=5)
        
        # Focar no input
        self.confirmation_input.focus()
    
    def block_domain(self):
        """Executar bloqueio do domínio"""
        if self.is_blocking:
            return
        
        # Verificar confirmação
        if self.confirmation_input.get().strip() != "BLOCK":
            self.show_error("❌ Digite 'BLOCK' para confirmar")
            self.confirmation_input.focus()
            return
        
        self.is_blocking = True
        self.btn_block.configure(state="disabled", text="Bloqueando...")
        
        def block():
            try:
                # Chamar edge function block-domain
                response = supabase.functions.invoke('block-domain', {
                    'body': {
                        'domain': self.domain,
                        'reason': f'Bloqueio manual via incidente {self.incident_id}',
                        'incident_id': self.incident_id
                    }
                })
                
                result = response.json()
                
                if result.get('success'):
                    self.after(0, lambda: self.on_block_success())
                else:
                    error_msg = result.get('error', 'Erro desconhecido')
                    self.after(0, lambda: self.on_block_error(error_msg))
                
            except Exception as e:
                print(f"[BlockDialog] Erro ao bloquear domínio: {e}")
                import traceback
                traceback.print_exc()
                self.after(0, lambda: self.on_block_error(str(e)))
        
        threading.Thread(target=block, daemon=True).start()
    
    def on_block_success(self):
        """Callback quando bloqueio é bem-sucedido"""
        self.show_success(f"✅ Domínio {self.domain} bloqueado com sucesso!")
        self.after(1500, self.destroy)
    
    def on_block_error(self, error: str):
        """Callback quando há erro no bloqueio"""
        self.is_blocking = False
        self.btn_block.configure(state="normal", text="🚫 Bloquear")
        self.show_error(f"❌ Erro: {error}")
    
    def show_success(self, message: str):
        """Mostrar mensagem de sucesso"""
        self.show_toast(message, "#22c55e")
    
    def show_error(self, message: str):
        """Mostrar mensagem de erro"""
        self.show_toast(message, "#ef4444")
    
    def show_toast(self, message: str, color: str):
        """Mostrar toast temporário"""
        toast = ctk.CTkLabel(
            self,
            text=message,
            font=("Roboto", 11),
            fg_color=color,
            corner_radius=6,
            padx=12,
            pady=8
        )
        toast.place(relx=0.5, rely=0.95, anchor="center")
        self.after(3000, toast.destroy)
