"""Structure TinyFish Search/Fetch responses for API routes (no LLM required)."""

import json
import re
import unicodedata

GENERIC_TITLE_RE = re.compile(
    r"\b("
    r"innovative|solutions?|industry|ingredients?|resilient|thriving|"
    r"expansion|digital content|market report|f&b industry|sector|economy|"
    r"beverage solutions|natural ingredients|content creation|"
    r"delivery service|giao hàng|đặt món|order đồ ăn|đồ ăn in|"
    r"hot trend trên|món ăn hot trend|world of|thế giới"
    r")\b",
    re.I,
)

EDITORIAL_TITLE_RE = re.compile(
    r"(?:^|\b)(thế giới|world of|khám phá|discover)\b"
    r"|(?:hot trend|đang hot|món ăn hot trend)\b.*\b(trên|tại|in|at)\b"
    r"|^top\s+món\b"
    r"|(?:order|đặt)\s+.+?(?:delivery|giao)"
    r"|delivery\s+service"
    r"|&\s*delivery",
    re.I,
)

PLATFORM_LISTICLE_RE = re.compile(
    r"^\s*top\s+.+?(?:hot trend|trending).*(?:shopee|grab|foody|tiktok)",
    re.I,
)

PUBLISHER_SUFFIX_RE = re.compile(
    r"\b(instagram|tiktok|youtube|facebook|shopee\s*food|grab\s*food|foody|reels?|shorts?)\b",
    re.I,
)

JUNK_LABEL_RE = re.compile(
    r"(https?://|www\.|watch\?v=)"
    r"|→|->"
    r"|^\s*from\s"
    r"|\babout this epis"
    r"|\.com/?"
    r"|\.(net|org|vn|io)\b"
    r"|\binstagram\b"
    r"|\btiktok\b",
    re.I,
)

VLOG_TITLE_RE = re.compile(
    r"\$\d"
    r"|\bmenu in\b"
    r"|china town"
    r"|street food.*vietnam"
    r"|street food streets?\b"
    r"|top\s*10\b"
    r"|\btop\s+\d+\s+best\b"
    r"|!\s*!",
    re.I,
)

CAPTION_TITLE_RE = re.compile(
    r"^\s*ping\b"
    r"|\bđừng bỏ lỡ\b"
    r"|\bđừng bỏ\b"
    r"|\bly trà\b"
    r"|\bkhám phá\b"
    r"|\bthưởng thức\b"
    r"|\btrải nghiệm\b"
    r"|\bmón ăn mới\b"
    r"|\bphiên\b"
    r"|\bpha chế\b"
    r"|\bpha che\b"
    r"|\bfollow\b"
    r"|\bsubscribe\b"
    r"|\bvà lớp\b"
    r"|\bthơm lừng\b",
    re.I,
)

DESCRIPTIVE_LABEL_RE = re.compile(
    r"\b(thơm|ngon|lừng|đặc biệt)\b.+\b(kem|sữa|trà)\b"
    r"|\bvà lớp kem\b",
    re.I,
)

LOCATION_IN_LABEL_RE = re.compile(
    r"\b(ho chi minh|hồ chí minh|tp\.?hcm|sài gòn|saigon|vietnam|hà nội|ha noi)\b"
    r"|\b(streets?|district|quận)\b",
    re.I,
)

STRONG_DISH_RE = re.compile(
    r"\b(banh|bánh|pho|phở|matcha|cà phê|ca phe|salt coffee|bún|bun bo|bánh mì|banh mi|"
    r"latte|smoothie|trà sữa|tra sua|khot|kem chuối|xiu mai|spring roll|bubble)\b",
    re.I,
)

TRENDY_SINGLE_WORDS = frozenset(
    {"matcha", "pho", "phở", "latte", "pizza", "burger", "khot", "donut", "doughnut"}
)

GENERIC_STAPLE_PHRASES = frozenset(
    {
        "cà phê",
        "ca phe",
        "coffee",
        "tea",
        "tra",
        "trà",
        "cơm",
        "com",
        "banh",
        "bánh",
        "bun",
        "bún",
        "mi",
        "mì",
        "kem",
        "che",
        "chè",
    }
)

COMPOUND_DISH_PHRASES = frozenset(
    {
        "banh mi",
        "bánh mì",
        "bun bo",
        "bún bò",
        "banh khot",
        "bánh khot",
        "banh xeo",
        "bánh xèo",
        "ca phe",
        "cà phê",
        "salt coffee",
        "tra sua",
        "trà sữa",
        "milk tea",
    }
)

