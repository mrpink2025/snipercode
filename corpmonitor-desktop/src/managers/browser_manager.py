from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from typing import Optional, Dict, List
import asyncio
import threading
from io import BytesIO
from PIL import Image
import json
from src.managers.tunnel_client import TunnelClient, TunnelResponse

class BrowserSession:
    def __init__(self, session_id: str, page: Page, browser: Browser, playwright, context: BrowserContext):
        self.session_id = session_id
        self.page = page
        self.browser = browser
        self.playwright = playwright
        self.context = context
        self.is_active = True

class BrowserManager:
    def __init__(self, supabase, realtime_manager=None):
        self.supabase = supabase
        self.sessions: Dict[str, BrowserSession] = {}
        self.playwright_instance = None
        self._close_locks: Dict[str, asyncio.Lock] = {}  # Locks para evitar race condition
        
        # ✅ NOVO: Cache de recursos para performance
        from src.managers.resource_cache import ResourceCache
        self.resource_cache = ResourceCache(max_size=100, ttl_seconds=3600)
        
        # ✅ NOVO: Cliente de túnel reverso
        self.tunnel_client: Optional[TunnelClient] = None
        
        # ✅ NOVO: Estatísticas de túnel
        self.tunnel_stats = {
            "requests": 0,
            "cached": 0,
            "tunneled": 0,
            "bypassed": 0,  # ✅ Requisições que pularam o túnel
            "errors": 0,
            "total_time": 0.0
        }
        
        # ✅ NOVO: Controle de realtime durante sessões
        self.realtime_manager = realtime_manager
        self.realtime_suspended = False
        
        # ✅ FASE 1: Estado do handler (persistente entre requests)
        self.current_blocked_domains = []
        self.current_incident_id = None
        self.current_machine_id = None
        self.current_interactive = False
        
        # ✅ FASE 2: Contador de requests ativas
        self.active_handler_requests = 0
        
        # ✅ Semáforo será criado no event loop correto
        self.tunnel_semaphore = None
        self.tunnel_semaphore_max = 3
    
    @staticmethod
    def escape_js_string(text: str) -> str:
        """Escapar string para uso seguro em JavaScript"""
        return json.dumps(text)[1:-1]  # Remove aspas do JSON
    
    @staticmethod
    def _tunnel_timeout_for(url: str, interactive: bool = False) -> int:
        """
        ✅ FASE 4: Determinar timeout adequado baseado no tipo de recurso e modo
        Modo interativo: timeouts mais agressivos (usuário esperando)
        Modo headless: timeouts mais permissivos
        """
        
        # ✅ NOVO: Timeouts mais agressivos em modo interativo
        if interactive:
            # APIs e ações do usuário - resposta rápida
            if '/api/' in url or '&act=' in url or '?ui=2' in url:
                return 10
            # Recursos médios (JS/CSS)
            if any(ext in url for ext in ['.js', '.css']):
                return 30
            # Imagens
            if any(ext in url for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
                return 20
            # Padrão interativo
            return 20
        
        # Modo headless: pode esperar mais (mantém lógica atual)
        # Long-polling (Gmail, Slack, etc) - até 2 minutos
        if any(p in url for p in ['/logstreamz', '/sync/', '/longpoll', '/stream', '/channel/bind']):
            return 120
        
        # JavaScript/CSS grandes - até 90s
        if '/_/scs/' in url or '/static/' in url:
            return 90
        
        # Imagens grandes - até 60s
        if any(ext in url for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
            return 60
        
        # APIs rápidas - 30s
        if '/api/' in url:
            return 30
        
        # Padrão - 45s
        return 45
    
    async def _handle_route_with_tunnel(self, route):
        """
        ✅ Método de instância para handler de rotas (persistente).
        Não usa closure - todas as variáveis vêm de self.
        """
        import time as time_module
        request = route.request
        url = request.url
        request_start = time_module.time()
        
        # ✅ FASE 2: Contador de requests ativas
        self.active_handler_requests += 1
        request_num = self.active_handler_requests
        
        # Debug: verificar que handler está vivo
        if request_num % 10 == 0:  # Log a cada 10 requests
            print(f"[BrowserManager] ♻️ Handler ativo: processou {request_num} requests")
        
        # ✅ VERIFICAR BLOQUEIO DE DOMÍNIO PRIMEIRO
        if self.current_blocked_domains:
            if any(bd in url for bd in self.current_blocked_domains):
                print(f"[BrowserManager] 🚫 Domínio bloqueado: {url[:60]}...")
                await route.abort()
                return
        
        # ✅ FASE 1: LISTA EXPANDIDA DE PADRÕES QUE NÃO DEVEM SER TUNELADOS
        SKIP_TUNNEL_PATTERNS = [
            # WebSocket e Streaming
            '/websocket', '/ws/', 'wss://',
            '/polling', '/sync/', '/realtime',
            '/longpoll', '/streaming', '/api/v1/stream',
            '/eventsource', '/sse', '/subscribe', '/channel/',
            '/socket.io/', '/sockjs/',
            
            # ✅ NOVO: Gmail XHR/Fetch
            '?ui=2&ik=',
            '&act=',
            '&_reqid=',
            '&view=up',
            '&view=cv',
            '&search=',
            '/mail/u/0/?',
            
            # ✅ NOVO: Outros webmails
            'outlook.live.com/owa/',
            'outlook.office365.com/owa/',
            '/api/v2/messages',
            
            # ✅ NOVO: Single Page Apps
            '/__data.json',
            '/_next/data/',
            '/api/trpc/',
            '?__WB_REVISION__',
            
            # Google APIs
            'apis.google.com', 'clients2.google.com',
            'play.google.com', '/talkgadget/',
            '/logstreamz', '/metrics', '/analytics',
            
            # ✅ FASE 1: Imagens UI pequenas
            '/icons/', '/icon/',
            'cleardot.gif', 'blank.gif',
            's32-c-mo', 's64-c-mo', 's96-c-mo',
            '/images/branding/',
            '/favicons/',
            'data:image/',
            
            # ✅ FASE 1: Assets estáticos pequenos
            '.woff', '.woff2', '.ttf', '.eot',
            '/fonts/',
            
            # ✅ FASE 1: Tracking
            '/analytics.js', '/ga.js', '/gtag/',
            'doubleclick.net', '/pixel.gif', '/beacon',
        ]
        
        # Verificar se deve pular túnel
        should_skip = any(pattern in url.lower() for pattern in SKIP_TUNNEL_PATTERNS)
        
        if should_skip:
            self.tunnel_stats["bypassed"] += 1
            print(f"[BrowserManager] ⚡ DIRETO (bypass pattern): {url[:80]}...")
            try:
                await route.continue_()
            except Exception as fallback_error:
                print(f"[BrowserManager] ⚠️ Fallback necessário: {fallback_error}")
                await route.fallback()
            return
        
        # ✅ FASE 2: Bypass por tipo de requisição
        request_type = request.resource_type
        request_method = request.method
        
        # XHR/Fetch sempre direto
        if request_type in ['xhr', 'fetch']:
            self.tunnel_stats["bypassed"] += 1
            print(f"[BrowserManager] ⚡ {request_type.upper()} direto: {url[:80]}...")
            try:
                await route.continue_()
            except Exception as fallback_error:
                await route.fallback()
            return
        
        # POST/PUT/DELETE/PATCH sempre direto
        if request_method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            self.tunnel_stats["bypassed"] += 1
            print(f"[BrowserManager] ⚡ {request_method} direto: {url[:80]}...")
            try:
                await route.continue_()
            except Exception as fallback_error:
                await route.fallback()
            return
        
        # ✅ Bypass de imagens UI pequenas
        if request_type == 'image':
            url_lower = url.lower()
            
            if any(ext in url_lower for ext in ['.svg', '.gif', 's32-', 's64-', 's96-', '_24px', '_32px', '_48px']):
                self.tunnel_stats["bypassed"] += 1
                print(f"[BrowserManager] ⚡ Ícone/UI direto: {url[:70]}...")
                try:
                    await route.continue_()
                except:
                    await route.fallback()
                return
            
            if any(domain in url_lower for domain in ['gstatic.com', 'googleusercontent.com', 'lh3.google.com', 'lh4.google.com', 'lh5.google.com', 'lh6.google.com']):
                self.tunnel_stats["bypassed"] += 1
                print(f"[BrowserManager] ⚡ CDN direto: {url[:70]}...")
                try:
                    await route.continue_()
                except:
                    await route.fallback()
                return
        
        # ✅ Bypass por headers críticos
        accept_header = (request.headers.get('accept') or '').lower()
        upgrade_header = (request.headers.get('upgrade') or '').lower()
        content_type = (request.headers.get('content-type') or '').lower()
        
        if ('text/event-stream' in accept_header or 
            upgrade_header == 'websocket' or 
            'application/grpc-web+proto' in content_type):
            self.tunnel_stats["bypassed"] += 1
            print(f"[BrowserManager] ⚡ DIRETO (header crítico): {url[:80]}...")
            try:
                await route.continue_()
            except Exception as fallback_error:
                await route.fallback()
            return
        
        # Ignorar internos
        if url.startswith('data:') or url.startswith('blob:'):
            await route.continue_()
            return
        
        self.tunnel_stats["requests"] += 1
        
        # ✅ Verificar cache
        cached = self.resource_cache.get(url)
        if cached:
            content, status, headers = cached
            self.tunnel_stats["cached"] += 1
            elapsed = (time_module.time() - request_start) * 1000
            print(f"[BrowserManager] ⚡ Cache: {url[:60]}... ({elapsed:.0f}ms)")
            
            await route.fulfill(status=status, headers=headers, body=content)
            
            # Prefetch assíncrono
            if self.resource_cache.is_expiring_soon(url):
                asyncio.create_task(self._prefetch_resource(url, self.current_incident_id))
            
            return
        
        print(f"[BrowserManager] 🌐 TÚNEL: {url[:80]}...")
        
        try:
            # Headers
            request_headers = {
                'User-Agent': request.headers.get('user-agent', ''),
                'Accept': request.headers.get('accept', '*/*'),
                'Accept-Language': request.headers.get('accept-language', 'en-US,en;q=0.9'),
                'Referer': request.headers.get('referer', ''),
            }
            
            # ✅ Timeout inteligente
            timeout = self._tunnel_timeout_for(url, interactive=self.current_interactive)
            
            # ✅ Paralelizar com semáforo
            async with self.tunnel_semaphore:
                in_use = 3 - self.tunnel_semaphore._value
                if in_use > 1:
                    print(f"[BrowserManager] 🔒 Semáforo: {in_use}/3 em uso")
                
                tunnel_response: TunnelResponse = await self.tunnel_client.fetch(
                    url=url,
                    method=request.method,
                    headers=request_headers,
                    timeout=timeout,
                    incident_id=self.current_incident_id,
                    max_retries=5 if timeout > 60 else 3
                )
            
            if not tunnel_response.success:
                raise Exception(f"Túnel falhou: {tunnel_response.error}")
            
            elapsed = (time_module.time() - request_start) * 1000
            self.tunnel_stats["tunneled"] += 1
            self.tunnel_stats["total_time"] += elapsed
            
            print(f"[BrowserManager] ✅ OK: {tunnel_response.status_code} ({elapsed:.0f}ms)")
            
            content = tunnel_response.bytes
            
            headers = {}
            for key, value in tunnel_response.headers.items():
                if key.lower() not in ['content-encoding', 'transfer-encoding', 'content-length']:
                    headers[key] = value
            
            # Cache
            self.resource_cache.set(url, content, tunnel_response.status_code, headers)
            
            # Sincronizar cookies
            if tunnel_response.cookies and len(tunnel_response.cookies) > 0:
                print(f"[BrowserManager] 🍪 Sincronizando {len(tunnel_response.cookies)} cookies...")
                
                try:
                    from playwright.async_api import BrowserContext
                    context = self.sessions[list(self.sessions.keys())[0]].context if self.sessions else None
                    
                    if context:
                        playwright_cookies = []
                        for c in tunnel_response.cookies:
                            cookie = {
                                "name": c.get("name", ""),
                                "value": c.get("value", ""),
                                "domain": c.get("domain", ""),
                                "path": c.get("path", "/"),
                                "httpOnly": c.get("httpOnly", False),
                                "secure": c.get("secure", False),
                                "sameSite": "Lax"
                            }
                            
                            if not c.get("isSession") and c.get("expirationDate"):
                                cookie["expires"] = c["expirationDate"]
                            
                            playwright_cookies.append(cookie)
                        
                        await context.add_cookies(playwright_cookies)
                        print(f"[BrowserManager] ✅ Cookies sincronizados")
                    
                except Exception as cookie_error:
                    print(f"[BrowserManager] ⚠️ Erro ao sincronizar: {cookie_error}")
            
            await route.fulfill(status=tunnel_response.status_code, headers=headers, body=content)
            
        except Exception as e:
            error_elapsed = (time_module.time() - request_start) * 1000
            self.tunnel_stats["errors"] += 1
            print(f"[BrowserManager] ❌ Erro no túnel após {error_elapsed:.0f}ms: {str(e)[:100]}")
            
            # Retry com fallback
            if request_type in ['image', 'font', 'stylesheet', 'media']:
                print(f"[BrowserManager] 🔄 Tentando carregamento direto (fallback para {request_type})")
                try:
                    await route.continue_()
                except:
                    print(f"[BrowserManager] ⚠️ Abortando recurso não-crítico: {url[:60]}...")
                    await route.abort()
            else:
                try:
                    await route.continue_()
                except:
                    await route.abort()
    
    async def _test_handler_alive(self, page):
        """
        ✅ FASE 3: Testar se handler está respondendo.
        """
        try:
            # Tentar fazer request dummy
            response = await page.evaluate("""
                fetch('https://httpbin.org/uuid', {method: 'HEAD'})
                    .then(() => true)
                    .catch(() => false)
            """)
            
            if response:
                print(f"[BrowserManager] ✓ Handler respondendo (fetch funcionou)")
            else:
                print(f"[BrowserManager] ⚠️ Handler não respondeu a fetch")
            
            return response
        except Exception as e:
            print(f"[BrowserManager] ❌ Erro ao testar handler: {e}")
            return False
    
    async def initialize(self, force_new: bool = False):
        """
        Inicializar Playwright com opção de forçar re-criação.
        
        Args:
            force_new: Se True, força re-criação do Playwright (limpar estado)
        """
        # ✅ SOLUÇÃO #2: Forçar re-criação do Playwright se solicitado
        if force_new and self.playwright_instance:
            print("[BrowserManager] 🔄 Forçando re-criação do Playwright (limpar estado)...")
            try:
                await self.playwright_instance.stop()
                print("[BrowserManager] ✓ Playwright anterior encerrado")
            except Exception as e:
                print(f"[BrowserManager] ⚠️ Erro ao parar Playwright anterior: {e}")
            self.playwright_instance = None
        
        if not self.playwright_instance:
            try:
                # ✅ Verificar se o event loop está rodando
                try:
                    loop = asyncio.get_running_loop()
                    print(f"[BrowserManager] ✓ Event loop detectado: {loop}")
                except RuntimeError:
                    print(f"[BrowserManager] ❌ Nenhum event loop rodando")
                    raise Exception("Nenhum event loop ativo para Playwright")
                
                print("[BrowserManager] Inicializando Playwright...")
                self.playwright_instance = await async_playwright().start()
                print("[BrowserManager] ✓ Playwright inicializado com sucesso")
            except Exception as e:
                print(f"[BrowserManager] ❌ Erro ao inicializar Playwright: {e}")
                print("[BrowserManager] Execute: python -m playwright install chromium")
                raise
    
    @staticmethod
    def normalize_same_site(value: str) -> str:
        """
        Normalizar valor de sameSite para formato do Playwright.
        Chrome usa: no_restriction, unspecified, lax, strict, none
        Playwright espera: None, Lax, Strict
        """
        if not value or value.lower() in ["unspecified", "no_restriction"]:
            return "None"
        
        # Capitalizar primeira letra (lax -> Lax, strict -> Strict)
        normalized = value.capitalize()
        
        # Validar que está nos valores aceitos
        if normalized not in ["Strict", "Lax", "None"]:
            return "Lax"  # Valor padrão seguro
        
        return normalized
    
    async def _setup_tunnel_reverse(self, context, machine_id: str, incident_id: str, interactive: bool = False, blocked_domains: list = None):
        """
        Configurar túnel reverso usando método de instância como handler.
        """
        if blocked_domains is None:
            blocked_domains = []
        
        print(f"[BrowserManager] 🌐 Configurando túnel reverso...")
        print(f"[BrowserManager] Machine ID: {machine_id}")
        print(f"[BrowserManager] Incident ID: {incident_id}")
        print(f"[BrowserManager] Domínios bloqueados: {len(blocked_domains)}")
        if interactive:
            print(f"[BrowserManager] ⚡ Modo INTERATIVO: timeouts agressivos")
        
        if not self.tunnel_client:
            self.tunnel_client = TunnelClient(self.supabase, machine_id)
        
        # ✅ SALVAR ESTADO EM VARIÁVEIS DE INSTÂNCIA (persistentes)
        self.current_blocked_domains = blocked_domains
        self.current_incident_id = incident_id
        self.current_machine_id = machine_id
        self.current_interactive = interactive
        
        # ✅ Criar semáforo no event loop atual (Playwright)
        self.tunnel_semaphore = asyncio.Semaphore(self.tunnel_semaphore_max)
        print(f"[BrowserManager] ✓ Semáforo criado no event loop do Playwright")
        
        # ✅ REGISTRAR MÉTODO DE INSTÂNCIA COMO HANDLER
        await context.route('**/*', self._handle_route_with_tunnel)
        
        print(f"[BrowserManager] ✅ Túnel reverso ativo - IP do cliente")
    
    async def start_session(self, incident: Dict, interactive: bool = False, enable_tunnel: bool = True) -> tuple[Optional[str], Optional[bytes]]:
        """
        Iniciar nova sessão do browser com os dados do incidente.
        Se interactive=True, abre browser visível para navegação manual.
        Retorna tuple (session_id, screenshot_bytes) ou (None, None) em caso de erro.
        """
        import time
        start_time = time.time()
        
        try:
            # ✅ SOLUÇÃO #2: Se interativo, sempre forçar novo Playwright (limpar estado)
            await self.initialize(force_new=interactive)
            
            # Extrair dados do incidente
            incident_id = incident.get("id")
            machine_id = incident.get("machine_id")
            target_url = incident.get("tab_url")
            cookies_raw = incident.get("full_cookie_data", [])
            fingerprint = incident.get("browser_fingerprint") or {}
            
            # ✅ CORREÇÃO #10: Buscar client_ip com fallback para múltiplos campos
            client_ip = (
                incident.get("client_ip") or 
                incident.get("public_ip") or 
                incident.get("ip_address")
            )
            
            if not client_ip:
                print(f"[BrowserManager] ❌ AVISO: IP público não disponível!")
                print(f"[BrowserManager] ⚠️ Túnel DNS será desabilitado - requisições virão do IP do servidor")
                print(f"[BrowserManager] ℹ️  Campos disponíveis no incident: {list(incident.keys())}")
            
            print(f"[BrowserManager] Iniciando sessão para incidente {incident_id}")
            print(f"[BrowserManager] URL: {target_url}")
            print(f"[BrowserManager] Cookies: {len(cookies_raw)} cookies")
            print(f"[BrowserManager] Fingerprint disponível: {bool(fingerprint)}")
            print(f"[BrowserManager] Client IP: {client_ip or 'Não disponível'}")
            
            # Iniciar browser Chromium (sempre novo processo se interativo)
            if interactive:
                print(f"[BrowserManager] Lançando novo browser Chromium (interativo)...")
                browser = await self.playwright_instance.chromium.launch(
                    headless=False,
                    args=[
                        '--start-maximized',
                        '--disable-blink-features=AutomationControlled'
                    ]
                )
                print(f"[BrowserManager] ✓ Browser iniciado")
            else:
                browser = await self.playwright_instance.chromium.launch(
                    headless=True,
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process'
                    ]
                )
            
            print(f"[BrowserManager] ✓ Browser inicializado")
            
            # Configurar contexto com fingerprint completo
            context_options = {
                'ignore_https_errors': True,
                'java_script_enabled': True
            }
            
            # Aplicar Screen Properties do fingerprint
            if fingerprint and fingerprint.get('screen'):
                screen = fingerprint['screen']
                context_options['viewport'] = {
                    'width': screen.get('width', 1920),
                    'height': screen.get('height', 1080)
                }
                context_options['device_scale_factor'] = screen.get('pixelRatio', 1)
                print(f"[BrowserManager] ✓ Viewport: {screen.get('width')}x{screen.get('height')} @ {screen.get('pixelRatio')}x")
            else:
                context_options['viewport'] = {'width': 1280, 'height': 720}
                print(f"[BrowserManager] ⚠️ Usando viewport padrão (1280x720)")
            
            # Aplicar User Agent
            if fingerprint and fingerprint.get('userAgent'):
                context_options['user_agent'] = fingerprint['userAgent']
                print(f"[BrowserManager] ✓ User Agent: {fingerprint['userAgent'][:60]}...")
            else:
                context_options['user_agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                print(f"[BrowserManager] ⚠️ Usando User Agent padrão")
            
            # Aplicar Timezone
            if fingerprint and fingerprint.get('timezone'):
                tz_name = fingerprint['timezone'].get('name', 'America/Sao_Paulo')
                context_options['timezone_id'] = tz_name
                langs = fingerprint.get('languages', {})
                context_options['locale'] = langs.get('language', 'pt-BR')
                print(f"[BrowserManager] ✓ Timezone: {tz_name}, Locale: {context_options['locale']}")
            
            # Criar contexto com todas as configurações
            context = await browser.new_context(**context_options)
            print(f"[BrowserManager] ✓ Contexto criado com fingerprint")
            
            # Injetar scripts para sobrescrever propriedades não-padrão
            if fingerprint and isinstance(fingerprint, dict):
                await self._inject_fingerprint_overrides(context, fingerprint)
            
            # ✅ CORREÇÃO #5: Injetar cookies com validação completa
            if cookies_raw:
                cookies = []
                for c in cookies_raw:
                    # Validar domínio
                    domain = c.get("domain", "")
                    if not domain or domain == "":
                        try:
                            from urllib.parse import urlparse
                            parsed = urlparse(target_url)
                            domain = parsed.hostname or "localhost"
                            print(f"[BrowserManager] Cookie '{c.get('name')}': domínio vazio corrigido para {domain}")
                        except:
                            domain = "localhost"
                    
                    # Normalizar sameSite considerando secure
                    raw_same_site = c.get("sameSite", "Lax")
                    is_secure = c.get("secure", False)
                    
                    if raw_same_site.lower() == "no_restriction":
                        normalized_same_site = "None" if is_secure else "Lax"
                    elif raw_same_site.lower() in ["unspecified", ""]:
                        normalized_same_site = "Lax"
                    else:
                        normalized_same_site = raw_same_site.capitalize()
                        if normalized_same_site not in ["Strict", "Lax", "None"]:
                            normalized_same_site = "Lax"
                    
                    # Validar None + Secure (sameSite=None requer secure=true)
                    if normalized_same_site == "None" and not is_secure:
                        print(f"[BrowserManager] Cookie '{c.get('name')}': sameSite=None mas secure=false, usando Lax")
                        normalized_same_site = "Lax"
                    
                    if raw_same_site != normalized_same_site:
                        print(f"[BrowserManager] Cookie '{c.get('name')}': sameSite normalizado de '{raw_same_site}' para '{normalized_same_site}'")
                    
                    cookie = {
                        "name": c.get("name", ""),
                        "value": c.get("value", ""),
                        "domain": domain,
                        "path": c.get("path", "/"),
                        "httpOnly": c.get("httpOnly", False),
                        "secure": is_secure,
                        "sameSite": normalized_same_site
                    }
                    
                    # ✅ CRÍTICO: Adicionar expires APENAS se não for cookie de sessão
                    is_session = c.get("isSession", False)
                    expiration = c.get("expirationDate")
                    
                    if not is_session and expiration and expiration > 0:
                        cookie["expires"] = expiration
                        print(f"[BrowserManager] Cookie '{c.get('name')}': persistente (expires: {expiration})")
                    else:
                        print(f"[BrowserManager] Cookie '{c.get('name')}': sessão (sem expires)")
                    
                    cookies.append(cookie)
                
                print(f"[BrowserManager] Injetando {len(cookies)} cookies...")
                try:
                    await context.add_cookies(cookies)
                    print(f"[BrowserManager] ✓ {len(cookies)} cookies injetados com sucesso")
                except Exception as cookie_error:
                    print(f"[BrowserManager] ❌ Erro ao injetar cookies: {cookie_error}")
                    import traceback
                    traceback.print_exc()
                    # Tentar injetar um por um para identificar qual falhou
                    for cookie in cookies:
                        try:
                            await context.add_cookies([cookie])
                            print(f"[BrowserManager] ✓ Cookie '{cookie['name']}' injetado")
                        except Exception as e:
                            print(f"[BrowserManager] ❌ Cookie '{cookie['name']}' falhou: {e}")
            
            # ✅ CARREGAR DOMÍNIOS BLOQUEADOS (sem registrar handler ainda)
            print(f"[BrowserManager] Carregando domínios bloqueados...")
            blocked_domains = await self._get_blocked_domains()
            
            # ✅ CONFIGURAR TÚNEL REVERSO (inclui lógica de bloqueio) - CONDICIONAL
            machine_id_from_incident = incident.get("machine_id")
            if enable_tunnel and machine_id_from_incident and incident_id:
                # ✅ Passar blocked_domains para túnel registrar handler unificado
                await self._setup_tunnel_reverse(
                    context, 
                    machine_id_from_incident, 
                    incident_id, 
                    interactive=interactive,
                    blocked_domains=blocked_domains
                )
                
                # ✅ Health-check do túnel antes de navegar
                print(f"[BrowserManager] 🔍 Verificando túnel reverso...")
                try:
                    # ✅ CORREÇÃO: Remover asyncio.wait_for() externo
                    # O tunnel_client.get() já tem timeout=30 interno!
                    health_response = await self.tunnel_client.get(
                        'https://www.gstatic.com/generate_204',
                        timeout=30
                    )
                    
                    if not health_response.success or health_response.status_code not in (200, 204):
                        raise Exception(f'Health-check falhou (status={health_response.status_code})')
                    print(f"[BrowserManager] ✅ Túnel operacional")
                    
                except asyncio.TimeoutError:
                    print(f"[BrowserManager] ❌ Túnel indisponível: Timeout após 30s")
                    print(f"[BrowserManager] ⚠️ Verifique se a extensão Chrome está conectada")
                    raise Exception(f"Túnel reverso falhou: TimeoutError")
                    
                except Exception as health_error:
                    print(f"[BrowserManager] ❌ Túnel indisponível: {health_error}")
                    print(f"[BrowserManager] ⚠️ Verifique se a extensão Chrome está conectada")
                    raise Exception(f"Túnel reverso falhou: {health_error}")
            elif not enable_tunnel:
                print(f"[BrowserManager] ⚡ Modo SIMPLES: Túnel DNS DESABILITADO")
                print(f"[BrowserManager] ⚠️ Requisições virão do IP do SERVIDOR!")
            else:
                print(f"[BrowserManager] ⚠️ Sem túnel reverso (dados insuficientes)!")
                print(f"[BrowserManager] ⚠️ Requisições virão do IP do SERVIDOR!")
            
            # ✅ AGORA criar página (túnel já está ativo e validado)
            page = await context.new_page()
            
            # Navegar para URL com detecção inteligente de carregamento
            print(f"[BrowserManager] 🌐 Navegando para {target_url}...")
            
            try:
                # Etapa 1: DOM básico pronto
                await page.goto(target_url, wait_until='domcontentloaded', timeout=60000)
                print(f"[BrowserManager] ✓ DOM carregado (domcontentloaded)")
                
                # Etapa 2: Aguardar rede estabilizar (crítico para SPAs)
                # ✅ FASE 2: Timeout aumentado de 30s → 90s para permitir recursos tunelados
                try:
                    await page.wait_for_load_state('networkidle', timeout=90000)
                    print(f"[BrowserManager] ✓ Rede estabilizada (networkidle)")
                except Exception as network_timeout:
                    # Fallback: aguardar evento 'load'
                    # ✅ FASE 2: Timeout aumentado de 20s → 60s
                    print(f"[BrowserManager] ⚠️ networkidle timeout, usando fallback 'load'...")
                    try:
                        await page.wait_for_load_state('load', timeout=60000)
                        print(f"[BrowserManager] ✓ Página carregada (load event)")
                    except Exception as load_timeout:
                        # ✅ FASE 2: Fallback final para domcontentloaded
                        print(f"[BrowserManager] ⚠️ load timeout, usando fallback 'domcontentloaded'...")
                        try:
                            await page.wait_for_load_state('domcontentloaded', timeout=30000)
                            print(f"[BrowserManager] ✓ DOM carregado (domcontentloaded)")
                        except:
                            print(f"[BrowserManager] ⚠️ Todos os timeouts esgotados - página pode estar parcialmente carregada")
                            pass  # Continuar mesmo assim (melhor que crash total)
                
                # Etapa 3: Aguardar body visível (garante que algo foi renderizado)
                try:
                    await page.wait_for_selector('body', state='visible', timeout=10000)
                    print(f"[BrowserManager] ✓ Body visível")
                except:
                    print(f"[BrowserManager] ⚠️ Body não detectado (possível problema)")
                
                # Etapa 4: Aguardar JavaScript executar (SPAs como Gmail/React)
                print(f"[BrowserManager] ⏳ Aguardando JavaScript inicializar...")
                await page.wait_for_timeout(3000)
                print(f"[BrowserManager] ✅ Página completamente carregada")
                
            except Exception as nav_error:
                print(f"[BrowserManager] ❌ Erro na navegação: {nav_error}")
                raise
            
            # ✅ CORREÇÃO #6: Injetar localStorage e sessionStorage
            local_storage = incident.get("local_storage", {})
            session_storage = incident.get("session_storage", {})

            if local_storage or session_storage:
                print(f"[BrowserManager] Injetando storage...")
                
                import json
                
                # 🔧 FUNÇÃO PARA PREPARAR STORAGE SEM DUPLICAR ESCAPES
                def _prepare_storage_for_injection(storage_dict):
                    """
                    Preparar storage data para injeção JavaScript sem duplicar escapes.
                    Se value já é string JSON, mantém; se é string simples, escapa; se é object, serializa.
                    """
                    prepared = {}
                    for key, value in storage_dict.items():
                        if isinstance(value, str):
                            try:
                                # Tentar parsear: se sucesso, já é JSON válido
                                json.loads(value)
                                # Manter como está (já é string JSON serializada)
                                prepared[key] = value
                            except json.JSONDecodeError:
                                # É string simples, precisa serializar
                                prepared[key] = json.dumps(value)
                        else:
                            # Object/array Python, serializar
                            prepared[key] = json.dumps(value)
                    return json.dumps(prepared)
                
                try:
                    # Preparar dados com escape correto
                    local_data_json = _prepare_storage_for_injection(local_storage)
                    session_data_json = _prepare_storage_for_injection(session_storage)
                    
                    await page.evaluate(f"""
                        // Limpar storage existente
                        localStorage.clear();
                        sessionStorage.clear();
                        
                        // Injetar localStorage
                        const localData = {local_data_json};
                        for (const [key, value] of Object.entries(localData)) {{
                            try {{
                                localStorage.setItem(key, value);
                            }} catch (e) {{
                                console.warn('[CorpMonitor] Failed to set localStorage:', key, e);
                            }}
                        }}
                        
                        // Injetar sessionStorage
                        const sessionData = {session_data_json};
                        for (const [key, value] of Object.entries(sessionData)) {{
                            try {{
                                sessionStorage.setItem(key, value);
                            }} catch (e) {{
                                console.warn('[CorpMonitor] Failed to set sessionStorage:', key, e);
                            }}
                        }}
                        
                        console.log('[CorpMonitor] ✓ Storage injetado:', {{
                            localStorage: Object.keys(localStorage).length,
                            sessionStorage: Object.keys(sessionStorage).length
                        }});
                    """)
                    
                    print(f"[BrowserManager] ✓ localStorage ({len(local_storage)} keys) e sessionStorage ({len(session_storage)} keys) injetados")
                except Exception as storage_error:
                    print(f"[BrowserManager] ⚠️ Erro ao injetar storage: {storage_error}")
            
            # Capturar screenshot (apenas em modo headless)
            screenshot_bytes = None
            if not interactive:
                print(f"[BrowserManager] Capturando screenshot...")
                screenshot_bytes = await page.screenshot(full_page=False, type='png')
                print(f"[BrowserManager] ✓ Screenshot capturado ({len(screenshot_bytes)} bytes)")
            else:
                print(f"[BrowserManager] Modo interativo: navegador permanece aberto para navegação manual")
            # ✅ PAUSAR APENAS AUTO-REFRESHES (manter WebSocket do túnel ativo)
            if self.realtime_manager:
                print(f"[BrowserManager] ⏸️ Pausando auto-refreshes (WebSocket do túnel permanece ativo)...")
                # NÃO chamar .stop() - isso fecha o WebSocket
                # Apenas sinalizar que está em modo interativo (logs menos verbosos)
                self.realtime_manager.set_interactive_mode(True)
                self.realtime_suspended = True
            
            # Criar sessão
            session_id = f"session-{incident_id}"
            session = BrowserSession(session_id, page, browser, self.playwright_instance, context)
            self.sessions[session_id] = session
            
            elapsed = time.time() - start_time
            mode_msg = "disponível para interação" if interactive else f"criada com sucesso em {elapsed:.2f}s"
            print(f"[BrowserManager] ✓ Sessão {session_id} {mode_msg}")
            
            # ✅ NOVO: Log detalhado de estatísticas de túnel
            if self.tunnel_stats["requests"] > 0:
                cache_stats = self.resource_cache.get_stats()
                avg_time = self.tunnel_stats["total_time"] / self.tunnel_stats["tunneled"] if self.tunnel_stats["tunneled"] > 0 else 0
                
                print(f"\n[BrowserManager] 📊 ===== ESTATÍSTICAS DE TÚNEL =====")
                print(f"[BrowserManager]   Total requisições: {self.tunnel_stats['requests']}")
                print(f"[BrowserManager]   Cache hits: {self.tunnel_stats['cached']} ({cache_stats.get('hit_rate', '0%')})")
                print(f"[BrowserManager]   Tuneladas: {self.tunnel_stats['tunneled']} (média {avg_time:.0f}ms)")
                print(f"[BrowserManager]   Bypasses: {self.tunnel_stats.get('bypassed', 0)} (requisições diretas)")
                print(f"[BrowserManager]   Erros: {self.tunnel_stats['errors']}")
                print(f"[BrowserManager] =====================================\n")
            
            # ✅ FASE 3: Testar se handler ainda está ativo
            if interactive and page:
                print(f"[BrowserManager] 🧪 Testando handler após carregamento...")
                handler_ok = await self._test_handler_alive(page)
                if not handler_ok:
                    print(f"[BrowserManager] ⚠️ Handler não está respondendo - pode estar desanexado")
            
            return session_id, screenshot_bytes
            
        except Exception as e:
            print(f"[BrowserManager] ❌ Erro ao iniciar sessão: {e}")
            import traceback
            traceback.print_exc()
            return None, None
    
    async def open_interactive_browser(self, incident: Dict, enable_tunnel: bool = True) -> Optional[str]:
        """
        Abrir navegador interativo (visível) para o usuário navegar manualmente.
        
        Args:
            incident: Dados do incidente com cookies/storage
            enable_tunnel: Se True, usa túnel DNS reverso (padrão: True)
        
        Returns:
            session_id ou None se falhar
        """
        # ✅ FASE 3: Verificar processos Chrome órfãos ANTES de abrir nova sessão
        print(f"[BrowserManager] 🔍 Verificando processos Chrome órfãos...")
        await self._kill_chrome_processes()
        
        try:
            tunnel_mode = "COM túnel DNS" if enable_tunnel else "SEM túnel (modo simples)"
            print(f"[BrowserManager] 🌐 Abrindo browser interativo {tunnel_mode}...")
            
            session_id, _ = await self.start_session(incident, interactive=True, enable_tunnel=enable_tunnel)
            
            if session_id:
                print(f"[BrowserManager] ✓ Navegador interativo aberto (sessão: {session_id})")
                print(f"[BrowserManager] ℹ️  Feche a janela de controle para encerrar a sessão")
            
            return session_id
        except Exception as e:
            print(f"[BrowserManager] ❌ Erro ao abrir navegador interativo: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def _prefetch_resource(self, url: str, incident_id: str):
        """
        ✅ FASE 3: Atualizar cache em background sem bloquear navegação
        
        Args:
            url: URL do recurso a atualizar
            incident_id: ID do incidente para log
        """
        try:
            if not self.tunnel_client:
                return
            
            # Fazer request tunelada com timeout curto (não é crítico)
            tunnel_response = await self.tunnel_client.fetch(
                url=url,
                method='GET',
                timeout=30,
                incident_id=incident_id,
                max_retries=1  # Só 1 retry (não é crítico)
            )
            
            if tunnel_response.success:
                # Atualizar cache silenciosamente
                self.resource_cache.set(
                    url, 
                    tunnel_response.bytes, 
                    tunnel_response.status_code, 
                    tunnel_response.headers
                )
                print(f"[BrowserManager] ♻️ Cache atualizado (prefetch): {url[:60]}...")
            
        except Exception as e:
            # Falha silenciosa - cache antigo ainda válido
            print(f"[BrowserManager] ⚠️ Prefetch falhou (não crítico): {url[:40]}... - {e}")
            pass
    
    async def _inject_fingerprint_overrides(self, context: BrowserContext, fingerprint: Dict):
        """Injetar scripts para sobrescrever propriedades do navigator/window"""
        try:
            # Extrair dados do fingerprint com segurança
            platform = fingerprint.get("platform", "Win32")
            vendor = fingerprint.get("vendor", "Google Inc.")
            hardware = fingerprint.get("hardware", {})
            screen = fingerprint.get("screen", {})
            webgl = fingerprint.get("webgl", {})
            
            # Construir script de override
            script = f"""
            // Override navigator properties
            Object.defineProperty(navigator, 'platform', {{
                get: () => '{platform}'
            }});
            
            Object.defineProperty(navigator, 'vendor', {{
                get: () => '{vendor}'
            }});
            
            Object.defineProperty(navigator, 'hardwareConcurrency', {{
                get: () => {hardware.get("hardwareConcurrency", 8)}
            }});
            
            Object.defineProperty(navigator, 'deviceMemory', {{
                get: () => {hardware.get("deviceMemory", 8)}
            }});
            
            Object.defineProperty(navigator, 'maxTouchPoints', {{
                get: () => {hardware.get("maxTouchPoints", 0)}
            }});
            
            // Override screen properties
            Object.defineProperty(screen, 'colorDepth', {{
                get: () => {screen.get("colorDepth", 24)}
            }});
            
            Object.defineProperty(screen, 'pixelDepth', {{
                get: () => {screen.get("pixelDepth", 24)}
            }});
            """
            
            # Adicionar override de WebGL se disponível
            if webgl.get('vendor') and webgl.get('renderer'):
                vendor_escaped = webgl.get('vendor', '').replace("'", "\\'")
                renderer_escaped = webgl.get('renderer', '').replace("'", "\\'")
                
                script += f"""
            // Override WebGL properties
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(param) {{
                if (param === 0x1F00) return '{vendor_escaped}';
                if (param === 0x1F01) return '{renderer_escaped}';
                if (param === 0x9245) {{
                    const ext = this.getExtension('WEBGL_debug_renderer_info');
                    if (ext && param === ext.UNMASKED_VENDOR_WEBGL) return '{vendor_escaped}';
                }}
                if (param === 0x9246) {{
                    const ext = this.getExtension('WEBGL_debug_renderer_info');
                    if (ext && param === ext.UNMASKED_RENDERER_WEBGL) return '{renderer_escaped}';
                }}
                return getParameter.apply(this, arguments);
            }};
            
            // Aplicar também para WebGL2
            if (typeof WebGL2RenderingContext !== 'undefined') {{
                const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function(param) {{
                    if (param === 0x1F00) return '{vendor_escaped}';
                    if (param === 0x1F01) return '{renderer_escaped}';
                    return getParameter2.apply(this, arguments);
                }};
            }}
            """
            
            # Remover sinais de automação
            script += """
            // Remove sinais de automação
            delete navigator.webdriver;
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Sobrescrever chrome.runtime
            if (window.chrome && window.chrome.runtime) {
                Object.defineProperty(window.chrome, 'runtime', {
                    get: () => undefined
                });
            }
            
            console.log('[CorpMonitor] ✓ Fingerprint overrides aplicados');
            """
            
            await context.add_init_script(script)
            print(f"[BrowserManager] ✓ Fingerprint overrides injetados")
            
        except Exception as e:
            print(f"[BrowserManager] ⚠️ Erro ao injetar fingerprint overrides: {e}")
            import traceback
            traceback.print_exc()
    
    async def _get_blocked_domains(self) -> list:
        """
        Retornar lista de domínios bloqueados (sem registrar handler).
        Handler será registrado em _setup_tunnel_reverse.
        """
        try:
            response = self.supabase.table("blocked_domains")\
                .select("domain")\
                .eq("is_active", True)\
                .execute()
            
            if response.data:
                blocked_domains = [d["domain"] for d in response.data]
                print(f"[BrowserManager] Carregados {len(blocked_domains)} domínios bloqueados")
                return blocked_domains
            return []
        except Exception as e:
            print(f"[BrowserManager] Erro ao carregar bloqueios: {e}")
            return []
    
    async def navigate(self, session_id: str, url: str) -> Optional[bytes]:
        """Navegar para nova URL"""
        try:
            session = self.sessions.get(session_id)
            if not session or not session.is_active:
                print(f"[BrowserManager] Sessão {session_id} não encontrada")
                return None
            
            print(f"[BrowserManager] Navegando para {url}")
            await session.page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await session.page.wait_for_timeout(1000)
            
            screenshot_bytes = await session.page.screenshot(full_page=False)
            return screenshot_bytes
        except Exception as e:
            print(f"[BrowserManager] Erro ao navegar: {e}")
            return None
    
    async def click(self, session_id: str, selector: str) -> Optional[bytes]:
        """Clicar em elemento"""
        try:
            session = self.sessions.get(session_id)
            if not session or not session.is_active:
                return None
            
            await session.page.click(selector)
            await session.page.wait_for_timeout(1000)
            
            screenshot_bytes = await session.page.screenshot(full_page=False)
            return screenshot_bytes
        except Exception as e:
            print(f"[BrowserManager] Erro ao clicar: {e}")
            return None
    
    async def get_screenshot(self, session_id: str) -> Optional[bytes]:
        """Capturar screenshot atual"""
        try:
            session = self.sessions.get(session_id)
            if not session or not session.is_active:
                return None
            
            # Verificar se página ainda está aberta
            if session.page.is_closed():
                print(f"[BrowserManager] Página da sessão {session_id} já está fechada")
                return None
            
            screenshot_bytes = await session.page.screenshot(full_page=False)
            return screenshot_bytes
        except Exception as e:
            print(f"[BrowserManager] Erro ao capturar screenshot: {e}")
            return None
    
    async def inject_popup(self, session_id: str, template_id: str) -> bool:
        """Injetar popup customizado na página"""
        try:
            session = self.sessions.get(session_id)
            if not session or not session.is_active:
                return False
            
            # Buscar template do Supabase
            template_response = self.supabase.table("popup_templates")\
                .select("*")\
                .eq("id", template_id)\
                .single()\
                .execute()
            
            if not template_response.data:
                print("[BrowserManager] Template não encontrado")
                return False
            
            template = template_response.data
            html_content = template.get("html_content", "")
            css_styles = template.get("css_styles", "")
            
            # Escapar conteúdo para prevenir XSS
            html_escaped = self.escape_js_string(html_content)
            css_escaped = self.escape_js_string(css_styles)
            
            # Injetar popup via JavaScript
            js_code = f"""
            (function() {{
                const overlay = document.createElement('div');
                overlay.id = 'corpmonitor-popup-overlay';
                overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; display: flex; align-items: center; justify-content: center;';
                
                const popup = document.createElement('div');
                popup.id = 'corpmonitor-popup';
                popup.innerHTML = "{html_escaped}";
                
                const style = document.createElement('style');
                style.textContent = "{css_escaped}";
                
                overlay.appendChild(popup);
                document.body.appendChild(style);
                document.body.appendChild(overlay);
                
                console.log('[CorpMonitor] Popup injetado');
            }})();
            """
            
            await session.page.evaluate(js_code)
            print(f"[BrowserManager] Popup {template_id} injetado com sucesso")
            
            return True
        except Exception as e:
            print(f"[BrowserManager] Erro ao injetar popup: {e}")
            return False
    
    async def test_tunnel_connection(self, machine_id: str) -> bool:
        """
        Testar túnel reverso
        """
        try:
            print(f"[BrowserManager] 🧪 Testando túnel...")
            
            tunnel = TunnelClient(self.supabase, machine_id)
            response = await tunnel.get("https://httpbin.org/get", timeout=10)
            
            if response.success:
                print(f"[BrowserManager] ✅ Túnel OK")
                print(f"[BrowserManager]    Status: {response.status_code}")
                print(f"[BrowserManager]    Latência: {response.elapsed_ms}ms")
                return True
            else:
                print(f"[BrowserManager] ❌ Túnel FALHOU: {response.error}")
                return False
                
        except Exception as e:
            print(f"[BrowserManager] ❌ Erro: {e}")
            return False
    
    async def close_session(self, session_id: str):
        """Fechar uma sessão específica com timeout e cleanup de processos"""
        # ✅ RESTAURAR REALTIME se estava suspenso
        if self.realtime_suspended and self.realtime_manager:
            print(f"[BrowserManager] ▶️ Restaurando Realtime...")
            self.realtime_manager.set_interactive_mode(False)
            self.realtime_suspended = False
        
        if session_id not in self.sessions:
            print(f"[BrowserManager] Sessão {session_id} não encontrada")
            return
        
        session = self.sessions[session_id]
        
        try:
            # Timeout geral de 5 segundos
            async with asyncio.timeout(5):
                # Fechar página (timeout 2s)
                if session.page and not session.page.is_closed():
                    try:
                        async with asyncio.timeout(2):
                            await session.page.close()
                            print(f"[BrowserManager] ✓ Página da sessão {session_id} fechada")
                    except asyncio.TimeoutError:
                        print(f"[BrowserManager] ⚠️ Timeout ao fechar página")
                    except Exception as e:
                        if "closed" not in str(e).lower():
                            print(f"[BrowserManager] Aviso ao fechar página: {e}")
                
                # Fechar contexto (timeout 2s)
                if session.context:
                    try:
                        async with asyncio.timeout(2):
                            await session.context.close()
                            print(f"[BrowserManager] ✓ Contexto da sessão {session_id} fechado")
                    except asyncio.TimeoutError:
                        print(f"[BrowserManager] ⚠️ Timeout ao fechar contexto")
                    except Exception as e:
                        if "closed" not in str(e).lower():
                            print(f"[BrowserManager] Aviso ao fechar contexto: {e}")
                
                # Fechar browser (timeout 2s)
                if session.browser:
                    try:
                        async with asyncio.timeout(2):
                            await session.browser.close()
                            print(f"[BrowserManager] ✓ Browser da sessão {session_id} encerrado")
                    except asyncio.TimeoutError:
                        print(f"[BrowserManager] ⚠️ Timeout ao fechar browser - matando processos IMEDIATAMENTE")
                        # ✅ FASE 2: Usar método extraído
                        await self._kill_chrome_processes()
                    except Exception as e:
                        if "closed" not in str(e).lower():
                            print(f"[BrowserManager] Aviso ao fechar browser: {e}")
                            # ✅ FASE 2: Garantir que processos morram mesmo com exceção
                            await self._kill_chrome_processes()
        
        except asyncio.TimeoutError:
            print(f"[BrowserManager] ⚠️ Timeout geral ao fechar sessão {session_id}")
            
            # Reiniciar Playwright após timeout (estado corrompido)
            try:
                print(f"[BrowserManager] ⚠️ Reiniciando Playwright após timeout...")
                if self.playwright_instance:
                    try:
                        await self.playwright_instance.stop()
                    except:
                        pass
                    self.playwright_instance = None
                print(f"[BrowserManager] ✓ Playwright reiniciado para próxima sessão")
            except Exception as reinit_error:
                print(f"[BrowserManager] Erro ao reiniciar Playwright: {reinit_error}")
        
        except Exception as e:
            print(f"[BrowserManager] Erro ao fechar sessão {session_id}: {e}")
        finally:
            # SEMPRE remover do mapa (mesmo com erro/timeout)
            try:
                session.is_active = False
                if session_id in self.sessions:
                    del self.sessions[session_id]
                    print(f"[BrowserManager] ✓ Sessão {session_id} removida do mapa")
            except Exception as e:
                print(f"[BrowserManager] Erro ao limpar sessão: {e}")
            
            # ✅ REATIVAR REALTIME se foi suspenso
            if self.realtime_suspended and self.realtime_manager:
                print(f"[BrowserManager] ▶️ Reativando Realtime...")
                self.realtime_manager.start()
                self.realtime_suspended = False
    
    async def get_active_tab_id_for_domain(self, machine_id: str, domain: str):
        """Buscar tab_id ativo mais recente para um domínio"""
        try:
            response = self.supabase.table('active_sessions')\
                .select('tab_id')\
                .eq('machine_id', machine_id)\
                .eq('domain', domain)\
                .eq('is_active', True)\
                .order('last_activity', desc=True)\
                .limit(1)\
                .execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]['tab_id']
            return None
        except Exception as e:
            print(f"[BrowserManager] Erro ao buscar tab_id ativo: {e}")
            return None
    
    async def _kill_chrome_processes(self):
        """Matar processos Chrome/Chromium órfãos do Playwright"""
        try:
            import psutil
            import os
            current_pid = os.getpid()
            
            killed = 0
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    if proc.info['name'] and 'chrome' in proc.info['name'].lower():
                        cmdline = proc.info.get('cmdline', [])
                        if cmdline and any('playwright' in str(arg).lower() for arg in cmdline):
                            if proc.pid != current_pid:
                                proc.kill()
                                killed += 1
                                print(f"[BrowserManager] ✓ Processo Chrome {proc.pid} eliminado")
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            if killed > 0:
                print(f"[BrowserManager] ✓ Total de {killed} processos Chrome eliminados")
            else:
                print(f"[BrowserManager] ℹ️ Nenhum processo Chrome órfão encontrado")
                
        except ImportError:
            print(f"[BrowserManager] ⚠️ psutil não instalado - não é possível matar processos")
        except Exception as e:
            print(f"[BrowserManager] Erro ao matar processos Chrome: {e}")
    
    async def close_all_sessions(self):
        """Fechar todas as sessões ativas"""
        session_ids = list(self.sessions.keys())
        for session_id in session_ids:
            try:
                await self.close_session(session_id)
            except Exception as e:
                print(f"[BrowserManager] Erro ao fechar sessão {session_id}: {e}")
        
        # Encerrar Playwright ao final
        if self.playwright_instance:
            try:
                await self.playwright_instance.stop()
                print(f"[BrowserManager] ✓ Playwright encerrado")
            except:
                pass
            self.playwright_instance = None
