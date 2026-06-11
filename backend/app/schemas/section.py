from pydantic import BaseModel
from typing import Any
from datetime import datetime


class ColumnCreate(BaseModel):
    name: str
    key: str | None = None  # optional — backend slugify(name) ishlatadi
    data_type: str = "text"
    order: int = 0
    is_required: bool = False
    width: int | None = None


class ColumnOut(BaseModel):
    id: int
    name: str
    key: str
    data_type: str
    order: int
    is_required: bool
    is_visible: bool
    width: int | None = None

    class Config:
        from_attributes = True


class ColumnUpdate(BaseModel):
    name: str | None = None
    data_type: str | None = None
    order: int | None = None
    is_required: bool | None = None
    is_visible: bool | None = None
    width: int | None = None


class SectionCreate(BaseModel):
    name: str
    full_name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    order: int = 0


class SectionOut(BaseModel):
    id: int
    name: str
    full_name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    order: int
    is_active: bool
    created_at: datetime
    columns: list[ColumnOut] = []

    class Config:
        from_attributes = True


class SectionUpdate(BaseModel):
    name: str | None = None
    full_name: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    order: int | None = None
    is_active: bool | None = None


class RowData(BaseModel):
    district_id: int | None = None
    cells: dict[str, Any]  # {column_key: value}


class RowOut(BaseModel):
    id: int
    section_id: int
    district_id: int | None = None
    district_name: str | None = None
    order: int
    cells: dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class ExcelImportConfig(BaseModel):
    district_id: int
    skip_rows: int = 0              # rows to skip at top
    header_row: int = 0             # 0-indexed row with headers (after skip)
    skip_columns: list[int] = []    # column indices to skip
    column_mapping: dict[str, str] = {}  # excel_col_index -> column_key


class ImportPreviewRow(BaseModel):
    index: int
    data: list[str | None]


class ImportPreview(BaseModel):
    total_rows: int
    headers: list[str | None]
    preview_rows: list[ImportPreviewRow]
    sheet_names: list[str]
