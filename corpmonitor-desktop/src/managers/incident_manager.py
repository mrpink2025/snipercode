from supabase import Client
from typing import List, Dict, Optional
from datetime import datetime

class IncidentManager:
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    def get_incidents(self, status: Optional[str] = None, severity: Optional[str] = None) -> List[Dict]:
        """Buscar incidentes com filtros opcionais"""
        try:
            query = self.supabase.table("incidents").select("*").order("created_at", desc=True)
            
            if status:
                query = query.eq("status", status)
            if severity:
                query = query.eq("severity", severity)
            
            response = query.execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Erro ao buscar incidentes: {e}")
            return []
    
    def get_incident_by_id(self, incident_id: str) -> Optional[Dict]:
        """Buscar incidente específico por ID"""
        try:
            response = self.supabase.table("incidents")\
                .select("*")\
                .eq("id", incident_id)\
                .single()\
                .execute()
            return response.data
        except Exception as e:
            print(f"Erro ao buscar incidente: {e}")
            return None
    
    def update_incident_status(self, incident_id: str, new_status: str) -> bool:
        """Atualizar status de um incidente"""
        try:
            update_data = {"status": new_status, "updated_at": datetime.now().isoformat()}
            
            if new_status == "resolved":
                update_data["resolved_at"] = datetime.now().isoformat()
            
            response = self.supabase.table("incidents")\
                .update(update_data)\
                .eq("id", incident_id)\
                .execute()
            
            return bool(response.data)
        except Exception as e:
            print(f"Erro ao atualizar incidente: {e}")
            return False
    
    def get_kpis(self) -> Dict:
        """Calcular KPIs do dashboard"""
        try:
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
            
            return {
                "total": total,
                "critical": critical,
                "resolved_today": resolved_today,
                "in_progress": in_progress
            }
        except Exception as e:
            print(f"Erro ao calcular KPIs: {e}")
            return {"total": 0, "critical": 0, "resolved_today": 0, "in_progress": 0}
