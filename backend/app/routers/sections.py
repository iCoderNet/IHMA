"""Dynamic sections CRUD + Excel import/export."""
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
import json

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_superadmin
from app.models.user import User
from app.models.section import Section, SectionColumn, SectionRow, SectionCell, Bolim
from app.models.district import District
from app.schemas.section import (
    BolimOut,
    SectionCreate, SectionOut, SectionUpdate,
    ColumnCreate, ColumnOut, ColumnUpdate,
    RowData, RowOut, ImportPreview,
)
from app.services.excel import (
    read_excel_preview, import_excel_rows,
    export_section_to_excel, generate_import_template, slugify,
)

router = APIRouter(prefix="/sections", tags=["sections"])


def row_to_out(row: SectionRow, columns: list[SectionColumn]) -> dict:
    cells = {cell.column.key: cell.value for cell in row.cells if cell.column}
    return {
        "id": row.id,
        "section_id": row.section_id,
        "district_id": row.district_id,
        "district_name": row.district.name if row.district else None,
        "mfy_name": row.mfy_name,
        "period_year": row.period_year,
        "period_month": row.period_month,
        "order": row.order,
        "cells": cells,
        "created_at": row.created_at,
    }


# ── Sections ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SectionOut])
async def list_sections(
    bolim_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        select(Section)
        .where(Section.is_active == True)
        .options(selectinload(Section.columns))
        .order_by(Section.order, Section.id)
    )
    if bolim_id is not None:
        q = q.where(Section.bolim_id == bolim_id)
    sections = (await db.execute(q)).scalars().all()

    # Inject bolim_name
    bolim_ids = {s.bolim_id for s in sections if s.bolim_id}
    bolim_map: dict[int, str] = {}
    if bolim_ids:
        bolimlar = (await db.execute(
            select(Bolim).where(Bolim.id.in_(bolim_ids))
        )).scalars().all()
        bolim_map = {b.id: b.name for b in bolimlar}

    result = []
    for s in sections:
        out = SectionOut.model_validate(s)
        out.bolim_name = bolim_map.get(s.bolim_id) if s.bolim_id else None
        result.append(out)
    return result


@router.post("", response_model=SectionOut, status_code=201)
async def create_section(
    data: SectionCreate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_superadmin),
):
    section = Section(**data.model_dump(), created_by=current.id)
    db.add(section)
    await db.flush()
    result2 = await db.execute(
        select(Section).where(Section.id == section.id).options(selectinload(Section.columns))
    )
    return result2.scalar_one()


@router.get("/{section_id}", response_model=SectionOut)
async def get_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Section)
        .where(Section.id == section_id)
        .options(selectinload(Section.columns))
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    return s


