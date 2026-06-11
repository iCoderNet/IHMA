from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum
from app.core.database import Base


class AppealStatus(str, enum.Enum):
    NEW = "new"
    IN_REVIEW = "in_review"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class Appeal(Base):
    __tablename__ = "appeals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bot_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("bot_users.id"), nullable=False)
    district_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("districts.id"), nullable=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AppealStatus] = mapped_column(
        SAEnum(AppealStatus), default=AppealStatus.NEW, index=True
    )
    admin_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    bot_user: Mapped["BotUser"] = relationship("BotUser", back_populates="appeals")
    district: Mapped["District"] = relationship("District")
    responder: Mapped["User"] = relationship("User", foreign_keys=[responded_by])
