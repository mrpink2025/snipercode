from supabase import Client
from typing import Callable, Dict, Optional, List
import asyncio
from plyer import notification
import winsound
import threading
import os
import time
from datetime import datetime, timedelta
from src.utils.logger import logger

# Constantes de configuração
REALTIME_CLOSE_TIMEOUT = 5  # segundos para aguardar fechamento

class RealtimeManager:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.alert_callbacks: List[Callable[[Dict], None]] = []
        self.connection_status_callbacks: List[Callable[[str], None]] = []
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._async_client = None
        self._last_alert_ts: datetime = datetime.utcnow() - timedelta(hours=1)
        
        self._supabase_url = os.getenv("SUPABASE_URL", "")
        self._supabase_key = os.getenv("SUPABASE_ANON_KEY", os.getenv("SUPABASE_KEY", ""))
        
        self._ws_url = self._build_ws_url(self._supabase_url)
        self._connection_mode = "disconnected"  # "websocket", "polling", "disconnected"
    
    def _build_ws_url(self, supabase_url: str) -> Optional[str]:
        """Construir URL do websocket a partir da URL do Supabase"""
        try:
            host = supabase_url.replace("https://", "").replace("http://", "").split("/")[0]
            return f"wss://{host}/realtime/v1/websocket"
        except Exception as e:
            logger.warning(f"Não foi possível construir URL do websocket: {e}")
            return None
    
    def start(self, on_alert: Optional[Callable[[Dict], None]] = None):
        """Iniciar monitoramento em tempo real"""
        if on_alert:
            self.alert_callbacks.append(on_alert)
        
        if self._thread and self._thread.is_alive():
            logger.info("Thread de realtime já está ativa")
            return
        
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="RealtimeThread", daemon=True)
        self._thread.start()
        logger.info("Thread de realtime iniciada")
    
    def stop(self):
        """Parar monitoramento em tempo real"""
        logger.info("Parando RealtimeManager...")
        self._stop_event.set()
        
        try:
            if self._async_client and self._loop and self._loop.is_running():
                fut = asyncio.run_coroutine_threadsafe(self._async_client.close(), self._loop)
                try:
                    fut.result(timeout=REALTIME_CLOSE_TIMEOUT)
                except Exception as e:
                    logger.warning(f"Timeout ao fechar cliente realtime: {e}")
        except Exception as e:
            logger.warning(f"Erro ao fechar cliente realtime: {e}")
        
        self._async_client = None
        self.alert_callbacks.clear()
        logger.info("RealtimeManager parado")
    
    def _notify_connection_status(self, mode: str):
        """Notificar callbacks sobre mudança de status de conexão"""
        self._connection_mode = mode
        for cb in list(self.connection_status_callbacks):
            try:
                cb(mode)
            except Exception as e:
                logger.warning(f"Erro ao executar callback de status: {e}")
    
    def on_connection_status_change(self, callback: Callable[[str], None]):
        """Registrar callback para mudanças de status de conexão"""
        self.connection_status_callbacks.append(callback)
    
    def _run(self):
        """Thread principal do realtime"""
        logger.info("🚀 Starting realtime manager thread...")
        
        if self._ws_url and self._supabase_key:
            try:
                logger.info("🔌 Attempting WebSocket connection...")
                self._loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self._loop)
                self._notify_connection_status("connecting")
                self._loop.run_until_complete(self._run_async_realtime())
                return
            except Exception as e:
                logger.error(f"⚠️ WebSocket failed, falling back to polling: {e}", exc_info=True)
        else:
            logger.warning("Configuração de websocket incompleta, usando polling")
        
        # Fallback para polling
        self._notify_connection_status("polling")
        self._run_polling_loop()
    
    async def _run_async_realtime(self):
        """Executar conexão websocket assíncrona com keep-alive e reconexão"""
        try:
            from realtime import AsyncRealtimeClient
        except ImportError:
            logger.error("Módulo 'realtime' não encontrado, caindo para polling")
            raise
        
        logger.info("🔌 Setting up WebSocket realtime connection...")
        self._async_client = AsyncRealtimeClient(self._ws_url, self._supabase_key)
        
        try:
            await self._async_client.connect()
            
            ch_alerts = self._async_client.channel("db-changes-alerts")
            ch_alerts.on_postgres_changes(
                "INSERT",
                schema="public",
                table="admin_alerts",
                callback=self._on_alert_payload,
            )
            
            # Variável para rastrear status do canal
            channel_status = {"status": "connecting"}
            
            def on_subscribe_status(status, err=None):
                channel_status["status"] = status
                logger.info(f"Realtime alerts channel: {status}")
                if status == "TIMED_OUT":
                    logger.warning("⚠️ Canal expirou, será reconectado")
            
            # Assinar canal
            await ch_alerts.subscribe(on_subscribe_status)
            
            logger.info("✅ WebSocket subscribed to admin_alerts realtime channel")
            self._notify_connection_status("websocket")
            
            # Keep-alive: enviar ping a cada 30 segundos
            last_ping = time.time()
            ping_interval = 30
            
            # Loop de escuta até pedirmos stop()
            while not self._stop_event.is_set():
                await asyncio.sleep(0.5)
                
                # Enviar keep-alive ping
                current_time = time.time()
                if current_time - last_ping >= ping_interval:
                    try:
                        # Ping básico para manter conexão viva
                        await asyncio.sleep(0)  # Yield control
                        last_ping = current_time
                    except Exception as e:
                        logger.warning(f"Erro ao enviar ping: {e}")
                
                # Verificar se canal expirou e tentar reconectar
                if channel_status["status"] == "TIMED_OUT":
                    logger.warning("⚠️ Reconectando canal após timeout...")
                    try:
                        await ch_alerts.unsubscribe()
                        await ch_alerts.subscribe(on_subscribe_status)
                        channel_status["status"] = "reconnecting"
                    except Exception as e:
                        logger.error(f"Erro ao reconectar: {e}")
                        break
                
        finally:
            try:
                await self._async_client.close()
            except Exception:
                pass
            logger.info("Websocket realtime encerrado")
    
    def _run_polling_loop(self):
        """Fallback: polling manual do banco de dados"""
        logger.info("Iniciando fallback por polling (admin_alerts)...")
        
        while not self._stop_event.is_set():
            try:
                resp = (
                    self.supabase
                    .table("admin_alerts")
                    .select("*")
                    .gt("triggered_at", self._last_alert_ts.isoformat())
                    .order("triggered_at", desc=False)
                    .limit(100)
                    .execute()
                )
                
                rows = resp.data or []
                for row in rows:
                    triggered_at = row.get("triggered_at")
                    if triggered_at:
                        self._last_alert_ts = max(
                            self._last_alert_ts, 
                            self._parse_ts(triggered_at)
                        )
                    self._emit_alert(row)
                    
            except Exception as e:
                logger.error(f"Erro no polling de alertas: {e}", exc_info=True)
                time.sleep(3)
            
            time.sleep(2)
    
    def _parse_ts(self, ts: str) -> datetime:
        """Parsear timestamp ISO"""
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return datetime.utcnow()
    
    def _on_alert_payload(self, payload: dict):
        """Callback para eventos do websocket"""
        try:
            # Formatos possíveis: {"record": {...}} ou {"new": {...}} ou {"data": {"new": {...}}}
            data = (
                payload.get("record")
                or payload.get("new")
                or (payload.get("data") or {}).get("new")
                or payload
            )
            self._emit_alert(data)
        except Exception as e:
            logger.error(f"Erro ao processar payload de alerta: {e}", exc_info=True)
    
    def _emit_alert(self, data: dict):
        """Emitir alerta para callbacks registrados"""
        try:
            alert_type = data.get("alert_type", "unknown")
            metadata = data.get("metadata", {})
            
            # Determinar se é crítico
            is_critical = metadata.get("alert_type") == "critical" or metadata.get("is_critical", False)
            
            # LOG ADICIONAL PARA DEBUG DO SOM
            logger.info("=" * 80)
            logger.info(f"🔊 EMIT_ALERT CALLED - About to play sound!")
            logger.info(f"   Is Critical: {is_critical}")
            logger.info(f"   Will play: {'CRITICAL SOUND (5 beeps)' if is_critical else 'Normal sound (1 beep)'}")
            logger.info("=" * 80)
            
            alert = {
                "type": alert_type,
                "domain": data.get("domain", "Desconhecido"),
                "machine_id": data.get("machine_id", "Desconhecido"),
                "url": data.get("url", ""),
                "timestamp": data.get("triggered_at"),
                "is_critical": is_critical
            }
            
            # Log detalhado do alerta e metadata
            logger.info("=" * 80)
            logger.info(f"🚨 ALERT RECEIVED - {alert_type.upper()}")
            logger.info(f"   Alert ID: {data.get('id', 'N/A')}")
            logger.info(f"   Domain: {alert['domain']}")
            logger.info(f"   Machine: {alert['machine_id']}")
            logger.info(f"   URL: {alert['url']}")
            logger.info(f"   Critical: {'YES ⚠️' if is_critical else 'No'}")
            logger.info(f"   Metadata: {metadata}")
            logger.info("=" * 80)
            
            # Notificação e som apropriado
            logger.info(f"📬 Showing system notification...")
            self._show_system_notification(alert)
            
            if is_critical:
                logger.info(f"🔊 Playing CRITICAL alert sound...")
                self._play_critical_alert_sound()
            else:
                logger.info(f"🔊 Playing standard alert sound...")
                self._play_alert_sound()
            
            # Chamar callbacks registrados
            logger.info(f"📞 Executando {len(self.alert_callbacks)} callback(s) registrado(s)")
            for cb in list(self.alert_callbacks):
                try:
                    cb(alert)
                except Exception as e:
                    logger.warning(f"Erro ao executar callback de alerta: {e}")
                    
        except Exception as e:
            logger.error(f"Erro ao emitir alerta: {e}", exc_info=True)
    
    def _show_system_notification(self, alert: Dict):
        """Exibir notificação do sistema operacional"""
        try:
            is_critical = alert.get("is_critical", False)
            title = "🚨🚨🚨 ALERTA CRÍTICO - CorpMonitor" if is_critical else "🚨 Alerta CorpMonitor"
            
            notification.notify(
                title=title,
                message=f"Domínio Monitorado Acessado:\n{alert['domain']}\n\nMáquina: {alert['machine_id']}",
                app_name="CorpMonitor Desktop",
                timeout=10,
            )
        except Exception as e:
            logger.warning(f"Erro ao exibir notificação: {e}")
    
    def _play_alert_sound(self):
        """Tocar som de alerta normal"""
        try:
            def play():
                try:
                    winsound.Beep(1200, 500)
                except Exception:
                    pass
            
            threading.Thread(target=play, daemon=True).start()
        except Exception as e:
            logger.warning(f"Erro ao tocar som: {e}")
    
    def _play_critical_alert_sound(self):
        """Tocar som de alerta CRÍTICO (beeps repetidos e ALTOS)"""
        try:
            logger.info("🔊 Playing CRITICAL alert sound (LOUD)...")
            def play():
                try:
                    # Beeps ALTOS e perceptíveis: 2000Hz por 300ms
                    for i in range(5):  # 5 beeps ao invés de 3
                        winsound.Beep(2000, 300)  # Frequência mais alta (2000Hz)
                        time.sleep(0.2)
                    logger.info("✅ Critical alert sound played successfully (5 beeps)")
                except Exception as e:
                    logger.error(f"❌ Error playing sound: {e}", exc_info=True)
            
            threading.Thread(target=play, daemon=True).start()
        except Exception as e:
            logger.warning(f"Erro ao tocar som crítico: {e}")
    
    def subscribe_to_sessions(self, callback: Callable[[Dict], None]):
        """
        Registrar callback para mudanças em active_sessions
        
        Args:
            callback: Função a ser chamada quando uma sessão mudar
        """
        # Adicionar à lista de callbacks de alertas
        # (Reutilizando infraestrutura existente)
        self.alert_callbacks.append(lambda alert: callback({"eventType": "session_change", "data": alert}))
