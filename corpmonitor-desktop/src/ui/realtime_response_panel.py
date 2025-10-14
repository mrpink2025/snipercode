"""
Painel para exibir respostas de popup em tempo real
"""
import customtkinter as ctk
from typing import Optional
import threading
import json
from src.config.supabase_config import supabase
from datetime import datetime


class RealtimeResponsePanel(ctk.CTkFrame):
    """Painel de respostas com polling (sync client não suporta realtime)"""
    
    def __init__(self, parent, machine_id: str, domain: str):
        super().__init__(parent, fg_color="#1e293b", corner_radius=8)
        
        self.machine_id = machine_id
        self.domain = domain
        self.responses = []
        self.last_seen_created_at = None
        self.polling_active = True
        
        # Criar widgets
        self.create_widgets()
        
        # Carregar respostas existentes
        threading.Thread(target=self.fetch_responses, daemon=True).start()
        
        # Iniciar polling a cada 2 segundos
        threading.Thread(target=self.poll_responses, daemon=True).start()
    
    def create_widgets(self):
        """Criar widgets do painel"""
        # Header
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=5, pady=5)
        
        ctk.CTkLabel(
            header,
            text="Respostas não lidas:",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(side="left")
        
        self.count_label = ctk.CTkLabel(
            header,
            text="0",
            font=("Roboto", 11, "bold"),
            text_color="#f59e0b",
            width=30
        )
        self.count_label.pack(side="left", padx=5)
        
        # Scroll de respostas
        self.scroll_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", height=150)
        self.scroll_frame.pack(fill="both", expand=True, padx=5, pady=5)
        
        # Mensagem vazia
        self.empty_label = ctk.CTkLabel(
            self.scroll_frame,
            text="Nenhuma resposta ainda",
            font=("Roboto", 10),
            text_color="#64748b"
        )
        self.empty_label.pack(pady=20)
    
    def fetch_responses(self):
        """Buscar respostas existentes"""
        try:
            response = supabase.table('popup_responses')\
                .select('*')\
                .eq('machine_id', self.machine_id)\
                .eq('is_read', False)\
                .order('created_at', desc=True)\
                .limit(10)\
                .execute()
            
            if response.data:
                # Guardar timestamp da resposta mais recente
                if response.data:
                    self.last_seen_created_at = response.data[0].get('created_at')
                self.after(0, lambda: self.add_responses(response.data))
        except Exception as e:
            print(f"[ResponsePanel] Erro ao buscar respostas: {e}")
    
    def poll_responses(self):
        """Polling a cada 2 segundos para novas respostas (sync client não suporta realtime)"""
        import time
        
        while self.polling_active:
            try:
                time.sleep(2)
                
                # Buscar respostas mais recentes que a última vista
                query = supabase.table('popup_responses')\
                    .select('*')\
                    .eq('machine_id', self.machine_id)\
                    .eq('is_read', False)\
                    .order('created_at', desc=False)\
                    .limit(20)
                
                if self.last_seen_created_at:
                    query = query.gt('created_at', self.last_seen_created_at)
                
                response = query.execute()
                
                if response.data:
                    # Processar novas respostas
                    for new_response in response.data:
                        print(f"[ResponsePanel] 🎯 Nova resposta detectada via polling!")
                        
                        # Tocar som
                        self.play_alert_sound()
                        
                        # Adicionar à lista
                        self.after(0, lambda r=new_response: self.add_response(r))
                        
                        # Atualizar timestamp
                        self.last_seen_created_at = new_response.get('created_at')
                
            except Exception as e:
                print(f"[ResponsePanel] Erro no polling: {e}")
                time.sleep(5)  # Aguardar mais em caso de erro
    
    def add_responses(self, responses: list):
        """Adicionar múltiplas respostas"""
        self.empty_label.pack_forget()
        
        for response in responses:
            self.add_response_card(response)
        
        self.update_count()
    
    def add_response(self, response: dict):
        """Adicionar uma resposta"""
        self.empty_label.pack_forget()
        self.add_response_card(response)
        self.update_count()
    
    def add_response_card(self, response: dict):
        """Criar card de resposta"""
        card = ctk.CTkFrame(self.scroll_frame, fg_color="#334155", corner_radius=6)
        card.pack(fill="x", pady=3)
        
        # Conteúdo
        content_frame = ctk.CTkFrame(card, fg_color="transparent")
        content_frame.pack(fill="both", expand=True, padx=10, pady=8)
        
        # Domínio e hora
        header = ctk.CTkFrame(content_frame, fg_color="transparent")
        header.pack(fill="x")
        
        ctk.CTkLabel(
            header,
            text=f"🌐 {response['domain'][:30]}",
            font=("Roboto", 10, "bold"),
            anchor="w"
        ).pack(side="left")
        
        created_at = response.get('created_at', '')
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                time_str = dt.strftime('%H:%M')
            except:
                time_str = created_at[:5]
        else:
            time_str = "agora"
        
        ctk.CTkLabel(
            header,
            text=time_str,
            font=("Roboto", 9),
            text_color="#94a3b8",
            anchor="e"
        ).pack(side="right")
        
        # Preview dos dados
        form_data = response.get('form_data', {})
        preview = json.dumps(form_data, indent=2)[:80] + "..."
        
        ctk.CTkLabel(
            content_frame,
            text=preview,
            font=("Roboto", 9),
            text_color="#cbd5e1",
            anchor="w",
            wraplength=250
        ).pack(fill="x", pady=(5, 0))
        
        # Botões
        btn_frame = ctk.CTkFrame(content_frame, fg_color="transparent")
        btn_frame.pack(fill="x", pady=(8, 0))
        
        btn_view = ctk.CTkButton(
            btn_frame,
            text="Ver Dados",
            command=lambda: self.view_response(response),
            width=80,
            height=25,
            font=("Roboto", 9),
            fg_color="#3b82f6",
            hover_color="#2563eb"
        )
        btn_view.pack(side="left", padx=(0, 5))
        
        btn_mark = ctk.CTkButton(
            btn_frame,
            text="Marcar Lido",
            command=lambda: self.mark_as_read(response['id'], card),
            width=90,
            height=25,
            font=("Roboto", 9),
            fg_color="#64748b",
            hover_color="#475569"
        )
        btn_mark.pack(side="left")
        
        self.responses.append({'id': response['id'], 'card': card})
    
    def view_response(self, response: dict):
        """Abrir dialog com detalhes da resposta"""
        dialog = ctk.CTkToplevel(self)
        dialog.title("📋 Detalhes da Resposta")
        dialog.geometry("500x400")
        
        # Centralizar
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - 250
        y = (dialog.winfo_screenheight() // 2) - 200
        dialog.geometry(f'500x400+{x}+{y}')
        
        # Conteúdo
        ctk.CTkLabel(
            dialog,
            text=f"🌐 {response['domain']}",
            font=("Roboto", 14, "bold")
        ).pack(pady=10)
        
        ctk.CTkLabel(
            dialog,
            text=f"🔗 {response['url'][:60]}...",
            font=("Roboto", 10),
            text_color="#94a3b8"
        ).pack(pady=5)
        
        # Dados do formulário
        ctk.CTkLabel(
            dialog,
            text="Dados do Formulário:",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(fill="x", padx=20, pady=(15, 5))
        
        data_box = ctk.CTkTextbox(dialog, height=250)
        data_box.pack(fill="both", expand=True, padx=20, pady=5)
        data_box.insert("1.0", json.dumps(response.get('form_data', {}), indent=2, ensure_ascii=False))
        data_box.configure(state="disabled")
        
        # Botão fechar
        ctk.CTkButton(
            dialog,
            text="Fechar",
            command=dialog.destroy,
            width=100
        ).pack(pady=10)
    
    def mark_as_read(self, response_id: str, card: ctk.CTkFrame):
        """Marcar resposta como lida"""
        def mark():
            try:
                supabase.table('popup_responses')\
                    .update({'is_read': True})\
                    .eq('id', response_id)\
                    .execute()
                
                # Remover card
                self.after(0, lambda: self.remove_response_card(response_id, card))
                
            except Exception as e:
                print(f"[ResponsePanel] Erro ao marcar como lido: {e}")
        
        threading.Thread(target=mark, daemon=True).start()
    
    def remove_response_card(self, response_id: str, card: ctk.CTkFrame):
        """Remover card da interface"""
        card.destroy()
        self.responses = [r for r in self.responses if r['id'] != response_id]
        self.update_count()
        
        if len(self.responses) == 0:
            self.empty_label.pack(pady=20)
    
    def update_count(self):
        """Atualizar contador de respostas"""
        count = len(self.responses)
        self.count_label.configure(text=str(count))
    
    def play_alert_sound(self):
        """Tocar som de alerta"""
        try:
            import winsound
            # Três beeps crescentes
            winsound.Beep(800, 150)
            winsound.Beep(1000, 150)
            winsound.Beep(1200, 300)
        except Exception as e:
            print(f"[ResponsePanel] Erro ao tocar som: {e}")
    
    def destroy(self):
        """Cleanup ao destruir"""
        self.polling_active = False
        super().destroy()
