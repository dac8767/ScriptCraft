"""Path-parameter and resource-id hardening (v0.55, audit item S1).

Every file-touching route builds filesystem paths from URL path segments
(project slugs, script/asset UUIDs). Routing guarantees a segment contains no
raw "/", but encoded separators, ".."/"." segments, dotfile names, backslashes
(Windows), and drive colons must be rejected before any Path join. Project ids
are unicode slugs, so this is a targeted denylist of traversal primitives
rather than an ASCII whitelist.
"""
from fastapi import HTTPException, Request

_FORBIDDEN_CHARS = ("/", "\\", "\x00", ":")


def is_safe_resource_id(value: str) -> bool:
    if not isinstance(value, str) or not value or len(value) > 128:
        return False
    if value in (".", "..") or value.startswith("."):
        return False
    if any(ch in value for ch in _FORBIDDEN_CHARS):
        return False
    return True


def assert_safe_resource_id(value: str, kind: str = "resource") -> str:
    """Service-layer guard: raise FileNotFoundError (mapped to 404) on a
    malformed id so nothing downstream ever joins it into a path."""
    if not is_safe_resource_id(value):
        raise FileNotFoundError(f"Invalid {kind} id")
    return value


async def validate_path_params(request: Request) -> None:
    """Router dependency: reject any URL path parameter that could act as a
    traversal primitive, before the handler runs."""
    for key, value in request.path_params.items():
        if isinstance(value, str) and not is_safe_resource_id(value):
            raise HTTPException(status_code=404, detail=f"Invalid {key}")
