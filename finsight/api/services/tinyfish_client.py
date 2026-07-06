import httpx
from typing import Dict, Any, List
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from api.core.config import settings
from api.core.logger import logger

SEARCH_URL = "https://api.search.tinyfish.ai"
FETCH_URL = "https://api.fetch.tinyfish.ai"


class TinyFishClient:
    def __init__(self):
        self.api_key = settings.tinyfish_api_key
        self.headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }
        self.timeout = settings.timeout_seconds

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
        reraise=True,
    )
    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        params = {
            "query": query,
            "location": "VN",
            "language": "vi",
        }

        logger.info(f"Initiating TinyFish Search for query: {query}")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                SEARCH_URL,
                headers=self.headers,
                params=params,
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            if not isinstance(results, list):
                logger.warning(f"TinyFish Search returned unexpected results type: {type(results)}")
                results = []
            normalized = [item for item in results if isinstance(item, dict)]
            logger.info(f"TinyFish Search returned {len(normalized)} results")
            return normalized[:limit]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError)),
        reraise=True,
    )
    async def fetch(self, target_url: str) -> str:
        payload = {
            "urls": [target_url],
            "format": "markdown",
        }

        logger.info(f"Initiating TinyFish Fetch for URL: {target_url}")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                FETCH_URL,
                headers=self.headers,
                json=payload,
                timeout=max(self.timeout, settings.tinyfish_fetch_timeout_seconds),
            )
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            if results:
                content = results[0].get("text", "") or ""
                logger.info(
                    f"TinyFish Fetch successful for URL: {target_url} (Length: {len(content)})"
                )
                return content

            errors = data.get("errors", [])
            if errors:
                err = errors[0]
                logger.error(
                    f"TinyFish Fetch failed for {target_url}: {err.get('error')} — {err.get('message', '')}"
                )
            return ""


tinyfish_client = TinyFishClient()
