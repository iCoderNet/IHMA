import re
from collections import defaultdict
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
import httpx

from app.core.database import get_db
from app.core.dependencies import get_admin_or_superadmin
from app.models.section import Section, SectionRow, SectionCell, SectionColumn
from app.models.appeal import Appeal, AppealStatus
from app.models.bot_user import BotUser
from app.models.district import District
from app.models.ijtimoiy_hodim import IjtimoiyHodim

router = APIRouter(prefix="/ai", tags=["ai"])


# ═══════════════════════════════════════════════════════════════════════════════
# Script helpers: Cyrillic ↔ Latin transliteration + fuzzy match
# ═══════════════════════════════════════════════════════════════════════════════

_CYR2LAT = [
    ("ш", "sh"), ("ч", "ch"), ("щ", "shch"),
    ("ж", "j"),  ("ю", "yu"), ("я", "ya"), ("ё", "yo"),
    ("ъ", "'"),  ("ь", ""),
    ("ў", "o'"), ("Ў", "O'"), ("ғ", "g'"), ("Ғ", "G'"),
    ("қ", "q"),  ("Қ", "Q"),  ("ҳ", "h"),  ("Ҳ", "H"),
    ("а", "a"), ("А", "A"), ("б", "b"), ("Б", "B"),
    ("в", "v"), ("В", "V"), ("г", "g"), ("Г", "G"),
    ("д", "d"), ("Д", "D"), ("е", "e"), ("Е", "E"),
    ("з", "z"), ("З", "Z"), ("и", "i"), ("И", "I"),
    ("й", "y"), ("Й", "Y"), ("к", "k"), ("К", "K"),
    ("л", "l"), ("Л", "L"), ("м", "m"), ("М", "M"),
    ("н", "n"), ("Н", "N"), ("о", "o"), ("О", "O"),
    ("п", "p"), ("П", "P"), ("р", "r"), ("Р", "R"),
    ("с", "s"), ("С", "S"), ("т", "t"), ("Т", "T"),
    ("у", "u"), ("У", "U"), ("ф", "f"), ("Ф", "F"),
    ("х", "h"), ("Х", "H"), ("ц", "ts"), ("Ц", "Ts"),
    ("э", "e"), ("Э", "E"),
]

_LAT2CYR = [
    ("sh", "ш"), ("ch", "ч"), ("ng", "нг"),
    ("o'", "ў"), ("O'", "Ў"), ("g'", "ғ"), ("G'", "Ғ"),
    ("ya", "я"), ("yu", "ю"), ("yo", "ё"),
    ("a", "а"), ("A", "А"), ("b", "б"), ("B", "Б"),
    ("d", "д"), ("D", "Д"), ("e", "е"), ("E", "Е"),
    ("f", "ф"), ("F", "Ф"), ("g", "г"), ("G", "Г"),
    ("h", "х"), ("H", "Х"), ("i", "и"), ("I", "И"),
    ("j", "ж"), ("J", "Ж"), ("k", "к"), ("K", "К"),
    ("l", "л"), ("L", "Л"), ("m", "м"), ("M", "М"),
    ("n", "н"), ("N", "Н"), ("o", "о"), ("O", "О"),
    ("p", "п"), ("P", "П"), ("q", "қ"), ("Q", "Қ"),
    ("r", "р"), ("R", "Р"), ("s", "с"), ("S", "С"),
    ("t", "т"), ("T", "Т"), ("u", "у"), ("U", "У"),
    ("v", "в"), ("V", "В"), ("x", "х"), ("X", "Х"),
    ("y", "й"), ("Y", "Й"), ("z", "з"), ("Z", "З"),
]


def _cyr2lat(text: str) -> str:
    for cyr, lat in _CYR2LAT:
        text = text.replace(cyr, lat)
    return text


def _lat2cyr(text: str) -> str:
    for lat, cyr in _LAT2CYR:
        text = text.replace(lat, cyr)
    return text


def _is_cyrillic(text: str) -> bool:
    return bool(re.search(r'[Ѐ-ӿ]', text))