CANONICAL_DISH_LABELS = {
    "pho": "Phở",
    "phở": "Phở",
    "banh mi": "Bánh Mì",
    "bun bo": "Bún Bò",
    "bánh mì": "Bánh Mì",
    "bún bò": "Bún Bò",
    "banh khot": "Bánh Khot",
    "bánh khot": "Bánh Khot",
    "banh xeo": "Bánh Xèo",
    "bánh xèo": "Bánh Xèo",
    "ca phe": "Cà Phê",
    "cà phê": "Cà Phê",
    "tra sua": "Trà Sữa",
    "trà sữa": "Trà Sữa",
}

EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]+")

HASHTAG_RE = re.compile(r"#\w+", re.UNICODE)

ENGLISH_DESC_RE = re.compile(
    r"\b(crispy|stuffed|baguette|sandwich|delicious|amazing|with|recipe|review)\b",
    re.I,
)

DISH_SEPARATOR_RE = re.compile(r"\s[-–—|·]\s")

MULTI_DISH_AND_RE = re.compile(
    r"(?:best|top)\s+(.+?)\s+and\s+(.+)",
    re.I,
)

PLAIN_AND_DISH_RE = re.compile(
    r"([\wÀ-ỹ][\wÀ-ỹ'’\s-]{1,40}?)\s+(?:and|và)\s+([\wÀ-ỹ][\wÀ-ỹ'’\s-]{1,40})",
    re.I,
)

DOMAIN_RE = re.compile(r"\b[\w-]+\.(com|net|org|vn|io|co)(?:/\S*)?", re.I)

LISTICLE_TITLE_RE = re.compile(
    r"^\s*(?:best|top)\s+(.+?)\s+(?:spots?|places?|restaurants?|cafés?|cafes?)\s+in\b"
    r"|^\s*top\s+món\s+ăn\b"
    r"|^\s*top\s+.+?\s+hot trend\b"
    r"|^\s*\d+\s+street food\b"
    r"|street food streets?\b"
    r"|^\s*top\s*\d+\s+best\b"
    r"|^\s*(?:vietnamese\s+)?top\s*\d+\s+best\b"
    r"|^\s*\d+\s+must[- ]try\b",
    re.I,
)

FOOD_HINT_RE = re.compile(
    r"\b("
    r"pho|banh|banh mi|bánh mì|banh khot|bánh khot|bun bo|bún bò|banh xeo|"
    r"ca phe|cà phê|salt coffee|coffee|tea|matcha|tra|trà|"
    r"com|cơm|bun|bún|mi|mì|kem|che|chè|"
    r"latte|smoothie|bubble|milk tea|sua|sữa|trà sữa|tra sua|cacao|chocolate|"
    r"donut|doughnut|"
    r"coconut|yogurt|chicken|ga|gà|pizza|burger|hot pot|lau|lẩu|"
    r"korean|k-food|yangnyeom|fried chicken|xiu mai|spring roll"
    r")\b",
    re.I,
)


