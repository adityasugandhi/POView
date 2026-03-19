import json
import os

import redis.asyncio as redis

# Architecturally mandated Redis integration with 72-hour TTL
_redis_url = os.getenv("REDIS_URL")
if _redis_url:
    redis_client = redis.from_url(_redis_url, decode_responses=True)
else:
    redis_client = redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=0,
        decode_responses=True,
    )

async def get_cached_profile(place_id: str) -> dict | None:
    """Retrieve validated JSON payload from Redis using exact Google Places ID."""
    try:
        data = await redis_client.get(f"profile:{place_id}")
        return json.loads(data) if data else None
    except Exception as e:
        print(f"Redis cache miss/error: {e}")
        return None

async def set_cached_profile(place_id: str, profile_data: dict, ttl_hours: int = 72):
    """Store generated Gemini output with extreme token efficiency logic."""
    try:
        ttl_seconds = ttl_hours * 3600
        await redis_client.setex(f"profile:{place_id}", ttl_seconds, json.dumps(profile_data))
    except Exception as e:
        print(f"Failed to set Redis cache: {e}")