def _both_scripts(text: str) -> list[str]:
    """Return [original, transliterated] for cross-script search."""
    return [text, _cyr2lat(text) if _is_cyrillic(text) else _lat2cyr(text)]


def _fuzzy_match(a: str, b: str, threshold: float = 0.75) -> bool:
    a, b = a.lower().strip(), b.lower().strip()
    if a in b or b in a:
        return True
    n = len(a)
    for start in range(max(0, len(b) - n - 3)):
        window = b[start: start + n + 3]
        if SequenceMatcher(None, a, window).ratio() >= threshold:
            return True
    return False


# ═══════════════════════════════════════════════════════════════════════════════
# Section keyword map — detects which section user is asking about
# ═══════════════════════════════════════════════════════════════════════════════

# key: lowercase keyword fragment → section name (as stored in DB)
SECTION_KEYWORDS: dict[str, str] = {
    # НБШ
    "nbsh": "НБШ", "нбш": "НБШ",
    "nogiron": "НБШ", "ногирон": "НБШ",
    "nogironligi": "НБШ", "ногиронлиги": "НБШ",
    # РТВ ва ПОМ
    "rtv": "РТВ ва ПОМ", "ртв": "РТВ ва ПОМ",
    "pom": "РТВ ва ПОМ", "пом": "РТВ ва ПОМ",
    "reabilitatsion": "РТВ ва ПОМ",
    # Бандлик
    "bandlik": "Бандлик", "бандлик": "Бандлик", "bandligi": "Бандлик",
    # Реабилитация
    "reabilitatsiya": "Реабилитация", "реабилитация": "Реабилитация",
    "reabilitatsiyaga": "Реабилитация",
    # Васийлик
    "vasiylik": "Васийлик", "васийлик": "Васийлик",
    "homiylik": "Васийлик", "хомийлик": "Васийлик",
    "patronat": "Васийлик", "патронат": "Васийлик",
    # Етим болалар
    "etim": "Етим болалар", "ётим": "Етим болалар",
    "yetim": "Етим болалар", "йетим": "Етим болалар",
    "ota-ona": "Етим болалар", "ота-она": "Етим болалар",
    # Ижтимоий реестр
    "reestr": "Ижтимоий реестр", "реестр": "Ижтимоий реестр",
    "ijtimoiy reestr": "Ижтимоий реестр",
    "kambag": "Ижтимоий реестр", "камбаг": "Ижтимоий реестр",
    "davlat taminot": "Ижтимоий реестр",
    # Нафақа
    "nafaqa": "Нафақа", "нафақа": "Нафақа",
    "nafaqaxo": "Нафақа", "bolalar nafaqa": "Нафақа",
    # Саховат ва кўмак
    "saxovat": "Саховат ва кўмак", "саховат": "Саховат ва кўмак",
    "kumak": "Саховат ва кўмак", "кўмак": "Саховат ва кўмак",
    "ko'mak": "Саховат ва кўмак",
    "kiyim": "Саховат ва кўмак", "кийим": "Саховат ва кўмак",
    "oziq": "Саховат ва кўмак", "озиқ": "Саховат ва кўмак",
    # Таълим
    "talim": "Таълим", "таълим": "Таълим",
    "ta'lim": "Таълим", "inklyuziv": "Таълим", "инклюзив": "Таълим",
    "maktab": "Таълим", "мактаб": "Таълим",
    # Тазйиқ
    "tazyiq": "Тазйиқ", "тазйиқ": "Тазйиқ",
    "zo'ravonlik": "Тазйиқ", "зўравонлик": "Тазйиқ",
    "zo'ravon": "Тазйиқ", "ayollar": "Тазйиқ",
    "himoya order": "Тазйиқ",
    # Фаол хаётга қадам
    "faol": "Фаол хаётга қадам", "фаол": "Фаол хаётга қадам",
    "faol hayot": "Фаол хаётга қадам",
    "ijtimoiy maishiy": "Фаол хаётга қадам",
    "hamrohlik": "Фаол хаётга қадам",
    # Санатория
    "sanatoria": "Санатория", "санатория": "Санатория",
    "sanatoya": "Санатория",
}