def _strip_urls_and_domains(text: str) -> str:
    text = EMOJI_RE.sub(" ", text or "")
    text = HASHTAG_RE.sub(" ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = DOMAIN_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def _food_hint_search_text(text: str) -> str:
    return _strip_urls_and_domains(text).replace("-", " ")


def _has_food_hint(text: str) -> bool:
    return bool(FOOD_HINT_RE.search(_food_hint_search_text(text)))


def _food_hint_matches(text: str) -> list[re.Match[str]]:
    return list(FOOD_HINT_RE.finditer(_food_hint_search_text(text)))


def _clean_trend_name(title: str) -> str:
    cleaned = re.sub(r"\s*[\|·]\s*.*$", "", title or "").strip()
    cleaned = re.sub(r"^\d+\.\s*", "", cleaned)
    cleaned = re.sub(r"https?://\S+", "", cleaned).strip()

    suffix = re.search(r"\s+[-–—]\s+(.+)$", cleaned)
    if suffix:
        left = cleaned[: suffix.start()].strip()
        right = suffix.group(1).strip()
        left_food = _has_food_hint(left)
        right_food = _has_food_hint(right)
        if PUBLISHER_SUFFIX_RE.search(right) or (left_food and not right_food):
            cleaned = left
        elif right_food and not left_food:
            cleaned = right

    return cleaned[:80] or ""


def _is_too_generic_label(label: str) -> bool:
    text = _finalize_label(label)
    folded = text.casefold()
    if folded in GENERIC_STAPLE_PHRASES:
        return True
    if folded in COMPOUND_DISH_PHRASES:
        return False
    words = text.split()
    if len(words) >= 2:
        if words[-1].casefold() in GENERIC_STAPLE_PHRASES:
            return True
        if all(word.casefold() in GENERIC_STAPLE_PHRASES for word in words):
            return True
    if len(words) != 1:
        return False
    if folded in TRENDY_SINGLE_WORDS:
        return False
    if STRONG_DISH_RE.search(text):
        return False
    return _has_food_hint(text)


def _is_descriptive_label(label: str) -> bool:
    if CAPTION_TITLE_RE.search(label):
        return True
    if DESCRIPTIVE_LABEL_RE.search(label):
        return True
    if not _has_food_hint(label):
        return False
    if STRONG_DISH_RE.search(label):
        return False
    return len(label.split()) >= 4


def _is_generic_headline(title: str) -> bool:
    if not title:
        return False
    if LISTICLE_TITLE_RE.search(title):
        return True
    if CAPTION_TITLE_RE.search(title):
        return True
    if EDITORIAL_TITLE_RE.search(title):
        return True
    if PLATFORM_LISTICLE_RE.search(title):
        return True
    if GENERIC_TITLE_RE.search(title):
        return True
    if VLOG_TITLE_RE.search(title):
        return True
    return False


def _primary_food_term(text: str) -> str | None:
    matches = _food_hint_matches(text)
    if not matches:
        return None
    ranked = sorted(matches, key=lambda match: len(match.group(0)), reverse=True)
    for match in ranked:
        term = _finalize_label(match.group(0))
        if not term or _is_junk_label(term):
            continue
        presented = _present_trend_label(term)
        if presented:
            return presented
    return None


def _label_from_colon_title(title: str) -> str | None:
    if ":" not in title:
        return None
    left, right = title.rsplit(":", 1)
    candidates: list[str] = []
    for part in (left, right):
        dish = _finalize_label(part)
        if not dish or DOMAIN_RE.search(dish) or JUNK_LABEL_RE.search(dish):
            continue
        if dish and _has_food_hint(dish) and not _is_junk_label(dish):
            presented = _present_trend_label(dish)
            if presented:
                candidates.append(presented)
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda name: (0 if STRONG_DISH_RE.search(name) else 1, len(name.split()), len(name)),
    )


def _label_from_hashtags(text: str) -> str | None:
    if not HASHTAG_RE.search(text):
        return None
    for tag in HASHTAG_RE.findall(text):
        term = tag.lstrip("#").replace("_", " ")
        if term and _has_food_hint(term) and len(term) >= 3:
            presented = _present_trend_label(term)
            if presented:
                return presented
    return _primary_food_term(text)


def _label_from_multi_dish_and(text: str) -> str | None:
    cleaned = _strip_urls_and_domains(text)
    best_label: str | None = None
    for match in MULTI_DISH_AND_RE.finditer(cleaned):
        first = _finalize_label(match.group(1))
        if first and _has_food_hint(first) and not _is_junk_label(first) and len(first.split()) <= 5:
            best_label = _present_trend_label(first) or best_label
    return best_label


def _label_from_comma_segments(text: str) -> str | None:
    cleaned = _strip_urls_and_domains(text)
    if "," not in cleaned:
        return None
    segments = [
        re.sub(r"\s+(?:và|and)\s*$", "", seg.strip(), flags=re.I)
        for seg in cleaned.split(",")
    ]
    candidates = [
        seg
        for seg in (_finalize_label(part) for part in segments)
        if seg and _has_food_hint(seg) and not _is_junk_label(seg) and len(seg.split()) <= 5
    ]
    if not candidates:
        return None
    best = min(
        candidates,
        key=lambda seg: (0 if STRONG_DISH_RE.search(seg) else 1, len(seg.split()), len(seg)),
    )
    return _present_trend_label(best)


