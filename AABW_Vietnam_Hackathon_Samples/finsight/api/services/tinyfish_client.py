from typing import Any, Dict, List

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception,
)
from tinyfish import (
    APIConnectionError,
    APITimeoutError,
    APIStatusError,
    AsyncTinyFish,
    InternalServerError,
    RateLimitError,
)

from api.core.config import settings
from api.core.logger import logger


def _is_retryable_tinyfish_error(exc: BaseException) -> bool:
    if isinstance(exc, (APIConnectionError, APITimeoutError, InternalServerError, RateLimitError)):
        return True
    if isinstance(exc, APIStatusError):
        return exc.status_code >= 500
    return False


def _search_result_to_dict(result: Any) -> Dict[str, Any]:
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")
    if isinstance(result, dict):
        return result
    return {}


class TinyFishClient:
    def __init__(self):
        self._client: AsyncTinyFish | None = None

    def _get_client(self) -> AsyncTinyFish:
        if self._client is None:
            timeout = float(
                max(settings.timeout_seconds, settings.tinyfish_fetch_timeout_seconds)
            )
            kwargs: dict[str, Any] = {"timeout": timeout, "max_retries": 2}
            if settings.tinyfish_api_key:
                kwargs["api_key"] = settings.tinyfish_api_key
            self._client = AsyncTinyFish(**kwargs)
        return self._client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_is_retryable_tinyfish_error),
        reraise=True,
    )
    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        logger.info(f"Initiating TinyFish Search for query: {query}")
        client = self._get_client()
        response = await client.search.query(
            query=query,
            location="VN",
            language="vi",
        )
        normalized = [_search_result_to_dict(item) for item in response.results[:limit]]
        logger.info(f"TinyFish Search returned {len(normalized)} results")
        return normalized

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_is_retryable_tinyfish_error),
        reraise=True,
    )
    async def fetch(self, target_url: str) -> str:
        logger.info(f"Initiating TinyFish Fetch for URL: {target_url}")
        client = self._get_client()
        response = await client.fetch.get_contents(
            urls=[target_url],
            format="markdown",
        )
        if response.results:
            content = response.results[0].text or ""
            logger.info(
                f"TinyFish Fetch successful for URL: {target_url} (Length: {len(content)})"
            )
            return content

        if response.errors:
            err = response.errors[0]
            logger.error(f"TinyFish Fetch failed for {target_url}: {err.error}")
        return ""


tinyfish_client = TinyFishClient()
