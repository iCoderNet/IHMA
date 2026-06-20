import re
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.core.database import get_db
from app.core.dependencies import get_admin_or_superadmin
from app.models.user import User
from app.models.section import Section, SectionRow, SectionCell, SectionColumn
from app.models.appeal import Appeal, AppealStatus
from app.models.bot_user import BotUser
from app.models.district import District
from app.models.section import Bolim

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_or_superadmin),
):
    # Total sections
    sections_count = (await db.execute(
        select(func.count()).select_from(Section).where(Section.is_active == True)
    )).scalar()

    # Total records across all sections
    records_count = (await db.execute(
        select(func.count()).select_from(SectionRow)
    )).scalar()

    # Appeals by status
    appeal_stats = {}
    for s in AppealStatus:
        cnt = (await db.execute(
            select(func.count()).select_from(Appeal).where(Appeal.status == s)
        )).scalar()
        appeal_stats[s.value] = cnt

    # Bot users
    bot_users_total = (await db.execute(
        select(func.count()).select_from(BotUser).where(BotUser.is_registered == True)
    )).scalar()

    # Districts count
    districts_count = (await db.execute(
        select(func.count()).select_from(District)
    )).scalar()

    # Sections with row counts
    sections_result = await db.execute(
        select(Section).where(Section.is_active == True).order_by(Section.order)
    )
    sections = sections_result.scalars().all()

    section_stats = []
    for sec in sections:
        cnt = (await db.execute(
            select(func.count()).select_from(SectionRow).where(SectionRow.section_id == sec.id)
        )).scalar()
        section_stats.append({
            "id": sec.id,
            "name": sec.name,
            "full_name": sec.full_name,
            "icon": sec.icon,
            "color": sec.color,
            "count": cnt,
        })

    # Recent appeals
    recent_appeals_result = await db.execute(
        select(Appeal).order_by(Appeal.created_at.desc()).limit(5)
    )
    recent_appeals = recent_appeals_result.scalars().all()

    return {
        "sections_count": sections_count,
        "records_count": records_count,
        "appeal_stats": appeal_stats,
        "bot_users_total": bot_users_total,
        "districts_count": districts_count,
        "section_stats": section_stats,
        "recent_appeals": [
            {
                "id": a.id,
                "subject": a.subject,
                "status": a.status,
                "created_at": a.created_at,
            }
            for a in recent_appeals
        ],
    }


@router.get("/analytics")
async def dashboard_analytics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_or_superadmin),
):
    """District × Section matrix for admin analytics dashboard."""
    # All active sections ordered
    sections = (await db.execute(
        select(Section).where(Section.is_active == True).order_by(Section.order, Section.id)
    )).scalars().all()

    # All districts ordered
    districts = (await db.execute(
        select(District).order_by(District.name)
    )).scalars().all()

    # Row counts per (district_id, section_id)
    counts_result = await db.execute(
        select(SectionRow.district_id, SectionRow.section_id, func.count().label("cnt"))
        .group_by(SectionRow.district_id, SectionRow.section_id)
    )
    counts = {(r.district_id, r.section_id): r.cnt for r in counts_result}

    # Person counts: sum values of number-typed columns per (district_id, section_id)
    cells_result = await db.execute(
        select(
            SectionRow.district_id,
            SectionRow.section_id,
            SectionCell.value,
        )
        .join(SectionCell, SectionCell.row_id == SectionRow.id)
        .join(SectionColumn, SectionColumn.id == SectionCell.column_id)
        .where(SectionColumn.data_type == "number")
    )
    person_sums: dict[tuple, int] = {}
    for r in cells_result:
        if r.value and r.value.strip():
            try:
                num = float(re.sub(r"[\s,]", "", r.value))
                key = (r.district_id, r.section_id)
                person_sums[key] = person_sums.get(key, 0) + int(num)
            except ValueError:
                pass

    # Build district rows
    district_rows = []
    for d in districts:
        section_data = []
        total = 0
        persons_total = 0
        for s in sections:
            cnt = counts.get((d.id, s.id), 0)
            persons = person_sums.get((d.id, s.id), 0)
            total += cnt
            persons_total += persons
            section_data.append({"id": s.id, "name": s.name, "count": cnt, "persons": persons})
        district_rows.append({
            "id": d.id,
            "name": d.name,
            "total": total,
            "persons_total": persons_total,
            "sections": section_data,
        })

    # Section totals (sum across all districts)
    section_totals = []
    for s in sections:
        total = sum(counts.get((d.id, s.id), 0) for d in districts)
        persons = sum(person_sums.get((d.id, s.id), 0) for d in districts)
        section_totals.append({
            "id": s.id,
            "name": s.name,
            "full_name": s.full_name,
            "icon": s.icon,
            "color": s.color,
            "total": total,          # MFY row count
            "persons": persons,      # actual person/beneficiary count
        })

    # Appeal stats
    appeal_stats = {}
    for status in AppealStatus:
        appeal_stats[status.value] = (await db.execute(
            select(func.count()).select_from(Appeal).where(Appeal.status == status)
        )).scalar()

    # Bot users
    bot_users = (await db.execute(
        select(func.count()).select_from(BotUser).where(BotUser.is_registered == True)
    )).scalar()

    total_persons = sum(d["persons_total"] for d in district_rows)
    return {
        "districts": district_rows,
        "sections": section_totals,
        "appeal_stats": appeal_stats,
        "bot_users": bot_users,
        "total_records": sum(d["total"] for d in district_rows),
        "total_persons": total_persons,
        "covered_districts": sum(1 for d in district_rows if d["total"] > 0),
    }


