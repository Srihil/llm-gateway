import pytest
import fakeredis.aioredis as fakeredis
from gateway.core.rate_limiter import RateLimiter


@pytest.fixture
def redis():
    return fakeredis.FakeRedis()


@pytest.fixture
def limiter(redis):
    return RateLimiter(redis)


async def test_allows_first_request(limiter):
    allowed = await limiter.check("team-a", max_rpm=10)
    assert allowed is True


async def test_blocks_when_bucket_empty(limiter):
    # max_rpm=3 → bucket capacity 3
    results = []
    for _ in range(5):
        results.append(await limiter.check("team-b", max_rpm=3))

    assert results[:3] == [True, True, True]
    assert False in results[3:]


async def test_different_teams_have_separate_buckets(limiter):
    # Drain team-c
    for _ in range(3):
        await limiter.check("team-c", max_rpm=3)

    # team-d should still be unaffected
    assert await limiter.check("team-d", max_rpm=3) is True


async def test_unlimited_budget_never_blocks(limiter):
    results = [await limiter.check("team-e", max_rpm=10_000) for _ in range(100)]
    assert all(results)
