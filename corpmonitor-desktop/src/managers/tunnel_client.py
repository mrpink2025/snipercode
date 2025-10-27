"""
Cliente Python para Túnel Reverso

Permite que o Python faça requisições usando o IP do cliente através
do Chrome Extension.
"""

import asyncio
import base64
import time
from typing import Optional, Dict, Any, List
import json


class TunnelResponse:
    """Resposta de uma requisição via túnel"""
    
    def __init__(self, data: Dict[str, Any]):
        self.success = data.get('success', False)
        self.status_code = data.get('status_code', 0)
        self.status_text = data.get('status_text', '')
        self.headers = data.get('headers', {})
        self.body = data.get('body', '')
        self.encoding = data.get('encoding', 'text')
        self.content_type = data.get('content_type', '')
        self.content_length = data.get('content_length', 0)
        self.final_url = data.get('final_url', '')
        self.redirected = data.get('redirected', False)
        self.cookies = data.get('cookies', [])
        self.elapsed_ms = data.get('elapsed_ms', 0)
        self.error = data.get('error')
        self.timestamp = data.get('timestamp')
    
    @property
    def text(self) -> str:
        """Retorna body como texto"""
        if self.encoding == 'base64':
            return base64.b64decode(self.body).decode('utf-8', errors='ignore')
        return self.body
    
    @property
    def bytes(self) -> bytes:
        """Retorna body como bytes"""
        if self.encoding == 'base64':
            return base64.b64decode(self.body)
        return self.body.encode('utf-8')
    
    @property
    def json(self) -> Any:
        """Retorna body como JSON"""
        return json.loads(self.text)
    
    def __repr__(self):
        return f"<TunnelResponse status={self.status_code} size={self.content_length}>"


