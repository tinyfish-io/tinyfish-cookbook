from urllib.parse import urlparse


# Source-priority rules for TruthLens.
# Tier 1 = highest priority; Tier 4 = lowest priority.
# These tiers are heuristics, not proof of accuracy.

TIER_WEIGHTS = {
    1: 1.0,
    2: 0.8,
    3: 0.5,
    4: 0.2,
}

# Tier 1: any Indian government / NIC site (central, state, district),
# matched by suffix so new ministries and state portals are covered.
TIER_1_SUFFIXES = {
    "gov.in",
    "nic.in",
}

# Tier 1: official bodies that don't use gov.in / nic.in.
TIER_1_DOMAINS = {
    "rbi.org.in",
    "sansad.in",
    "who.int",
    "un.org",
}

# Tier 2: established news organizations.
# A starting point, not an endorsement of every article.
TIER_2_NEWS_DOMAINS = {
    # India
    "thehindu.com",
    "thehindubusinessline.com",
    "indianexpress.com",
    "newindianexpress.com",
    "ndtv.com",
    "hindustantimes.com",
    "timesofindia.indiatimes.com",
    "economictimes.indiatimes.com",
    "livemint.com",
    "business-standard.com",
    "ptinews.com",
    "deccanherald.com",
    "telegraphindia.com",
    "tribuneindia.com",
    "indiatoday.in",
    "theprint.in",
    "scroll.in",
    "thewire.in",
    # International
    "bbc.com",
    "bbc.co.uk",
    "reuters.com",
    "apnews.com",
    "afp.com",
    "theguardian.com",
    "nytimes.com",
    "washingtonpost.com",
    "aljazeera.com",
    "dw.com",
}

# Tier 2: dedicated fact-checking organizations.
TIER_2_FACTCHECK_DOMAINS = {
    "boomlive.in",
    "altnews.in",
    "factly.in",
    "vishvasnews.com",
    "newschecker.in",
    "factchecker.in",
    "snopes.com",
    "politifact.com",
    "factcheck.org",
}

TIER_2_DOMAINS = TIER_2_NEWS_DOMAINS | TIER_2_FACTCHECK_DOMAINS

# Tier 4: user-generated platforms (domain says nothing about the author)
# and free hosting subdomains (anyone can publish a page in minutes).
TIER_4_DOMAINS = {
    # Social / messaging / UGC
    "instagram.com",
    "instagr.am",
    "facebook.com",
    "fb.com",
    "fb.watch",
    "threads.net",
    "x.com",
    "twitter.com",
    "t.co",
    "t.me",
    "telegram.me",
    "wa.me",
    "whatsapp.com",
    "reddit.com",
    "quora.com",
    "tiktok.com",
    "sharechat.com",
    "youtube.com",
    "youtu.be",
    "medium.com",
    "substack.com",
    # Free hosting / deployment platforms
    "vercel.app",
    "netlify.app",
    "github.io",
    "pages.dev",
    "workers.dev",
    "onrender.com",
    "herokuapp.com",
    "railway.app",
    "fly.dev",
    "web.app",
    "firebaseapp.com",
    "streamlit.app",
    "hf.space",
    "replit.app",
    "repl.co",
    "glitch.me",
    "surge.sh",
    "ngrok-free.app",
    "blogspot.com",
    "blogspot.in",
    "wordpress.com",
    "wixsite.com",
    "weebly.com",
}


def normalize_domain(url: str) -> str:
    """Extract a normalized hostname from an HTTP(S) URL."""

    if not isinstance(url, str) or not url.strip():
        return ""

    try:
        parsed = urlparse(url.strip())

        if parsed.scheme.lower() not in {"http", "https"}:
            return ""

        if not parsed.hostname:
            return ""

        host = parsed.hostname.lower().rstrip(".")

        # Treat www.example.com and example.com consistently.
        if host.startswith("www."):
            host = host[4:]

        return host

    except (ValueError, TypeError):
        return ""


def _matches_domain(host: str, domain: str) -> bool:
    """Match a domain and its subdomains without partial-name collisions."""

    return host == domain or host.endswith("." + domain)


def _matches_any(host: str, domains) -> bool:
    return any(_matches_domain(host, d) for d in domains)


def normalize_organization(url: str) -> str:
    """Group related hostnames under a common source organization."""

    host = normalize_domain(url)

    if not host:
        return ""

    # PIB's main website and its static subdomain
    # should count as one source organization.
    if host == "pib.gov.in" or host.endswith(".pib.gov.in"):
        return "pib.gov.in"

    return host


def classify_source(url: str) -> dict:
    """Classify a source using the configured domain rules."""

    host = normalize_domain(url)

    if not host:
        return {
            "url": url,
            "domain": None,
            "tier": 4,
            "weight": TIER_WEIGHTS[4],
            "reason": "Invalid or unsupported URL",
        }

    # Tier 4 is checked first so a low-priority rule can never be
    # overridden by a broader higher-tier match.
    if _matches_any(host, TIER_4_DOMAINS):
        tier = 4
        reason = "User-generated platform or free-hosting domain"

    elif _matches_any(host, TIER_1_SUFFIXES) or _matches_any(host, TIER_1_DOMAINS):
        tier = 1
        reason = "Recognized official government / institutional domain"

    elif _matches_any(host, TIER_2_FACTCHECK_DOMAINS):
        tier = 2
        reason = "Recognized fact-checking organization"

    elif _matches_any(host, TIER_2_NEWS_DOMAINS):
        tier = 2
        reason = "Recognized news organization domain"

    else:
        tier = 3
        reason = "Unclassified domain; reliability not yet assessed"

    return {
        "url": url,
        "domain": host,
        "tier": tier,
        "weight": TIER_WEIGHTS[tier],
        "reason": reason,
    }


def rank_sources(urls: list[str]) -> list[dict]:
    """Classify and rank URLs, preserving input order for equal tiers."""

    if not isinstance(urls, list):
        raise TypeError("urls must be a list of strings.")

    results = [classify_source(url) for url in urls]

    return sorted(results, key=lambda item: item["tier"])


if __name__ == "__main__":
    cases = {
        "https://pib.gov.in/PressReleasePage.aspx?PRID=1": 1,
        "https://main.sci.gov.in/": 1,
        "https://rbi.org.in/": 1,
        "https://www.thehindu.com/news/": 2,
        "https://www.boomlive.in/fact-check": 2,
        "https://somerandomblog.com/post": 3,
        "https://www.instagram.com/p/abc/": 4,
        "https://m.facebook.com/story": 4,
        "https://fake-news.vercel.app/": 4,
        "https://my-site.netlify.app/": 4,
        # Collision checks: must NOT match a higher tier.
        "https://pib.gov.in.evil.com/": 3,
        "https://notreuters.com/": 3,
        "https://pib.gov.in.vercel.app/": 4,
        "ftp://pib.gov.in/file": 4,
        "": 4,
    }
    for url, expected in cases.items():
        got = classify_source(url)["tier"]
        assert got == expected, f"{url!r}: expected {expected}, got {got}"
    print("All tier checks passed.")