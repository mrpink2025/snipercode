from supabase import Client
from typing import List, Dict, Optional
from datetime import datetime

class IncidentManager:
    def __init__(self, supabase: Client, user_id: str):
        self.supabase = supabase
        self.user_id = user_id
    
    def get_incidents(
        self, 
        status: Optional[str] = None, 
        severity: Optional[str] = None,
        viewed: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """
        Buscar incidentes com filtros opcionais e paginação
        
        Args:
            viewed: None = todos, False = não visualizados, True = visualizados
        """
        try:
            from src.utils.logger import logger
            logger.info(f"Buscando incidentes (status={status}, severity={severity}, viewed={viewed}, limit={limit}, offset={offset})")
            
            query = self.supabase.table("incidents")\
                .select("*")\
                .order("created_at", desc=True)\
                .range(offset, offset + limit - 1)
            
            if status:
                # Mapear underscore para hífen
                if status == "in_progress":
                    status = "in-progress"
                query = query.eq("status", status)
            if severity:
                query = query.eq("severity", severity)
            
            # Filtro de visualização
            if viewed is not None:
                if viewed:
                    query = query.not_.is_("viewed_at", "null")
                else:
                    query = query.is_("viewed_at", "null")
            
            response = query.execute()
            logger.info(f"✓ Encontrados {len(response.data) if response.data else 0} incidentes")
            return response.data if response.data else []
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar incidentes: {e}", exc_info=True)
            return []
    
    def get_incidents_count(
        self, 
        status: Optional[str] = None, 
        severity: Optional[str] = None,
        viewed: Optional[bool] = None
    ) -> int:
        """
        Contar total de incidentes (para paginação)
        
        Args:
            viewed: None = todos, False = não visualizados, True = visualizados
        """
        try:
            from src.utils.logger import logger
            query = self.supabase.table("incidents").select("id", count="exact")
            
            if status:
                # Mapear underscore para hífen
                if status == "in_progress":
                    status = "in-progress"
                query = query.eq("status", status)
            if severity:
                query = query.eq("severity", severity)
            
            # Filtro de visualização
            if viewed is not None:
                if viewed:
                    query = query.not_.is_("viewed_at", "null")
                else:
                    query = query.is_("viewed_at", "null")
            
            response = query.execute()
            return response.count if hasattr(response, 'count') else 0
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao contar incidentes: {e}", exc_info=True)
            return 0
    
    def get_incident_by_id(self, incident_id: str) -> Optional[Dict]:
        """Buscar incidente específico por ID"""
        try:
            from src.utils.logger import logger
            response = self.supabase.table("incidents")\
                .select("*")\
                .eq("id", incident_id)\
                .maybeSingle()\
                .execute()
            
            if not response.data:
                logger.warning(f"Incidente {incident_id} não encontrado")
                return None
            
            return response.data
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar incidente {incident_id}: {e}", exc_info=True)
            return None
    
    def update_incident_status(self, incident_id: str, new_status: str) -> bool:
        """Atualizar status de um incidente"""
        try:
            from src.utils.logger import logger
            logger.info(f"Atualizando status do incidente {incident_id} para {new_status}")
            
            update_data = {"status": new_status, "updated_at": datetime.now().isoformat()}
            
            if new_status == "resolved":
                update_data["resolved_at"] = datetime.now().isoformat()
            
            response = self.supabase.table("incidents")\
                .update(update_data)\
                .eq("id", incident_id)\
                .execute()
            
            logger.info(f"✓ Status do incidente {incident_id} atualizado com sucesso")
            return bool(response.data)
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao atualizar incidente {incident_id}: {e}", exc_info=True)
            return False
    
    def get_kpis(self) -> Dict:
        """Calcular KPIs do dashboard"""
        try:
            from src.utils.logger import logger
            # Total de incidentes
            total_response = self.supabase.table("incidents").select("id", count="exact").execute()
            total = total_response.count if hasattr(total_response, 'count') else 0
            
            # Incidentes críticos
            critical_response = self.supabase.table("incidents")\
                .select("id", count="exact")\
                .eq("severity", "critical")\
                .eq("status", "new")\
                .execute()
            critical = critical_response.count if hasattr(critical_response, 'count') else 0
            
            # Incidentes resolvidos hoje
            today = datetime.now().date().isoformat()
            resolved_today_response = self.supabase.table("incidents")\
                .select("id", count="exact")\
                .eq("status", "resolved")\
                .gte("resolved_at", today)\
                .execute()
            resolved_today = resolved_today_response.count if hasattr(resolved_today_response, 'count') else 0
            
            # Incidentes em progresso
            in_progress_response = self.supabase.table("incidents")\
                .select("id", count="exact")\
                .eq("status", "in-progress")\
                .execute()
            in_progress = in_progress_response.count if hasattr(in_progress_response, 'count') else 0
            
            logger.info(f"✓ KPIs calculados: total={total}, critical={critical}, in_progress={in_progress}, resolved_today={resolved_today}")
            
            return {
                "total": total,
                "critical": critical,
                "resolved_today": resolved_today,
                "in_progress": in_progress
            }
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao calcular KPIs: {e}", exc_info=True)
            return {"total": 0, "critical": 0, "resolved_today": 0, "in_progress": 0}
    
    def mark_incident_as_viewed(self, incident_id: str) -> bool:
        """Marcar incidente como visualizado"""
        try:
            from src.utils.logger import logger
            logger.info(f"Marcando incidente {incident_id} como visualizado")
            
            response = self.supabase.table("incidents")\
                .update({"viewed_at": datetime.now().isoformat()})\
                .eq("id", incident_id)\
                .execute()
            
            logger.info(f"✓ Incidente {incident_id} marcado como visualizado")
            return bool(response.data)
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao marcar incidente como visualizado: {e}", exc_info=True)
            return False
    
    def get_incidents_by_machine(self, machine_id: str, limit: int = 10) -> List[Dict]:
        """Buscar incidentes de uma máquina específica"""
        try:
            from src.utils.logger import logger
            response = self.supabase.table("incidents")\
                .select("*")\
                .eq("machine_id", machine_id)\
                .order("created_at", desc=True)\
                .limit(limit)\
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar incidentes por máquina: {e}", exc_info=True)
            return []

    def get_incident_by_url(self, machine_id: str, url: str) -> Optional[Dict]:
        """Buscar incidente específico por máquina e URL"""
        try:
            from src.utils.logger import logger
            response = self.supabase.table("incidents")\
                .select("*")\
                .eq("machine_id", machine_id)\
                .eq("tab_url", url)\
                .order("created_at", desc=True)\
                .limit(1)\
                .maybeSingle()\
                .execute()
            
            return response.data if response.data else None
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar incidente por URL: {e}", exc_info=True)
            return None
