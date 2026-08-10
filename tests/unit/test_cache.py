import pytest
import fakeredis.aioredis as fakeredis
from gateway.core.cache import ResponseCache
from gateway.schemas.chat import ChatRequest, ChatResponse, ChatChoice, Message, TokenUsage


@pytest.fixture
def redis():
    return fakeredis.FakeRedis()


@pytest.fixture
def cache(redis):
    return ResponseCache(redis)


def make_request(model="gpt-4o", content="Hello") -> ChatRequest:
    return ChatRequest(model=model, messages=[Message(role="user", content=content)])


def make_response(model="gpt-4o") -> ChatResponse:
    return ChatResponse(
        model=model,
        choices=[ChatChoice(message=Message(role="assistant", content="World"))],
        usage=TokenUsage(prompt_tokens=5, completion_tokens=3, total_tokens=8),
    )


async def test_cache_miss_returns_none(cache):
    req = make_request()
    key = cache.make_key("team-1", req)
    assert await cache.get(key) is None


async def test_set_and_get(cache):
    req = make_request()
    resp = make_response()
    key = cache.make_key("team-1", req)
    await cache.set(key, resp, ttl=60)
    retrieved = await cache.get(key)
    assert retrieved is not None
    assert retrieved.model == resp.model
    assert retrieved.choices[0].message.content == "World"


async def test_tenant_isolation(cache):
    req = make_request()
    resp = make_response()
    key_t1 = cache.make_key("team-1", req)
    key_t2 = cache.make_key("team-2", req)
    assert key_t1 != key_t2, "Same request from different teams must produce different cache keys"

    await cache.set(key_t1, resp, ttl=60)
    assert await cache.get(key_t1) is not None
    assert await cache.get(key_t2) is None  # Team 2 must not see Team 1's cache


async def test_ttl_zero_skips_storage(cache):
    req = make_request()
    resp = make_response()
    key = cache.make_key("team-1", req)
    await cache.set(key, resp, ttl=0)
    assert await cache.get(key) is None
