from supabase import Client
from typing import Callable, Dict
import asyncio
from plyer import notification
import winsound
import threading

class RealtimeManager:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.channels = {}
        self.alert_callbacks = []
    
    def subscribe_to_alerts(self, callback: Callable[[Dict], None]):
        """
        Registrar callback para receber alertas em tempo real
        callback recebe: {type: str, domain: str, machine_id: str, ...}
        """
        self.alert_callbacks.append(callback)
        
        # Criar canal para alertas
        channel = self.supabase.channel('admin-alerts')
        
        # Listener para novos alertas
        channel.on(
            'postgres_changes',
            {
                'event': 'INSERT',
                'schema': 'public',
                'table': 'admin_alerts'
            },
            lambda payload: self._handle_alert(payload)
        ).subscribe()
        
        self.channels['alerts'] = channel
        print("[RealtimeManager] Inscrito em alertas em tempo real")
    
    def _handle_alert(self, payload):
        """Processar novo alerta recebido"""
        try:
            alert_data = payload.get('new', {})
            alert_type = alert_data.get('alert_type', 'unknown')
            domain = alert_data.get('domain', 'Desconhecido')
            machine_id = alert_data.get('machine_id', 'Desconhecido')
            url = alert_data.get('url', '')
            
            print(f"[RealtimeManager] 🚨 Novo alerta: {alert_type} - {domain}")
            
            # Preparar dados do alerta
            alert = {
                'type': alert_type,
                'domain': domain,
                'machine_id': machine_id,
                'url': url,
                'timestamp': alert_data.get('triggered_at')
            }
            
            # Notificação do sistema
            self._show_system_notification(alert)
            
            # Som de alerta
            self._play_alert_sound()
            
            # Chamar callbacks registrados
            for callback in self.alert_callbacks:
                try:
                    callback(alert)
                except Exception as e:
                    print(f"[RealtimeManager] Erro ao executar callback: {e}")
        
        except Exception as e:
            print(f"[RealtimeManager] Erro ao processar alerta: {e}")
    
    def _show_system_notification(self, alert: Dict):
        """Exibir notificação do sistema operacional"""
        try:
            title = f"🚨 Alerta CorpMonitor"
            message = f"Domínio Monitorado Acessado:\n{alert['domain']}\n\nMáquina: {alert['machine_id']}"
            
            notification.notify(
                title=title,
                message=message,
                app_name='CorpMonitor Desktop',
                timeout=10
            )
        except Exception as e:
            print(f"[RealtimeManager] Erro ao exibir notificação: {e}")
    
    def _play_alert_sound(self):
        """Tocar som de alerta"""
        try:
            # Tocar beep do sistema (Windows)
            def play():
                winsound.Beep(1200, 500)  # Frequência 1200Hz, duração 500ms
            
            # Executar em thread separada para não bloquear
            thread = threading.Thread(target=play)
            thread.daemon = True
            thread.start()
        except Exception as e:
            print(f"[RealtimeManager] Erro ao tocar som: {e}")
    
    def subscribe_to_incidents(self, callback: Callable[[Dict], None]):
        """
        Registrar callback para novos incidentes
        """
        channel = self.supabase.channel('incidents-realtime')
        
        channel.on(
            'postgres_changes',
            {
                'event': 'INSERT',
                'schema': 'public',
                'table': 'incidents'
            },
            lambda payload: callback(payload.get('new', {}))
        ).subscribe()
        
        self.channels['incidents'] = channel
        print("[RealtimeManager] Inscrito em novos incidentes")
    
    def unsubscribe_all(self):
        """Cancelar todas as inscrições"""
        for channel_name, channel in self.channels.items():
            try:
                self.supabase.remove_channel(channel)
                print(f"[RealtimeManager] Canal {channel_name} desconectado")
            except Exception as e:
                print(f"[RealtimeManager] Erro ao desconectar canal {channel_name}: {e}")
        
        self.channels.clear()
        self.alert_callbacks.clear()
