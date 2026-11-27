
import re
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any


def normalize_date(
    raw_date: str | None,
    reference_time: datetime | None = None,
) -> dict[str, Any]:
    """
    Parse a relative or absolute date into an approximate ISO date.

    The original date text is always retained. Unrecognized values
    produce date_abs=None rather than an invented date.
    """

    result = {
        "date_raw": raw_date,
        "date_abs": None,
    }

    if not isinstance(raw_date, str) or not raw_date.strip():
        return result

    text = raw_date.strip()

    if reference_time is None:
        reference_time = datetime.now(timezone.utc)
    elif reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=timezone.utc)

    # Relative dates: "7 hours ago", "3 days ago", etc.
    relative_pattern = re.fullmatch(
        r"(\d+)\s+"
        r"(second|minute|hour|day|week|month|year)s?\s+ago",
        text,
        flags=re.IGNORECASE,
    )

    if relative_pattern:
        amount = int(relative_pattern.group(1))
        unit = relative_pattern.group(2).lower()

        if unit == "second":
            delta = timedelta(seconds=amount)
        elif unit == "minute":
            delta = timedelta(minutes=amount)
        elif unit == "hour":
            delta = timedelta(hours=amount)
        elif unit == "day":
            delta = timedelta(days=amount)
        elif unit == "week":
            delta = timedelta(weeks=amount)
        elif unit == "month":
            # Approximation: one month is 30 days.
            delta = timedelta(days=30 * amount)
        else:
            # Approximation: one year is 365 days.
            delta = timedelta(days=365 * amount)

        result["date_abs"] = (reference_time - delta).date().isoformat()
        return result

    # Common ISO formats and date-only values.
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        result["date_abs"] = parsed.date().isoformat()
        return result
    except ValueError:
        pass

    try:
        parsed_date = date.fromisoformat(text)
        result["date_abs"] = parsed_date.isoformat()
        return result
    except ValueError:
        pass

    # Common HTTP/email date format.
    try:
        parsed = parsedate_to_datetime(text)

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        result["date_abs"] = parsed.date().isoformat()
        return result
    except (TypeError, ValueError, OverflowError):
        pass

    # Unknown date formats are left unresolved.
    return result
