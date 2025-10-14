from supabase import Client
from typing import List, Dict, Optional
from datetime import datetime

class IncidentManager:
    def __init__(self, supabase: Client, user_id: str):
        self.supabase = supabase
        self.user_id = user_id
    
    def get_incidents(self, status: Optional[str] = None, severity: Optional[str] = None) -> List[Dict]:
        """Buscar incidentes com filtros opcionais"""
        try:
            from src.utils.logger import logger
            logger.info(f"Buscando incidentes (status={status}, severity={severity})")
            
            query = self.supabase.table("incidents").select("*").order("created_at", desc=True)
            
            if status:
                query = query.eq("status", status)
            if severity:
                query = query.eq("severity", severity)
            
            response = query.execute()
            logger.info(f"✓ Encontrados {len(response.data) if response.data else 0} incidentes")
            return response.data if response.data else []
        except Exception as e:
            from src.utils.logger import logger
            logger.error(f"Erro ao buscar incidentes: {e}", exc_info=True)
            return []
    
    def get_incident_by_id(self, incident_id: str) -> Optional[Dict]:
        """Buscar incidente específico por ID"""
        try:
            from src.utils.logger import logger
            response = self.supabase.table("incidents")\
                .select("*")\
                .eq("id", incident_id)\
                .single()\
                .execute()
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
                .eq("status", "in_progress")\
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
