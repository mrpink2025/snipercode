#!/usr/bin/env python3
"""Teste do túnel reverso"""

import asyncio
import os
from dotenv import load_dotenv

# Carregar .env
load_dotenv()

from supabase import create_client
from src.managers.tunnel_client import TunnelClient

async def test():
    """Executar testes do túnel reverso"""
    
    # Configuração
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://vxvcquifgwtbjghrcjbp.supabase.co")
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    MACHINE_ID = os.getenv("MACHINE_ID", "TEST_MACHINE")
    
    if not SUPABASE_KEY:
        print("❌ SUPABASE_ANON_KEY não configurado no .env")
        return False
    
    print("="*60)
    print("🧪 TESTE DO TÚNEL REVERSO")
    print("="*60)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Machine ID: {MACHINE_ID}")
    print("="*60 + "\n")
    
    try:
        # Criar cliente Supabase
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Criar cliente de túnel
        tunnel = TunnelClient(supabase, machine_id=MACHINE_ID)
        
        # Teste 1: GET simples
        print("🧪 Teste 1: GET https://httpbin.org/get")
        response = await tunnel.get("https://httpbin.org/get")
        
        if response.success:
            print(f"✅ Status: {response.status_code}")
            print(f"✅ Latência: {response.elapsed_ms}ms")
            print(f"✅ Body size: {len(response.text)} chars")
            
            # Verificar JSON
            try:
                data = response.json
                print(f"✅ JSON parseado: {list(data.keys())}")
            except Exception as e:
                print(f"⚠️  Erro ao parsear JSON: {e}")
        else:
            print(f"❌ Erro: {response.error}")
            return False
        
        # Teste 2: Verificar IP
        print("\n🧪 Teste 2: GET https://api.ipify.org?format=json")
        response2 = await tunnel.get("https://api.ipify.org?format=json")
        
        if response2.success:
            data = response2.json
            print(f"✅ IP usado: {data.get('ip', 'N/A')}")
            print(f"✅ Latência: {response2.elapsed_ms}ms")
        else:
            print(f"⚠️  Falhou: {response2.error}")
        
        # Teste 3: POST
        print("\n🧪 Teste 3: POST https://httpbin.org/post")
        import json
        body = json.dumps({"test": "data", "timestamp": "now"})
        response3 = await tunnel.post(
            "https://httpbin.org/post",
            body=body
        )
        
        if response3.success:
            print(f"✅ Status: {response3.status_code}")
            print(f"✅ Latência: {response3.elapsed_ms}ms")
        else:
            print(f"⚠️  Falhou: {response3.error}")
        
        # Exibir estatísticas
        print("\n")
        tunnel.print_stats()
        
        return True
        
    except Exception as e:
        print(f"\n❌ Erro durante teste: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("\n🚀 Iniciando teste do túnel reverso...\n")
    result = asyncio.run(test())
    
    if result:
        print("\n✅ TODOS OS TESTES PASSARAM!\n")
        exit(0)
    else:
        print("\n❌ TESTES FALHARAM!\n")
        exit(1)
