#!/usr/bin/env python3
"""
Machine Manager
Gerencia máquinas monitoradas via active_sessions
"""

from supabase import Client
from typing import List, Dict, Optional
from datetime import datetime, timedelta


class MachineManager:
    """Gerenciador de máquinas monitoradas"""
    
    def __init__(self, supabase: Client, user_id: str):
        self.supabase = supabase
        self.user_id = user_id
    
    def get_monitored_machines(self, active_only: bool = True, search_term: str = "") -> List[Dict]:
        """
        Buscar máquinas monitoradas agrupadas por machine_id
        
        Args:
            active_only: Filtrar apenas máquinas ativas
            search_term: Termo de busca para filtrar por machine_id
            
        Returns:
            Lista de dicionários com informações das máquinas
        """
        try:
            from src.utils.logger import logger
            logger.info(f"Buscando máquinas monitoradas (active_only={active_only}, search='{search_term}')")
            
            # Buscar todas as sessões ativas
            query = self.supabase.table("active_sessions").select("*")
            
            if active_only:
                query = query.eq("is_active", True)
            
            response = query.execute()
            sessions = response.data if response.data else []
            
            # Agrupar por machine_id
            machines_dict = {}
            for session in sessions:
                machine_id = session['machine_id']
                
                # Filtrar por termo de busca
                if search_term and search_term.lower() not in machine_id.lower():
                    continue
                
                if machine_id not in machines_dict:
                    machines_dict[machine_id] = {
                        "machine_id": machine_id,
                        "tabs_count": 0,
                        "domains": set(),
                        "last_activity": session['last_activity'],
                        "is_active": session['is_active'],
                        "sessions": []
                    }
                
                machines_dict[machine_id]["tabs_count"] += 1
                machines_dict[machine_id]["domains"].add(session['domain'])
                machines_dict[machine_id]["sessions"].append(session)
                
                # Atualizar última atividade se mais recente
                if session['last_activity'] > machines_dict[machine_id]["last_activity"]:
                    machines_dict[machine_id]["last_activity"] = session['last_activity']
            
            # Converter para lista e formatar
            machines_list = []
            for machine in machines_dict.values():
                machine['domains'] = list(machine['domains'])
                machine['domains_count'] = len(machine['domains'])
                
                # Determinar se está realmente ativa (última atividade < 5min)
                last_activity = datetime.fromisoformat(machine['last_activity'].replace('Z', '+00:00'))
                is_recently_active = (datetime.now(last_activity.tzinfo) - last_activity) < timedelta(minutes=5)
                machine['is_recently_active'] = is_recently_active
                
                machines_list.append(machine)
            
            # Ordenar por última atividade
            machines_list.sort(key=lambda x: x['last_activity'], reverse=True)
            
            logger.info(f"✓ Encontradas {len(machines_list)} máquinas")
            return machines_list
            
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar máquinas monitoradas: {e}", exc_info=True)
            return []
    
    def get_machine_details(self, machine_id: str) -> Dict:
        """
        Obter detalhes completos de uma máquina específica
        
        Args:
            machine_id: ID da máquina
            
        Returns:
            Dicionário com detalhes da máquina
        """
        try:
            from src.utils.logger import logger
            logger.info(f"Buscando detalhes da máquina: {machine_id}")
            
            response = self.supabase.table("active_sessions")\
                .select("*")\
                .eq("machine_id", machine_id)\
                .execute()
            
            sessions = response.data if response.data else []
            
            if not sessions:
                return {}
            
            # Calcular estatísticas
            domains = set(s['domain'] for s in sessions)
            last_activity = max(s['last_activity'] for s in sessions)
            
            return {
                "machine_id": machine_id,
                "tabs_count": len(sessions),
                "domains": list(domains),
                "domains_count": len(domains),
                "last_activity": last_activity,
                "sessions": sessions
            }
            
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar detalhes da máquina: {e}", exc_info=True)
            return {}
    
    def get_machines_kpis(self) -> Dict:
        """
        Calcular KPIs do painel de máquinas
        
        Returns:
            Dicionário com KPIs calculados
        """
        try:
            from src.utils.logger import logger
            
            # Buscar todas as sessões ativas
            response = self.supabase.table("active_sessions")\
                .select("*")\
                .eq("is_active", True)\
                .execute()
            
            sessions = response.data if response.data else []
            
            # Calcular métricas
            machines = set()
            active_machines = set()
            domains = set()
            total_tabs = len(sessions)
            
            now = datetime.now()
            
            for session in sessions:
                machine_id = session['machine_id']
                machines.add(machine_id)
                domains.add(session['domain'])
                
                # Máquina ativa se última atividade < 5min
                last_activity = datetime.fromisoformat(session['last_activity'].replace('Z', '+00:00'))
                if (now.replace(tzinfo=last_activity.tzinfo) - last_activity) < timedelta(minutes=5):
                    active_machines.add(machine_id)
            
            kpis = {
                "total_machines": len(machines),
                "active_machines": len(active_machines),
                "total_tabs": total_tabs,
                "unique_domains": len(domains)
            }
            
            logger.info(f"✓ KPIs de máquinas calculados: {kpis}")
            return kpis
            
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao calcular KPIs de máquinas: {e}", exc_info=True)
            return {
                "total_machines": 0,
                "active_machines": 0,
                "total_tabs": 0,
                "unique_domains": 0
            }
    
    def get_pending_alerts_count(self, machine_id: str) -> int:
        """
        Contar alertas pendentes para uma máquina específica
        
        Args:
            machine_id: ID da máquina (ex: usuario@empresa.com)
            
        Returns:
            Número de alertas não reconhecidos (acknowledged_by IS NULL)
        """
        try:
            from src.utils.logger import logger
            
            response = self.supabase.table('admin_alerts') \
                .select('id', count='exact') \
                .eq('machine_id', machine_id) \
                .is_('acknowledged_by', 'null') \
                .execute()
            
            return response.count if response.count else 0
            
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao contar alertas: {e}", exc_info=True)
            return 0
    
    def get_machine_alerts(self, machine_id: str) -> List[Dict]:
        """
        Buscar todos os alertas pendentes de uma máquina
        
        Args:
            machine_id: ID da máquina
            
        Returns:
            Lista de dicionários com os alertas
        """
        try:
            from src.utils.logger import logger
            logger.info(f"Buscando alertas da máquina: {machine_id}")
            
            response = self.supabase.table('admin_alerts') \
                .select('*') \
                .eq('machine_id', machine_id) \
                .is_('acknowledged_by', 'null') \
                .order('triggered_at', desc=True) \
                .execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar alertas: {e}", exc_info=True)
            return []
    
    def get_critical_domains(self) -> List[str]:
        """
        Buscar lista de domínios marcados como críticos
        
        Returns:
            Lista de domínios (strings)
        """
        try:
            from src.utils.logger import logger
            
            response = self.supabase.table('monitored_domains') \
                .select('domain') \
                .eq('alert_type', 'critical') \
                .eq('is_active', True) \
                .execute()
            
            domains = [d['domain'] for d in response.data] if response.data else []
            logger.info(f"✓ Encontrados {len(domains)} domínios críticos")
            return domains
            
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar domínios críticos: {e}", exc_info=True)
            return []
    
    def check_machine_has_critical_access(
        self, 
        machine_id: str, 
        critical_domains: List[str]
    ) -> bool:
        """
        Verificar se máquina acessou algum domínio crítico nas últimas 24h
        
        Args:
            machine_id: ID da máquina
            critical_domains: Lista de domínios críticos
            
        Returns:
            True se acessou, False caso contrário
        """
        try:
            if not critical_domains:
                return False
            
            from src.utils.logger import logger
            from datetime import timedelta
            
            # Buscar nas últimas 24h
            since = (datetime.now() - timedelta(hours=24)).isoformat()
            
            response = self.supabase.table('active_sessions') \
                .select('domain') \
                .eq('machine_id', machine_id) \
                .gte('last_activity', since) \
                .in_('domain', critical_domains) \
                .limit(1) \
                .execute()
            
            return bool(response.data and len(response.data) > 0)
            
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao verificar acesso crítico: {e}", exc_info=True)
            return False
