import json
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiofiles

from app.config import get_projects_dir
from app.security import assert_safe_resource_id

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Media and document types the Asset Manager supports. Scriptable web types
# (.html, .xhtml, .js, .swf ...) are deliberately absent; .svg is allowed but
# always served with an attachment disposition (see api/assets.py).
ALLOWED_ASSET_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg',
    '.pdf', '.txt', '.md', '.rtf', '.docx', '.doc', '.odt',
    '.fountain', '.fdx', '.odraft', '.celtx',
    '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac',
    '.mp4', '.mov', '.webm', '.m4v', '.avi',
    '.zip', '.csv', '.json', '.xml',
}


def _assets_dir(project_id: str) -> Path:
    """Return the assets directory for a project, ensuring the project exists."""
    assert_safe_resource_id(project_id, 'project')
    project_dir = get_projects_dir() / project_id
    if not project_dir.exists():
        raise FileNotFoundError(f"Project '{project_id}' not found")
    assets_path = project_dir / "assets"
    assets_path.mkdir(exist_ok=True)
    return assets_path


def _manifest_path(project_id: str) -> Path:
    """Return the path to the asset manifest file."""
    return _assets_dir(project_id) / "manifest.json"


def _read_manifest(project_id: str) -> list[dict]:
    """Read the asset manifest, returning an empty list if it doesn't exist."""
    path = _manifest_path(project_id)
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _write_manifest(project_id: str, manifest: list[dict]) -> None:
    """Write the asset manifest to disk."""
    path = _manifest_path(project_id)
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


async def upload_asset(
    project_id: str,
    file_content: bytes,
    original_name: str,
    tags: list[str] | None = None,
) -> dict:
    """Save an uploaded file to the assets directory and add it to the manifest."""
    if len(file_content) > MAX_FILE_SIZE:
        raise ValueError(f"File size exceeds maximum of {MAX_FILE_SIZE // (1024 * 1024)} MB")

    assets_path = _assets_dir(project_id)
    asset_id = str(uuid.uuid4())

    # Detect MIME type from file extension
    mime_type, _ = mimetypes.guess_type(original_name)
    if mime_type is None:
        mime_type = "application/octet-stream"

    # Preserve original extension — restricted to the media/document types
    # the Asset Manager supports (audit item S2: an unrestricted extension
    # like .html served from the app origin is stored XSS).
    _, ext = os.path.splitext(original_name)
    ext = ext.lower()
    if ext not in ALLOWED_ASSET_EXTENSIONS:
        raise ValueError(
            f"File type '{ext or '(none)'}' is not allowed. "
            f"Allowed: {', '.join(sorted(ALLOWED_ASSET_EXTENSIONS))}"
        )
    filename = f"{asset_id}{ext}"

    file_path = assets_path / filename
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_content)

    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": asset_id,
        "filename": filename,
        "original_name": original_name,
        "mime_type": mime_type,
        "size_bytes": len(file_content),
        "tags": tags or [],
        "created_at": now,
    }

    manifest = _read_manifest(project_id)
    manifest.append(entry)
    _write_manifest(project_id, manifest)

    return entry


def list_assets(project_id: str) -> list[dict]:
    """List all assets in a project by reading the manifest."""
    return _read_manifest(project_id)


def get_asset_path(project_id: str, asset_id: str) -> Path:
    """Return the file path for a given asset, for download."""
    manifest = _read_manifest(project_id)
    for entry in manifest:
        if entry["id"] == asset_id:
            file_path = _assets_dir(project_id) / entry["filename"]
            if not file_path.exists():
                raise FileNotFoundError(f"Asset file '{entry['filename']}' not found on disk")
            return file_path
    raise FileNotFoundError(f"Asset '{asset_id}' not found")


def get_asset_entry(project_id: str, asset_id: str) -> dict:
    """Return the manifest entry for a given asset."""
    manifest = _read_manifest(project_id)
    for entry in manifest:
        if entry["id"] == asset_id:
            return entry
    raise FileNotFoundError(f"Asset '{asset_id}' not found")


def delete_asset(project_id: str, asset_id: str) -> None:
    """Remove an asset file and its manifest entry."""
    manifest = _read_manifest(project_id)
    found = None
    for entry in manifest:
        if entry["id"] == asset_id:
            found = entry
            break

    if found is None:
        raise FileNotFoundError(f"Asset '{asset_id}' not found")

    # Remove file from disk
    file_path = _assets_dir(project_id) / found["filename"]
    if file_path.exists():
        file_path.unlink()

    # Remove from manifest
    manifest = [e for e in manifest if e["id"] != asset_id]
    _write_manifest(project_id, manifest)


def update_tags(project_id: str, asset_id: str, tags: list[str]) -> dict:
    """Update the tags for a given asset."""
    manifest = _read_manifest(project_id)
    updated_entry = None
    for entry in manifest:
        if entry["id"] == asset_id:
            entry["tags"] = tags
            updated_entry = entry
            break

    if updated_entry is None:
        raise FileNotFoundError(f"Asset '{asset_id}' not found")

    _write_manifest(project_id, manifest)
    return updated_entry


def search_by_tag(project_id: str, tag: str) -> list[dict]:
    """Filter assets by a specific tag."""
    manifest = _read_manifest(project_id)
    return [entry for entry in manifest if tag in entry.get("tags", [])]
