import re
from collections import defaultdict
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import httpx

from app.core.database import get_db
from app.core.dependencies import get_admin_or_superadmin
from app.models.section import Section, SectionRow, SectionCell, SectionColumn
from app.models.appeal import Appeal, AppealStatus
from app.models.bot_user import BotUser
from app.models.district import District

router = APIRouter(prefix="/ai", tags=["ai"])


# ──────────────────────────────────────────────────────────────────────────
# Uzbek Latin ↔ Cyrillic helpers + fuzzy match
# ──────────────────────────────────────────────────────────────────────────

# Ordered: multi-char BEFORE single-char to avoid partial replacement
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


def _lat2cyr(text: str) -> str:
    for lat, cyr in _LAT2CYR:
        text = text.replace(lat, cyr)
    return text


def _cyr2lat(text: str) -> str:
    for cyr, lat in _CYR2LAT:
        text = text.replace(cyr, lat)
    return text


def _is_cyrillic(text: str) -> bool:
    return bool(re.search(r'[Ѐ-ӿ]', text))


def _search_variants(keyword: str) -> list[str]:
    """Return [keyword, transliterated_variant] for cross-script search."""
    if _is_cyrillic(keyword):
        return [keyword, _cyr2lat(keyword)]
    else:
        return [keyword, _lat2cyr(keyword)]


def _fuzzy_contains(needle: str, haystack: str, threshold: float = 0.78) -> bool:
    """True if needle matches any substring of haystack with ratio >= threshold."""
    needle = needle.lower().strip()
    haystack = haystack.lower().strip()
    if needle in haystack:
        return True
    # Slide a window of len(needle) ± 2 over haystack
    n = len(needle)
    for start in range(max(0, len(haystack) - n - 2)):
        window = haystack[start : start + n + 2]
        if SequenceMatcher(None, needle, window).ratio() >= threshold:
            return True
    return False


async def _district_aggregation(
    db: AsyncSession,
    district,
    sections: list,
) -> str:
    """Sum all numeric-looking cell values for a district across all sections.
    Returns human-readable lines like:
      [NBSH — Baliqchi tumani (5 ta MFY)]: Nogironlar soni: 234 | Bolalar soni: 45
    """
    lines: list[str] = []

    for s in sections:
        row_count = (await db.execute(
            select(func.count())
            .select_from(SectionRow)
            .where(SectionRow.district_id == district.id, SectionRow.section_id == s.id)
        )).scalar()

        if not row_count:
            continue

        # Fetch all cells for this district+section in one query
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

        # Aggregate numeric values in Python (handles any data_type)
        col_order: list[int] = []
        col_names: dict[int, str] = {}
        col_sums: dict[int, float] = {}

        for cell, col in cells_result.all():
            if col.id not in col_names:
                col_names[col.id] = col.name
                col_order.append(col.id)
            if cell.value and cell.value.strip():
                try:
                    cleaned = re.sub(r'[\s,]', '', cell.value)
                    col_sums[col.id] = col_sums.get(col.id, 0.0) + float(cleaned)
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
                f"[{s.name} — {district.name} ({row_count} ta MFY yozuvi)]: "
                + " | ".join(parts)
            )
        else:
            lines.append(
                f"[{s.name} — {district.name}]: {row_count} ta MFY yozuvi mavjud"
            )

    return "\n".join(lines)


