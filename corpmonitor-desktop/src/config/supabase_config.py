"""
Configuração do cliente Supabase para desktop app
"""
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

SUPABASE_URL = "https://vxvcquifgwtbjghrcjbp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dmNxdWlmZ3d0YmpnaHJjamJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDM1MjcsImV4cCI6MjA3NDIxOTUyN30.AdlrmsW5gGY5o9pKkq6LJYtTbi7SLtKdqwb--4h8rEs"

def get_supabase_client() -> Client:
    """Criar e retornar cliente Supabase"""
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# Cliente global
supabase: Client = get_supabase_client()
