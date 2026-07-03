import os

import openai
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "nvidia/nemotron-3-super-120b-a12b:free"


def _make_client() -> openai.AsyncOpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    return openai.AsyncOpenAI(api_key=api_key, base_url=OPENROUTER_BASE_URL)


async def chat_completion(messages: list[dict]) -> str:
    """Call OpenRouter chat completions and return the assistant reply text."""
    client = _make_client()
    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=messages,
            timeout=30.0,
        )
        return response.choices[0].message.content or ""
    except openai.AuthenticationError as e:
        raise RuntimeError("OpenRouter authentication failed: check OPENROUTER_API_KEY") from e
    except openai.APITimeoutError as e:
        raise RuntimeError("OpenRouter request timed out") from e
    except openai.APIConnectionError as e:
        raise RuntimeError(f"OpenRouter connection error: {e}") from e
    except openai.RateLimitError as e:
        raise RuntimeError("OpenRouter rate limit exceeded") from e
