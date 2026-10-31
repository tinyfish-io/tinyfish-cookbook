"""Normalization tests.

The contract these protect: render chrome must not move the hash, and real content
must never be swallowed by a noise pattern.
"""

from docs_drift_radar.normalize import (
    content_hash,
    extract_title,
    fingerprint,
    is_noise,
    normalize_markdown,
    strip_front_matter,
)

PAGE = """# Endpoints

TinyFish offers three ways to run automations.

## Streaming

Use `/run-sse` for live updates.
"""

# Same documentation, plus everything a docs site wraps around it.
PAGE_WITH_CHROME = """---
title: Endpoints
---

Skip to main content

# Endpoints

TinyFish offers three ways to run automations.

Last updated: September 27, 2026

## Streaming

Use `/run-sse` for live updates.

Was this page helpful?

Edit this page

Copyright 2026 TinyFish

[← Previous](#) [Next →](#)
"""


def test_render_chrome_does_not_change_the_hash():
    assert normalize_markdown(PAGE) == normalize_markdown(PAGE_WITH_CHROME)
    assert content_hash(normalize_markdown(PAGE)) == content_hash(
        normalize_markdown(PAGE_WITH_CHROME)
    )


def test_real_content_change_does_change_the_hash():
    changed = PAGE.replace("/run-sse", "/run-async")
    assert content_hash(normalize_markdown(PAGE)) != content_hash(normalize_markdown(changed))


def test_crlf_and_trailing_whitespace_are_normalized():
    assert normalize_markdown("# Title   \r\n\r\nbody\t\r\n") == "# Title\n\nbody"


def test_front_matter_is_dropped_only_at_the_start():
    lines = ["---", "title: x", "---", "# Body"]
    assert strip_front_matter(lines) == ["# Body"]

    # A horizontal rule deep in the document is not front matter.
    deep = ["# Body", "", "---", "", "more"]
    assert strip_front_matter(deep) == deep


def test_code_fences_are_preserved_verbatim():
    source = "```python\nx = 1\n\n\ny = 2\n```\n"
    assert normalize_markdown(source) == "```python\nx = 1\n\n\ny = 2\n```"


def test_blank_runs_collapse_outside_code_fences():
    assert normalize_markdown("a\n\n\n\n\nb") == "a\n\nb"


def test_noise_predicate_is_line_anchored():
    assert is_noise("Was this page helpful?")
    assert is_noise("Last updated: September 27, 2026")

    # A sentence that merely mentions the word is content, not chrome.
    assert not is_noise("The page was updated when the config changes.")
    assert not is_noise("See the previous section for details.")


def test_title_and_fingerprint():
    normalized = normalize_markdown(PAGE)
    assert extract_title(normalized) == "Endpoints"

    marks = fingerprint(normalized)
    assert marks["content_hash"] == content_hash(normalized)
    assert marks["line_count"] == len(normalized.split("\n"))
    assert marks["char_count"] == len(normalized)


def test_empty_input_is_empty():
    assert normalize_markdown("") == ""
    assert extract_title("") is None
