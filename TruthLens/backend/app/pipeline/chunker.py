
import re
import unicodedata
from typing import Any
from urllib.parse import urlparse

from rank_bm25 import BM25Okapi

from app.pipeline.dates import normalize_date


def normalize_text(text: str) -> str:
    """Normalize Unicode and whitespace while preserving Hindi characters."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\x00", "")
    return re.sub(r"\s+", " ", text).strip()


def clean_text(text: str) -> str:
    """Clean extracted page text."""
    return normalize_text(text)


def tokenize(text: str) -> list[str]:
    """Tokenize English, Hindi, and other Unicode word characters."""
    normalized = unicodedata.normalize("NFC", text).casefold()
    return re.findall(r"[\w\u0900-\u097F]+", normalized)


def chunk_text(
    text: str,
    chunk_size: int = 300,
    overlap: int = 40,
) -> list[str]:
    """
    Split text into approximately chunk_size-word chunks.

    Consecutive chunks overlap by the requested number of words.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and smaller than chunk_size")

    cleaned = clean_text(text)
    if not cleaned:
        return []

    sentences = re.split(r"(?<=[.!?।])\s+", cleaned)
    words: list[str] = []

    for sentence in sentences:
        sentence_words = sentence.split()
        if sentence_words:
            words.extend(sentence_words)

    if not words:
        return []

    chunks: list[str] = []
    step = chunk_size - overlap

    for start in range(0, len(words), step):
        current_words = words[start:start + chunk_size]

        if not current_words:
            break

        chunks.append(" ".join(current_words))

        if start + chunk_size >= len(words):
            break

    return chunks


def _get_page_date(page: dict[str, Any]) -> str | None:
    """
    Return an explicitly supplied publication date.

    Never infer a publication date from arbitrary webpage text or
    from the time the page was fetched.
    """
    value = page.get("published_date")

    if isinstance(value, str) and value.strip():
        return value.strip()

    return None


def chunk_pages(
    fetch_response: dict[str, Any],
    chunk_size: int = 300,
    overlap: int = 40,
) -> list[dict[str, Any]]:
    """
    Convert fetched pages into evidence chunks.

    Publication dates come only from the fetched page's published_date
    metadata. Missing or unparseable dates remain None.
    """
    response = fetch_response.get("response", {})
    pages = response.get("results", [])

    if not isinstance(pages, list):
        return []

    evidence_chunks: list[dict[str, Any]] = []
    next_chunk_id = 1

    for page in pages:
        if not isinstance(page, dict):
            continue

        page_text = page.get("text", "")
        if not isinstance(page_text, str) or not page_text.strip():
            continue

        source_url = page.get("final_url") or page.get("url")
        title = page.get("title") or ""
        language = page.get("language")

        date_raw = _get_page_date(page)
        normalized_date = normalize_date(date_raw)
        date_abs = normalized_date["date_abs"]

        page_chunks = chunk_text(
            text=page_text,
            chunk_size=chunk_size,
            overlap=overlap,
        )

        for page_chunk_index, text in enumerate(page_chunks):
            evidence_chunks.append(
                {
                    "chunk_id": next_chunk_id,
                    "source_url": source_url,
                    "title": title,
                    "language": language,
                    "date_raw": date_raw,
                    "date_abs": date_abs,
                    "chunk_index": page_chunk_index,
                    "text": text,
                }
            )

            next_chunk_id += 1

    return evidence_chunks


def _get_domain(url: str | None) -> str:
    """Extract a normalized hostname from a URL."""
    if not url:
        return ""

    try:
        hostname = urlparse(url).hostname or ""
        return hostname.lower().removeprefix("www.")
    except (ValueError, AttributeError):
        return ""


def rank_evidence_chunks(
    chunks: list[dict[str, Any]],
    claim: str,
    claim_en: str | None = None,
    sources: list[dict[str, Any]] | None = None,
    top_k: int = 12,
    max_chunks_per_domain: int = 3,
) -> list[dict[str, Any]]:
    """
    Rank evidence chunks using BM25 relevance multiplied by source-tier
    weight. Limit the number of selected chunks per domain.

    When `claim_en` (an English translation) differs from `claim`, its tokens
    are added to the BM25 query, so a Hindi claim can still match English
    sources and vice versa.

    The returned chunks retain their original metadata and receive
    additional ranking fields.
    """
    if top_k <= 0 or max_chunks_per_domain <= 0:
        return []

    if not chunks:
        return []

    claim_tokens = tokenize(claim)

    if claim_en and claim_en.strip() and claim_en.strip() != claim.strip():
        claim_tokens = claim_tokens + tokenize(claim_en)

    tokenized_chunks = [tokenize(chunk.get("text", "")) for chunk in chunks]

    if not claim_tokens or not any(tokenized_chunks):
        return []

    source_lookup: dict[str, dict[str, Any]] = {}

    for source in sources or []:
        source_url = source.get("url")

        if isinstance(source_url, str):
            source_lookup[source_url] = source

    bm25 = BM25Okapi(tokenized_chunks)
    bm25_scores = bm25.get_scores(claim_tokens)

    ranked: list[dict[str, Any]] = []

    for chunk, raw_score in zip(chunks, bm25_scores):
        ranked_chunk = dict(chunk)

        source_url = ranked_chunk.get("source_url")
        source = source_lookup.get(source_url, {})
        domain = source.get("domain") or _get_domain(source_url)

        tier = source.get("tier", 3)
        tier_weight = source.get("weight", source.get("tier_weight", 0.5))

        try:
            tier = int(tier)
        except (TypeError, ValueError):
            tier = 3

        try:
            tier_weight = float(tier_weight)
        except (TypeError, ValueError):
            tier_weight = 0.5

        bm25_score = float(raw_score)
        rank_score = bm25_score * tier_weight

        ranked_chunk.update(
            {
                "domain": domain,
                "tier": tier,
                "tier_weight": tier_weight,
                "bm25_score": bm25_score,
                "rank_score": rank_score,
            }
        )

        ranked.append(ranked_chunk)

    ranked.sort(key=lambda item: item["rank_score"], reverse=True)

    selected: list[dict[str, Any]] = []
    deferred: list[dict[str, Any]] = []
    domain_counts: dict[str, int] = {}

    for chunk in ranked:
        domain = chunk.get("domain") or ""

        if domain_counts.get(domain, 0) < max_chunks_per_domain:
            selected.append(chunk)
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
        else:
            deferred.append(chunk)

        if len(selected) >= top_k:
            break

    if len(selected) < top_k:
        selected_ids = {chunk["chunk_id"] for chunk in selected}

        for chunk in deferred:
            if chunk["chunk_id"] in selected_ids:
                continue

            selected.append(chunk)
            selected_ids.add(chunk["chunk_id"])

            if len(selected) >= top_k:
                break

    return selected