def _label_from_plain_and_list(text: str) -> str | None:
    cleaned = _strip_urls_and_domains(text)
    best_label: str | None = None
    for match in PLAIN_AND_DISH_RE.finditer(cleaned):
        first = _finalize_label(match.group(1))
        if first and _has_food_hint(first) and not _is_junk_label(first) and len(first.split()) <= 5:
            best_label = _present_trend_label(first) or best_label
    if best_label:
        return best_label
    if re.search(r"\s+và\s+", cleaned, re.I):
        first = re.split(r"\s+và\s+", cleaned, maxsplit=1, flags=re.I)[0].strip(" .,;:-—–|")
        hyphen = re.search(r"[\wÀ-ỹ]+(?:-[\wÀ-ỹ]+)+", first)
        candidate = hyphen.group(0) if hyphen else first
        if candidate and _has_food_hint(candidate) and not _is_junk_label(candidate):
            return _present_trend_label(candidate)
    return None


def _label_from_dash_segments(title: str) -> str | None:
    if not re.search(r"\s[-–—]\s", title):
        return None
    segments = [_finalize_label(part) for part in re.split(r"\s[-–—]\s", title)]
    candidates = [
        seg
        for seg in segments
        if seg and _has_food_hint(seg) and not _is_junk_label(seg) and len(seg.split()) <= 6
    ]
    if not candidates:
        return None
    best = min(candidates, key=lambda seg: (len(seg.split()), len(seg)))
    return _present_trend_label(best)


def _trim_to_dish_head(label: str) -> str:
    parts = DISH_SEPARATOR_RE.split(label or "", maxsplit=1)
    if len(parts) < 2:
        return label or ""
    left, right = parts[0].strip(), parts[1].strip()
    if not left or not right:
        return label or ""
    if STRONG_DISH_RE.search(left) or (_has_food_hint(left) and len(left.split()) <= 4):
        if ENGLISH_DESC_RE.search(right) or len(right.split()) > 4:
            return left
    return label or ""


