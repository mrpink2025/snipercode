package supabase

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	supabase "github.com/supabase-community/supabase-go"
)

type Client struct {
	*supabase.Client
	URL string
	Key string
}

func NewClient() (*Client, error) {
	// Carregar .env
	godotenv.Load()

	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_ANON_KEY")

	if url == "" || key == "" {
		return nil, fmt.Errorf("SUPABASE_URL ou SUPABASE_ANON_KEY não configurados")
	}

	client, err := supabase.NewClient(url, key, &supabase.ClientOptions{})
	if err != nil {
		return nil, err
	}

	return &Client{
		Client: client,
		URL:    url,
		Key:    key,
	}, nil
}

