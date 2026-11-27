"""Deterministic markdown normalization.

The whole point of this module: two fetches of an *unchanged* page must produce
byte-identical text. Anything that varies between renders for reasons unrelated to
the documentation — relative timestamps, "was this page helpful?" widgets, cookie
notices, navigation chrome — is removed here, once, for both sides of every
comparison. Without this step the drift report is pure noise.

Noise stripping is deliberately conservative and anchored to whole lines. A pattern
that eats real content is worse than a pattern that misses chrome, because a missed
pattern only adds a stable line while a greedy one can hide a changed sentence.
"""

from __future__ import annotations

import functools
import hashlib
import re
import unicodedata

# Whole-line patterns. Each is applied with `fullmatch` on a trailing-whitespace
# stripped line, so they cannot nibble at the middle of a paragraph.
DEFAULT_NOISE_PATTERNS: tuple[str, ...] = (
    r"(?:#+\s*)?(?:table of )?contents",
    r"(?:#+\s*)?on this page",
    r"(?:#+\s*)?in this (?:article|page|guide|section)",
    r"skip to (?:main )?content",
    r"(?:was|is) this (?:page|article|doc|documentation) helpful\??",
    r"did this (?:page|article) answer your question\??",
    r"thank you for your feedback\.?",
    r"last (?:updated|modified|reviewed)(?:\s+on)?:?\s*\S.*",
    r"updated(?:\s+on)?:?\s+\w+ \d{1,2},? \d{4}.*",
    r"(?:edit|improve|suggest(?: an)? edit(?:s)?(?: to)?) this page",
    r"report (?:an? )?(?:issue|problem|bug|typo)(?: with this page)?",
    r"(?:←|→|«|»)?\s*(?:previous|next|back)(?: page| section| article)?\s*(?:←|→|«|»)?",
    # Markdown nav links, e.g. `[← Previous](#) [Next →](#)`.
    r"\[[^\]]*(?:previous|next|back|older|newer)[^\]]*\]\([^)]*\)(?:\s*\[[^\]]*\]\([^)]*\))*",
    r"we use cookies.*",
    r"(?:accept|allow|reject) (?:all )?cookies?",
    r"copyright ©?.*",
    r"all rights reserved\.?",
    r"^\s*\d+\s*(?:min(?:ute)?s? (?:read|to read))\s*$",
)

_FENCE_RE = re.compile(r"^\s*(?:```|~~~)")
_FRONT_MATTER_RE = re.compile(r"^(?:---|\+\+\+)\s*$")
_TITLE_RE = re.compile(r"^#\s+(.+?)\s*$")

# How far into the file a closing front-matter delimiter may appear. Guards against
# treating a `---` horizontal rule deep in a long page as front matter.
_FRONT_MATTER_SCAN_LINES = 60

_MAX_CONSECUTIVE_BLANK_LINES = 1


@functools.lru_cache(maxsize=8)
def _compile(patterns: tuple[str, ...]) -> tuple[re.Pattern[str], ...]:
    return tuple(re.compile(f"(?:{p})", re.IGNORECASE) for p in patterns)


def is_noise(line: str, patterns: tuple[str, ...] = DEFAULT_NOISE_PATTERNS) -> bool:
    """True when a whole line is render chrome rather than documentation."""

    stripped = line.strip()
    if not stripped:
        return False
    return any(pattern.fullmatch(stripped) for pattern in _compile(patterns))


def strip_front_matter(lines: list[str]) -> list[str]:
    """Drop a leading YAML/TOML front-matter block, if the page has one."""

    if not lines or not _FRONT_MATTER_RE.match(lines[0]):
        return lines
    limit = min(len(lines), _FRONT_MATTER_SCAN_LINES)
    for index in range(1, limit):
        if _FRONT_MATTER_RE.match(lines[index]):
            return lines[index + 1 :]
    return lines


def normalize_markdown(
    text: str,
    noise_patterns: tuple[str, ...] = DEFAULT_NOISE_PATTERNS,
) -> str:
    """Normalize fetched markdown into a stable, comparable form.

    - CRLF/CR are folded to LF and the text is NFC-normalized.
    - Trailing whitespace is removed from every line.
    - Front matter is dropped.
    - Chrome lines (see `DEFAULT_NOISE_PATTERNS`) are dropped.
    - Blank-line runs outside fenced code blocks are collapsed.

    Fenced code blocks are passed through verbatim: a code sample is often exactly
    what changed, and reformatting it would corrupt the diff a reviewer reads.
    """

    if not text:
        return ""

    folded = unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n"))
    lines = strip_front_matter(folded.split("\n"))

    out: list[str] = []
    in_fence = False
    blank_run = 0

    for line in lines:
        stripped = line.rstrip()

        if _FENCE_RE.match(stripped):
            in_fence = not in_fence
            out.append(stripped)
            blank_run = 0
            continue

        if in_fence:
            out.append(stripped)
            continue

        if not stripped:
            blank_run += 1
            if blank_run <= _MAX_CONSECUTIVE_BLANK_LINES:
                out.append("")
            continue

        # A dropped chrome line must be invisible: it may not reset the blank run, or
        # removing "Last updated: ..." between two paragraphs would add a blank line and
        # move the hash on a page that did not actually change.
        if is_noise(stripped, noise_patterns):
            continue

        blank_run = 0
        out.append(stripped)

    return "\n".join(out).strip("\n")


def content_hash(normalized: str) -> str:
    """Stable content hash used to skip unchanged pages without diffing them."""

    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def extract_title(normalized: str) -> str | None:
    """First markdown H1 in the document, if there is one."""

    for line in normalized.split("\n"):
        match = _TITLE_RE.match(line)
        if match:
            return match.group(1)
    return None


def fingerprint(normalized: str) -> dict[str, int | str | None]:
    """Cheap measurements stored alongside a snapshot and shown in reports."""

    return {
        "content_hash": content_hash(normalized),
        "char_count": len(normalized),
        "line_count": len(normalized.split("\n")) if normalized else 0,
        "title": extract_title(normalized),
    }
