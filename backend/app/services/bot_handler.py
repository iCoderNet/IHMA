"""Telegram bot webhook handler - registration flow, appeals."""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sql_func
from sqlalchemy.orm import selectinload
import math

from app.models.bot_user import BotUser, BotSettings, BotRegistrationStep, BotLanguage
from app.models.district import District
from app.models.appeal import Appeal, AppealStatus
from app.services.telegram import send_message


# ─── Texts ───────────────────────────────────────────────────────────────────

TEXTS = {
    "uz": {
        "welcome": "👋 Salom! IHMA xizmatiga xush kelibsiz.\n\nIltimos, tilni tanlang:",
        "choose_lang": "Tilni tanlang / Выберите язык:",
        "enter_fio": "✏️ Iltimos, to'liq ismingizni kiriting (FIO):",
        "choose_district": "📍 Qaysi tumanda yashasiz? Tanlang:",
        "share_phone": "📱 Telefon raqamingizni tasdiqlash uchun quyidagi tugmani bosing:",
        "phone_btn": "📱 Raqamimni ulashish",
        "wrong_contact": "❌ Iltimos, faqat o'z raqamingizni ulashing!",
        "enter_extra_phone": "📞 Qo'shimcha aloqa raqami (ixtiyoriy).\nKiritmasangiz, /o'tkazib yuborish ni bosing:",
        "skip_btn": "⏭️ O'tkazib yuborish",
        "reg_done": "✅ Ro'yxatdan o'tish muvaffaqiyatli yakunlandi!\n\nQuyidagi bo'limlardan birini tanlang:",
        "main_menu": "🏠 Asosiy menyu:",
        "new_appeal": "📝 Murojaat yo'llash",
        "my_appeals": "📋 Murojaatlarim",
        "my_profile": "👤 Profilim",
        "enter_subject": "📌 Murojaatingiz mavzusini kiriting:",
        "enter_message": "✍️ Murojaat matnini kiriting:",
        "appeal_sent": "✅ Murojaatingiz muvaffaqiyatli yuborildi!\n\nSiz \"Murojaatlarim\" bo'limida uning holatini kuzatishingiz mumkin.",
        "no_appeals": "📭 Hozircha murojaat yo'q.",
        "appeal_details": "📋 <b>Murojaat #{id}</b>\n\n📌 Mavzu: {subject}\n📊 Holat: {status}\n📅 Sana: {date}\n\n💬 Xabar:\n{message}",
        "response_label": "\n\n👨‍💼 Javob:\n{response}",
        "back_btn": "⬅️ Ortga",
        "profile_text": "👤 <b>Profilingiz</b>\n\n🏷️ FIO: {fio}\n📱 Telefon: {phone}\n📞 Qo'shimcha: {extra}\n🌍 Tuman: {district}\n🗣️ Til: {lang}",
        "edit_fio": "✏️ FIO o'zgartirish",
        "edit_phone": "📞 Qo'shimcha raqam",
        "edit_district": "📍 Tumanni o'zgartirish",
        "change_lang": "🌍 Tilni o'zgartirish",
        "not_registered": "❌ Siz hali ro'yxatdan o'tmagansiz. /start ni bosing.",
        "status_new": "🆕 Yangi",
        "status_in_review": "🔍 Ko'rib chiqilmoqda",
        "status_resolved": "✅ Hal qilindi",
        "status_rejected": "❌ Rad etildi",
        "page_info": "📄 Sahifa: {page}/{total}",
        "prev_btn": "◀️ Oldingi",
        "next_btn": "Keyingi ▶️",
        "new_fio": "✏️ Yangi FIO kiriting:",
        "new_extra_phone": "📞 Yangi qo'shimcha raqam kiriting:",
        "saved": "✅ Saqlandi!",
        "enter_new_phone_skip": "📞 Yangi qo'shimcha raqam kiriting (o'tkazib yuborish uchun /o'tkazib yuborish):",
    },
    "ru": {
        "welcome": "👋 Привет! Добро пожаловать в сервис IHMA.\n\nПожалуйста, выберите язык:",
        "choose_lang": "Выберите язык / Tilni tanlang:",
        "enter_fio": "✏️ Пожалуйста, введите ваше полное имя (ФИО):",
        "choose_district": "📍 В каком районе вы живёте? Выберите:",
        "share_phone": "📱 Нажмите кнопку ниже, чтобы подтвердить ваш номер телефона:",
        "phone_btn": "📱 Поделиться номером",
        "wrong_contact": "❌ Пожалуйста, поделитесь только своим номером!",
        "enter_extra_phone": "📞 Дополнительный контактный номер (необязательно).\nЕсли не хотите, нажмите /пропустить:",
        "skip_btn": "⏭️ Пропустить",
        "reg_done": "✅ Регистрация успешно завершена!\n\nВыберите один из разделов:",
        "main_menu": "🏠 Главное меню:",
        "new_appeal": "📝 Подать обращение",
        "my_appeals": "📋 Мои обращения",
        "my_profile": "👤 Мой профиль",
        "enter_subject": "📌 Введите тему обращения:",
        "enter_message": "✍️ Введите текст обращения:",
        "appeal_sent": "✅ Ваше обращение успешно отправлено!\n\nВы можете следить за его статусом в разделе «Мои обращения».",
        "no_appeals": "📭 Обращений пока нет.",
        "appeal_details": "📋 <b>Обращение #{id}</b>\n\n📌 Тема: {subject}\n📊 Статус: {status}\n📅 Дата: {date}\n\n💬 Сообщение:\n{message}",
        "response_label": "\n\n👨‍💼 Ответ:\n{response}",
        "back_btn": "⬅️ Назад",
        "profile_text": "👤 <b>Ваш профиль</b>\n\n🏷️ ФИО: {fio}\n📱 Телефон: {phone}\n📞 Доп. номер: {extra}\n🌍 Район: {district}\n🗣️ Язык: {lang}",
        "edit_fio": "✏️ Изменить ФИО",
        "edit_phone": "📞 Доп. номер",
        "edit_district": "📍 Изменить район",
        "change_lang": "🌍 Изменить язык",
        "not_registered": "❌ Вы ещё не зарегистрированы. Нажмите /start.",
        "status_new": "🆕 Новый",
        "status_in_review": "🔍 На рассмотрении",
        "status_resolved": "✅ Решено",
        "status_rejected": "❌ Отклонено",
        "page_info": "📄 Страница: {page}/{total}",
        "prev_btn": "◀️ Предыдущая",
        "next_btn": "Следующая ▶️",
        "new_fio": "✏️ Введите новое ФИО:",
        "new_extra_phone": "📞 Введите новый доп. номер:",
        "saved": "✅ Сохранено!",
        "enter_new_phone_skip": "📞 Введите новый доп. номер (для пропуска /пропустить):",
    },
}

