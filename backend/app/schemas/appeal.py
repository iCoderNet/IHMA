from pydantic import BaseModel
from datetime import datetime
from app.models.appeal import AppealStatus


class AppealCreate(BaseModel):
    subject: str
    message: str


class AppealOut(BaseModel):
    id: int
    subject: str
    message: str
    status: AppealStatus
    admin_response: str | None = None
    created_at: datetime
    updated_at: datetime
    bot_user_fio: str | None = None
    bot_user_phone: str | None = None
    district_name: str | None = None

    class Config:
        from_attributes = True


class AppealStatusUpdate(BaseModel):
    status: AppealStatus
    admin_response: str | None = None


class AppealListResponse(BaseModel):
    items: list[AppealOut]
    total: int
    page: int
    size: int
    pages: int