HODIM_KEYWORDS = {
    "hodim", "xodim", "ходим", "работник",
    "ijtimoiy xodim", "ijtimoiy hodim",
    "ижтимоий ходим", "ижтимоий хизматчи",
    "kim ishlaydi", "kim ishlayd",
}


def _detect_section(query_lower: str) -> str | None:
    """Return section name if query contains a section keyword."""
    for kw, section_name in SECTION_KEYWORDS.items():
        if kw in query_lower:
            return section_name
    return None


def _is_hodim_query(query_lower: str) -> bool:
    """True if user is asking about social workers (ijtimoiy hodimlar)."""
    return any(kw in query_lower for kw in HODIM_KEYWORDS)


def _extract_mfy_name(query: str) -> str | None:
    """
    Extract MFY name from query.
    Patterns:  "Maqsad MFY", "Adolat mahallasi", "Baxtiyor MFY da"
    Returns the word(s) before MFY/mahalla/etc., or None.
    """
    # Try explicit MFY/mahalla pattern
    m = re.search(
        r"([A-ZА-ЯЎҒҚҲa-zа-яўғқҳ'`\-]+(?:\s+[A-ZА-ЯЎҒҚҲa-zа-яўғқҳ'`\-]+)?)"
        r"\s+(?:MFY|mfy|МФЙ|мфй|mahalla(?:si)?|маҳалла(?:си)?)",
        query,
        re.IGNORECASE | re.UNICODE,
    )
    if m:
        return m.group(1).strip()
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# DB query helpers
# ═══════════════════════════════════════════════════════════════════════════════

async def _query_mfy_section(
    db: AsyncSession,
    mfy_keyword: str,
    section_name: str | None,
    sections: list[Section],
    districts: list[District],
) -> str:
    """
    Find rows matching MFY keyword, optionally filtered by section.
    Returns formatted text block.
    """
    section_map = {s.name: s for s in sections}
    district_map = {d.id: d.name for d in districts}
    col_name_map: dict[int, str] = {}

    # Build all script variants of mfy_keyword
    variants = _both_scripts(mfy_keyword)

    # Filter by section if provided
    target_sections = sections
    if section_name and section_name in section_map:
        target_sections = [section_map[section_name]]

    all_lines: list[str] = []

    for s in target_sections:
        # Build WHERE for mfy_name matching any variant
        conditions = [
            func.lower(SectionRow.mfy_name).contains(v.lower())
            for v in variants
            if v.strip()
        ]
        rows_result = await db.execute(
            select(SectionRow)
            .where(
                SectionRow.section_id == s.id,
                or_(*conditions),
            )
            .limit(10)
        )
        rows = rows_result.scalars().all()
        if not rows:
            continue

        for row in rows:
            # Fetch cells
            cells_result = await db.execute(
                select(SectionCell, SectionColumn)
                .join(SectionColumn, SectionCell.column_id == SectionColumn.id)
                .where(SectionCell.row_id == row.id)
                .order_by(SectionColumn.order)
            )
            parts = []
            for cell, col in cells_result.all():
                if cell.value and cell.value.strip() and cell.value not in ('None', '0'):
                    parts.append(f"{col.name}: {cell.value}")

            d_name = district_map.get(row.district_id, "Noma'lum tuman")
            mfy = row.mfy_name or "Noma'lum MFY"
            period = ""
            if row.period_year:
                period = f" [{row.period_year}"
                if row.period_month:
                    months = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun',
                              'Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr']
                    period += f"-{months[row.period_month]}"
                period += "]"

            if parts:
                all_lines.append(
                    f"📍 {s.name} — {d_name}, {mfy}{period}:\n   "
                    + " | ".join(parts)
                )
            else:
                all_lines.append(f"📍 {s.name} — {d_name}, {mfy}{period}: ma'lumot yo'q")

    return "\n".join(all_lines)


