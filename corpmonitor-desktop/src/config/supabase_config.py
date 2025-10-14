"""
Configuração do cliente Supabase para desktop app
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from typing import Optional

# Carregar variáveis de ambiente
load_dotenv()

SUPABASE_URL = "https://vxvcquifgwtbjghrcjbp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dmNxdWlmZ3d0YmpnaHJjamJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDM1MjcsImV4cCI6MjA3NDIxOTUyN30.AdlrmsW5gGY5o9pKkq6LJYtTbi7SLtKdqwb--4h8rEs"

def get_supabase_client(access_token: Optional[str] = None, refresh_token: Optional[str] = None) -> Client:
    """
    Criar e retornar cliente Supabase
    
    Args:
        access_token: Token de acesso do usuário autenticado (opcional)
        refresh_token: Token de refresh do usuário autenticado (opcional)
    
    Returns:
        Cliente Supabase autenticado ou anônimo
    """
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Se tokens fornecidos, autenticar cliente
    if access_token and refresh_token:
        client.auth.set_session(access_token, refresh_token)
    
    return client

# Cliente global (não autenticado - para leitura pública)
supabase: Client = get_supabase_client()
