"""
API key authentication middleware.

Reads the Authorization header (Bearer <key>) or X-API-Key header,
looks up the team from the database, and stores it on request.state.
Requests without a valid key receive 401. Inactive teams receive 403.
"""
import structlog
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from gateway.db.repositories.teams import get_team_by_api_key
from gateway.db.session import AsyncSessionLocal

log = structlog.get_logger()

# These paths skip auth
_PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}
_PUBLIC_PREFIXES = ("/metrics",)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        is_public = path in _PUBLIC_PATHS or any(path.startswith(p) for p in _PUBLIC_PREFIXES)
        if is_public or path.startswith("/admin"):
            # Admin paths have their own key check
            return await call_next(request)

        api_key = self._extract_key(request)
        if not api_key:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Missing API key. Provide Authorization: Bearer <key> or X-API-Key header."},
            )

        async with AsyncSessionLocal() as db:
            team = await get_team_by_api_key(db, api_key)

        if team is None:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Invalid API key"},
            )

        if not team.is_active:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Team account is inactive"},
            )

        request.state.team = team
        log.debug("auth_ok", team=team.name, request_id=getattr(request.state, "request_id", None))
        return await call_next(request)

    @staticmethod
    def _extract_key(request: Request) -> str | None:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:]
        return request.headers.get("X-API-Key")
