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

class RealtimeManager:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.alert_callbacks: List[Callable[[Dict], None]] = []
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._async_client = None
        self._last_alert_ts: datetime = datetime.utcnow() - timedelta(seconds=5)
        
        self._supabase_url = os.getenv("SUPABASE_URL", "")
        self._supabase_key = os.getenv("SUPABASE_ANON_KEY", os.getenv("SUPABASE_KEY", ""))
        
        self._ws_url = self._build_ws_url(self._supabase_url)
    
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
                    fut.result(timeout=2)
                except Exception as e:
                    logger.warning(f"Timeout ao fechar cliente realtime: {e}")
        except Exception as e:
            logger.warning(f"Erro ao fechar cliente realtime: {e}")
        
        self._async_client = None
        self.alert_callbacks.clear()
        logger.info("RealtimeManager parado")
    
    def _run(self):
        """Thread principal do realtime"""
        logger.info("RealtimeManager._run: Iniciando...")
        
        if self._ws_url and self._supabase_key:
            try:
                logger.info(f"RealtimeManager: Tentando conectar websocket em {self._ws_url}")
                self._loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self._loop)
                self._loop.run_until_complete(self._run_async_realtime())
                return
            except Exception as e:
                logger.warning(f"Falha no websocket, caindo para polling: {e}")
                # Continua para o fallback abaixo
        else:
            logger.warning("Configuração de websocket incompleta, usando polling")
        
        # Fallback para polling
        logger.info("RealtimeManager: Usando fallback de polling")
        self._run_polling_loop()
    
    async def _run_async_realtime(self):
        """Executar conexão websocket assíncrona"""
        try:
            from realtime import AsyncRealtimeClient
        except ImportError:
            logger.error("Módulo 'realtime' não encontrado, caindo para polling")
            raise
        
        logger.info("Conectando ao Supabase Realtime (websocket)...")
        self._async_client = AsyncRealtimeClient(self._ws_url, self._supabase_key)
        
        try:
            # Adicionar timeout de 5 segundos para conexão
            await asyncio.wait_for(
                self._async_client.connect(),
                timeout=5.0
            )
            logger.info("✓ Websocket conectado com sucesso")
            
            ch_alerts = self._async_client.channel("db-changes-alerts")
            ch_alerts.on_postgres_changes(
                "INSERT",
                schema="public",
                table="admin_alerts",
                callback=self._on_alert_payload,
            )
            
            # Assinar canal
            await ch_alerts.subscribe(
                lambda status, err: logger.info(f"Realtime alerts channel: {status}")
            )
            
            logger.info("✓ Realtime conectado via websocket")
            
            # Loop de escuta até pedirmos stop()
            while not self._stop_event.is_set():
                await asyncio.sleep(0.5)
        
        except asyncio.TimeoutError:
            logger.error("Timeout ao conectar ao websocket (5s), caindo para polling")
            raise
        except Exception as e:
            logger.error(f"Erro ao conectar websocket: {e}", exc_info=True)
            raise
                
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
            domain = data.get("domain", "Desconhecido")
            machine_id = data.get("machine_id", "Desconhecido")
            url = data.get("url", "")
            
            alert = {
                "type": alert_type,
                "domain": domain,
                "machine_id": machine_id,
                "url": url,
                "timestamp": data.get("triggered_at"),
            }
            
            logger.info(f"🚨 Alerta recebido: {alert_type} - {domain}")
            
            # Notificação e som
            self._show_system_notification(alert)
            self._play_alert_sound()
            
            # Chamar callbacks registrados
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
            notification.notify(
                title="🚨 Alerta CorpMonitor",
                message=f"Domínio Monitorado Acessado:\n{alert['domain']}\n\nMáquina: {alert['machine_id']}",
                app_name="CorpMonitor Desktop",
                timeout=10,
            )
        except Exception as e:
            logger.warning(f"Erro ao exibir notificação: {e}")
    
    def _play_alert_sound(self):
        """Tocar som de alerta"""
        try:
            def play():
                try:
                    winsound.Beep(1200, 500)
                except Exception:
                    pass
            
            threading.Thread(target=play, daemon=True).start()
        except Exception as e:
            logger.warning(f"Erro ao tocar som: {e}")
