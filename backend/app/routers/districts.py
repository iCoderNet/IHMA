from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.core.database import get_db
from app.models.district import District, MFY
from app.models.user import User
from app.core.dependencies import get_current_user, get_superadmin

router = APIRouter(prefix="/districts", tags=["districts"])


class DistrictCreate(BaseModel):
    name: str
    name_ru: str | None = None


class DistrictOut(BaseModel):
    id: int
    name: str
    name_ru: str | None = None

    class Config:
        from_attributes = True


class MFYCreate(BaseModel):
    name: str
    district_id: int


class MFYOut(BaseModel):
    id: int
    name: str
    district_id: int

    class Config:
        from_attributes = True


@router.get("", response_model=list[DistrictOut])
async def list_districts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(District).order_by(District.name))
    return result.scalars().all()


@router.post("", response_model=DistrictOut, status_code=201)
async def create_district(
    data: DistrictCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    d = District(name=data.name, name_ru=data.name_ru)
    db.add(d)
    await db.flush()
    await db.refresh(d)
    return d


@router.put("/{district_id}", response_model=DistrictOut)
async def update_district(
    district_id: int,
    data: DistrictCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(select(District).where(District.id == district_id))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="District not found")
    d.name = data.name
    d.name_ru = data.name_ru
    await db.flush()
    await db.refresh(d)
    return d


@router.delete("/{district_id}", status_code=204)
async def delete_district(
    district_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(select(District).where(District.id == district_id))
    d = result.scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="District not found")
    await db.delete(d)


@router.get("/{district_id}/mfys", response_model=list[MFYOut])
async def list_mfys(
    district_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(MFY).where(MFY.district_id == district_id).order_by(MFY.name))
    return result.scalars().all()


@router.get("/{district_id}/stats")
async def get_district_stats(
    district_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.appeal import Appeal, AppealStatus
    from app.models.bot_user import BotUser
    from app.models.section import Section, SectionRow, SectionCell, SectionColumn

    d = (await db.execute(select(District).where(District.id == district_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="District not found")

    appeals_total = (await db.execute(
        select(func.count()).select_from(Appeal).where(Appeal.district_id == district_id)
    )).scalar()
    appeals_new = (await db.execute(
        select(func.count()).select_from(Appeal).where(
            Appeal.district_id == district_id, Appeal.status == AppealStatus.NEW
        )
    )).scalar()
    appeals_resolved = (await db.execute(
        select(func.count()).select_from(Appeal).where(
            Appeal.district_id == district_id, Appeal.status == AppealStatus.RESOLVED
        )
    )).scalar()
    bot_users = (await db.execute(
        select(func.count()).select_from(BotUser).where(
            BotUser.district_id == district_id, BotUser.is_registered == True
        )
    )).scalar()

    # Per-section record counts
    sections = (await db.execute(
        select(Section).where(Section.is_active == True).order_by(Section.order)
    )).scalars().all()
    section_stats = []
    for s in sections:
        cnt = (await db.execute(
            select(func.count()).select_from(SectionRow).where(
                SectionRow.section_id == s.id,
                SectionRow.district_id == district_id,
            )
        )).scalar()
        section_stats.append({"id": s.id, "name": s.name, "icon": s.icon, "color": s.color, "count": cnt})

    return {
        "district": {"id": d.id, "name": d.name},
        "appeals": {"total": appeals_total, "new": appeals_new, "resolved": appeals_resolved},
        "bot_users": bot_users,
        "sections": section_stats,
    }


@router.post("/mfys", response_model=MFYOut, status_code=201)
async def create_mfy(
    data: MFYCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    mfy = MFY(name=data.name, district_id=data.district_id)
    db.add(mfy)
    await db.flush()
    await db.refresh(mfy)
    return mfy
