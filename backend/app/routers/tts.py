from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from openai import OpenAI
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/tts", tags=["tts"])

openai_client = OpenAI(api_key=settings.openai_api_key)


def _elevenlabs_synthesize(text: str) -> bytes:
    import httpx

    response = httpx.post(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
        headers={
            "xi-api-key": settings.elevenlabs_api_key,
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
        timeout=30.0,
    )
    if response.status_code != 200:
        raise Exception(f"ElevenLabs error: {response.status_code}")
    return response.content


def _openai_synthesize(text: str) -> bytes:
    response = openai_client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text,
    )
    return response.content


@router.post("/synthesize")
async def synthesize(text: str):
    try:
        if settings.elevenlabs_api_key:
            audio_bytes = _elevenlabs_synthesize(text)
        else:
            audio_bytes = _openai_synthesize(text)
    except Exception:
        audio_bytes = _openai_synthesize(text)

    return StreamingResponse(
        BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=question.mp3"},
    )
