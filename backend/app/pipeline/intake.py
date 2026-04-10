import os
import re
from typing import Optional


def validate_input(
    title: str,
    description: str,
    reporter_email: str,
    image_path: Optional[str] = None,
) -> dict:
    errors = []

    if not title or len(title.strip()) < 5:
        errors.append("Title must be at least 5 characters.")

    if not description or len(description.strip()) < 20:
        errors.append("Description must be at least 20 characters.")

    email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    if not reporter_email or not email_re.match(reporter_email.strip()):
        errors.append("reporter_email is not a valid email address.")

    image_info = None
    if image_path:
        # image_path is like /uploads/filename.ext — resolve to filesystem
        fs_path = image_path.replace("/uploads/", "/app/uploads/", 1)
        if os.path.exists(fs_path):
            size_bytes = os.path.getsize(fs_path)
            if size_bytes > 10 * 1024 * 1024:
                errors.append("Image file exceeds 10MB limit.")
            image_info = {"path": image_path, "size_bytes": size_bytes}
        else:
            image_info = {"path": image_path, "size_bytes": None, "warning": "File not found on disk"}

    if errors:
        raise ValueError("; ".join(errors))

    return {
        "title_length": len(title.strip()),
        "description_length": len(description.strip()),
        "email_valid": True,
        "image": image_info,
    }
