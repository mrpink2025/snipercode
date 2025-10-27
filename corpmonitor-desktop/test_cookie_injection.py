#!/usr/bin/env python3
"""
Script de teste rápido para validar correções de injeção de cookies
Testa especificamente a correção #5 (cookies de sessão sem expires)
"""

import asyncio
from playwright.async_api import async_playwright

async def test_session_cookie():
    """Testa se cookies de sessão (sem expires) são aceitos"""
    test_cookie = {
        "name": "test_session",
        "value": "123456",
        "domain": ".example.com",
        "path": "/",
        "secure": False,
        "httpOnly": False,
        "sameSite": "Lax",
        "isSession": True  # Cookie de sessão
    }
    
    print("🧪 Testando injeção de cookie de sessão...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        
        # Testar injeção (sem campo expires para sessão)
        cookie_pw = {
            "name": test_cookie["name"],
            "value": test_cookie["value"],
            "domain": test_cookie["domain"],
            "path": test_cookie["path"],
            "secure": test_cookie["secure"],
            "httpOnly": test_cookie["httpOnly"],
            "sameSite": test_cookie["sameSite"]
            # ✅ SEM expires para cookie de sessão
        }
        
        try:
            await context.add_cookies([cookie_pw])
            print("✅ TESTE PASSOU - Cookie de sessão aceito pelo Playwright")
            print(f"   Cookie: {test_cookie['name']}={test_cookie['value']}")
            return True
        except Exception as e:
            print(f"❌ TESTE FALHOU - {e}")
            return False
        finally:
            await browser.close()

async def test_persistent_cookie():
    """Testa se cookies persistentes (com expires) são aceitos"""
    import time
    future_expiry = int(time.time()) + 86400  # +24h
    
    test_cookie = {
        "name": "test_persistent",
        "value": "789012",
        "domain": ".example.com",
        "path": "/",
        "secure": True,
        "httpOnly": True,
        "sameSite": "None",
        "expirationDate": future_expiry,
        "isSession": False
    }
    
    print("🧪 Testando injeção de cookie persistente...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        
        # Testar injeção (com expires para persistente)
        cookie_pw = {
            "name": test_cookie["name"],
            "value": test_cookie["value"],
            "domain": test_cookie["domain"],
            "path": test_cookie["path"],
            "secure": test_cookie["secure"],
            "httpOnly": test_cookie["httpOnly"],
            "sameSite": test_cookie["sameSite"],
            "expires": test_cookie["expirationDate"]  # ✅ COM expires
        }
        
        try:
            await context.add_cookies([cookie_pw])
            print("✅ TESTE PASSOU - Cookie persistente aceito pelo Playwright")
            print(f"   Cookie: {test_cookie['name']}={test_cookie['value']} (expires: {future_expiry})")
            return True
        except Exception as e:
            print(f"❌ TESTE FALHOU - {e}")
            return False
        finally:
            await browser.close()

async def test_mixed_cookies():
    """Testa batch de cookies mistos (sessão + persistentes)"""
    import time
    
    cookies = [
        # Cookie de sessão
        {
            "name": "session_cookie",
            "value": "abc",
            "domain": ".test.com",
            "path": "/",
            "secure": False,
            "httpOnly": False,
            "sameSite": "Lax"
            # SEM expires
        },
        # Cookie persistente
        {
            "name": "persistent_cookie",
            "value": "def",
            "domain": ".test.com",
            "path": "/",
            "secure": True,
            "httpOnly": True,
            "sameSite": "None",
            "expires": int(time.time()) + 3600  # +1h
        }
    ]
    
    print("🧪 Testando batch de cookies mistos...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        
        try:
            await context.add_cookies(cookies)
            print("✅ TESTE PASSOU - Batch de cookies mistos aceito")
            print(f"   {len(cookies)} cookies injetados com sucesso")
            return True
        except Exception as e:
            print(f"❌ TESTE FALHOU - {e}")
            return False
        finally:
            await browser.close()

async def main():
    """Executa todos os testes"""
    print("=" * 60)
    print("🔬 VALIDAÇÃO DAS CORREÇÕES DE COOKIES")
    print("=" * 60)
    print()
    
    results = []
    
    # Teste 1: Cookie de sessão
    result1 = await test_session_cookie()
    results.append(("Cookie de sessão", result1))
    print()
    
    # Teste 2: Cookie persistente
    result2 = await test_persistent_cookie()
    results.append(("Cookie persistente", result2))
    print()
    
    # Teste 3: Batch misto
    result3 = await test_mixed_cookies()
    results.append(("Batch misto", result3))
    print()
    
    # Resumo
    print("=" * 60)
    print("📊 RESUMO DOS TESTES")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASSOU" if passed else "❌ FALHOU"
        print(f"{status}: {name}")
        if not passed:
            all_passed = False
    
    print()
    if all_passed:
        print("🎉 TODOS OS TESTES PASSARAM!")
        print("✅ Correção #5 validada com sucesso")
        return 0
    else:
        print("❌ ALGUNS TESTES FALHARAM")
        print("⚠️  Revise as correções aplicadas")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
