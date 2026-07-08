import os

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

_client: AsyncOpenAI | None = None


def has_openai() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        _client = AsyncOpenAI(api_key=api_key, timeout=60.0)
    return _client


async def analyze_data(
    prompt: str,
    system_prompt: str = "You are a food industry analyst.",
    model: str = "gpt-4o",
) -> str:
    """Optional OpenAI enrichment when OPENAI_API_KEY is configured."""
    client = _get_client()
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
    )
    return response.choices[0].message.content or ""
