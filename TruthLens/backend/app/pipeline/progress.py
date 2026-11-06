from collections.abc import Awaitable, Callable
from typing import Any

# A progress callback receives one dict per pipeline stage, e.g.
# {"stage": "planned", "queries": ["..."]}.
ProgressCallback = Callable[[dict[str, Any]], Awaitable[None]]


async def emit(
    callback: ProgressCallback | None,
    stage: str,
    **data: Any,
) -> None:
    """Report a pipeline stage to the caller (no-op if nobody is listening)."""
    if callback is not None:
        await callback({"stage": stage, **data})
