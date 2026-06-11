"""Bot administration router - settings, users, broadcast."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import math

from app.core.database import get_db
from app.core.dependencies import get_superadmin
from app.models.user import User
from app.models.bot_user import BotUser, BotSettings
from app.schemas.bot import BotSettingsUpdate, BotSettingsOut, BotUserOut, BroadcastMessage, BroadcastResult, WebhookSetupResponse

router = APIRouter(prefix="/bot-admin", tags=["bot-admin"])


async def get_or_create_settings(db: AsyncSession) -> BotSettings:
    result = await db.execute(select(BotSettings).where(BotSettings.id == 1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = BotSettings(id=1)
        db.add(settings)
        await db.flush()
    return settings


@router.get("/settings", response_model=BotSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    s = await get_or_create_settings(db)
    return s


@router.put("/settings", response_model=BotSettingsOut)
async def update_settings(
    data: BotSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    s = await get_or_create_settings(db)
    if data.token is not None:
        s.token = data.token
    if data.webhook_url is not None:
        s.webhook_url = data.webhook_url
    if data.is_active is not None:
        s.is_active = data.is_active
    await db.flush()
    await db.refresh(s)
    return s


@router.post("/webhook/setup", response_model=WebhookSetupResponse)
async def setup_webhook(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    s = await get_or_create_settings(db)
    if not s.token or not s.webhook_url:
        raise HTTPException(status_code=400, detail="Bot token va webhook URL sozlanmagan")

    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{s.token}/setWebhook",
                json={"url": f"{s.webhook_url}/api/bot/webhook"},
                timeout=10,
            )
            result = resp.json()
            if result.get("ok"):
                return WebhookSetupResponse(
                    success=True,
                    message="Webhook muvaffaqiyatli o'rnatildi",
                    webhook_url=f"{s.webhook_url}/api/bot/webhook",
                )
            else:
                return WebhookSetupResponse(
                    success=False,
                    message=result.get("description", "Xato"),
                )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/webhook/delete", response_model=WebhookSetupResponse)
async def delete_webhook(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    s = await get_or_create_settings(db)
    if not s.token:
        raise HTTPException(status_code=400, detail="Bot token sozlanmagan")

    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{s.token}/deleteWebhook",
            timeout=10,
        )
        result = resp.json()
        return WebhookSetupResponse(
            success=result.get("ok", False),
            message=result.get("description", "OK"),
        )


@router.get("/users")
async def list_bot_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    is_registered: bool | None = Query(None),
    district_id: int | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    q = (
        select(BotUser)
        .options(selectinload(BotUser.district))
        .order_by(BotUser.created_at.desc())
    )
    count_q = select(func.count()).select_from(BotUser)

    if is_registered is not None:
        q = q.where(BotUser.is_registered == is_registered)
        count_q = count_q.where(BotUser.is_registered == is_registered)
    if district_id:
        q = q.where(BotUser.district_id == district_id)
        count_q = count_q.where(BotUser.district_id == district_id)
    if search:
        like = f"%{search}%"
        q = q.where(BotUser.fio.like(like) | BotUser.phone.like(like))

    total = (await db.execute(count_q)).scalar()
    result = await db.execute(q.offset((page - 1) * size).limit(size))
    users = result.scalars().all()

    return {
        "items": [
            {
                "id": u.id,
                "telegram_id": u.telegram_id,
                "username": u.username,
                "fio": u.fio,
                "phone": u.phone,
                "extra_phone": u.extra_phone,
                "language": u.language,
                "district_name": u.district.name if u.district else None,
                "is_registered": u.is_registered,
                "is_blocked": u.is_blocked,
                "created_at": u.created_at,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 1,
    }


@router.put("/users/{user_id}/block")
async def toggle_block_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(select(BotUser).where(BotUser.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_blocked = not u.is_blocked
    await db.flush()
    return {"is_blocked": u.is_blocked}


@router.post("/broadcast", response_model=BroadcastResult)
async def broadcast(
    data: BroadcastMessage,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    settings = await get_or_create_settings(db)
    if not settings.token:
        raise HTTPException(status_code=400, detail="Bot token sozlanmagan")

    q = select(BotUser).where(
        BotUser.telegram_id.isnot(None),
        BotUser.is_blocked == False,
    )
    if data.district_id:
        q = q.where(BotUser.district_id == data.district_id)

    result = await db.execute(q)
    users = result.scalars().all()

    sent = failed = 0
    import httpx
    async with httpx.AsyncClient() as client:
        for user in users:
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{settings.token}/sendMessage",
                    json={"chat_id": user.telegram_id, "text": data.message, "parse_mode": "HTML"},
                    timeout=5,
                )
                if resp.json().get("ok"):
                    sent += 1
                else:
                    failed += 1
            except Exception:
                failed += 1

    return BroadcastResult(sent=sent, failed=failed, total=len(users))
