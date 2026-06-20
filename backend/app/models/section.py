from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from app.core.database import Base


class Bolim(Base):
    """Top-level department that groups related Toifalar (Sections).
    Example: "Bolalar shuʼbasi" groups NBSH, Yetim bolalar, etc.
    """
    __tablename__ = "bolimlar"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)       # Short: Bolalar
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Full name
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    sections: Mapped[list["Section"]] = relationship("Section", back_populates="bolim")


class Section(Base):
    """Dynamic section - e.g. NBSH, Bolalar nafaqasi, etc."""
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)          # Short: NBSH
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)     # Full: Nogironligi bo'lgan shaxslar
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)     # emoji or icon name
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)    # tailwind color class
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    bolim_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("bolimlar.id"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    columns: Mapped[list["SectionColumn"]] = relationship(
        "SectionColumn", back_populates="section",
        cascade="all, delete", order_by="SectionColumn.order"
    )
    rows: Mapped[list["SectionRow"]] = relationship(
        "SectionRow", back_populates="section", cascade="all, delete"
    )
    bolim: Mapped[Optional["Bolim"]] = relationship("Bolim", back_populates="sections")


class SectionColumn(Base):
    """Columns for a section (dynamic schema)"""
    __tablename__ = "section_columns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    section_id: Mapped[int] = mapped_column(Integer, ForeignKey("sections.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)          # slug/key for API
    data_type: Mapped[str] = mapped_column(String(20), default="text")     # text, number, date
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)      # table column width px

    section: Mapped["Section"] = relationship("Section", back_populates="columns")
    cells: Mapped[list["SectionCell"]] = relationship(
        "SectionCell", back_populates="column", cascade="all, delete"
    )


class SectionRow(Base):
    """One data record in a section"""
    __tablename__ = "section_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    section_id: Mapped[int] = mapped_column(Integer, ForeignKey("sections.id"), nullable=False)
    district_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("districts.id"), nullable=True)
    period_year: Mapped[int | None] = mapped_column(Integer, nullable=True)   # e.g. 2024
    period_month: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-12, None = annual
    mfy_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    section: Mapped["Section"] = relationship("Section", back_populates="rows")
    district: Mapped["District"] = relationship("District", back_populates="section_rows")
    cells: Mapped[list["SectionCell"]] = relationship(
        "SectionCell", back_populates="row", cascade="all, delete"
    )


class SectionCell(Base):
    """Cell value: row x column"""
    __tablename__ = "section_cells"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    row_id: Mapped[int] = mapped_column(Integer, ForeignKey("section_rows.id"), nullable=False)
    column_id: Mapped[int] = mapped_column(Integer, ForeignKey("section_columns.id"), nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)

    row: Mapped["SectionRow"] = relationship("SectionRow", back_populates="cells")
    column: Mapped["SectionColumn"] = relationship("SectionColumn", back_populates="cells")