async def _find_relevant_rows(
    db: AsyncSession,
    query: str,
    sections: list,
    districts: list,
    limit: int = 8,
) -> str:
    """Return relevant DB context for the AI:
    1. If a district name is in the query → aggregate numeric values for that district.
    2. Otherwise search for MFY/entity names in cell values.
    """
    query_lower = query.lower()

    # ── Phase 1: district-level aggregation (fuzzy + cross-script) ─────────
    query_words = re.split(r'\s+', query_lower)
    for d in districts:
        base = d.name.lower()
        d_variants = [
            base,
            base.replace(" tumani", "").replace(" shahri", ""),
            _cyr2lat(base),
            _lat2cyr(base),
            _cyr2lat(base).replace(" tumani", "").replace(" shahri", ""),
        ]
        for word in query_words:
            if len(word) < 4:
                continue
            for variant in d_variants:
                if not variant or len(variant) < 4:
                    continue
                if _fuzzy_contains(word, variant) or _fuzzy_contains(variant, word):
                    return await _district_aggregation(db, d, sections)

    # ── Phase 2: MFY / entity keyword search ────────────────────────────────
    candidates: list[str] = []
    mfy_match = re.search(
        r"(\w{2,}(?:\s+\w{2,})?)\s+(?:MFY|mahalla(?:si)?)",
        query,
        re.IGNORECASE | re.UNICODE,
    )
    if mfy_match:
        candidates.append(mfy_match.group(1).strip())

    proper = re.findall(r"[A-ZА-Я][a-zA-Zа-я]{2,}", query)
    STOPWORDS = {"kechirasiz", "salom", "rahmat", "qanday", "qancha", "nechta"}
    for p in proper:
        if p.lower() not in STOPWORDS:
            candidates.append(p)

    seen: set[str] = set()
    keywords: list[str] = []
    for c in candidates:
        if c.lower() not in seen:
            seen.add(c.lower())
            keywords.append(c)

    if not keywords:
        return ""

    matching_row_ids: set[int] = set()
    for kw in keywords[:3]:
        for term in _search_variants(kw):
            result = await db.execute(
                select(SectionCell.row_id)
                .where(func.lower(SectionCell.value).contains(term.lower()))
                .distinct()
                .limit(limit)
            )
            for rid in result.scalars():
                matching_row_ids.add(rid)
        if len(matching_row_ids) >= limit:
            break

    if not matching_row_ids:
        return ""

    row_ids = list(matching_row_ids)[:limit]

    rows = (await db.execute(
        select(SectionRow).where(SectionRow.id.in_(row_ids))
    )).scalars().all()

    cells_result = await db.execute(
        select(SectionCell, SectionColumn)
        .join(SectionColumn, SectionCell.column_id == SectionColumn.id)
        .where(SectionCell.row_id.in_(row_ids))
        .order_by(SectionCell.row_id, SectionColumn.order)
    )
    cells_by_row: dict[int, list[str]] = defaultdict(list)
    for cell, col in cells_result.all():
        if cell.value and cell.value.strip():
            cells_by_row[cell.row_id].append(f"{col.name}: {cell.value}")

    section_map = {s.id: s.name for s in sections}
    district_map = {d.id: d.name for d in districts}

    lines: list[str] = []
    for row in rows:
        s_name = section_map.get(row.section_id, f"Bo'lim#{row.section_id}")
        d_name = district_map.get(row.district_id, "Noma'lum tuman")
        cell_text = " | ".join(cells_by_row.get(row.id, []))
        if cell_text:
            lines.append(f"[{s_name} — {d_name}]: {cell_text}")

    return "\n".join(lines)

def _strip_for_speech(text: str) -> str:
    """Convert markdown AI reply to clean plain text suitable for TTS.
    - Removes **bold**, *italic* markers
    - Removes list markers (numbers, bullets)
    - Expands common abbreviations so the TTS pronounces them correctly
    - Collapses newlines to spaces
    - Strips emojis
    """
    # Remove bold / italic markers
    text = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', text)
    # Remove numbered list prefixes "1. " "1) "
    text = re.sub(r'(?m)^\d+[.)]\s+', '', text)
    # Remove bullet prefixes "- " "• "
    text = re.sub(r'(?m)^[-•]\s+', '', text)
    # Expand abbreviations
    ABBREVS = {
        r'\bNBSH\b': "nogironligi bo'lgan shaxslar bo'limi",
        r'\bMFY\b': "mahalla fuqarolar yig'ilishi",
        r'\bIHMA\b': "Ijtimoiy Himoya Menejment Axborot Tizimi",
        r'\bta\b': "ta",
    }
    for pattern, replacement in ABBREVS.items():
        text = re.sub(pattern, replacement, text)
    # Collapse multiple newlines → pause (period + space)
    text = re.sub(r'\n{2,}', '. ', text)
    text = re.sub(r'\n', ' ', text)
    # Remove emoji (basic Unicode blocks)
    text = re.sub(r'[\U0001F300-\U0001FFFF\U00002600-\U000027BF]', '', text)
    # Collapse extra spaces
    text = re.sub(r'  +', ' ', text)
    return text.strip()


