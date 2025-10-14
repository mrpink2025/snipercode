from supabase import Client
from typing import List, Dict, Optional
from datetime import datetime
import re

class DomainManager:
    def __init__(self, supabase: Client, user_id: str):
        self.supabase = supabase
        self.user_id = user_id
    
    @staticmethod
    def validate_domain(domain: str) -> bool:
        """Validar formato de domínio"""
        if not domain or len(domain) < 3 or len(domain) > 255:
            return False
        
        # Regex básico para validar domínio
        pattern = r'^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
        return bool(re.match(pattern, domain.strip().lower()))
    
    def get_monitored_domains(self) -> List[Dict]:
        """Buscar todos os domínios monitorados ativos"""
        try:
            from src.utils.logger import logger
            logger.info("Buscando domínios monitorados")
            
            response = self.supabase.table("monitored_domains")\
                .select("*")\
                .eq("is_active", True)\
                .order("created_at", desc=True)\
                .execute()
            
            logger.info(f"✓ Encontrados {len(response.data) if response.data else 0} domínios monitorados")
            return response.data if response.data else []
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar domínios monitorados: {e}", exc_info=True)
            return []
    
    def add_monitored_domain(self, domain: str, alert_type: str = "sound", alert_frequency: int = 60) -> bool:
        """Adicionar novo domínio à lista de monitoramento"""
        try:
            from src.utils.logger import logger
            logger.info(f"Adicionando domínio monitorado: {domain}")
            
            data = {
                "domain": domain,
                "alert_type": alert_type,
                "alert_frequency": alert_frequency,
                "added_by": self.user_id,
                "is_active": True
            }
            
            response = self.supabase.table("monitored_domains").insert(data).execute()
            logger.info(f"✓ Domínio {domain} adicionado com sucesso")
            return bool(response.data)
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao adicionar domínio monitorado {domain}: {e}", exc_info=True)
            return False
    
    def remove_monitored_domain(self, domain_id: str) -> bool:
        """Remover domínio da lista de monitoramento"""
        try:
            from src.utils.logger import logger
            logger.info(f"Removendo domínio monitorado: {domain_id}")
            
            response = self.supabase.table("monitored_domains")\
                .update({"is_active": False})\
                .eq("id", domain_id)\
                .execute()
            
            logger.info(f"✓ Domínio {domain_id} removido com sucesso")
            return bool(response.data)
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao remover domínio monitorado {domain_id}: {e}", exc_info=True)
            return False
    
    def get_blocked_domains(self) -> List[Dict]:
        """Buscar todos os domínios bloqueados ativos"""
        try:
            from src.utils.logger import logger
            logger.info("Buscando domínios bloqueados")
            
            response = self.supabase.table("blocked_domains")\
                .select("*")\
                .eq("is_active", True)\
                .order("created_at", desc=True)\
                .execute()
            
            logger.info(f"✓ Encontrados {len(response.data) if response.data else 0} domínios bloqueados")
            return response.data if response.data else []
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar domínios bloqueados: {e}", exc_info=True)
            return []
    
    def block_domain(self, domain: str, reason: str, expires_at: Optional[str] = None) -> bool:
        """Bloquear um domínio"""
        try:
            from src.utils.logger import logger
            
            # Validar formato do domínio
            domain_clean = domain.strip().lower()
            if not self.validate_domain(domain_clean):
                logger.error(f"Domínio inválido: {domain}")
                return False
            
            logger.info(f"Bloqueando domínio: {domain_clean}")
            
            data = {
                "domain": domain_clean,
                "reason": reason,
                "blocked_by": self.user_id,
                "is_active": True
            }
            
            if expires_at:
                data["expires_at"] = expires_at
            
            response = self.supabase.table("blocked_domains").insert(data).execute()
            logger.info(f"✓ Domínio {domain} bloqueado com sucesso")
            return bool(response.data)
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao bloquear domínio {domain}: {e}", exc_info=True)
            return False