class TunnelClient:
    """Cliente para fazer requisições via túnel reverso"""
    
    def __init__(self, supabase, machine_id: str):
        self.supabase = supabase
        self.machine_id = machine_id
        self.timeout = 180  # ✅ 3 minutos para sites complexos
        self.debug = True
        
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_bytes': 0,
            'total_time_ms': 0
        }
    
    def log(self, level: str, message: str, data: Optional[Dict] = None):
        """Log com prefixo"""
        if not self.debug:
            return
        prefix = f"[TunnelClient {level.upper()}]"
        if data:
            print(f"{prefix} {message}: {data}")
        else:
            print(f"{prefix} {message}")
    
    async def fetch(
        self,
        url: str,
        method: str = 'GET',
        headers: Optional[Dict[str, str]] = None,
        body: Optional[str] = None,
        follow_redirects: bool = True,
        timeout: Optional[int] = None,
        incident_id: Optional[str] = None,
        max_retries: int = 3  # ✅ NOVO parâmetro
    ) -> TunnelResponse:
        """
        Fazer requisição via túnel reverso com retry automático
        """
        
        start_time = time.time()
        self.stats['total_requests'] += 1
        last_error = None
        
        for retry_attempt in range(max_retries):
            try:
                if retry_attempt > 0:
                    retry_delay = 2 ** retry_attempt  # Backoff exponencial: 2s, 4s, 8s
                    self.log('info', f'🔄 Retry {retry_attempt + 1}/{max_retries} após {retry_delay}s...')
                    await asyncio.sleep(retry_delay)
                
                self.log('info', f'🌐 Iniciando túnel para {url}')
                
                # ✅ Criar comando com campos obrigatórios corretos
                command_data = {
                    'target_machine_id': self.machine_id,  # ✅ Campo correto
                    'command_type': 'tunnel-fetch',
                    'status': 'pending',
                    'executed_by': '00000000-0000-0000-0000-000000000000',  # ✅ UUID sistema
                    'executed_at': time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime()),  # ✅ Timestamp ISO
                    'payload': {
                        'target_url': url,
                        'method': method,
                        'headers': headers or {},
                        'body': body,
                        'follow_redirects': follow_redirects
                    }
                    # ✅ created_at será gerado automaticamente pelo DEFAULT now()
                }
                
                if incident_id:
                    command_data['incident_id'] = incident_id
                
                self.log('debug', 'Criando comando...')
                
                response = self.supabase.table('remote_commands')\
                    .insert(command_data)\
                    .execute()
                
                if not response.data:
                    raise Exception("Falha ao criar comando")
                
                command_id = response.data[0]['id']
                self.log('info', f'✅ Comando criado: {command_id}')
                
                # Aguardar resultado
                timeout_value = timeout or self.timeout
                poll_interval = 0.5
                max_attempts = int(timeout_value / poll_interval)
                
                self.log('debug', f'Aguardando resultado (timeout: {timeout_value}s)...')
                
                result = None
                for attempt in range(max_attempts):
                    await asyncio.sleep(poll_interval)
                    
                    result_response = self.supabase.table('tunnel_fetch_results')\
                        .select('*')\
                        .eq('command_id', command_id)\
                        .execute()
                    
                    if result_response.data and len(result_response.data) > 0:
                        result = result_response.data[0]
                        self.log('info', f'✅ Resultado recebido (tentativa {attempt + 1}/{max_attempts})')
                        break
                    
                    if (attempt + 1) % 10 == 0:
                        elapsed = (attempt + 1) * poll_interval
                        self.log('debug', f'⏳ Aguardando... ({elapsed:.1f}s/{timeout_value}s)')
                
                if not result:
                    raise TimeoutError(f"Timeout aguardando resultado ({timeout_value}s)")
                
                # Processar resultado
                elapsed_total = (time.time() - start_time) * 1000
                
                tunnel_response = TunnelResponse(result)
                
                if tunnel_response.success:
                    self.stats['successful_requests'] += 1
                    self.stats['total_bytes'] += tunnel_response.content_length
                    self.log('info', f'✅ Sucesso: {tunnel_response.status_code} ({elapsed_total:.0f}ms)')
                else:
                    self.stats['failed_requests'] += 1
                    self.log('error', f'❌ Falhou: {tunnel_response.error}')
                
                self.stats['total_time_ms'] += elapsed_total
                
                return tunnel_response
                
            except Exception as e:
                last_error = e
                
                # ✅ Se for erro de schema cache, não tentar novamente
                error_str = str(e).lower()
                if 'schema cache' in error_str or 'pgrst204' in error_str:
                    self.log('error', '❌ Erro de schema cache - necessário reload do Supabase')
                    break
                
                # ✅ Se for último retry, falhar
                if retry_attempt == max_retries - 1:
                    break
                
                self.log('warning', f'⚠️ Tentativa {retry_attempt + 1} falhou: {e}')
        
        # Se chegou aqui, todas as tentativas falharam
        self.stats['failed_requests'] += 1
        self.log('error', f'❌ Túnel falhou após {max_retries} tentativas: {last_error}')
        
        return TunnelResponse({
            'success': False,
            'error': f'Túnel falhou: {last_error}',
            'error_type': type(last_error).__name__,
            'timestamp': time.time()
        })
    
    async def get(self, url: str, **kwargs) -> TunnelResponse:
        """Atalho para GET"""
        return await self.fetch(url, method='GET', **kwargs)
    
    async def post(self, url: str, body: str, **kwargs) -> TunnelResponse:
        """Atalho para POST"""
        return await self.fetch(url, method='POST', body=body, **kwargs)
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas"""
        if self.stats['total_requests'] > 0:
            success_rate = (self.stats['successful_requests'] / self.stats['total_requests']) * 100
            avg_time = self.stats['total_time_ms'] / self.stats['total_requests']
        else:
            success_rate = 0
            avg_time = 0
        
        return {
            **self.stats,
            'success_rate': f"{success_rate:.1f}%",
            'average_time_ms': f"{avg_time:.0f}ms"
        }
    
    def print_stats(self):
        """Imprime estatísticas"""
        stats = self.get_stats()
        print("\n" + "="*60)
        print("📊 ESTATÍSTICAS DO TÚNEL REVERSO")
        print("="*60)
        print(f"Total de requisições:    {stats['total_requests']}")
        print(f"Bem-sucedidas:           {stats['successful_requests']}")
        print(f"Falhadas:                {stats['failed_requests']}")
        print(f"Taxa de sucesso:         {stats['success_rate']}")
        print(f"Bytes transferidos:      {stats['total_bytes']:,}")
        print(f"Tempo médio:             {stats['average_time_ms']}")
        print("="*60 + "\n")
