import pytest
import fakeredis.aioredis as fakeredis
from gateway.core.circuit_breaker import CircuitBreaker, CBState


@pytest.fixture
def redis():
    return fakeredis.FakeRedis()


@pytest.fixture
def cb(redis):
    return CircuitBreaker(redis, failure_threshold=3, recovery_timeout=60)


async def test_initial_state_is_closed(cb):
    status = await cb.get_status("provider-1")
    assert status.state == CBState.CLOSED


async def test_opens_after_threshold_failures(cb):
    for _ in range(3):
        state = await cb.record_failure("provider-1")
    assert state == CBState.OPEN
    assert await cb.is_open("provider-1") is True


async def test_does_not_open_below_threshold(cb):
    await cb.record_failure("provider-1")
    await cb.record_failure("provider-1")
    assert await cb.is_open("provider-1") is False


async def test_success_resets_failure_count(cb):
    await cb.record_failure("provider-1")
    await cb.record_failure("provider-1")
    await cb.record_success("provider-1")
    # Still closed after 2 failures + 1 success reset
    assert await cb.is_open("provider-1") is False


async def test_manual_reset(cb):
    for _ in range(3):
        await cb.record_failure("provider-1")
    assert await cb.is_open("provider-1") is True
    await cb.reset("provider-1")
    assert await cb.is_open("provider-1") is False


async def test_allow_request_when_closed(cb):
    assert await cb.allow_request("provider-1") is True


async def test_deny_request_when_open(cb):
    for _ in range(3):
        await cb.record_failure("provider-1")
    assert await cb.allow_request("provider-1") is False
