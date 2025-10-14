from supabase import Client
from typing import List, Dict, Optional
from datetime import datetime
from urllib.parse import urlparse
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
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """Validar URL completa"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except:
            return False
    
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
    
    def add_monitored_domain(self, domain_or_url: str, alert_type: str = "critical", alert_frequency: int = 60) -> bool:
        """Adicionar novo domínio ou URL completa à lista de monitoramento"""
        try:
            from src.utils.logger import logger
            
            # Determinar se é URL completa ou apenas domínio
            domain_clean = domain_or_url.strip()
            full_url = None
            
            if domain_clean.startswith('http://') or domain_clean.startswith('https://'):
                # É uma URL completa
                if not self.validate_url(domain_clean):
                    logger.error(f"URL inválida: {domain_clean}")
                    return False
                parsed = urlparse(domain_clean)
                domain = parsed.netloc
                full_url = domain_clean
                logger.info(f"Processando URL monitorada: {full_url} (domínio: {domain})")
            else:
                # É apenas um domínio
                domain = domain_clean.lower()
                if not self.validate_domain(domain):
                    logger.error(f"Domínio inválido: {domain}")
                    return False
                logger.info(f"Processando domínio monitorado: {domain}")
            
            # VERIFICAR SE JÁ EXISTE
            existing = self.supabase.table("monitored_domains")\
                .select("*")\
                .eq("domain", domain)\
                .maybeSingle()\
                .execute()
            
            if existing.data:
                # Domínio já existe
                if existing.data['is_active']:
                    logger.warning(f"⚠️ Domínio {domain} já está ativo no monitoramento")
                    return False
                else:
                    # REATIVAR domínio inativo
                    logger.info(f"♻️ Reativando domínio {domain} que estava inativo")
                    
                    update_data = {
                        "is_active": True,
                        "alert_type": alert_type,
                        "alert_frequency": alert_frequency
                    }
                    
                    if full_url:
                        update_data["metadata"] = {"full_url": full_url}
                    
                    response = self.supabase.table("monitored_domains")\
                        .update(update_data)\
                        .eq("domain", domain)\
                        .execute()
                    
                    logger.info(f"✅ Domínio {domain} reativado com sucesso")
                    return bool(response.data)
            else:
                # INSERIR NOVO domínio
                logger.info(f"➕ Adicionando novo domínio: {domain}")
                
                data = {
                    "domain": domain,
                    "alert_type": alert_type,
                    "alert_frequency": alert_frequency,
                    "added_by": self.user_id,
                    "is_active": True,
                    "metadata": {"full_url": full_url} if full_url else None
                }
                
                response = self.supabase.table("monitored_domains").insert(data).execute()
                logger.info(f"✅ Domínio {domain} adicionado com sucesso")
                return bool(response.data)
                
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao adicionar/reativar domínio monitorado: {e}", exc_info=True)
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