def _finalize_label(label: str) -> str:
    text = _trim_to_dish_head(label)
    text = EMOJI_RE.sub(" ", text or "")
    text = HASHTAG_RE.sub(" ", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\s+(?:và|and)\s*$", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip(" .,;:-→|")
    return text[:72]


def _present_trend_label(label: str) -> str | None:
    """Normalize and capitalize the first letter for chalkboard display."""
    text = _finalize_label(label)
    if not text or _is_junk_label(text):
        return None
    canonical = CANONICAL_DISH_LABELS.get(text.casefold())
    if canonical:
        return canonical
    return text[0].upper() + text[1:]


def _is_junk_label(label: str) -> bool:
    if not label or len(label) < 3:
        return True
    if HASHTAG_RE.search(label):
        return True
    if (
        len(label) <= 3
        and label.casefold() not in TRENDY_SINGLE_WORDS
        and not STRONG_DISH_RE.search(label)
    ):
        return True
    if _is_too_generic_label(label):
        return True
    if JUNK_LABEL_RE.search(label):
        return True
    if re.search(r"\babout\b", label, re.I):
        return True
    if CAPTION_TITLE_RE.search(label):
        return True
    if PUBLISHER_SUFFIX_RE.search(label) and len(label.split()) >= 3:
        return True
    if len(label.split()) >= 6 and _has_food_hint(label) and not STRONG_DISH_RE.search(label):
        return True
    if DESCRIPTIVE_LABEL_RE.search(label):
        return True
    if _is_descriptive_label(label):
        return True
    if LOCATION_IN_LABEL_RE.search(label):
        return True
    if re.search(r"\b(viral|trending|review|keywords)\b", label, re.I) and len(label.split()) >= 2:
        return True
    if re.search(
        r"^(?:coffee|tea|ca phe|cà phê|tra|trà|cơm|com|kem|che|chè)\s+\w+",
        label,
        re.I,
    ):
        return True
    if EDITORIAL_TITLE_RE.search(label):
        return True
    if VLOG_TITLE_RE.search(label):
        return True
    if PLATFORM_LISTICLE_RE.search(label):
        return True
    if MULTI_DISH_AND_RE.search(label) and len(_food_hint_matches(label)) >= 2:
        return True
    if PLAIN_AND_DISH_RE.search(label) and len(_food_hint_matches(label)) >= 2:
        return True
    if re.search(r"\s+(?:và|and)\s*$", label, re.I):
        return True
    if "," in label and len(_food_hint_matches(label)) >= 2:
        return True
    if label.count(",") >= 3:
        return True
    if LISTICLE_TITLE_RE.search(label):
        return True
    if len(label) > 48:
        return True
    if len(label) > 55 and label.count(",") >= 2:
        return True
    if len(label.split()) > 9:
        return True
    if re.search(r"\s[-–—|·]\s", label) and ENGLISH_DESC_RE.search(label):
        return True
    if len(label) > 24 and re.search(r"\s[a-z]$", label, re.I):
        return True
    if re.search(r"\s[-–—]\s", label) and len(_food_hint_matches(label)) >= 2:
        return True
    return False


def _label_from_listicle_title(title: str) -> str | None:
    match = LISTICLE_TITLE_RE.search(title)
    if not match:
        return None
    if match.lastindex is not None:
        subject = _finalize_label(match.group(1))
        if subject and _has_food_hint(subject) and not _is_junk_label(subject):
            presented = _present_trend_label(subject)
            if presented:
                return presented
    return _primary_food_term(title)


def _first_dish_from_list_snippet(snippet: str) -> str:
    if not re.match(r"^\s*from\s", snippet, re.I):
        return ""
    tail = re.sub(r"^\s*from\s+", "", snippet, flags=re.I)
    first = re.split(r"[,.\n]", tail, maxsplit=1)[0].strip()
    if first and _has_food_hint(first) and len(first.split()) <= 5:
        return _present_trend_label(first) or ""
    return ""


def _publisher_label(result: dict) -> str:
    raw = (result.get("site_name") or result.get("url") or "").casefold()
    if "instagram" in raw:
        return "Instagram"
    if "tiktok" in raw:
        return "TikTok"
    if "youtube" in raw:
        return "YouTube"
    if "facebook" in raw:
        return "Facebook"
    if "grabfood" in raw or "food.grab" in raw:
        return "GrabFood"
    if "shopeefood" in raw:
        return "ShopeeFood"
    if "foody" in raw:
        return "Foody"
    site = (result.get("site_name") or "").strip()
    if site and not site.startswith("http"):
        return site
    url = (result.get("url") or "").strip()
    if url:
        host = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
        if host.startswith("www."):
            host = host[4:]
        return host or "web"
    return "web"


def _is_weak_title(title: str) -> bool:
    if not title:
        return True
    words = title.split()
    if not words:
        return True
    if len(words) == 1 and not _has_food_hint(title):
        return True
    weak_titles = {
        "episode",
        "video",
        "reel",
        "post",
        "watch",
        "menu",
        "home",
        "viral",
        "trending",
        "food",
        "update",
    }
    lowered = title.casefold()
    if lowered in weak_titles:
        return True
    if _finalize_label(title).casefold() in GENERIC_STAPLE_PHRASES:
        return True
    if len(words) <= 2 and words[0].casefold() in weak_titles:
        return True
    return False


def _phrase_around_food_hint(text: str) -> str:
    text = _strip_urls_and_domains(text)
    text = re.sub(r"\babout this episode\b", " ", text, flags=re.I)
    text = re.sub(r"\s*->\s*", " ", text)

    if re.match(r"^\s*from\s", text, re.I):
        list_label = _first_dish_from_list_snippet(text)
        if list_label:
            return list_label
        stripped = re.sub(r"^\s*from\s+[^,.\n]+[,.\n]\s*", "", text, count=1, flags=re.I)
        if stripped and stripped != text:
            text = stripped

    multi = _label_from_multi_dish_and(text)
    if multi:
        return multi
    plain = _label_from_plain_and_list(text)
    if plain:
        return plain

    matches = _food_hint_matches(text)
    if not matches:
        return ""
    match = matches[-1]
    if len(match.group(0)) < 3:
        return ""
    start = max(0, match.start() - 20)
    end = min(len(text), match.end() + 28)
    phrase = text[start:end].strip(" .,;:-→|!")
    phrase = PUBLISHER_SUFFIX_RE.sub("", phrase)
    phrase = re.sub(r"\bInstagram:\s*$", "", phrase, flags=re.I).strip(" :,-")
    phrase = re.sub(r"\s+", " ", phrase).strip()
    words = phrase.split()
    while words and (len(words[0]) <= 2 or words[0].casefold() in {"et", "top", "best", "g"}):
        words = words[1:]
    phrase = " ".join(words)
    multi = _label_from_multi_dish_and(phrase)
    if multi:
        return multi
    plain = _label_from_plain_and_list(phrase)
    if plain:
        return plain
    if len(phrase) < 4 or _is_junk_label(phrase):
        return ""
    return phrase[:72]


def _trend_label_from_result(result: dict) -> str | None:
    raw_title = result.get("title", "") or ""
    title = _clean_trend_name(raw_title)
    snippet = result.get("snippet") or ""

    for candidate_title in (title, raw_title):
        if not candidate_title:
            continue
        for extractor in (
            _label_from_listicle_title,
            _label_from_colon_title,
            _label_from_hashtags,
            _label_from_dash_segments,
            _label_from_multi_dish_and,
            _label_from_plain_and_list,
            _label_from_comma_segments,
        ):
            label = extractor(candidate_title)
            if label:
                return label

    if title and _is_generic_headline(title):
        keyword = _primary_food_term(title)
        if keyword:
            return keyword

    if (
        title
        and ":" not in title
        and not HASHTAG_RE.search(title)
        and not GENERIC_TITLE_RE.search(title)
        and not _is_generic_headline(title)
        and not _is_junk_label(title)
        and not _is_weak_title(title)
    ):
        if _has_food_hint(title) and title.count(",") <= 1 and len(title.split()) <= 8:
            title_label = _present_trend_label(title)
            if title_label:
                return title_label

    snippet_label = _phrase_around_food_hint(snippet)
    snippet_presented = None
    if snippet_label:
        snippet_presented = _present_trend_label(snippet_label)
        if not snippet_presented:
            snippet_presented = _primary_food_term(snippet_label)
    if not snippet_presented and snippet:
        snippet_presented = _primary_food_term(snippet)
    if snippet_presented:
        return snippet_presented

    if (
        title
        and _has_food_hint(snippet)
        and len(title) <= 45
        and not GENERIC_TITLE_RE.search(title)
        and not _is_generic_headline(title)
        and not _is_junk_label(title)
        and not _is_weak_title(title)
        and title.count(",") <= 1
    ):
        title_label = _present_trend_label(title)
        if title_label:
            return title_label

    return None


def build_emerging_search_queries(location: str, category: str) -> list[str]:
    """Build TinyFish queries for emerging trends based on location and category."""
    market = location.strip()
    focus = (category or "food and beverage").strip()
    focus_lower = focus.casefold()

    platforms = "Vietnam TikTok GrabFood ShopeeFood Foody menu"

    if "food and beverage" in focus_lower or focus_lower in {"f&b", "fb"}:
        return [
            f"món viral đồ uống cà phê trà matcha {market} TikTok GrabFood",
            f"viral trending street food dishes {market} Vietnam ShopeeFood Foody menu",
            f"món ăn đường phố viral {market} Vietnam Foody ShopeeFood",
        ]

    if focus_lower in {"beverage", "beverages", "drinks", "drink"} or (
        "beverage" in focus_lower and "food" not in focus_lower
    ):
        return [
            f"viral trending {focus} coffee tea matcha {market} {platforms}",
            f"viral trending {focus} bubble milk tea drinks {market} {platforms}",
        ]

    if "food" in focus_lower:
        dish_term = "dishes" if "street food" in focus_lower else "street food dishes"
        return [
            f"viral trending {focus} {dish_term} {market} {platforms}",
            f"viral {focus} menu {market} trending",
        ]

    return [
        f"viral trending {focus} {market} {platforms}",
        f"viral trending {focus} menu items {market} trending",
    ]


def _merge_dedup_key(result: dict) -> str:
    url = (result.get("url") or "").strip()
    if url:
        return f"url:{url}"
    title = re.sub(r"\s+", " ", (result.get("title") or "").strip().casefold())
    snippet = re.sub(r"\s+", " ", (result.get("snippet") or "").strip().casefold())[:160]
    return f"text:{title}|{snippet}"


def merge_search_results(*datasets: dict) -> dict:
    seen_keys: set[str] = set()
    merged: list[dict] = []
    for data in datasets:
        for result in data.get("results", []):
            key = _merge_dedup_key(result)
            if key in seen_keys:
                continue
            seen_keys.add(key)
            merged.append(result)
    merged.sort(key=lambda item: item.get("position") or 999)
    return {"results": merged, "total_results": len(merged)}


def _sources_from_results(data: dict, limit: int = 5) -> list[dict]:
    return [
        {
            "title": r.get("title"),
            "excerpt": r.get("snippet"),
            "url": r.get("url"),
            "publisher": r.get("site_name"),
        }
        for r in data.get("results", [])[:limit]
    ]


def _trend_name_key(name: str) -> str:
    folded = unicodedata.normalize("NFD", name or "")
    stripped = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", stripped).casefold().strip()


def emerging_trends_from_search(data: dict, location: str, limit: int = 5) -> list[dict]:
    candidates: list[dict] = []
    seen_names: set[str] = set()
    for result in data.get("results", []):
        name = _trend_label_from_result(result)
        if not name:
            continue
        name_key = _trend_name_key(name)
        if name_key in seen_names:
            continue
        seen_names.add(name_key)
        serp_rank = result.get("position") or 999
        candidates.append(
            {
                "result": result,
                "name": name,
                "serp_rank": serp_rank,
            }
        )

    candidates.sort(key=lambda item: item["serp_rank"])

    trends = []
    for display_rank, item in enumerate(candidates[:limit], start=1):
        result = item["result"]
        snippet = result.get("snippet") or ""
        publisher = _publisher_label(result)
        serp_rank = item["serp_rank"] if item["serp_rank"] != 999 else None
        trend: dict = {
            "trend_name": item["name"],
            "display_rank": display_rank,
            "description": snippet,
            "why_it_matters": (
                f"Listed at position {display_rank} from live TinyFish search in {location} "
                f"({publisher})."
            ),
            "source_url": result.get("url"),
            "publisher": publisher,
            "region": location,
        }
        if serp_rank is not None:
            trend["search_rank"] = serp_rank
        trends.append(trend)
    return trends


def normalize_emerging_trends(trends: list, location: str, limit: int = 5) -> list[dict]:
    """Kept for compatibility — ranks are assigned from response order only."""
    normalized: list[dict] = []
    for index, item in enumerate(trends[:limit]):
        if not isinstance(item, dict):
            continue
        entry = {**item, "region": item.get("region") or location}
        if entry.get("display_rank") is None and entry.get("search_rank") is None:
            entry["display_rank"] = index + 1
        normalized.append(entry)
    return normalized


def forecast_from_search(data: dict, trend_name: str, location: str) -> dict:
    sources = _sources_from_results(data, 5)
    count = len(sources)

    reasoning_parts = []
    if sources:
        reasoning_parts.append(
            f"TinyFish Search returned **{count}** relevant signals for *{trend_name}* in *{location}*."
        )
        top = sources[0]
        if top.get("excerpt"):
            reasoning_parts.append(
                f"Top result: *{top.get('title')}* ({top.get('publisher', 'web')}) — {top.get('excerpt')}"
            )
        reasoning_parts.append(
            "Review the linked sources below and validate adoption timing with your own POS and store data."
        )
    else:
        reasoning_parts.append(
            f"No public web signals were returned for *{trend_name}* in {location}. "
            f"Try a broader trend label or add competitor URLs to menu-gap analysis."
        )

    return {
        "trend": trend_name,
        "location": location,
        "signal_count": count,
        "reasoning": " ".join(reasoning_parts),
        "key_drivers": [s.get("title") for s in sources[:3] if s.get("title")],
        "sources": sources,
    }


def regional_comparison_from_search(
    region_a: str,
    region_b: str,
    data_a: dict,
    data_b: dict,
    category: str,
) -> dict:
    signals_a = _sources_from_results(data_a, 5)
    signals_b = _sources_from_results(data_b, 5)

    def lead_signal(signals: list[dict]) -> str:
        if not signals:
            return "No dominant signal"
        return _clean_trend_name(signals[0].get("title") or "")

    lead_a = lead_signal(signals_a)
    lead_b = lead_signal(signals_b)

    summary = (
        f"*{region_a}* top TinyFish signal: **{lead_a}**. "
        f"*{region_b}* top TinyFish signal: **{lead_b}** ({category}). "
        f"Use these live search leaders to localize LTOs per city cluster."
    )

    return {
        "category": category,
        "region_a": region_a,
        "region_b": region_b,
        "region_a_signals": signals_a,
        "region_b_signals": signals_b,
        "region_a_lead_trend": lead_a,
        "region_b_lead_trend": lead_b,
        "summary": summary,
        "region_a_summary": (
            f"{region_a}: {signals_a[0]['excerpt']}" if signals_a else f"{region_a}: limited signal."
        ),
        "region_b_summary": (
            f"{region_b}: {signals_b[0]['excerpt']}" if signals_b else f"{region_b}: limited signal."
        ),
        "expansion_opportunities": [
            f"Review whether {lead_b} appears in {region_a} search signals.",
            f"Review whether {lead_a} appears in {region_b} search signals.",
            f"Compare {category} source excerpts between {region_a} and {region_b}.",
        ],
    }


def menu_gap_from_search(
    current_menu: list[str],
    location: str,
    trends_data: dict,
    competitor_menus: list[dict],
) -> dict:
    trend_signals = _sources_from_results(trends_data, 8)
    menu_words: set[str] = set()
    for item in current_menu:
        menu_words.update(w for w in re.split(r"\W+", item.lower()) if len(w) > 3)

    missing = []
    for index, result in enumerate(trends_data.get("results", [])[:8]):
        signal = {
            "title": result.get("title"),
            "excerpt": result.get("snippet"),
            "url": result.get("url"),
            "publisher": result.get("site_name"),
        }
        title = _clean_trend_name(signal.get("title") or "")
        title_lower = title.lower()
        title_words = {w for w in re.split(r"\W+", title_lower) if len(w) > 3}
        overlap = title_words & menu_words
        if title and len(overlap) < max(1, len(title_words) // 3):
            list_rank = index + 1
            serp_rank = result.get("position")
            rank = serp_rank if serp_rank is not None else list_rank
            priority = "High" if rank <= 2 else "Medium" if rank <= 5 else "Low"
            gap: dict = {
                "trend": title,
                "priority": priority,
                "evidence": signal.get("excerpt"),
                "source_url": signal.get("url"),
                "competitor_adoption": signal.get("excerpt") or "See linked source.",
                "recommendation": (
                    f"Evaluate *{title}* for {location} using the linked search evidence."
                ),
            }
            if serp_rank is not None:
                gap["search_rank"] = serp_rank
            missing.append(gap)

    competitor_summary = [
        f"{c.get('title') or c.get('url')}" for c in competitor_menus if c.get("title") or c.get("url")
    ]

    return {
        "location": location,
        "current_menu_items": current_menu,
        "missing_opportunities": missing[:5],
        "competitor_menus": competitor_menus,
        "competitor_summary": competitor_summary,
        "trend_signals": trend_signals,
        "executive_summary": (
            f"Compared {len(current_menu)} menu items against {len(trend_signals)} live TinyFish signals "
            f"in {location}. Found {len(missing[:5])} actionable gaps."
        ),
    }


def suppliers_from_search(data: dict) -> list[dict]:
    suppliers = []
    for index, result in enumerate(data.get("results", [])[:10], start=1):
        rank = result.get("position")
        supplier: dict = {
            "name": result.get("site_name") or _clean_trend_name(result.get("title") or ""),
            "contact_info": result.get("url"),
            "products_offered": result.get("snippet"),
            "next_step": "Review this search result and contact if relevant.",
        }
        if rank is not None:
            supplier["search_rank"] = rank
        suppliers.append(supplier)
    return suppliers


def outreach_template(supplier_info: str, product_needs: str) -> dict:
    product_label = product_needs.split(",")[0].strip() or product_needs.strip()

    body_en = (
        f"Dear Supplier Partner,\n\n"
        f"I hope this message finds you well. We are expanding our F&B product line and are "
        f"currently sourcing the following:\n\n"
        f"**Product requirements:** {product_needs}\n\n"
        f"**Supplier under review:** {supplier_info}\n\n"
        f"Could you please provide:\n"
        f"• Bulk pricing tiers (FOB and delivered)\n"
        f"• Minimum order quantity (MOQ)\n"
        f"• Sample policy and lead time\n"
        f"• Monthly delivery capacity and payment terms\n\n"
        f"We are evaluating partners and would appreciate a response at your earliest convenience.\n\n"
        f"Best regards"
    )

    body_vi = (
        f"Kính gửi Quý Nhà Cung Cấp,\n\n"
        f"Chúng tôi đang mở rộng danh mục F&B và cần tìm nguồn cung ổn định cho:\n\n"
        f"**Yêu cầu sản phẩm:** {product_needs}\n\n"
        f"**Thông tin NCC:** {supplier_info}\n\n"
        f"Quý công ty vui lòng gửi:\n"
        f"• Bảng giá sỉ (FOB và giao tận nơi)\n"
        f"• MOQ (số lượng đặt hàng tối thiểu)\n"
        f"• Chính sách mẫu và thời gian cung mẫu\n"
        f"• Năng lực giao hàng hàng tháng và điều khoản thanh toán\n\n"
        f"Chúng tôi đang đánh giá đối tác và mong nhận phản hồi khi thuận tiện.\n\n"
        f"Trân trọng"
    )

    return {
        "subject_en": f"RFQ — {product_label} (Bulk Supply Inquiry)",
        "body_en": body_en,
        "subject_vi": f"Yêu cầu báo giá — {product_label}",
        "body_vi": body_vi,
    }


def as_json_text(data: object) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)
