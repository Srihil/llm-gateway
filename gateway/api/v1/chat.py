from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from gateway.core.pipeline import (
    BudgetExceeded,
    GatewayPipeline,
    NoProvidersAvailable,
    RateLimitExceeded,
)
from gateway.db.repositories.providers import list_enabled_providers
from gateway.db.session import get_db
from gateway.schemas.chat import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat/completions", response_model=ChatResponse)
async def chat_completions(
    body: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    team = getattr(request.state, "team", None)
    if team is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    policy = team.policy
    if policy is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Team policy not configured")

    request_id = getattr(request.state, "request_id", "unknown")
    pipeline: GatewayPipeline = request.app.state.pipeline
    all_providers = await list_enabled_providers(db)

    try:
        response = await pipeline.process(
            request=body,
            team=team,
            policy=policy,
            request_id=request_id,
            db=db,
            all_providers=all_providers,
        )
        return response

    except RateLimitExceeded as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    except BudgetExceeded as e:
        raise HTTPException(status_code=402, detail=str(e))
    except NoProvidersAvailable as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Gateway error: {e}")
