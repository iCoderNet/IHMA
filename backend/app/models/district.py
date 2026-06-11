from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
from app.core.database import Base


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_ru: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    mfys: Mapped[list["MFY"]] = relationship("MFY", back_populates="district", cascade="all, delete")
    admins: Mapped[list["User"]] = relationship("User", back_populates="district")
    section_rows: Mapped[list["SectionRow"]] = relationship("SectionRow", back_populates="district")


class MFY(Base):
    __tablename__ = "mfys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    district_id: Mapped[int] = mapped_column(Integer, ForeignKey("districts.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    district: Mapped["District"] = relationship("District", back_populates="mfys")
