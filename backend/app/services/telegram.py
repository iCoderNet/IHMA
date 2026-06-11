"""Telegram bot service - message sending utilities."""
import httpx
from typing import Optional
from app.models.appeal import Appeal


async def get_bot_token(db) -> Optional[str]:
    from sqlalchemy import select
    from app.models.bot_user import BotSettings
    result = await db.execute(select(BotSettings).where(BotSettings.id == 1))
    s = result.scalar_one_or_none()
    return s.token if s else None


async def send_message(token: str, chat_id: int, text: str, reply_markup=None, parse_mode="HTML"):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json=payload,
            timeout=10,
        )
        return resp.json()


async def send_appeal_status_notification(appeal: Appeal):
    """Notify bot user when their appeal status changes."""
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.bot_user import BotSettings

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(BotSettings).where(BotSettings.id == 1))
        settings = result.scalar_one_or_none()
        if not settings or not settings.token:
            return

    bot_user = appeal.bot_user
    if not bot_user:
        return

    lang = bot_user.language or "uz"
    status_labels = {
        "uz": {
            "new": "🆕 Yangi",
            "in_review": "🔍 Ko'rib chiqilmoqda",
            "resolved": "✅ Hal qilindi",
            "rejected": "❌ Rad etildi",
        },
        "ru": {
            "new": "🆕 Новый",
            "in_review": "🔍 На рассмотрении",
            "resolved": "✅ Решено",
            "rejected": "❌ Отклонено",
        },
    }

    status_label = status_labels[lang].get(appeal.status.value, appeal.status.value)

    if lang == "uz":
        text = (
            f"📋 <b>Murojaatingiz yangilandi</b>\n\n"
            f"📌 Mavzu: {appeal.subject}\n"
            f"📊 Holat: {status_label}\n"
        )
        if appeal.admin_response:
            text += f"\n💬 Javob:\n{appeal.admin_response}"
    else:
        text = (
            f"📋 <b>Ваше обращение обновлено</b>\n\n"
            f"📌 Тема: {appeal.subject}\n"
            f"📊 Статус: {status_label}\n"
        )
        if appeal.admin_response:
            text += f"\n💬 Ответ:\n{appeal.admin_response}"

    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{settings.token}/sendMessage",
            json={"chat_id": bot_user.telegram_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
