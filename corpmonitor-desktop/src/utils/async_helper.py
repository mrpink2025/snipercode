import asyncio
import nest_asyncio
from typing import Coroutine, Any
from src.utils.logger import logger

# Permitir nested event loops
nest_asyncio.apply()

def run_async(coro: Coroutine) -> Any:
    """
    Executa uma coroutine de forma síncrona.
    Útil para integração com Tkinter.
    
    Args:
        coro: Coroutine a ser executada
        
    Returns:
        Resultado da coroutine
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    try:
        return loop.run_until_complete(coro)
    except Exception as e:
        logger.error(f"Erro ao executar coroutine: {e}")
        raise
