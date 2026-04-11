from __future__ import annotations

from redis import Redis

from ..config import settings

_redis_client: Redis | None = None


def get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        if settings.use_in_memory_store:
            import fakeredis

            _redis_client = fakeredis.FakeRedis(decode_responses=True)  # type: ignore[assignment]
        else:
            _redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client

