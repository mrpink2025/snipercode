import os
from supabase import create_client, Client
from typing import Optional, Dict
from dotenv import load_dotenv

load_dotenv()

class AuthManager:
    def __init__(self):
        self.supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_ANON_KEY")
        )
        self.current_user: Optional[Dict] = None
        self.current_profile: Optional[Dict] = None
        self.session = None
    
    def sign_in(self, email: str, password: str) -> tuple[bool, str]:
        """
        Login com mesmas credenciais do painel web.
        Retorna: (sucesso: bool, mensagem: str)
        """
        try:
            # Autenticar via Supabase (API síncrona)
            response = self.supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if response.user:
                # Converter user para dict para facilitar acesso
                self.current_user = {
                    "id": response.user.id,
                    "email": response.user.email
                }
                self.session = response.session
                
                # Buscar perfil do usuário
                profile_response = self.supabase.table("profiles")\
                    .select("*")\
                    .eq("id", response.user.id)\
                    .single()\
                    .execute()
                
                if profile_response.data:
                    self.current_profile = profile_response.data
                    
                    # Verificar se é admin, superadmin ou demo_admin
                    role = self.current_profile.get("role")
                    if role not in ["admin", "superadmin", "demo_admin"]:
                        self.sign_out()
                        return False, "Acesso negado: apenas administradores podem usar este painel."
                    
                    return True, "Login realizado com sucesso!"
                else:
                    return False, "Perfil de usuário não encontrado."
            else:
                return False, "Credenciais inválidas."
                
        except Exception as e:
            return False, f"Erro ao autenticar: {str(e)}"
    
    def sign_out(self):
        """Deslogar usuário"""
        try:
            self.supabase.auth.sign_out()
        except:
            pass
        finally:
            self.current_user = None
            self.current_profile = None
            self.session = None
    
    def is_authenticated(self) -> bool:
        """Verificar se está autenticado"""
        return self.current_user is not None and self.current_profile is not None
    
    def get_user_name(self) -> str:
        """Obter nome do usuário logado"""
        if self.current_profile:
            return self.current_profile.get("full_name", "Usuário")
        return ""
    
    def get_user_role(self) -> str:
        """Obter role do usuário"""
        if self.current_profile:
            return self.current_profile.get("role", "")
        return ""
    
    def is_admin(self) -> bool:
        """Verificar se é admin ou superior"""
        role = self.get_user_role()
        return role in ["admin", "superadmin", "demo_admin"]
    
    def get_user_id(self) -> Optional[str]:
        """Obter ID do usuário logado"""
        if self.current_user:
            return self.current_user.get("id")
        return None
    
    def get_access_token(self) -> Optional[str]:
        """Obter access token da sessão atual"""
        if self.session:
            return self.session.access_token
        return None
