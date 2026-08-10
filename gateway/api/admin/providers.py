import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from gateway.config import get_settings
from gateway.core.circuit_breaker import CircuitBreaker
from gateway.db.repositories.providers import list_providers, set_provider_enabled
from gateway.db.session import get_db
from gateway.providers.registry import list_registered

settings = get_settings()
router = APIRouter()


def _require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key")


class ProviderStatus(BaseModel):
    id: str
    name: str
    base_url: str
    priority: int
    is_enabled: bool
    is_registered: bool
    circuit_breaker_state: str


@router.get("", response_model=list[ProviderStatus], dependencies=[Depends(_require_admin)])
async def list_provider_statuses(request: Request, db: AsyncSession = Depends(get_db)):
    providers = await list_providers(db)
    cb: CircuitBreaker = request.app.state.circuit_breaker
    registered = set(list_registered())

    result = []
    for p in providers:
        cb_status = await cb.get_status(str(p.id))
        result.append(
            ProviderStatus(
                id=str(p.id),
                name=p.name,
                base_url=p.base_url,
                priority=p.priority,
                is_enabled=p.is_enabled,
                is_registered=p.name in registered,
                circuit_breaker_state=cb_status.state.value,
            )
        )
    return result


@router.post("/{provider_id}/enable", dependencies=[Depends(_require_admin)])
async def enable_provider(provider_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await set_provider_enabled(db, provider_id, True)
    if not ok:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"status": "enabled"}


@router.post("/{provider_id}/disable", dependencies=[Depends(_require_admin)])
async def disable_provider(provider_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await set_provider_enabled(db, provider_id, False)
    if not ok:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"status": "disabled"}


@router.post("/{provider_id}/reset-circuit-breaker", dependencies=[Depends(_require_admin)])
async def reset_circuit_breaker(provider_id: uuid.UUID, request: Request):
    cb: CircuitBreaker = request.app.state.circuit_breaker
    await cb.reset(str(provider_id))
    return {"status": "circuit_breaker_reset"}