STATUS_LABELS = {
    "uz": {
        AppealStatus.NEW: "🆕 Yangi",
        AppealStatus.IN_REVIEW: "🔍 Ko'rib chiqilmoqda",
        AppealStatus.RESOLVED: "✅ Hal qilindi",
        AppealStatus.REJECTED: "❌ Rad etildi",
    },
    "ru": {
        AppealStatus.NEW: "🆕 Новый",
        AppealStatus.IN_REVIEW: "🔍 На рассмотрении",
        AppealStatus.RESOLVED: "✅ Решено",
        AppealStatus.REJECTED: "❌ Отклонено",
    },
}


def t(user: BotUser, key: str) -> str:
    lang = user.language if user else "uz"
    return TEXTS.get(lang, TEXTS["uz"]).get(key, key)


def main_menu_keyboard(user: BotUser) -> dict:
    lang = user.language
    return {
        "keyboard": [
            [{"text": TEXTS[lang]["new_appeal"]}],
            [{"text": TEXTS[lang]["my_appeals"]}],
            [{"text": TEXTS[lang]["my_profile"]}],
        ],
        "resize_keyboard": True,
        "persistent": True,
    }


def remove_keyboard() -> dict:
    return {"remove_keyboard": True}


# ─── Handler ──────────────────────────────────────────────────────────────────

