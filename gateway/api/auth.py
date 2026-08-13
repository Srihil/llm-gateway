"""
Auth endpoints: /auth/signup and /auth/login.

Uses HMAC-SHA256 signed tokens (stdlib only, no extra deps).
Passwords are hashed with PBKDF2-SHA256 + random salt.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from gateway.config import get_settings
from gateway.db.models import User
from gateway.db.session import AsyncSessionLocal

router = APIRouter()
settings = get_settings()


# ── Token helpers ──────────────────────────────────────────────────────────

def _make_token(user_id: str) -> str:
    payload = json.dumps({"uid": user_id, "exp": time.time() + 7 * 86400})
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    sig = hmac.new(
        settings.gateway_secret_key.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_token(token: str) -> dict | None:
    try:
        payload_b64, sig = token.rsplit(".", 1)
        expected = hmac.new(
            settings.gateway_secret_key.encode(),
            payload_b64.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        padding = "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + padding))
        if payload["exp"] < time.time():
            return None
        return payload
    except Exception:
        return None


# ── Password helpers ───────────────────────────────────────────────────────

def _hash_password(password: str, salt: str) -> str:
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return base64.b64encode(key).decode()


def _make_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    return f"{salt}:{_hash_password(password, salt)}"


def _verify_password(password: str, stored: str) -> bool:
    salt, stored_hash = stored.split(":", 1)
    return _hash_password(password, salt) == stored_hash


# ── DB dependency ──────────────────────────────────────────────────────────

async def get_db():
    async with AsyncSessionLocal() as db:
        yield db


# ── Schemas ────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()
    username = req.username.strip().lower()

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(email=email, username=username, password_hash=_make_password_hash(req.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {
        "token": _make_token(str(user.id)),
        "user": {"id": str(user.id), "email": user.email, "username": user.username},
    }


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()

    if not user or not _verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "token": _make_token(str(user.id)),
        "user": {"id": str(user.id), "email": user.email, "username": user.username},
    }


@router.get("/me")
async def me(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(auth[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"user_id": payload["uid"]}
