package browser

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/corpmonitor/corpmonitor-go/internal/cache"
	"github.com/corpmonitor/corpmonitor-go/internal/tunnel"
	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Manager gerencia sessões de browser
type Manager struct {
	sessions      map[string]*Session
	mu            sync.RWMutex
	tunnelClient  *tunnel.Client
	resourceCache *cache.ResourceCache
	logger        *zap.Logger
}

// Cookie representa um cookie HTTP
type Cookie struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Domain   string `json:"domain"`
	Path     string `json:"path"`
	Expires  int64  `json:"expires"`
	HTTPOnly bool   `json:"httpOnly"`
	Secure   bool   `json:"secure"`
	SameSite string `json:"sameSite"`
}

// NewManager cria um novo BrowserManager
func NewManager(tunnelClient *tunnel.Client) *Manager {
	return &Manager{
		sessions:      make(map[string]*Session),
		tunnelClient:  tunnelClient,
		resourceCache: cache.NewResourceCache(),
		logger:        logger.Log,
	}
}

// StartSession inicia uma nova sessão de browser
func (m *Manager) StartSession(incident map[string]interface{}) (string, []byte, error) {
	sessionID := uuid.New().String()

	m.logger.Info("Iniciando sessão de browser",
		zap.String("session_id", sessionID),
		zap.Any("incident", incident),
	)

	// Extrair URL do incidente
	url, ok := incident["tab_url"].(string)
	if !ok || url == "" {
		return "", nil, fmt.Errorf("URL não encontrada no incidente")
	}

	// Criar contexto ChromeDP
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("disable-web-security", true),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
		chromedp.WindowSize(1920, 1080),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)

	ctx, cancel2 := chromedp.NewContext(allocCtx)

	// Criar sessão
	session := &Session{
		ID:       sessionID,
		Ctx:      ctx,
		Cancel:   func() { cancel2(); cancel() },
		Incident: incident,
		URL:      url,
		StartedAt: time.Now(),
	}

	// Armazenar sessão
	m.mu.Lock()
	m.sessions[sessionID] = session
	m.mu.Unlock()

	// Injetar cookies se disponíveis
	if err := m.injectCookies(ctx, incident); err != nil {
		m.logger.Warn("Erro ao injetar cookies", zap.Error(err))
	}

	// Injetar localStorage e sessionStorage
	if err := m.injectStorage(ctx, incident); err != nil {
		m.logger.Warn("Erro ao injetar storage", zap.Error(err))
	}

	// Setup túnel reverso se disponível
	if m.tunnelClient != nil {
		if err := m.setupTunnelReverse(ctx, incident); err != nil {
			m.logger.Warn("Erro ao configurar túnel reverso", zap.Error(err))
		}
	}

	// Navegar para URL
	if err := chromedp.Run(ctx, chromedp.Navigate(url)); err != nil {
		m.CloseSession(sessionID)
		return "", nil, fmt.Errorf("erro ao navegar: %w", err)
	}

	// Aguardar carregamento
	time.Sleep(2 * time.Second)

	// Capturar screenshot
	screenshot, err := m.GetScreenshot(sessionID)
	if err != nil {
		m.logger.Warn("Erro ao capturar screenshot", zap.Error(err))
	}

	m.logger.Info("Sessão iniciada com sucesso", zap.String("session_id", sessionID))

	return sessionID, screenshot, nil
}

// injectCookies injeta cookies na sessão
func (m *Manager) injectCookies(ctx context.Context, incident map[string]interface{}) error {
	cookieData, ok := incident["full_cookie_data"]
	if !ok {
		return nil
	}

	var cookies []Cookie
	if err := json.Unmarshal([]byte(fmt.Sprintf("%v", cookieData)), &cookies); err != nil {
		// Tentar como map
		cookieMap, ok := cookieData.(map[string]interface{})
		if !ok {
			return fmt.Errorf("formato de cookie inválido")
		}

		for name, value := range cookieMap {
			cookies = append(cookies, Cookie{
				Name:   name,
				Value:  fmt.Sprintf("%v", value),
				Domain: getDomainFromIncident(incident),
				Path:   "/",
			})
		}
	}

	// Injetar cada cookie
	for _, cookie := range cookies {
		err := chromedp.Run(ctx,
			chromedp.ActionFunc(func(ctx context.Context) error {
				return chromedp.SetCookie(cookie.Name, cookie.Value).
					WithDomain(cookie.Domain).
					WithPath(cookie.Path).
					WithHTTPOnly(cookie.HTTPOnly).
					WithSecure(cookie.Secure).
					Do(ctx)
			}),
		)
		if err != nil {
			m.logger.Warn("Erro ao injetar cookie",
				zap.String("name", cookie.Name),
				zap.Error(err),
			)
		}
	}

	m.logger.Info("Cookies injetados", zap.Int("count", len(cookies)))
	return nil
}

