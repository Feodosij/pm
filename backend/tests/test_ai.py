import os
from unittest.mock import AsyncMock, MagicMock, patch

import openai
import pytest

from app.ai import chat_completion

MESSAGES = [{"role": "user", "content": "What is 2+2?"}]


def _mock_response(content: str) -> MagicMock:
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


async def test_chat_completion_returns_answer():
    with patch("app.ai._make_client") as make_client:
        client = MagicMock()
        client.chat.completions.create = AsyncMock(return_value=_mock_response("The answer is 4."))
        make_client.return_value = client

        result = await chat_completion(MESSAGES)

    assert "4" in result


async def test_chat_completion_auth_error():
    with patch("app.ai._make_client") as make_client:
        client = MagicMock()
        client.chat.completions.create = AsyncMock(
            side_effect=openai.AuthenticationError("bad key", response=MagicMock(), body={})
        )
        make_client.return_value = client

        with pytest.raises(RuntimeError, match="authentication failed"):
            await chat_completion(MESSAGES)


async def test_chat_completion_timeout_error():
    with patch("app.ai._make_client") as make_client:
        client = MagicMock()
        client.chat.completions.create = AsyncMock(
            side_effect=openai.APITimeoutError(request=MagicMock())
        )
        make_client.return_value = client

        with pytest.raises(RuntimeError, match="timed out"):
            await chat_completion(MESSAGES)


async def test_chat_completion_rate_limit_error():
    with patch("app.ai._make_client") as make_client:
        client = MagicMock()
        client.chat.completions.create = AsyncMock(
            side_effect=openai.RateLimitError("rate limit", response=MagicMock(), body={})
        )
        make_client.return_value = client

        with pytest.raises(RuntimeError, match="rate limit"):
            await chat_completion(MESSAGES)


@pytest.mark.skipif(
    not os.environ.get("RUN_LIVE_AI_TESTS"),
    reason="Set RUN_LIVE_AI_TESTS=1 to run live integration tests",
)
async def test_chat_completion_live():
    result = await chat_completion(MESSAGES)
    assert "4" in result, f"Expected '4' in reply, got: {result!r}"
