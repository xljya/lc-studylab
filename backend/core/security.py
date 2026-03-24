"""
认证与密码安全工具
"""

from __future__ import annotations

from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import os
from typing import Any

from config import settings

JWT_HEADER = {"alg": "HS256", "typ": "JWT"}
PASSWORD_HASH_NAME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 120_000


def _b64url_encode(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return (
        f"{PASSWORD_HASH_NAME}"
        f"${PASSWORD_ITERATIONS}"
        f"${_b64url_encode(salt)}"
        f"${_b64url_encode(hashed)}"
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_value, expected_hash = password_hash.split("$", 3)
        if algorithm != PASSWORD_HASH_NAME:
            return False

        recalculated = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            _b64url_decode(salt_value),
            int(iterations),
        )
        return hmac.compare_digest(_b64url_encode(recalculated), expected_hash)
    except (ValueError, TypeError):
        return False


def create_access_token(*, user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.auth_access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    header_segment = _b64url_encode(
        json.dumps(JWT_HEADER, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_segment = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    signature_segment = _b64url_encode(signature)

    return f"{header_segment}.{payload_segment}.{signature_segment}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        header_segment, payload_segment, signature_segment = token.split(".", 2)
    except ValueError as exc:
        raise ValueError("无效的 token 格式") from exc

    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    expected_signature = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    if not hmac.compare_digest(_b64url_encode(expected_signature), signature_segment):
        raise ValueError("token 签名校验失败")

    header = json.loads(_b64url_decode(header_segment))
    if header.get("alg") != "HS256":
        raise ValueError("不支持的 token 算法")

    payload = json.loads(_b64url_decode(payload_segment))
    expires_at = payload.get("exp")
    if not isinstance(expires_at, int):
        raise ValueError("token 缺少过期时间")

    if expires_at < int(datetime.now(timezone.utc).timestamp()):
        raise ValueError("token 已过期")

    return payload
