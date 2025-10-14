from supabase import Client
from typing import List, Dict, Optional
from datetime import datetime

class DomainManager:
    def __init__(self, supabase: Client, user_id: str):
        self.supabase = supabase
        self.user_id = user_id
    
    def get_monitored_domains(self) -> List[Dict]:
        """Buscar todos os domínios monitorados ativos"""
        try:
            response = self.supabase.table("monitored_domains")\
                .select("*")\
                .eq("is_active", True)\
                .order("created_at", desc=True)\
                .execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Erro ao buscar domínios monitorados: {e}")
            return []
    
    def add_monitored_domain(self, domain: str, alert_type: str = "sound", alert_frequency: int = 60) -> bool:
        """Adicionar novo domínio à lista de monitoramento"""
        try:
            data = {
                "domain": domain,
                "alert_type": alert_type,
                "alert_frequency": alert_frequency,
                "added_by": self.user_id,
                "is_active": True
            }
            
            response = self.supabase.table("monitored_domains").insert(data).execute()
            return bool(response.data)
        except Exception as e:
            print(f"Erro ao adicionar domínio monitorado: {e}")
            return False
    
    def remove_monitored_domain(self, domain_id: str) -> bool:
        """Remover domínio da lista de monitoramento"""
        try:
            response = self.supabase.table("monitored_domains")\
                .update({"is_active": False})\
                .eq("id", domain_id)\
                .execute()
            return bool(response.data)
        except Exception as e:
            print(f"Erro ao remover domínio monitorado: {e}")
            return False
    
    def get_blocked_domains(self) -> List[Dict]:
        """Buscar todos os domínios bloqueados ativos"""
        try:
            response = self.supabase.table("blocked_domains")\
                .select("*")\
                .eq("is_active", True)\
                .order("created_at", desc=True)\
                .execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Erro ao buscar domínios bloqueados: {e}")
            return []
    
    def block_domain(self, domain: str, reason: str, expires_at: Optional[str] = None) -> bool:
        """Bloquear um domínio"""
        try:
            data = {
                "domain": domain,
                "reason": reason,
                "blocked_by": self.user_id,
                "is_active": True
            }
            
            if expires_at:
                data["expires_at"] = expires_at
            
            response = self.supabase.table("blocked_domains").insert(data).execute()
            return bool(response.data)
        except Exception as e:
            print(f"Erro ao bloquear domínio: {e}")
            return False
