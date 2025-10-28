"""
Cache de recursos para melhorar performance do túnel DNS
"""
import time
from typing import Optional, Dict, Tuple
from dataclasses import dataclass
import hashlib

@dataclass
class CachedResource:
    """Recurso em cache"""
    content: bytes
    status: int
    headers: Dict[str, str]
    cached_at: float
    url: str

class ResourceCache:
    """Cache em memória para recursos estáticos"""
    
    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600):
        """
        Inicializar cache
        
        Args:
            max_size: Número máximo de recursos em cache
            ttl_seconds: Tempo de vida dos recursos em segundos (padrão: 1 hora)
        """
        self._cache: Dict[str, CachedResource] = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.hits = 0
        self.misses = 0
        
        # Extensões que devem ser cacheadas
        self.cacheable_extensions = {
            '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', 
            '.woff', '.woff2', '.ttf', '.eot', '.ico', '.webp'
        }
        
        # Domínios que devem ser cacheados (CDNs)
        self.cacheable_domains = {
            'gstatic.com', 'googleapis.com', 'googleusercontent.com',
            'cloudflare.com', 'jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'
        }
    
    def _get_cache_key(self, url: str) -> str:
        """Gerar chave de cache a partir da URL"""
        return hashlib.sha256(url.encode()).hexdigest()[:16]
    
    def _is_cacheable(self, url: str) -> bool:
        """Verificar se URL deve ser cacheada"""
        url_lower = url.lower()
        
        # Verificar extensão
        for ext in self.cacheable_extensions:
            if ext in url_lower:
                return True
        
        # Verificar domínio
        for domain in self.cacheable_domains:
            if domain in url_lower:
                return True
        
        return False
    
    def get(self, url: str) -> Optional[Tuple[bytes, int, Dict[str, str]]]:
        """
        Obter recurso do cache
        
        Returns:
            Tuple (content, status, headers) ou None se não encontrado/expirado
        """
        if not self._is_cacheable(url):
            return None
        
        key = self._get_cache_key(url)
        
        if key not in self._cache:
            self.misses += 1
            return None
        
        resource = self._cache[key]
        
        # Verificar se expirou
        age = time.time() - resource.cached_at
        if age > self.ttl_seconds:
            del self._cache[key]
            self.misses += 1
            return None
        
        self.hits += 1
        return (resource.content, resource.status, resource.headers)
    
    def is_expiring_soon(self, url: str, threshold: float = 0.8) -> bool:
        """
        ✅ FASE 3: Verificar se recurso está próximo de expirar
        
        Args:
            url: URL do recurso
            threshold: Percentual de TTL para considerar "expirando" (padrão: 80%)
        
        Returns:
            True se recurso existe e está em >80% do TTL
        """
        if not self._is_cacheable(url):
            return False
        
        key = self._get_cache_key(url)
        
        if key not in self._cache:
            return False
        
        resource = self._cache[key]
        age = time.time() - resource.cached_at
        
        # Se já passou >80% do TTL, retorna True para prefetch
        return age > (self.ttl_seconds * threshold)
    
    def set(self, url: str, content: bytes, status: int, headers: Dict[str, str]):
        """Adicionar recurso ao cache"""
        if not self._is_cacheable(url):
            return
        
        # Limpar cache se atingiu limite
        if len(self._cache) >= self.max_size:
            self._evict_oldest()
        
        key = self._get_cache_key(url)
        self._cache[key] = CachedResource(
            content=content,
            status=status,
            headers=headers,
            cached_at=time.time(),
            url=url
        )
    
    def _evict_oldest(self):
        """Remover recurso mais antigo do cache"""
        if not self._cache:
            return
        
        oldest_key = min(
            self._cache.keys(), 
            key=lambda k: self._cache[k].cached_at
        )
        del self._cache[oldest_key]
    
    def clear(self):
        """Limpar todo o cache"""
        self._cache.clear()
        self.hits = 0
        self.misses = 0
    
    def get_stats(self) -> Dict:
        """Obter estatísticas do cache"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.1f}%",
            "total_requests": total_requests
        }
