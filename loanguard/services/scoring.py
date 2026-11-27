"""Risk scoring engine — pure, testable function.

Starting score = 100, subtract risk points per the master spec:

    Confirmed not found in RBI directory .................. 40
    RBI directory could not be checked .................... 15
    No grievance details found ............................ 10
    No named lending partner found ........................ 15
    No registered address found ............................. 5
    No interest-rate disclosure found ...................... 10
    Complaint keywords >= 8 ................................ 25
    Complaint keywords >= 3 ................................ 12

Complaint thresholds are mutually exclusive (25 OR 12, never both).
Final score clamped to [0, 100].

Verdicts:
    70-100 LOWER RISK | 45-69 UNCLEAR | 0-44 HIGH RISK

A "not found" indicator means "not found in inspected sources", never proof
that something does not exist. A failed RBI lookup must never become a
confirmed negative match.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import VERDICT_HIGH, VERDICT_LOW, VERDICT_UNCLEAR


@dataclass
class Indicators:
    rbi_checked: bool = False
    rbi_found: bool = False
    fetch_checked: bool = True  # True if at least one public source was successfully inspected
    grievance_found: bool = False
    lending_partner_found: bool = False
    address_found: bool = False
    interest_rate_found: bool = False
    complaint_count: int = 0


def compute_score(ind: Indicators) -> dict[str, Any]:
    score = 100
    deductions: list[dict[str, Any]] = []

    # RBI directory — a failed check (not checked) is NOT a confirmed absence.
    if ind.rbi_checked and not ind.rbi_found:
        score -= 40
        deductions.append(
            {
                "reason": "Application not found in the RBI digital lending apps directory",
                "points": 40,
            }
        )
    elif not ind.rbi_checked:
        score -= 15
        deductions.append(
            {
                "reason": "RBI directory could not be checked (lookup failed or unavailable)",
                "points": 15,
            }
        )

    # Missing-information deductions: Only apply when the relevant public source
    # has actually been successfully inspected. If Fetch fails, do not assume
    # the information is absent.
    if ind.fetch_checked:
        if not ind.grievance_found:
            score -= 10
            deductions.append(
                {"reason": "No grievance redressal details found in inspected sources", "points": 10}
            )

        if not ind.lending_partner_found:
            score -= 15
            deductions.append(
                {"reason": "No named lending partner (NBFC / bank) found in inspected sources", "points": 15}
            )

        if not ind.address_found:
            score -= 5
            deductions.append(
                {"reason": "No registered business address found in inspected sources", "points": 5}
            )

        if not ind.interest_rate_found:
            score -= 10
            deductions.append(
                {"reason": "No interest-rate disclosure found in inspected sources", "points": 10}
            )
    else:
        # Transparent note when public websites could not be inspected
        pass

    # Complaint signals — mutually exclusive thresholds.
    if ind.complaint_count >= 8:
        score -= 25
        deductions.append(
            {
                "reason": f"High complaint signal count ({ind.complaint_count} complaint-related keywords)",
                "points": 25,
            }
        )
    elif ind.complaint_count >= 3:
        score -= 12
        deductions.append(
            {
                "reason": f"Moderate complaint signal count ({ind.complaint_count} complaint-related keywords)",
                "points": 12,
            }
        )

    score = max(0, min(100, score))

    if score >= 70 and ind.rbi_checked:
        verdict = VERDICT_LOW
    elif score >= 45:
        verdict = VERDICT_UNCLEAR
    else:
        verdict = VERDICT_HIGH

    unverified: list[str] = []
    if not ind.rbi_checked:
        unverified.append("RBI directory verification was not completed")
    if not ind.fetch_checked:
        unverified.append("Public website inspection was not completed")

    confidence = "high" if ind.rbi_checked and ind.fetch_checked else "limited"
    return {
        "score": score,
        "verdict": verdict,
        "confidence": confidence,
        "unverified": unverified,
        "deductions": deductions,
    }


def verdict_color(verdict: str) -> str:
    return {
        VERDICT_LOW: "#16a34a",
        VERDICT_UNCLEAR: "#d97706",
        VERDICT_HIGH: "#dc2626",
    }.get(verdict, "#475569")