// injectStorage injeta localStorage e sessionStorage
func (m *Manager) injectStorage(ctx context.Context, incident map[string]interface{}) error {
	// localStorage
	if localStorage, ok := incident["local_storage"]; ok && localStorage != nil {
		storageMap, ok := localStorage.(map[string]interface{})
		if ok {
			for key, value := range storageMap {
				script := fmt.Sprintf(`localStorage.setItem('%s', '%v')`, key, value)
				chromedp.Run(ctx, chromedp.Evaluate(script, nil))
			}
			m.logger.Info("localStorage injetado", zap.Int("items", len(storageMap)))
		}
	}

	// sessionStorage
	if sessionStorage, ok := incident["session_storage"]; ok && sessionStorage != nil {
		storageMap, ok := sessionStorage.(map[string]interface{})
		if ok {
			for key, value := range storageMap {
				script := fmt.Sprintf(`sessionStorage.setItem('%s', '%v')`, key, value)
				chromedp.Run(ctx, chromedp.Evaluate(script, nil))
			}
			m.logger.Info("sessionStorage injetado", zap.Int("items", len(storageMap)))
		}
	}

	return nil
}

// setupTunnelReverse configura interceptação de fetch via túnel
func (m *Manager) setupTunnelReverse(ctx context.Context, incident map[string]interface{}) error {
	machineID, ok := incident["machine_id"].(string)
	if !ok {
		return fmt.Errorf("machine_id não encontrado")
	}

	// Script para interceptar fetch
	script := fmt.Sprintf(`
		(function() {
			const originalFetch = window.fetch;
			window.__tunneledRequests = [];
			
			window.fetch = async function(...args) {
				const url = args[0];
				const options = args[1] || {};
				
				console.log('[TUNNEL] Intercepting fetch:', url);
				
				// Enviar para túnel via mensagem
				window.postMessage({
					type: 'tunnel_fetch',
					url: url,
					options: options,
					machineId: '%s'
				}, '*');
				
				// Continuar com fetch original
				return originalFetch.apply(this, args);
			};
			
			console.log('[TUNNEL] Fetch interceptor installed');
		})();
	`, machineID)

	err := chromedp.Run(ctx, chromedp.Evaluate(script, nil))
	if err != nil {
		return err
	}

	m.logger.Info("Túnel reverso configurado", zap.String("machine_id", machineID))
	return nil
}

// GetScreenshot captura screenshot da sessão
func (m *Manager) GetScreenshot(sessionID string) ([]byte, error) {
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("sessão não encontrada: %s", sessionID)
	}

	var buf []byte
	err := chromedp.Run(session.Ctx,
		chromedp.FullScreenshot(&buf, 90),
	)

	if err != nil {
		return nil, fmt.Errorf("erro ao capturar screenshot: %w", err)
	}

	return buf, nil
}

// Navigate navega para uma URL
func (m *Manager) Navigate(sessionID, url string) error {
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("sessão não encontrada: %s", sessionID)
	}

	m.logger.Info("Navegando", zap.String("session_id", sessionID), zap.String("url", url))

	return chromedp.Run(session.Ctx,
		chromedp.Navigate(url),
		chromedp.WaitReady("body"),
	)
}

// ExecuteScript executa JavaScript na página
func (m *Manager) ExecuteScript(sessionID, script string) (interface{}, error) {
	m.mu.RLock()
	session, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("sessão não encontrada: %s", sessionID)
	}

	var result interface{}
	err := chromedp.Run(session.Ctx, chromedp.Evaluate(script, &result))
	return result, err
}

// CloseSession fecha uma sessão
func (m *Manager) CloseSession(sessionID string) error {
	m.mu.Lock()
	session, exists := m.sessions[sessionID]
	if exists {
		delete(m.sessions, sessionID)
	}
	m.mu.Unlock()

	if !exists {
		return fmt.Errorf("sessão não encontrada: %s", sessionID)
	}

	session.Cancel()
	m.logger.Info("Sessão fechada", zap.String("session_id", sessionID))
	return nil
}

// GetActiveSessions retorna número de sessões ativas
func (m *Manager) GetActiveSessions() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// getDomainFromIncident extrai domínio do incidente
func getDomainFromIncident(incident map[string]interface{}) string {
	if host, ok := incident["host"].(string); ok {
		return host
	}
	if url, ok := incident["tab_url"].(string); ok {
		// Extrair domínio da URL
		// Simplificado - idealmente usar net/url
		return url
	}
	return ""
}