@router.put("/{section_id}", response_model=SectionOut)
async def update_section(
    section_id: int,
    data: SectionUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(
        select(Section).where(Section.id == section_id).options(selectinload(Section.columns))
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.flush()
    result2 = await db.execute(
        select(Section).where(Section.id == s.id).options(selectinload(Section.columns))
    )
    return result2.scalar_one()


@router.delete("/{section_id}", status_code=204)
async def delete_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(select(Section).where(Section.id == section_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(s)


# ── Columns ───────────────────────────────────────────────────────────────────

@router.post("/{section_id}/columns", response_model=ColumnOut, status_code=201)
async def add_column(
    section_id: int,
    data: ColumnCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(select(Section).where(Section.id == section_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Section not found")

    key = slugify(data.key or data.name)
    col = SectionColumn(section_id=section_id, **{**data.model_dump(), "key": key})
    db.add(col)
    await db.flush()
    await db.refresh(col)
    return col


@router.put("/{section_id}/columns/{col_id}", response_model=ColumnOut)
async def update_column(
    section_id: int, col_id: int,
    data: ColumnUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(
        select(SectionColumn).where(SectionColumn.id == col_id, SectionColumn.section_id == section_id)
    )
    col = result.scalar_one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(col, k, v)
    await db.flush()
    await db.refresh(col)
    return col


@router.delete("/{section_id}/columns/{col_id}", status_code=204)
async def delete_column(
    section_id: int, col_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_superadmin),
):
    result = await db.execute(
        select(SectionColumn).where(SectionColumn.id == col_id, SectionColumn.section_id == section_id)
    )
    col = result.scalar_one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    await db.delete(col)


# ── Rows (CRUD) ───────────────────────────────────────────────────────────────

@router.get("/{section_id}/rows")
async def list_rows(
    section_id: int,
    district_id: int | None = Query(None),
    period_year: int | None = Query(None),
    period_month: int | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Load columns
    cols_result = await db.execute(
        select(SectionColumn)
        .where(SectionColumn.section_id == section_id, SectionColumn.is_visible == True)
        .order_by(SectionColumn.order)
    )
    columns = cols_result.scalars().all()

    q = (
        select(SectionRow)
        .where(SectionRow.section_id == section_id)
        .options(
            selectinload(SectionRow.cells).selectinload(SectionCell.column),
            selectinload(SectionRow.district),
        )
        .order_by(SectionRow.order, SectionRow.id)
    )
    if district_id:
        q = q.where(SectionRow.district_id == district_id)
    if period_year is not None:
        q = q.where(SectionRow.period_year == period_year)
    if period_month is not None:
        q = q.where(SectionRow.period_month == period_month)
    if search:
        from sqlalchemy import or_
        term = f"%{search}%"
        dist_subq = select(District.id).where(District.name.ilike(term)).scalar_subquery()
        q = q.where(or_(
            SectionRow.mfy_name.ilike(term),
            SectionRow.district_id.in_(dist_subq),
        ))

    from sqlalchemy import func
    count_q = select(func.count()).select_from(SectionRow).where(SectionRow.section_id == section_id)
    if district_id:
        count_q = count_q.where(SectionRow.district_id == district_id)
    if period_year is not None:
        count_q = count_q.where(SectionRow.period_year == period_year)
    if period_month is not None:
        count_q = count_q.where(SectionRow.period_month == period_month)
    if search:
        from sqlalchemy import or_
        term = f"%{search}%"
        dist_subq = select(District.id).where(District.name.ilike(term)).scalar_subquery()
        count_q = count_q.where(or_(
            SectionRow.mfy_name.ilike(term),
            SectionRow.district_id.in_(dist_subq),
        ))
    total = (await db.execute(count_q)).scalar()

    q = q.offset((page - 1) * size).limit(size)
    result = await db.execute(q)
    rows = result.scalars().all()

    import math
    return {
        "items": [row_to_out(r, columns) for r in rows],
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 1,
        "columns": [{"id": c.id, "key": c.key, "name": c.name, "data_type": c.data_type} for c in columns],
    }


@router.post("/{section_id}/rows", status_code=201)
async def create_row(
    section_id: int,
    data: RowData,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Validate columns
    cols_result = await db.execute(
        select(SectionColumn).where(SectionColumn.section_id == section_id)
    )
    columns = {c.key: c for c in cols_result.scalars().all()}

    row = SectionRow(section_id=section_id, district_id=data.district_id)
    db.add(row)
    await db.flush()

    for key, value in data.cells.items():
        if key in columns:
            cell = SectionCell(row_id=row.id, column_id=columns[key].id, value=str(value) if value is not None else None)
            db.add(cell)

    await db.flush()
    return {"id": row.id, "message": "Row created"}


@router.put("/{section_id}/rows/{row_id}", status_code=200)
async def update_row(
    section_id: int, row_id: int,
    data: RowData,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SectionRow)
        .where(SectionRow.id == row_id, SectionRow.section_id == section_id)
        .options(selectinload(SectionRow.cells))
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")

    cols_result = await db.execute(
        select(SectionColumn).where(SectionColumn.section_id == section_id)
    )
    columns = {c.key: c for c in cols_result.scalars().all()}

    if data.district_id is not None:
        row.district_id = data.district_id

    existing_cells = {cell.column_id: cell for cell in row.cells}

    for key, value in data.cells.items():
        if key in columns:
            col = columns[key]
            if col.id in existing_cells:
                existing_cells[col.id].value = str(value) if value is not None else None
            else:
                db.add(SectionCell(row_id=row.id, column_id=col.id, value=str(value) if value is not None else None))

    await db.flush()
    return {"message": "Row updated"}


@router.delete("/{section_id}/rows/{row_id}", status_code=204)
async def delete_row(
    section_id: int, row_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SectionRow).where(SectionRow.id == row_id, SectionRow.section_id == section_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    await db.delete(row)


# ── Excel ─────────────────────────────────────────────────────────────────────

@router.post("/{section_id}/excel/preview", response_model=ImportPreview)
async def preview_excel(
    section_id: int,
    file: UploadFile = File(...),
    sheet_index: int = Form(0),
    _: User = Depends(get_current_user),
):
    content = await file.read()
    try:
        preview = read_excel_preview(content, sheet_index)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel read error: {str(e)}")
    return preview


@router.post("/{section_id}/excel/import")
async def import_excel(
    section_id: int,
    file: UploadFile = File(...),
    district_id: int = Form(...),
    sheet_index: int = Form(0),
    skip_rows: int = Form(0),
    header_row: int = Form(0),
    header_rows: int = Form(1),
    skip_columns: str = Form("[]"),        # JSON array of col indices
    column_mapping: str = Form("{}"),      # JSON {col_index: column_key}
    period_year: int | None = Form(None),
    period_month: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        skip_cols = json.loads(skip_columns)
        col_map = {int(k): v for k, v in json.loads(column_mapping).items()}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON params")

    content = await file.read()
    try:
        rows_data = import_excel_rows(content, sheet_index, skip_rows, header_row, header_rows, skip_cols, col_map)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import error: {str(e)}")

    # Load columns
    cols_result = await db.execute(
        select(SectionColumn).where(SectionColumn.section_id == section_id)
    )
    columns = {c.key: c for c in cols_result.scalars().all()}

    created = 0
    for row_data in rows_data:
        row = SectionRow(section_id=section_id, district_id=district_id, order=created, period_year=period_year, period_month=period_month)
        db.add(row)
        await db.flush()
        for key, value in row_data.items():
            if key in columns:
                db.add(SectionCell(row_id=row.id, column_id=columns[key].id, value=value))
        created += 1

    return {"imported": created, "message": f"{created} ta qator muvaffaqiyatli import qilindi"}


@router.get("/{section_id}/excel/export")
async def export_excel(
    section_id: int,
    district_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Section with columns
    result = await db.execute(
        select(Section)
        .where(Section.id == section_id)
        .options(selectinload(Section.columns))
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    visible_cols = [c for c in section.columns if c.is_visible]
    visible_cols.sort(key=lambda c: c.order)

    # Rows
    q = (
        select(SectionRow)
        .where(SectionRow.section_id == section_id)
        .options(
            selectinload(SectionRow.cells).selectinload(SectionCell.column),
            selectinload(SectionRow.district),
        )
        .order_by(SectionRow.order)
    )
    if district_id:
        q = q.where(SectionRow.district_id == district_id)

    rows_result = await db.execute(q)
    rows = rows_result.scalars().all()
    rows_out = [row_to_out(r, visible_cols) for r in rows]

    cols_data = [{"key": c.key, "name": c.name} for c in visible_cols]
    excel_bytes = export_section_to_excel(section.full_name, cols_data, rows_out)

    filename = f"{section.name}_export.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{section_id}/excel/template")
async def download_template(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Section)
        .where(Section.id == section_id)
        .options(selectinload(Section.columns))
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    visible_cols = sorted([c for c in section.columns if c.is_visible], key=lambda c: c.order)
    cols_data = [{"key": c.key, "name": c.name, "data_type": c.data_type} for c in visible_cols]
    tpl_bytes = generate_import_template(cols_data)

    return StreamingResponse(
        io.BytesIO(tpl_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{section.name}_template.xlsx"'},
    )
