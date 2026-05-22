"""
file_handler.py — Secure image upload utility.

Supports all common image formats:
  Raster:  jpg/jpeg, png, webp, gif, bmp, tiff/tif, avif, heic/heif
  Vector:  svg (stored as-is, not rasterised)

Security:
  • Extension check (first pass)
  • Magic-bytes sniff (second pass) — prevents disguised executables
    with a .jpg extension. Uses manual byte signatures since imghdr
    was removed in Python 3.13.
  • UUID filename — no user-controlled characters in the path
  • Max 10 MB per file
"""
import os
import uuid
from flask import current_app

# ── Allowed extensions ────────────────────────────────────────
ALLOWED_EXTENSIONS = {
    'jpg', 'jpeg',
    'png',
    'webp',
    'gif',
    'bmp',
    'tiff', 'tif',
    'avif',
    'heic', 'heif',   # iPhone photos
    'svg',
}

# Normalise extension stored on disk
EXT_NORMALISE = {
    'jpeg': 'jpg',
    'tif':  'tiff',
}

MAX_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB

# ── Magic-byte signatures ─────────────────────────────────────
# (offset, bytes_to_match)
_MAGIC: list[tuple[int, bytes]] = [
    (0,  b'\xff\xd8\xff'),                    # JPEG
    (0,  b'\x89PNG\r\n\x1a\n'),              # PNG
    (0,  b'GIF87a'),                          # GIF87
    (0,  b'GIF89a'),                          # GIF89
    (0,  b'BM'),                              # BMP
    (0,  b'II\x2a\x00'),                     # TIFF little-endian
    (0,  b'MM\x00\x2a'),                     # TIFF big-endian
    (0,  b'RIFF'),                            # WebP (RIFF....WEBP)
    (0,  b'\x00\x00\x00'),                   # AVIF / HEIC / MP4 family (ftyp box)
    (0,  b'<svg'),                            # SVG (text)
    (0,  b'<?xml'),                           # SVG with XML declaration
]

# Formats where we skip magic-byte check (container formats vary too much)
_SKIP_MAGIC = {'avif', 'heic', 'heif', 'svg'}


def allowed_file(filename: str) -> bool:
    if '.' not in filename:
        return False
    return filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _get_ext(filename: str) -> str:
    raw = filename.rsplit('.', 1)[1].lower()
    return EXT_NORMALISE.get(raw, raw)


def _is_image_bytes(header: bytes, ext: str) -> bool:
    """Return True if the file header looks like a known image format."""
    if ext in _SKIP_MAGIC:
        return True   # trust extension for container formats
    for offset, sig in _MAGIC:
        if header[offset: offset + len(sig)] == sig:
            return True
    return False


def save_image(file, folder_name: str = "products") -> str | None:
    """
    Validate, save, and return the URL path of the uploaded image.
    Returns None if the file is invalid.
    """
    if not file or not file.filename:
        return None

    if not allowed_file(file.filename):
        current_app.logger.warning(f"Rejected upload: bad extension — {file.filename}")
        return None

    ext = _get_ext(file.filename)

    # Size check
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_SIZE_BYTES:
        current_app.logger.warning(f"Rejected upload: too large ({size} bytes) — {file.filename}")
        return None

    # Magic-bytes check
    header = file.read(16)
    file.seek(0)
    if not _is_image_bytes(header, ext):
        current_app.logger.warning(f"Rejected upload: magic bytes mismatch — {file.filename}")
        return None

    # Save with UUID filename
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    upload_path     = os.path.join(current_app.root_path, 'static', 'uploads', folder_name)
    os.makedirs(upload_path, exist_ok=True)

    file.save(os.path.join(upload_path, unique_filename))
    return f"/static/uploads/{folder_name}/{unique_filename}"
