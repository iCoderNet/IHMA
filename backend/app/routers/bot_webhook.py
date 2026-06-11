"""Telegram bot webhook endpoint."""
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.bot_user import BotSettings
from app.services.bot_handler import BotHandler

router = APIRouter(prefix="/bot", tags=["bot-webhook"])


@router.post("/webhook")
async def webhook(request: Request):
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    async with AsyncSessionLocal() as db:
        # Get bot token
        result = await db.execute(select(BotSettings).where(BotSettings.id == 1))
        settings = result.scalar_one_or_none()
        if not settings or not settings.token or not settings.is_active:
            return {"ok": False, "error": "Bot not configured"}

        handler = BotHandler(settings.token, db)
        try:
            await handler.handle_update(update)
            await db.commit()
        except Exception as e:
            await db.rollback()
            # Log but don't crash - Telegram retries on non-200
            import traceback
            traceback.print_exc()

    return {"ok": True}
