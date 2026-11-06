"""Language detection helpers.

Gemini (in the planner call) is the primary language detector. This module
only applies deterministic script-based sanity checks on top of its answer,
because Gemini can mislabel Roman-script Hindi ("Hinglish") or mixed text.
"""

import re

# Languages the pipeline understands.
#   en       English
#   hi       Hindi in Devanagari script
#   hinglish Hindi written in Latin script, or Hindi/English mixed
#   other    any other language (handled with English + Hindi output)
SUPPORTED_LANGUAGES = {"en", "hi", "hinglish", "other"}

LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "hinglish": "Hinglish",
    "other": "another language",
}

_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
_LATIN = re.compile(r"[A-Za-z]")


def resolve_language(model_value: str | None, claim: str) -> str:
    """Combine the model's guess with the claim's actual scripts."""

    value = model_value if model_value in SUPPORTED_LANGUAGES else None

    letters = [ch for ch in claim if ch.isalpha()]
    total = len(letters)

    if total == 0:
        return value or "en"

    devanagari = len(_DEVANAGARI.findall(claim))
    latin = len(_LATIN.findall(claim))
    other = total - devanagari - latin

    # Mostly some third script (Tamil, Arabic, ...): not ours to guess.
    if other / total > 0.5:
        return "other"

    dev_ratio = devanagari / total

    if dev_ratio >= 0.6:
        return "hi"

    if dev_ratio >= 0.1:
        # Devanagari mixed with Latin words.
        return "hinglish"

    # No (or negligible) Devanagari: Latin script.
    if value == "hi":
        return "hinglish"  # Hindi written in Roman script

    if value in ("hinglish", "other"):
        return value

    return "en"


def search_language_code(language: str) -> str | None:
    """Language code to pass to the TinyFish search API (None = no filter)."""

    return language if language in ("en", "hi") else None