async def _query_hodimlar(
    db: AsyncSession,
    mfy_keyword: str | None,
    district_name: str | None,
    districts: list[District],
) -> str:
    """Search ijtimoiy hodimlar by MFY or district name."""
    q = (
        select(IjtimoiyHodim, District)
        .outerjoin(District, IjtimoiyHodim.district_id == District.id)
    )

    if mfy_keyword:
        variants = _both_scripts(mfy_keyword)
        conditions = [
            func.lower(IjtimoiyHodim.mfy_name).contains(v.lower())
            for v in variants if v.strip()
        ]
        q = q.where(or_(*conditions))
    elif district_name:
        # Find district id
        district_id = None
        for d in districts:
            if _fuzzy_match(district_name, d.name):
                district_id = d.id
                break
        if district_id:
            q = q.where(IjtimoiyHodim.district_id == district_id)

    q = q.limit(15)
    results = (await db.execute(q)).all()

    if not results:
        return ""

    lines = []
    for hodim, district in results:
        d_name = district.name if district else "Noma'lum tuman"
        phone = f", 📞 {hodim.phone}" if hodim.phone else ""
        lines.append(f"👤 {hodim.fio} — {d_name}, {hodim.mfy_name}{phone}")

    return "=== IJTIMOIY HODIMLAR ===\n" + "\n".join(lines) + "\n========================"


async def _district_aggregation(
    db: AsyncSession,
    district: District,
    sections: list[Section],
) -> str:
    """Aggregate all numeric cells for a district across sections."""
    lines: list[str] = []

    for s in sections:
        row_count = (await db.execute(
            select(func.count())
            .select_from(SectionRow)
            .where(SectionRow.district_id == district.id, SectionRow.section_id == s.id)
        )).scalar()

        if not row_count:
            continue

        cells_result = await db.execute(
            select(SectionCell, SectionColumn)
            .join(SectionColumn, SectionCell.column_id == SectionColumn.id)
            .join(SectionRow, SectionCell.row_id == SectionRow.id)
            .where(
                SectionRow.district_id == district.id,
                SectionRow.section_id == s.id,
            )
            .order_by(SectionColumn.order)
        )

        col_order: list[int] = []
        col_names: dict[int, str] = {}
        col_sums: dict[int, float] = {}

        for cell, col in cells_result.all():
            if col.id not in col_names:
                col_names[col.id] = col.name
                col_order.append(col.id)
            if cell.value and cell.value.strip():
                try:
                    col_sums[col.id] = col_sums.get(col.id, 0.0) + float(
                        re.sub(r'[\s,]', '', cell.value)
                    )
                except ValueError:
                    pass

        if col_sums:
            parts = []
            for col_id in col_order:
                if col_id in col_sums:
                    total = col_sums[col_id]
                    val = int(total) if total == int(total) else round(total, 2)
                    parts.append(f"{col_names[col_id]}: {val:,}")
            lines.append(
                f"[{s.name} — {district.name} ({row_count} ta MFY)]: "
                + " | ".join(parts)
            )

    return "\n".join(lines)


