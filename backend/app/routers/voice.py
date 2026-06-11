"""
Voice proxy endpoints: STT (Speech-to-Text) and TTS (Text-to-Speech)
via Muxlisa AI service.  API key is NEVER exposed to the frontend.
"""
import io
import logging

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

from app.core.config import settings
from app.core.dependencies import get_admin_or_superadmin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])

MUXLISA_BASE = "https://service.muxlisa.uz/api/v2"
MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB

# All MIME types accepted by Muxlisa (strip codec params before checking)
ALLOWED_BASE_TYPES = {
    "audio/mpeg",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/vnd.wav",
    "audio/ogg",
    "audio/flac",
    "audio/x-m4a",
    "audio/aac",
    "audio/mp4",
    "audio/webm",
    "video/webm",   # MediaRecorder on some browsers reports this
    "audio/3gpp",
    "audio/3gpp2",
    "audio/x-ms-wma",
    "audio/amr",
}


def _muxlisa_headers_json() -> dict:
    if not settings.MUXLISA_API_KEY:
        raise HTTPException(503, "Voice service is not configured (MUXLISA_API_KEY missing)")
    return {
        "x-api-key": settings.MUXLISA_API_KEY,
        "Content-Type": "application/json",
    }


def _muxlisa_headers_multipart() -> dict:
    if not settings.MUXLISA_API_KEY:
        raise HTTPException(503, "Voice service is not configured (MUXLISA_API_KEY missing)")
    return {"x-api-key": settings.MUXLISA_API_KEY}


def _handle_muxlisa_error(status: int, endpoint: str) -> None:
    if status == 400:
        raise HTTPException(400, "Invalid audio / bad request sent to voice service")
    if status == 402:
        raise HTTPException(402, "Voice service quota exceeded")
    if status == 429:
        raise HTTPException(429, "Voice service rate limit — try again shortly")
    if status >= 500:
        raise HTTPException(502, f"Voice service unavailable ({endpoint})")


# ─── STT ────────────────────────────────────────────────────────────────────

@router.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(..., description="Audio file (wav/webm/ogg/…)"),
    _=Depends(get_admin_or_superadmin),
):
    """Accept an audio file, proxy to Muxlisa STT, return recognised text."""
    # Validate MIME type (ignore codec params like ;codecs=opus)
    base_type = (audio.content_type or "").split(";")[0].strip().lower()
    if base_type not in ALLOWED_BASE_TYPES:
        raise HTTPException(
            400,
            f"Unsupported audio format '{base_type}'. "
            f"Use wav, webm, ogg, mp3, flac or aac.",
        )

    content = await audio.read()
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(400, "Audio file too large — maximum is 5 MB")
    if len(content) == 0:
        raise HTTPException(400, "Audio file is empty")

    headers = _muxlisa_headers_multipart()

    for attempt in range(2):  # 1 retry on 5xx
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{MUXLISA_BASE}/stt",
                    headers=headers,
                    files={"audio": (audio.filename or "voice.wav", content, "audio/wav")},
                )
        except httpx.TimeoutException:
            logger.warning("Muxlisa STT timeout (attempt %d)", attempt + 1)
            if attempt == 1:
                raise HTTPException(504, "Voice recognition service timed out")
            continue
        except httpx.RequestError as exc:
            logger.error("Muxlisa STT network error: %s", exc)
            raise HTTPException(502, "Could not reach voice service")

        if resp.status_code >= 500 and attempt == 0:
            continue  # retry once on server error
        _handle_muxlisa_error(resp.status_code, "STT")
        break

    try:
        text = resp.json().get("text", "")
    except Exception:
        text = resp.text or ""

    return {"success": True, "text": text.strip()}


# ─── TTS ────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    speaker: int = 0  # 0 = female, 1 = male

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        # Muxlisa hard limit — truncate at sentence boundary if possible
        if len(v) > 512:
            trimmed = v[:509]
            last_break = max(trimmed.rfind(". "), trimmed.rfind("? "), trimmed.rfind("! "))
            v = trimmed[: last_break + 1].strip() if last_break > 100 else trimmed + "…"
        return v

    @field_validator("speaker")
    @classmethod
    def validate_speaker(cls, v: int) -> int:
        if v not in (0, 1):
            raise ValueError("speaker must be 0 (female) or 1 (male)")
        return v


@router.post("/tts")
async def text_to_speech(
    body: TTSRequest,
    _=Depends(get_admin_or_superadmin),
):
    """Convert text to WAV audio via Muxlisa TTS. Returns binary WAV stream."""
    headers = _muxlisa_headers_json()

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{MUXLISA_BASE}/tts",
                    headers=headers,
                    json={"text": body.text, "speaker": body.speaker},
                )
        except httpx.TimeoutException:
            logger.warning("Muxlisa TTS timeout (attempt %d)", attempt + 1)
            if attempt == 1:
                raise HTTPException(504, "Text-to-speech service timed out")
            continue
        except httpx.RequestError as exc:
            logger.error("Muxlisa TTS network error: %s", exc)
            raise HTTPException(502, "Could not reach text-to-speech service")

        if resp.status_code >= 500 and attempt == 0:
            continue
        _handle_muxlisa_error(resp.status_code, "TTS")
        break

    return StreamingResponse(
        io.BytesIO(resp.content),
        media_type="audio/wav",
        headers={
            "Content-Disposition": "inline; filename=speech.wav",
            "Cache-Control": "no-store",
        },
    )
