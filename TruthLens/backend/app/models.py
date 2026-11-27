
import re
from typing import Any, Literal
from datetime import datetime
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, field_validator


# Languages accepted from older clients. The backend now detects the claim's
# language itself, so this field is optional and ignored.
Language = Literal["en", "hi", "hinglish"]


class AnalyzeRequest(BaseModel):
    """Input supplied to the TruthLens analysis API."""

    model_config = ConfigDict(extra="forbid")

    claim: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The claim that TruthLens should investigate.",
    )

    language: Language | None = Field(
        default=None,
        deprecated=True,
        description=(
            "Deprecated and ignored. The claim's language is detected "
            "automatically."
        ),
    )

    max_sources: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum number of sources to fetch.",
    )

    @field_validator("claim")
    @classmethod
    def validate_claim(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Claim cannot be empty or whitespace only.")

        return value


class AnalyzeResponse(BaseModel):
    """Combined analysis result returned by TruthLens."""

    claim: str
    claim_en: str | None = None
    # One of: en, hi, hinglish, other. Reports saved before language detection
    # existed only have `language`.
    detected_language: str = "en"
    language: str | None = None

    verdict: str | None = None
    judge_verdict: str | None = None

    explanation: dict[str, Any] | None = None
    diff_segments: list[dict[str, Any]] = Field(default_factory=list)
    claim_vs_reality: dict[str, Any] | None = None

    zombie_suspected: bool = False
    escalation: dict[str, Any] | None = None

    consensus_score: float | None = None
    dominant_stance: str | None = None
    segments_valid: bool | None = None

    evidence: list[dict[str, Any]] = Field(default_factory=list)
    rejected_evidence: list[dict[str, Any]] = Field(default_factory=list)

    search_queries: list[str] = Field(default_factory=list)
    search_summary: dict[str, Any] | None = None
    sources: list[dict[str, Any]] = Field(default_factory=list)
    fetch_summary: dict[str, Any] | None = None
    evidence_chunks: list[dict[str, Any]] = Field(default_factory=list)

    timings_ms: dict[str, float] = Field(default_factory=dict)

    analysis_id: str | None = None
    escalation_available: bool = False

class CommunityClaim(BaseModel):
    """Summary card for a previously analyzed claim."""

    id: str
    claim: str
    verdict: str | None = None
    consensus_score: float | None = None
    explanation_snippet: str | None = None
    explanation_snippet_hi: str | None = None
    detected_language: str | None = None
    zombie_suspected: bool = False
    analysis_count: int = 1
    seen_count: int = 0
    seen_by_me: bool = False
    first_analyzed_at: datetime
    last_analyzed_at: datetime


class CommunityClaimsPage(BaseModel):
    items: list[CommunityClaim]
    page: int
    page_size: int
    total: int
    total_pages: int


class VisitorToken(BaseModel):
    """Signed anonymous visitor token. Keep it in the browser."""

    visitor_token: str


class SeenState(BaseModel):
    """Result of marking or un-marking "I have seen this too"."""

    claim_id: str
    seen_count: int
    seen_by_me: bool


# --------------------------------------------------
# Challenges: a visitor disputes a community fact-check
# --------------------------------------------------

ChallengeType = Literal[
    "verdict_wrong",
    "missing_context",
    "outdated_evidence",
    "misread_source",
    "other",
]

SuggestedVerdict = Literal[
    "SUPPORTED",
    "REFUTED",
    "INSUFFICIENT_EVIDENCE",
    "UNVERIFIED_NO_AUTHORITATIVE_SOURCES",
]

MAX_CHALLENGE_SOURCES = 5

# Practical (HTML5-style) email check; it does not try to cover every corner
# of RFC 5322.
_EMAIL_RE = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)


def _clean_url(value: str) -> str:
    value = value.strip()
    parts = urlsplit(value)
    if (
        len(value) > 2048
        or any(ch.isspace() for ch in value)
        or parts.scheme not in {"http", "https"}
        or not parts.hostname
        or "." not in parts.hostname
    ):
        raise ValueError(f"'{value[:80]}' is not a valid http(s) link.")
    return value


class ChallengeCreate(BaseModel):
    """A visitor's challenge to a community fact-check."""

    model_config = ConfigDict(extra="forbid")

    challenge_type: ChallengeType = Field(
        ..., description="What the visitor thinks is wrong with the fact-check."
    )
    suggested_verdict: SuggestedVerdict | None = Field(
        default=None, description="The verdict the visitor believes is correct."
    )
    explanation: str = Field(
        ...,
        min_length=20,
        max_length=2000,
        description="Why the fact-check is wrong or what it is missing.",
    )
    sources: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_CHALLENGE_SOURCES,
        description="Links the reviewer can check to verify the challenge.",
    )
    email: str = Field(..., max_length=254, description="Contact email.")
    name: str | None = Field(default=None, max_length=100)
    contact_consent: bool = Field(
        ..., description="The visitor agrees to be contacted about this challenge."
    )

    @field_validator("explanation", "name", "email", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("name")
    @classmethod
    def blank_name_is_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not _EMAIL_RE.match(value):
            raise ValueError("Enter a valid email address.")
        return value.lower()

    @field_validator("sources")
    @classmethod
    def validate_sources(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for url in value:
            url = _clean_url(url)
            if url not in cleaned:  # drop duplicates, keep order
                cleaned.append(url)
        return cleaned

    @field_validator("contact_consent")
    @classmethod
    def must_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("You must agree to be contacted about your challenge.")
        return value


class ChallengeReceipt(BaseModel):
    """Confirmation returned after a challenge is stored."""

    challenge_id: str
    status: str
    created_at: datetime
