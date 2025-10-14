import logging
import os
from datetime import datetime

# Criar diretório de logs se não existir
LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

# Configurar logger
def setup_logger(name: str = "corpmonitor") -> logging.Logger:
    """
    Configura e retorna um logger para a aplicação.
    
    Args:
        name: Nome do logger
        
    Returns:
        Logger configurado
    """
    logger = logging.getLogger(name)
    
    # Evitar duplicação de handlers
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.DEBUG)
    
    # Formato de log
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Handler para arquivo
    log_file = os.path.join(LOGS_DIR, f"corpmonitor_{datetime.now().strftime('%Y%m%d')}.log")
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Handler para console
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger

# Logger global
logger = setup_logger()
