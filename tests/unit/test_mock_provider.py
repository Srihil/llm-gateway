import pytest
from gateway.providers.mock import MockProvider
from gateway.schemas.chat import ChatRequest, Message


@pytest.fixture
def provider():
    return MockProvider()


def make_request(text: str) -> ChatRequest:
    return ChatRequest(
        model="mock-gpt",
        messages=[Message(role="user", content=text)],
    )


async def test_returns_response(provider):
    req = make_request("Hello")
    resp = await provider.chat_completion(req)
    assert resp.choices[0].message.role == "assistant"
    assert len(resp.choices[0].message.content) > 0


async def test_deterministic_for_same_input(provider):
    req = make_request("What is 2+2?")
    r1 = await provider.chat_completion(req)
    r2 = await provider.chat_completion(req)
    assert r1.choices[0].message.content == r2.choices[0].message.content


async def test_different_inputs_give_different_outputs(provider):
    r1 = await provider.chat_completion(make_request("Question A"))
    r2 = await provider.chat_completion(make_request("Question B"))
    assert r1.choices[0].message.content != r2.choices[0].message.content


async def test_health_check(provider):
    assert await provider.health_check() is True


async def test_usage_populated(provider):
    resp = await provider.chat_completion(make_request("test"))
    assert resp.usage is not None
    assert resp.usage.prompt_tokens > 0
    assert resp.usage.completion_tokens > 0
