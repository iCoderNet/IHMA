"""Bo'lim (top-level department) CRUD — groups related Toifalar (Sections)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_superadmin
from app.models.section import Bolim, Section
from app.models.user import User
from app.schemas.section import BolimCreate, BolimOut, BolimUpdate, BolimWithSections

router = APIRouter(prefix="/bolimlar", tags=["bolimlar"])


@router.get("", response_model=list[BolimWithSections])
async def list_bolimlar(
    db: AsyncSession = Depends(get_db),
):
    """List all Bo'limlar with their Toifalar (sections)."""
    result = await db.execute(
        select(Bolim)
        .options(selectinload(Bolim.sections))
        .where(Bolim.is_active == True)
        .order_by(Bolim.order, Bolim.id)
    )
    bolimlar = result.scalars().all()
    out = []
    for b in bolimlar:
        sections_out = [
            {
                "id": s.id, "name": s.name, "full_name": s.full_name,
                "description": s.description, "icon": s.icon, "color": s.color,
                "order": s.order, "is_active": s.is_active,
                "bolim_id": s.bolim_id, "bolim_name": b.name,
                "created_at": s.created_at, "columns": [],
            }
            for s in sorted(b.sections, key=lambda x: x.order)
            if s.is_active
        ]
        out.append({
            "id": b.id, "name": b.name, "full_name": b.full_name,
            "description": b.description, "icon": b.icon, "color": b.color,
            "order": b.order, "is_active": b.is_active,
            "sections": sections_out,
        })
    return out


@router.post("", status_code=201)
async def create_bolim(
    data: BolimCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    bolim = Bolim(**data.model_dump())
    db.add(bolim)
    await db.commit()
    await db.refresh(bolim)
    return {"id": bolim.id, "message": "Bo'lim yaratildi"}


@router.put("/{bolim_id}", status_code=200)
async def update_bolim(
    bolim_id: int,
    data: BolimUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    bolim = (await db.execute(
        select(Bolim).where(Bolim.id == bolim_id)
    )).scalar_one_or_none()
    if not bolim:
        raise HTTPException(404, "Bo'lim topilmadi")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(bolim, field, value)
    await db.commit()
    return {"message": "Saqlandi"}


@router.delete("/{bolim_id}", status_code=204)
async def delete_bolim(
    bolim_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    bolim = (await db.execute(
        select(Bolim).where(Bolim.id == bolim_id)
    )).scalar_one_or_none()
    if not bolim:
        raise HTTPException(404, "Bo'lim topilmadi")
    # Unlink sections instead of cascade-deleting them
    await db.execute(
        select(Section).where(Section.bolim_id == bolim_id)
    )
    sections = (await db.execute(
        select(Section).where(Section.bolim_id == bolim_id)
    )).scalars().all()
    for s in sections:
        s.bolim_id = None
    await db.delete(bolim)
    await db.commit()
