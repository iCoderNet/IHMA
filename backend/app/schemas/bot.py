from pydantic import BaseModel
from datetime import datetime
from app.models.bot_user import BotLanguage


class BotSettingsUpdate(BaseModel):
    token: str | None = None
    webhook_url: str | None = None
    is_active: bool | None = None


class BotSettingsOut(BaseModel):
    token: str | None = None
    webhook_url: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class BotUserOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None = None
    fio: str | None = None
    phone: str | None = None
    extra_phone: str | None = None
    language: BotLanguage
    district_name: str | None = None
    is_registered: bool
    is_blocked: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BroadcastMessage(BaseModel):
    message: str
    district_id: int | None = None   # None = all users


class BroadcastResult(BaseModel):
    sent: int
    failed: int
    total: int


class WebhookSetupResponse(BaseModel):
    success: bool
    message: str
    webhook_url: str | None = None
