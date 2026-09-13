from typing import Awaitable, Callable, List, Optional

from api.models.schemas import PipelineEvent

EventCallback = Callable[[PipelineEvent], Awaitable[None]]


class PipelineEmitter:
    def __init__(self, on_event: Optional[EventCallback] = None):
        self.events: List[PipelineEvent] = []
        self._on_event = on_event

    async def emit(
        self,
        stage: str,
        message: str,
        url: Optional[str] = None,
        status: Optional[str] = None,
        meta: Optional[dict] = None,
    ) -> None:
        event = PipelineEvent(stage=stage, message=message, url=url, status=status, meta=meta)
        self.events.append(event)
        if self._on_event:
            await self._on_event(event)


def host_from_url(url: str) -> str:
    try:
        from urllib.parse import urlparse

        return (urlparse(url).hostname or url).replace("www.", "")
    except Exception:
        return url