async def _find_relevant_rows(
    db: AsyncSession,
    query: str,
    sections: list[Section],
    districts: list[District],
) -> str:
    """
    Smart context builder:
    1. MFY + section query  → row-level data
    2. Hodim query          → ijtimoiy hodimlar table
    3. District query       → aggregated totals
    4. General MFY search   → row-level data without section filter
    """
    query_lower = query.lower().strip()

    mfy_keyword  = _extract_mfy_name(query)
    section_name = _detect_section(query_lower)
    is_hodim     = _is_hodim_query(query_lower)

    # ── 1. Social worker query ──────────────────────────────────────────────
    if is_hodim:
        # Try to get district name too for narrower search
        district_hint = None
        for d in districts:
            for variant in _both_scripts(d.name.lower()):
                if variant and len(variant) > 3 and variant in query_lower:
                    district_hint = d.name
                    break

        result = await _query_hodimlar(db, mfy_keyword, district_hint, districts)
        if result:
            return result
        # Fallback: no filter search
        result = await _query_hodimlar(db, None, district_hint, districts)
        return result or "Ijtimoiy hodimlar bazasida tegishli yozuv topilmadi."

    # ── 2. MFY + optional section ───────────────────────────────────────────
    if mfy_keyword:
        result = await _query_mfy_section(db, mfy_keyword, section_name, sections, districts)
        if result:
            return f"=== MFY MA'LUMOTLARI ===\n{result}\n========================"

    # ── 3. District-level aggregation ──────────────────────────────────────
    query_words = re.split(r'\s+', query_lower)
    for d in districts:
        d_variants = [
            d.name.lower(),
            d.name.lower().replace(" tumani", "").replace(" shahri", ""),
            _cyr2lat(d.name.lower()),
            _lat2cyr(d.name.lower()),
        ]
        for word in query_words:
            if len(word) < 4:
                continue
            for variant in d_variants:
                if variant and _fuzzy_match(word, variant):
                    agg = await _district_aggregation(db, d, sections)
                    if agg:
                        return f"=== {d.name.upper()} BO'YICHA UMUMIY ===\n{agg}\n=============================="

    # ── 4. Keyword-only MFY search (no explicit MFY pattern) ───────────────
    # Extract capitalized words as potential MFY name fragments
    candidates = re.findall(r"[A-ZА-ЯЎҒҚҲ][a-zA-Zа-яўғқҳ']{2,}", query)
    STOPWORDS = {
        "Salom", "Rahmat", "Kechirasiz", "Qanday", "Qancha",
        "Nechta", "Haqida", "Bersin", "Bering", "Ber"
    }
    for cand in candidates:
        if cand in STOPWORDS:
            continue
        result = await _query_mfy_section(db, cand, section_name, sections, districts)
        if result:
            return f"=== MFY MA'LUMOTLARI ===\n{result}\n========================"

    return ""


# ═══════════════════════════════════════════════════════════════════════════════
# TTS cleanup
# ═══════════════════════════════════════════════════════════════════════════════

def _strip_for_speech(text: str) -> str:
    text = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', text)
    text = re.sub(r'(?m)^\d+[.)]\s+', '', text)
    text = re.sub(r'(?m)^[-•📍👤]\s*', '', text)
    ABBREVS = {
        r'\bNBSH\b': "nogironligi bo'lgan shaxslar",
        r'\bMFY\b': "mahalla fuqarolar yig'ilishi",
        r'\bIHMA\b': "Ijtimoiy Himoya Menejment Axborot Tizimi",
    }
    for pattern, replacement in ABBREVS.items():
        text = re.sub(pattern, replacement, text)
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'\n', ' ', text)
    text = re.sub(r'[\U0001F300-\U0001FFFF\U00002600-\U000027BF]', '', text)
    text = re.sub(r'  +', ' ', text)
    return text.strip()


# ═══════════════════════════════════════════════════════════════════════════════
# AI endpoint
# ═══════════════════════════════════════════════════════════════════════════════

