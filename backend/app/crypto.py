from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


def _fernet() -> Fernet:
    key = get_settings().avinor_secret_key.encode()
    if len(key) != 44:
        # Accept raw 32-byte urlsafe keys; otherwise derive a stable pad for local dev.
        from base64 import urlsafe_b64encode
        from hashlib import sha256

        key = urlsafe_b64encode(sha256(key).digest())
    return Fernet(key)


def encrypt_text(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode()).decode()


def decrypt_text(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return value
