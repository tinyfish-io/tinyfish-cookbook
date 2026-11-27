"""Anonymous visitor identity for "I have seen this too".

A visitor is a random UUID (from ``uuid.uuid4``, which reads ``os.urandom``).
The server hands it to the browser inside a signed token::

    <32 hex chars of UUID>.<32 hex chars of HMAC-SHA256(secret, UUID)>

Only the server knows the secret, so a client cannot invent or tweak a visitor
ID. It can only present one the server issued. This module has no app imports
so it can be tested without any configuration.
"""

import hashlib
import hmac
import uuid

_SIG_LEN = 32  # hex characters of the HMAC kept in the token (128 bits)
_ID_LEN = 32  # hex characters of a UUID
_HEX = frozenset("0123456789abcdef")


def new_visitor_id() -> str:
    return uuid.uuid4().hex


def _sign(visitor_id: str, secret: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"), visitor_id.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return digest[:_SIG_LEN]


def make_token(visitor_id: str, secret: str) -> str:
    return f"{visitor_id}.{_sign(visitor_id, secret)}"


def issue_token(secret: str) -> str:
    """Create a brand-new visitor and return its signed token."""
    return make_token(new_visitor_id(), secret)


def verify_token(token: str | None, secret: str) -> str | None:
    """Return the visitor ID if the token is genuine, otherwise ``None``."""
    if not token or len(token) != _ID_LEN + 1 + _SIG_LEN:
        return None

    visitor_id, sep, signature = token.partition(".")
    if not sep or len(visitor_id) != _ID_LEN or not _HEX.issuperset(visitor_id):
        return None

    expected = _sign(visitor_id, secret)
    # Compare as bytes: compare_digest rejects non-ASCII str.
    if hmac.compare_digest(signature.encode("utf-8"), expected.encode("utf-8")):
        return visitor_id
    return None
