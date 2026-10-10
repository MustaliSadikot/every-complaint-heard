"""
Local AI integration via Ollama — FR-08.

Calls only the local Ollama endpoint. Validates JSON responses against schema.
Falls back to deterministic classifier on any error (timeout, malformed JSON,
model unavailable, low confidence).

Never sends data to external cloud APIs.
"""

from __future__ import annotations
import json
import logging
import re
from typing import Optional

import httpx
from app.config import settings
from app.db.models import DepartmentEnum, ClassificationModeEnum
from app.schemas import AIClassificationResult
from app.core.classifier import classify_fallback, compute_urgency_level, _has_safety_signal

logger = logging.getLogger(__name__)

_AI_AVAILABLE: Optional[bool] = None   # cached status; None = not yet checked


def _build_prompt(text: str, language: str) -> str:
    return f"""You are a triage assistant for Gujarat Metro passenger complaints.
Analyse the complaint below and respond ONLY with a valid JSON object — no markdown, no explanation.

Complaint language hint: {language}
Complaint text: "{text}"

Required JSON schema (all fields mandatory):
{{
  "department": one of ["Safety", "Cleanliness", "Fare and Ticketing", "Lifts and Escalators", "Staff Behaviour", "Other/General"],
  "confidence": float between 0.0 and 1.0,
  "urgency_score": integer between 0 and 100,
  "safety_flag": boolean (true if there is any risk to life, injury, fire, violence or emergency),
  "draft_reply": string (polite reply in {language} language, max 120 words; do NOT invent resolution times, refunds or commitments),
  "reply_language": "{language}"
}}

Rules:
- If safety_flag is true, urgency_score MUST be >= 80.
- draft_reply must be in the language indicated by reply_language.
- Return ONLY the JSON object, nothing else.
"""


def _validate_ai_response(data: dict, text: str) -> AIClassificationResult:
    """
    Validate and normalise the AI JSON response.
    Raises ValueError if any required field is missing or invalid.
    Safety override: if text contains safety signals but AI says safety_flag=False,
    we correct it — FR-03 mandates we never rely on model output alone for safety.
    """
    required = {"department", "confidence", "urgency_score", "safety_flag", "draft_reply", "reply_language"}
    missing = required - set(data.keys())
    if missing:
        raise ValueError(f"AI response missing fields: {missing}")

    # Validate department
    dept_str = data["department"]
    try:
        department = DepartmentEnum(dept_str)
    except ValueError:
        raise ValueError(f"Unknown department from AI: {dept_str!r}")

    confidence = float(data["confidence"])
    if not 0.0 <= confidence <= 1.0:
        raise ValueError(f"Confidence out of range: {confidence}")

    urgency_score = int(data["urgency_score"])
    if not 0 <= urgency_score <= 100:
        raise ValueError(f"Urgency score out of range: {urgency_score}")

    safety_flag = bool(data["safety_flag"])
    draft_reply = str(data["draft_reply"]).strip()
    reply_language = str(data["reply_language"])

    if not draft_reply:
        raise ValueError("AI returned empty draft_reply.")

    # ─── Safety override (FR-03) ──────────────────────────────────────────
    # If deterministic signals say "safety" but AI doesn't → override AI.
    if _has_safety_signal(text) and not safety_flag:
        logger.warning(
            "AI safety_flag=False overridden to True by deterministic safety signal check."
        )
        safety_flag = True

    if safety_flag and urgency_score < 80:
        logger.warning(
            "AI urgency_score=%d overridden to 80 because safety_flag=True.", urgency_score
        )
        urgency_score = 80

    if safety_flag and department == DepartmentEnum.other:
        department = DepartmentEnum.safety

    return AIClassificationResult(
        department=department,
        confidence=confidence,
        urgency_score=urgency_score,
        safety_flag=safety_flag,
        draft_reply=draft_reply,
        reply_language=reply_language,
        mode=ClassificationModeEnum.ai,
    )


async def check_ai_available() -> bool:
    """
    Probe Ollama /api/tags to see if the configured model is available.
    Updates cached _AI_AVAILABLE status.
    """
    global _AI_AVAILABLE
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
            names = [m.get("name", "").split(":")[0] for m in models]
            model_base = settings.ollama_model.split(":")[0]
            available = any(model_base in n for n in names)
            _AI_AVAILABLE = available
            logger.info(
                "Ollama check: %s | model '%s' found=%s | all=%s",
                settings.ollama_base_url, settings.ollama_model, available, names
            )
            return available
    except Exception as exc:
        logger.info("Ollama not reachable: %s", exc)
        _AI_AVAILABLE = False
        return False


def get_ai_status() -> bool:
    """Return last-known AI availability (may be stale if not re-checked)."""
    return bool(_AI_AVAILABLE)


async def classify_with_ai(text: str, language: str) -> AIClassificationResult:
    """
    Attempt AI classification via Ollama.
    On any failure, falls back to deterministic classifier and logs the reason.
    """
    # Check AI availability first
    ai_up = await check_ai_available()
    if not ai_up or not settings.ai_enabled:
        reason = "AI disabled" if not settings.ai_enabled else "Ollama unavailable"
        logger.info("Using fallback classifier: %s", reason)
        return classify_fallback(text, language)

    prompt = _build_prompt(text, language)

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
            payload = {
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1, "num_predict": 512},
            }
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            raw_response = resp.json().get("response", "")

        # Extract JSON from response (model may wrap it in markdown)
        json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON object found in AI response: {raw_response[:200]!r}")

        data = json.loads(json_match.group())
        result = _validate_ai_response(data, text)
        logger.info(
            "AI classification success | dept=%s | urgency=%d | safety=%s | conf=%.2f",
            result.department.value, result.urgency_score, result.safety_flag, result.confidence,
        )
        return result

    except httpx.TimeoutException:
        logger.warning("Ollama timeout after %.1fs — using fallback.", settings.ollama_timeout_seconds)
    except httpx.HTTPStatusError as exc:
        logger.warning("Ollama HTTP error %d — using fallback.", exc.response.status_code)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("AI response validation failed: %s — using fallback.", exc)
    except Exception as exc:
        logger.warning("Unexpected AI error: %s — using fallback.", exc)

    # Always fall back gracefully
    return classify_fallback(text, language)