class BotHandler:
    def __init__(self, token: str, db: AsyncSession):
        self.token = token
        self.db = db

    async def send(self, chat_id: int, text: str, markup=None):
        await send_message(self.token, chat_id, text, markup)

    async def get_or_create_user(self, tg_user: dict) -> BotUser:
        tg_id = tg_user["id"]
        result = await self.db.execute(select(BotUser).where(BotUser.telegram_id == tg_id))
        user = result.scalar_one_or_none()
        if not user:
            user = BotUser(
                telegram_id=tg_id,
                username=tg_user.get("username"),
                registration_step=BotRegistrationStep.START,
            )
            self.db.add(user)
            await self.db.flush()
            await self.db.refresh(user)
        return user

    async def handle_update(self, update: dict):
        message = update.get("message") or update.get("callback_query", {}).get("message")
        callback = update.get("callback_query")

        if callback:
            await self.handle_callback(callback)
            return

        if not message:
            return

        tg_user = message.get("from", {})
        chat_id = message["chat"]["id"]

        user = await self.get_or_create_user(tg_user)

        if user.is_blocked:
            return

        text = message.get("text", "")
        contact = message.get("contact")

        # Handle /start
        if text.startswith("/start"):
            await self.handle_start(user, chat_id)
            return

        # Route by registration step
        if not user.is_registered:
            await self.handle_registration(user, chat_id, text, contact)
        else:
            await self.handle_registered(user, chat_id, text, contact, message)

    async def handle_start(self, user: BotUser, chat_id: int):
        # Allaqachon ro'yxatdan o'tgan bo'lsa — asosiy menyuni ko'rsat
        if user.is_registered:
            await self.send(chat_id, t(user, "main_menu"), main_menu_keyboard(user))
            return

        user.registration_step = BotRegistrationStep.LANG
        await self.db.flush()
        await self.send(chat_id, TEXTS["uz"]["choose_lang"], {
            "keyboard": [
                [{"text": "🇺🇿 O'zbek"}, {"text": "🇷🇺 Русский"}]
            ],
            "resize_keyboard": True,
            "one_time_keyboard": True,
        })

    async def handle_registration(self, user: BotUser, chat_id: int, text: str, contact):
        step = user.registration_step

        if step == BotRegistrationStep.LANG:
            if "O'zbek" in text or "Uzbek" in text:
                user.language = BotLanguage.UZ
            elif "Русский" in text or "Russian" in text:
                user.language = BotLanguage.RU
            else:
                await self.handle_start(user, chat_id)
                return
            user.registration_step = BotRegistrationStep.FIO
            await self.db.flush()
            await self.send(chat_id, t(user, "enter_fio"), remove_keyboard())

        elif step == BotRegistrationStep.FIO:
            if len(text.strip()) < 3:
                await self.send(chat_id, t(user, "enter_fio"))
                return
            user.fio = text.strip()
            user.registration_step = BotRegistrationStep.DISTRICT
            await self.db.flush()
            await self.send_district_keyboard(user, chat_id)

        elif step == BotRegistrationStep.DISTRICT:
            # Find district by name
            result = await self.db.execute(select(District).where(District.name.like(f"%{text.strip()}%")))
            district = result.scalar_one_or_none()
            if not district:
                await self.send_district_keyboard(user, chat_id)
                return
            user.district_id = district.id
            user.registration_step = BotRegistrationStep.PHONE
            await self.db.flush()
            await self.send(chat_id, t(user, "share_phone"), {
                "keyboard": [[{
                    "text": t(user, "phone_btn"),
                    "request_contact": True,
                }]],
                "resize_keyboard": True,
                "one_time_keyboard": True,
            })

        elif step == BotRegistrationStep.PHONE:
            if contact:
                # Verify it's their own contact
                if contact.get("user_id") != user.telegram_id:
                    await self.send(chat_id, t(user, "wrong_contact"))
                    return
                phone = contact.get("phone_number", "").replace("+", "").replace(" ", "")
                user.phone = f"+{phone}" if not phone.startswith("+") else phone
                user.registration_step = BotRegistrationStep.EXTRA_PHONE
                await self.db.flush()
                await self.send(chat_id, t(user, "enter_extra_phone"), {
                    "keyboard": [[{"text": t(user, "skip_btn")}]],
                    "resize_keyboard": True,
                    "one_time_keyboard": True,
                })
            else:
                await self.send(chat_id, t(user, "share_phone"), {
                    "keyboard": [[{"text": t(user, "phone_btn"), "request_contact": True}]],
                    "resize_keyboard": True,
                })

        elif step == BotRegistrationStep.EXTRA_PHONE:
            if text and "skip" not in text.lower() and "o'tkazib" not in text.lower() and "пропустить" not in text.lower() and "⏭️" not in text:
                user.extra_phone = text.strip()
            user.registration_step = BotRegistrationStep.DONE
            user.is_registered = True
            await self.db.flush()
            # Load district
            await self.db.refresh(user, ["district"])
            await self.send(chat_id, t(user, "reg_done"), main_menu_keyboard(user))

    async def send_district_keyboard(self, user: BotUser, chat_id: int):
        result = await self.db.execute(select(District).order_by(District.name))
        districts = result.scalars().all()
        buttons = [[{"text": d.name}] for d in districts]
        await self.send(chat_id, t(user, "choose_district"), {
            "keyboard": buttons,
            "resize_keyboard": True,
            "one_time_keyboard": True,
        })

    async def handle_registered(self, user: BotUser, chat_id: int, text: str, contact, message: dict):
        lang = user.language

        # Main menu buttons
        if text in (TEXTS["uz"]["new_appeal"], TEXTS["ru"]["new_appeal"]):
            user.registration_step = "appeal_subject"
            await self.db.flush()
            await self.send(chat_id, t(user, "enter_subject"), remove_keyboard())
            return

        if text in (TEXTS["uz"]["my_appeals"], TEXTS["ru"]["my_appeals"]):
            await self.show_appeals(user, chat_id, page=1)
            return

        if text in (TEXTS["uz"]["my_profile"], TEXTS["ru"]["my_profile"]):
            await self.show_profile(user, chat_id)
            return

        # Profile editing
        if user.registration_step == "edit_fio":
            user.fio = text.strip()
            user.registration_step = BotRegistrationStep.DONE
            await self.db.flush()
            await self.send(chat_id, t(user, "saved"), main_menu_keyboard(user))
            return

        if user.registration_step == "edit_extra_phone":
            if "o'tkazib" not in text and "пропустить" not in text and "/o'tkazib" not in text:
                user.extra_phone = text.strip()
            user.registration_step = BotRegistrationStep.DONE
            await self.db.flush()
            await self.send(chat_id, t(user, "saved"), main_menu_keyboard(user))
            return

        if user.registration_step == "edit_district":
            result = await self.db.execute(select(District).where(District.name.like(f"%{text.strip()}%")))
            district = result.scalar_one_or_none()
            if district:
                user.district_id = district.id
                user.registration_step = BotRegistrationStep.DONE
                await self.db.flush()
                await self.send(chat_id, t(user, "saved"), main_menu_keyboard(user))
            else:
                await self.send_district_keyboard(user, chat_id)
            return

        # Appeal flow
        if user.registration_step == "appeal_subject":
            import json
            user.registration_step = json.dumps({"step": "appeal_message", "subject": text.strip()})
            await self.db.flush()
            await self.send(chat_id, t(user, "enter_message"))
            return

        if user.registration_step and user.registration_step.startswith("{"):
            import json
            try:
                state = json.loads(user.registration_step)
                if state.get("step") == "appeal_message":
                    subject = state.get("subject", "Murojaat")
                    appeal = Appeal(
                        bot_user_id=user.id,
                        district_id=user.district_id,
                        subject=subject,
                        message=text.strip(),
                        status=AppealStatus.NEW,
                    )
                    self.db.add(appeal)
                    user.registration_step = BotRegistrationStep.DONE
                    await self.db.flush()
                    await self.send(chat_id, t(user, "appeal_sent"), main_menu_keyboard(user))
                    return
            except Exception:
                pass

        # Default: show main menu
        await self.send(chat_id, t(user, "main_menu"), main_menu_keyboard(user))

    async def show_appeals(self, user: BotUser, chat_id: int, page: int = 1):
        size = 5
        result = await self.db.execute(
            select(Appeal)
            .where(Appeal.bot_user_id == user.id)
            .order_by(Appeal.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        appeals = result.scalars().all()

        count_result = await self.db.execute(
            select(sql_func.count())
            .select_from(Appeal)
            .where(Appeal.bot_user_id == user.id)
        )
        total = count_result.scalar()
        total_pages = math.ceil(total / size) if total else 1

        lang = user.language
        if not appeals:
            await self.send(chat_id, t(user, "no_appeals"), main_menu_keyboard(user))
            return

        # Build inline keyboard for appeal list
        buttons = []
        for a in appeals:
            status_label = STATUS_LABELS[lang].get(a.status, a.status.value)
            btn_text = f"#{a.id} {a.subject[:25]} | {status_label}"
            buttons.append([{"text": btn_text, "callback_data": f"appeal_{a.id}"}])

        nav = []
        if page > 1:
            nav.append({"text": t(user, "prev_btn"), "callback_data": f"appeals_page_{page-1}"})
        if page < total_pages:
            nav.append({"text": t(user, "next_btn"), "callback_data": f"appeals_page_{page+1}"})
        if nav:
            buttons.append(nav)

        buttons.append([{"text": t(user, "back_btn"), "callback_data": "main_menu"}])

        page_text = t(user, "page_info").format(page=page, total=total_pages)
        await self.send(
            chat_id,
            f"📋 <b>{t(user, 'my_appeals')}</b>\n{page_text}",
            {"inline_keyboard": buttons},
        )

    async def show_profile(self, user: BotUser, chat_id: int):
        await self.db.refresh(user, ["district"])
        lang = user.language
        lang_label = "O'zbek 🇺🇿" if lang == "uz" else "Русский 🇷🇺"
        text = TEXTS[lang]["profile_text"].format(
            fio=user.fio or "-",
            phone=user.phone or "-",
            extra=user.extra_phone or "-",
            district=user.district.name if user.district else "-",
            lang=lang_label,
        )
        buttons = {
            "inline_keyboard": [
                [{"text": t(user, "edit_fio"), "callback_data": "edit_fio"}],
                [{"text": t(user, "edit_phone"), "callback_data": "edit_extra_phone"}],
                [{"text": t(user, "edit_district"), "callback_data": "edit_district"}],
                [{"text": t(user, "change_lang"), "callback_data": "change_lang"}],
                [{"text": t(user, "back_btn"), "callback_data": "main_menu"}],
            ]
        }
        await self.send(chat_id, text, buttons)

    async def handle_callback(self, callback: dict):
        data = callback.get("data", "")
        chat_id = callback["message"]["chat"]["id"]
        tg_user = callback["from"]

        user = await self.get_or_create_user(tg_user)
        if user.is_blocked:
            return

        # Answer callback to remove loading indicator
        await self.answer_callback(callback["id"])

        if data == "main_menu":
            await self.send(chat_id, t(user, "main_menu"), main_menu_keyboard(user))

        elif data.startswith("appeal_"):
            appeal_id = int(data.split("_")[1])
            await self.show_appeal_detail(user, chat_id, appeal_id)

        elif data.startswith("appeals_page_"):
            page = int(data.split("_")[-1])
            await self.show_appeals(user, chat_id, page)

        elif data == "edit_fio":
            user.registration_step = "edit_fio"
            await self.db.flush()
            await self.send(chat_id, t(user, "new_fio"))

        elif data == "edit_extra_phone":
            user.registration_step = "edit_extra_phone"
            await self.db.flush()
            await self.send(chat_id, t(user, "new_extra_phone"))

        elif data == "edit_district":
            user.registration_step = "edit_district"
            await self.db.flush()
            await self.send_district_keyboard(user, chat_id)

        elif data == "change_lang":
            await self.send(chat_id, TEXTS["uz"]["choose_lang"], {
                "inline_keyboard": [
                    [
                        {"text": "🇺🇿 O'zbek", "callback_data": "set_lang_uz"},
                        {"text": "🇷🇺 Русский", "callback_data": "set_lang_ru"},
                    ]
                ]
            })

        elif data == "set_lang_uz":
            user.language = BotLanguage.UZ
            await self.db.flush()
            await self.send(chat_id, t(user, "saved"), main_menu_keyboard(user))

        elif data == "set_lang_ru":
            user.language = BotLanguage.RU
            await self.db.flush()
            await self.send(chat_id, t(user, "saved"), main_menu_keyboard(user))

    async def show_appeal_detail(self, user: BotUser, chat_id: int, appeal_id: int):
        result = await self.db.execute(
            select(Appeal).where(Appeal.id == appeal_id, Appeal.bot_user_id == user.id)
        )
        appeal = result.scalar_one_or_none()
        if not appeal:
            await self.send(chat_id, "❌ Murojaat topilmadi")
            return

        lang = user.language
        status_label = STATUS_LABELS[lang].get(appeal.status, appeal.status.value)
        text = TEXTS[lang]["appeal_details"].format(
            id=appeal.id,
            subject=appeal.subject,
            status=status_label,
            date=appeal.created_at.strftime("%d.%m.%Y %H:%M"),
            message=appeal.message,
        )
        if appeal.admin_response:
            text += TEXTS[lang]["response_label"].format(response=appeal.admin_response)

        await self.send(chat_id, text, {
            "inline_keyboard": [[
                {"text": t(user, "back_btn"), "callback_data": "appeals_page_1"}
            ]]
        })

    async def answer_callback(self, callback_id: str):
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{self.token}/answerCallbackQuery",
                json={"callback_query_id": callback_id},
                timeout=5,
            )
