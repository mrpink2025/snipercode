package auth

import (
	"context"
	"encoding/json"

	"github.com/corpmonitor/corpmonitor-go/pkg/logger"
	"github.com/corpmonitor/corpmonitor-go/pkg/supabase"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Manager struct {
	supabase       *supabase.Client
	currentUser    *User
	currentProfile *Profile
	session        *Session
}

type User struct {
	ID    string
	Email string
}

type Profile struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	FullName   string `json:"full_name"`
	Department string `json:"department"`
	Role       string `json:"role"`
	AvatarURL  string `json:"avatar_url"`
	IsActive   bool   `json:"is_active"`
}

type Session struct {
	AccessToken  string
	RefreshToken string
}

func NewManager(sb *supabase.Client) *Manager {
	return &Manager{
		supabase: sb,
	}
}

func (m *Manager) SignIn(ctx context.Context, email, password string) (bool, string) {
	logger.Log.Info("Tentando login", zap.String("email", email))

	// Autenticar via Supabase
	resp, err := m.supabase.SignInWithEmailPassword(email, password)

	if err != nil {
		logger.Log.Error("Erro ao autenticar", zap.Error(err))
		return false, "Credenciais inválidas: " + err.Error()
	}

	if resp.User.ID == uuid.Nil {
		return false, "Usuário não encontrado"
	}

	// Armazenar usuário
	m.currentUser = &User{
		ID:    resp.User.ID.String(),
		Email: resp.User.Email,
	}

	m.session = &Session{
		AccessToken:  resp.AccessToken,
		RefreshToken: resp.RefreshToken,
	}

	// Buscar perfil do usuário
	profile, err := m.fetchProfile(ctx, resp.User.ID.String())
	if err != nil {
		logger.Log.Error("Erro ao buscar perfil", zap.Error(err))
		m.SignOut()
		return false, "Perfil de usuário não encontrado"
	}

	m.currentProfile = profile

	// Verificar se é admin, superadmin ou demo_admin
	if profile.Role != "admin" && profile.Role != "superadmin" && profile.Role != "demo_admin" {
		m.SignOut()
		return false, "Acesso negado: apenas administradores podem usar este painel."
	}

	logger.Log.Info("Login bem-sucedido", zap.String("role", profile.Role))
	return true, "Login realizado com sucesso!"
}

func (m *Manager) fetchProfile(ctx context.Context, userID string) (*Profile, error) {
	var profile Profile

	resp, _, err := m.supabase.From("profiles").
		Select("*", "", false).
		Eq("id", userID).
		Single().
		Execute()

	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(resp, &profile); err != nil {
		return nil, err
	}

	return &profile, nil
}

func (m *Manager) SignOut() {
	// Limpar estado local (não há método SignOut na biblioteca)
	m.currentUser = nil
	m.currentProfile = nil
	m.session = nil
}

func (m *Manager) IsAuthenticated() bool {
	return m.currentUser != nil && m.currentProfile != nil
}

func (m *Manager) GetUserName() string {
	if m.currentProfile != nil {
		return m.currentProfile.FullName
	}
	return ""
}

func (m *Manager) GetUserRole() string {
	if m.currentProfile != nil {
		return m.currentProfile.Role
	}
	return ""
}

func (m *Manager) IsAdmin() bool {
	role := m.GetUserRole()
	return role == "admin" || role == "superadmin" || role == "demo_admin"
}

func (m *Manager) GetUserID() string {
	if m.currentUser != nil {
		return m.currentUser.ID
	}
	return ""
}

func (m *Manager) GetAccessToken() string {
	if m.session != nil {
		return m.session.AccessToken
	}
	return ""
}