@router.get("/analytics/v2")
async def analytics_v2(
    district_id: int | None = Query(None),
    period_year: int | None = Query(None),
    period_month: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_or_superadmin),
):
    """
    Analytics with period + district filters.
    Uses 'jami' key column to get real person totals.
    Returns bolim → section → district breakdown.
    """
    # All active bolimlar
    bolimlar = (await db.execute(
        select(Bolim).where(Bolim.is_active == True).order_by(Bolim.order, Bolim.id)
    )).scalars().all()

    # All active sections
    sections = (await db.execute(
        select(Section).where(Section.is_active == True).order_by(Section.order, Section.id)
    )).scalars().all()

    # All districts
    districts = (await db.execute(
        select(District).order_by(District.name)
    )).scalars().all()

    # Available periods
    periods_q = (await db.execute(
        select(SectionRow.period_year, SectionRow.period_month)
        .where(SectionRow.period_year.is_not(None))
        .distinct()
        .order_by(SectionRow.period_year.desc(), SectionRow.period_month.desc())
    )).fetchall()
    available_periods = [
        {"year": r.period_year, "month": r.period_month}
        for r in periods_q if r.period_year is not None
    ]

    # Build WHERE conditions for jami cells
    conditions = [SectionColumn.key == 'jami']
    if district_id is not None:
        conditions.append(SectionRow.district_id == district_id)
    if period_year is not None:
        conditions.append(SectionRow.period_year == period_year)
    if period_month is not None:
        conditions.append(SectionRow.period_month == period_month)

    # Fetch jami cell values grouped by (district_id, section_id)
    rows_q = (
        select(
            SectionRow.district_id,
            SectionRow.section_id,
            SectionCell.value,
        )
        .join(SectionCell, SectionCell.row_id == SectionRow.id)
        .join(SectionColumn, SectionColumn.id == SectionCell.column_id)
        .where(*conditions)
    )
    raw_rows = (await db.execute(rows_q)).fetchall()

    # Sum values per (district_id, section_id)
    totals: dict[tuple[int | None, int], int] = {}
    for r in raw_rows:
        if r.value and str(r.value).strip():
            try:
                v = int(float(re.sub(r"[\s,]", "", str(r.value))))
                key = (r.district_id, r.section_id)
                totals[key] = totals.get(key, 0) + v
            except (ValueError, TypeError):
                pass

    # Build bolimlar output
    bolim_output = []
    for b in bolimlar:
        b_sections = [s for s in sections if s.bolim_id == b.id]
        if not b_sections:
            continue

        sections_out = []
        for s in b_sections:
            total = sum(totals.get((d.id, s.id), 0) for d in districts)
            per_district = sorted(
                [
                    {
                        "district_id": d.id,
                        "district_name": d.name,
                        "total": totals.get((d.id, s.id), 0),
                    }
                    for d in districts
                ],
                key=lambda x: x["total"],
                reverse=True,
            )
            sections_out.append({
                "id": s.id,
                "name": s.name,
                "full_name": s.full_name,
                "icon": s.icon,
                "color": s.color,
                "total": total,
                "per_district": per_district,
            })

        bolim_total = sum(s["total"] for s in sections_out)
        bolim_output.append({
            "id": b.id,
            "name": b.name,
            "full_name": b.full_name,
            "icon": b.icon,
            "color": b.color,
            "total": bolim_total,
            "sections": sections_out,
        })

    # District totals (for map coloring)
    district_totals = []
    for d in districts:
        total = sum(totals.get((d.id, s.id), 0) for s in sections)
        district_totals.append({"id": d.id, "name": d.name, "total": total})

    grand_total = sum(dt["total"] for dt in district_totals)

    # Appeal stats
    appeal_stats: dict[str, int] = {}
    for status in AppealStatus:
        appeal_stats[status.value] = (await db.execute(
            select(func.count()).select_from(Appeal).where(Appeal.status == status)
        )).scalar() or 0

    # Bot users
    bot_users = (await db.execute(
        select(func.count()).select_from(BotUser).where(BotUser.is_registered == True)
    )).scalar() or 0

    return {
        "bolimlar": bolim_output,
        "district_totals": district_totals,
        "grand_total": grand_total,
        "active_districts": sum(1 for dt in district_totals if dt["total"] > 0),
        "appeal_stats": appeal_stats,
        "bot_users": bot_users,
        "available_periods": available_periods,
    }
