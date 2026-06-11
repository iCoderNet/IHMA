from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
import math

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_admin_or_superadmin
from app.models.user import User
from app.models.appeal import Appeal, AppealStatus
from app.models.bot_user import BotUser
from app.schemas.appeal import AppealOut, AppealStatusUpdate, AppealListResponse

router = APIRouter(prefix="/appeals", tags=["appeals"])


def appeal_to_out(a: Appeal) -> dict:
    return {
        "id": a.id,
        "subject": a.subject,
        "message": a.message,
        "status": a.status,
        "admin_response": a.admin_response,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
        "bot_user_fio": a.bot_user.fio if a.bot_user else None,
        "bot_user_phone": a.bot_user.phone if a.bot_user else None,
        "district_name": a.district.name if a.district else None,
    }


@router.get("", response_model=AppealListResponse)
async def list_appeals(
    status: AppealStatus | None = Query(None),
    district_id: int | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_or_superadmin),
):
    q = (
        select(Appeal)
        .options(selectinload(Appeal.bot_user), selectinload(Appeal.district))
        .order_by(Appeal.created_at.desc())
    )
    count_q = select(func.count()).select_from(Appeal)

    if status:
        q = q.where(Appeal.status == status)
        count_q = count_q.where(Appeal.status == status)
    if district_id:
        q = q.where(Appeal.district_id == district_id)
        count_q = count_q.where(Appeal.district_id == district_id)
    if search:
        like = f"%{search}%"
        q = q.where(Appeal.subject.like(like) | Appeal.message.like(like))
        count_q = count_q.where(Appeal.subject.like(like) | Appeal.message.like(like))

    total = (await db.execute(count_q)).scalar()
    result = await db.execute(q.offset((page - 1) * size).limit(size))
    items = result.scalars().all()

    return {
        "items": [appeal_to_out(a) for a in items],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 1,
    }


@router.get("/{appeal_id}")
async def get_appeal(
    appeal_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_or_superadmin),
):
    result = await db.execute(
        select(Appeal)
        .where(Appeal.id == appeal_id)
        .options(selectinload(Appeal.bot_user), selectinload(Appeal.district))
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Appeal not found")
    return appeal_to_out(a)


@router.put("/{appeal_id}/status")
async def update_appeal_status(
    appeal_id: int,
    data: AppealStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_admin_or_superadmin),
):
    result = await db.execute(
        select(Appeal)
        .where(Appeal.id == appeal_id)
        .options(selectinload(Appeal.bot_user), selectinload(Appeal.district))
    )
    appeal = result.scalar_one_or_none()
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")

    old_status = appeal.status
    appeal.status = data.status
    if data.admin_response:
        appeal.admin_response = data.admin_response
    appeal.responded_by = current.id
    appeal.responded_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(appeal)  # reload server-side updated_at

    # Send Telegram notification if status changed
    if old_status != data.status and appeal.bot_user:
        try:
            from app.services.telegram import send_appeal_status_notification
            await send_appeal_status_notification(appeal)
        except Exception:
            pass  # Don't fail if notification fails

    return appeal_to_out(appeal)


@router.get("/stats/summary")
async def appeals_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_or_superadmin),
):
    stats = {}
    for s in AppealStatus:
        count = (await db.execute(
            select(func.count()).select_from(Appeal).where(Appeal.status == s)
        )).scalar()
        stats[s.value] = count
    stats["total"] = sum(stats.values())
    return stats