AI_API_URL = "https://p950-w009-runai-p950.runai-inference.dc.uz/v1/chat/completions"
AI_API_KEY = "sk-_RFXXpNRwyAc5ap6XUztNQ"
AI_MODEL   = "openai/gpt-oss-120b"


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat")
async def ai_chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_admin_or_superadmin),
):
    # ── Load base context ────────────────────────────────────────────────────
    sections = (await db.execute(
        select(Section).where(Section.is_active == True).order_by(Section.order)
    )).scalars().all()

    districts = (await db.execute(
        select(District).order_by(District.name)
    )).scalars().all()

    total_records = (await db.execute(
        select(func.count()).select_from(SectionRow)
    )).scalar()

    appeals_total = (await db.execute(select(func.count()).select_from(Appeal))).scalar()
    appeals_new   = (await db.execute(select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.NEW))).scalar()
    appeals_in_review  = (await db.execute(select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.IN_REVIEW))).scalar()
    appeals_resolved   = (await db.execute(select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.RESOLVED))).scalar()
    appeals_rejected   = (await db.execute(select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.REJECTED))).scalar()

    bot_users     = (await db.execute(select(func.count()).select_from(BotUser).where(BotUser.is_registered == True))).scalar()
    blocked_users = (await db.execute(select(func.count()).select_from(BotUser).where(BotUser.is_blocked == True))).scalar()

    hodimlar_count = (await db.execute(select(func.count()).select_from(IjtimoiyHodim))).scalar()

    # ── Per-section summary ──────────────────────────────────────────────────
    section_lines = []
    for s in sections:
        cnt = (await db.execute(
            select(func.count()).select_from(SectionRow).where(SectionRow.section_id == s.id)
        )).scalar()
        section_lines.append(f"  • {s.name} ({s.full_name}): {cnt} ta MFY yozuvi")
    sections_text = "\n".join(section_lines) or "  (bo'lim yo'q)"

    # ── District × Section matrix ────────────────────────────────────────────
    counts_result = await db.execute(
        select(SectionRow.district_id, SectionRow.section_id, func.count().label("cnt"))
        .group_by(SectionRow.district_id, SectionRow.section_id)
    )
    counts = {(r.district_id, r.section_id): r.cnt for r in counts_result}

    district_lines = []
    for d in districts:
        d_total = sum(counts.get((d.id, s.id), 0) for s in sections)
        if d_total == 0:
            continue
        district_lines.append(f"  • {d.name}: jami {d_total} ta MFY yozuvi")
    districts_text = "\n".join(district_lines) or "  (tuman yo'q)"

    # ── Smart context from DB ────────────────────────────────────────────────
    db_context = await _find_relevant_rows(db, body.message, sections, districts)
    context_section = f"\n\n{db_context}" if db_context else ""

    # ── System prompt ────────────────────────────────────────────────────────
    system_prompt = f"""Siz IHMA tizimining AI yordamchisisiz.
IHMA — Andijon viloyati Ijtimoiy Himoya Menejment Axborot Tizimi.

=== TIZIM STATISTIKASI ===
Bo'limlar ({len(sections)} ta, jami {total_records:,} ta yozuv):
{sections_text}

Tumanlar ({len(districts)} ta):
{districts_text}

Ijtimoiy hodimlar bazasida: {hodimlar_count} ta hodim

Murojaatlar: jami {appeals_total} ta (yangi: {appeals_new}, ko'rib chiqilmoqda: {appeals_in_review}, hal qilingan: {appeals_resolved}, rad: {appeals_rejected})
Telegram bot: {bot_users} ta ro'yxatdan o'tgan, {blocked_users} ta bloklangan
=========================={context_section}

QOIDALAR:
1. Yuqoridagi ma'lumotlar asosida aniq javob bering. Taxminiy javob bermang.
2. "MFY MA'LUMOTLARI" yoki "IJTIMOIY HODIMLAR" bo'limi mavjud bo'lsa — undan to'g'ridan-to'g'ri javob bering.
3. Agar foydalanuvchi lotin harflarida so'rasa, krill nomlar bazada bo'lsa ham topiladi — bu tizim funksiyasi.
4. Foydalanuvchi qaysi tilda yozsa (o'zbek/rus), shu tilda javob bering.
5. Qisqa, aniq, foydali javob bering. Markdown (bo'ldiroq, ro'yxat) ishlatish mumkin.
6. Agar so'ralgan MFY yoki tuman bazada yo'q bo'lsa — shuni ochiq ayting.
7. Faqat IHMA tizimi haqidagi savollarga javob bering."""

    messages = [{"role": "system", "content": system_prompt}]
    for h in body.history[-10:]:
        if h.get("role") in ("user", "assistant"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": body.message})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                AI_API_URL,
                headers={
                    "Authorization": f"Bearer {AI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": AI_MODEL,
                    "messages": messages,
                    "max_tokens": 800,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            reply = resp.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        reply = f"AI xizmat xatosi: {e.response.status_code}"
    except Exception:
        reply = "Xato yuz berdi. Qaytadan urinib ko'ring."

    return {"reply": reply, "speech_text": _strip_for_speech(reply)}
