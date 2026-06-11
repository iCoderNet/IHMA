from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean, BigInteger, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from app.core.database import Base


class BotLanguage(str, enum.Enum):
    UZ = "uz"
    RU = "ru"


class BotRegistrationStep(str, enum.Enum):
    START = "start"
    LANG = "lang"
    FIO = "fio"
    DISTRICT = "district"
    PHONE = "phone"
    EXTRA_PHONE = "extra_phone"
    DONE = "done"


class BotUser(Base):
    __tablename__ = "bot_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    extra_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    language: Mapped[BotLanguage] = mapped_column(
        String(5), default=BotLanguage.UZ
    )
    district_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("districts.id"), nullable=True)
    registration_step: Mapped[str] = mapped_column(String(500), default=BotRegistrationStep.START)
    is_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    district: Mapped["District"] = relationship("District")
    appeals: Mapped[list["Appeal"]] = relationship("Appeal", back_populates="bot_user")


class BotSettings(Base):
    __tablename__ = "bot_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