AI_API_URL = "https://p950-w009-runai-p950.runai-inference.dc.uz/v1/chat/completions"
AI_API_KEY = "sk-_RFXXpNRwyAc5ap6XUztNQ"
AI_MODEL = "openai/gpt-oss-120b"


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat")
async def ai_chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_admin_or_superadmin),
):
    # Gather live context from DB
    sections = (await db.execute(
        select(Section).where(Section.is_active == True).order_by(Section.order)
    )).scalars().all()

    total_records = (await db.execute(
        select(func.count()).select_from(SectionRow)
    )).scalar()

    appeals_total = (await db.execute(
        select(func.count()).select_from(Appeal)
    )).scalar()
    appeals_new = (await db.execute(
        select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.NEW)
    )).scalar()
    appeals_in_review = (await db.execute(
        select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.IN_REVIEW)
    )).scalar()
    appeals_resolved = (await db.execute(
        select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.RESOLVED)
    )).scalar()
    appeals_rejected = (await db.execute(
        select(func.count()).select_from(Appeal).where(Appeal.status == AppealStatus.REJECTED)
    )).scalar()

    bot_users = (await db.execute(
        select(func.count()).select_from(BotUser).where(BotUser.is_registered == True)
    )).scalar()
    blocked_users = (await db.execute(
        select(func.count()).select_from(BotUser).where(BotUser.is_blocked == True)
    )).scalar()

    districts = (await db.execute(select(District).order_by(District.name))).scalars().all()

    # Per-section counts
    section_lines = []
    for s in sections:
        cnt = (await db.execute(
            select(func.count()).select_from(SectionRow).where(SectionRow.section_id == s.id)
        )).scalar()
        section_lines.append(f"  • {s.name} ({s.full_name}): jami {cnt} ta yozuv")

    sections_text = "\n".join(section_lines) if section_lines else "  (bo'lim yo'q)"

    # District × Section breakdown — single GROUP BY query
    counts_result = await db.execute(
        select(SectionRow.district_id, SectionRow.section_id, func.count().label("cnt"))
        .group_by(SectionRow.district_id, SectionRow.section_id)
    )
    counts = {(r.district_id, r.section_id): r.cnt for r in counts_result}

    district_lines = []
    for d in districts:
        d_total = sum(counts.get((d.id, s.id), 0) for s in sections)
        detail = "; ".join(
            f"{s.name}: {counts.get((d.id, s.id), 0)} ta MFY"
            for s in sections
            if counts.get((d.id, s.id), 0) > 0
        ) or "ma'lumot yo'q"
        district_lines.append(f"  • {d.name}: jami {d_total} ta MFY yozuvi ({detail})")

    districts_text = "\n".join(district_lines) if district_lines else "  (tuman yo'q)"

    # Row-level search: look for MFY names or other entities in the user's message
    relevant_rows_text = await _find_relevant_rows(db, body.message, sections, districts)
    relevant_section = ""
    if relevant_rows_text:
        relevant_section = f"""

=== SO'ROVGA TEGISHLI MA'LUMOTLAR ===
{relevant_rows_text}
====================================="""

    system_prompt = f"""Siz IHMA tizimining AI yordamchisisiz.
IHMA — Andijon viloyati Ijtimoiy Himoya Menejment Axborot Tizimi.

=== JORIY TIZIM MA'LUMOTLARI ===

Bo'limlar ({len(sections)} ta, jami {total_records} ta yozuv):
{sections_text}

Tumanlar bo'yicha taqsimot ({len(districts)} ta tuman):
{districts_text}

Murojaatlar:
  • Jami: {appeals_total} ta
  • Yangi: {appeals_new} ta
  • Ko'rib chiqilmoqda: {appeals_in_review} ta
  • Hal qilingan: {appeals_resolved} ta
  • Rad etilgan: {appeals_rejected} ta

Telegram bot foydalanuvchilari:
  • Ro'yxatdan o'tganlar: {bot_users} ta
  • Bloklangan: {blocked_users} ta
================================{relevant_section}

Qoidalar:
1. Faqat ushbu tizim va uning ma'lumotlari haqida savollarga javob bering.
2. Tashqi mavzular, siyosat, shaxsiy masalalar — rad eting.
3. Foydalanuvchi qaysi tilda yozsa (o'zbek/rus), shu tilda javob bering.
4. Qisqa, aniq, foydali javoblar bering. Markdown ishlatish mumkin: **qalin**, raqamli va bullet ro'yxatlar.
5. Agar aniq raqam so'ralsa — to'g'ridan-to'g'ri javob bering, "administrator" ga yo'llamang.
6. "SO'ROVGA TEGISHLI MA'LUMOTLAR" bo'limida tegishli yozuv bo'lsa, undan foydalanib aniq javob bering.
7. MUHIM: Tumanlar bo'yicha taqsimotdagi raqamlar — MFY YOZUVLARI SONI (qatorlar soni), nafaqa oluvchilar yoki shaxslar soni EMAS. Aniq sonlar (nogironlar soni, nafaqaxo'rlar soni va h.k.) uchun "SO'ROVGA TEGISHLI MA'LUMOTLAR" bo'limidagi real hisob-kitoblardan foydalaning."""

    messages = [{"role": "system", "content": system_prompt}]
    # Add recent history (max 10 turns)
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
                    "temperature": 0.4,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        reply = f"AI xizmat xatosi: {e.response.status_code}"
    except Exception as e:
        reply = f"Xato yuz berdi. Qaytadan urinib ko'ring."

    return {"reply": reply, "speech_text": _strip_for_speech(reply)}
