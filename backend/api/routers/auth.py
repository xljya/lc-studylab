"""
认证 API
"""

from __future__ import annotations

import re
import sqlite3
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.dependencies import get_current_user
from config import settings
from core.database import create_user, get_user_by_email
from core.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthUser(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    created_at: str


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _validate_email(value: str) -> str:
    email = _normalize_email(value)
    if not EMAIL_PATTERN.match(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="邮箱格式不正确",
        )
    return email


def _to_auth_user(user: dict) -> AuthUser:
    return AuthUser(
        id=user["id"],
        email=user["email"],
        display_name=user.get("display_name"),
        created_at=user["created_at"],
    )


def _build_auth_response(user: dict) -> AuthTokenResponse:
    return AuthTokenResponse(
        access_token=create_access_token(user_id=user["id"], email=user["email"]),
        expires_in=settings.auth_access_token_expire_minutes * 60,
        user=_to_auth_user(user),
    )


@router.post("/register", response_model=AuthTokenResponse)
async def register(request: RegisterRequest) -> AuthTokenResponse:
    email = _validate_email(request.email)
    password = request.password

    if len(password) < settings.auth_password_min_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"密码长度不能少于 {settings.auth_password_min_length} 位",
        )

    display_name = request.display_name.strip() if request.display_name else None
    if get_user_by_email(email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该邮箱已注册",
        )

    try:
        user = create_user(
            user_id=f"user_{uuid4().hex[:12]}",
            email=email,
            password_hash=hash_password(password),
            display_name=display_name or None,
        )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该邮箱已注册",
        ) from exc

    return _build_auth_response(user)


@router.post("/login", response_model=AuthTokenResponse)
async def login(request: LoginRequest) -> AuthTokenResponse:
    email = _validate_email(request.email)
    user = get_user_by_email(email)

    if user is None or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
        )

    return _build_auth_response(user)


@router.get("/me", response_model=AuthUser)
async def me(current_user: dict = Depends(get_current_user)) -> AuthUser:
    return _to_auth_user(current_user)
