"""
Deterministic local fallback classifier — FR-02, FR-03.

Runs entirely offline without any AI model. Uses keyword matching on
normalised complaint text across Gujarati, Hindi and English.

This is the authoritative safety override: potential emergencies are
ALWAYS flagged regardless of model output.
"""

from __future__ import annotations
import re
import logging
from typing import Dict, List, Tuple
from app.db.models import DepartmentEnum, ClassificationModeEnum
from app.schemas import AIClassificationResult
from app.config import settings

logger = logging.getLogger(__name__)


# ─── Safety Keywords (any language) ─────────────────────────────────────────
# These trigger safety_flag=True and urgency ≥ 80 regardless of anything else.
# FR-03: "Never rely on model output alone for critical safety triage."

SAFETY_SIGNALS: List[str] = [
    # English
    "fire", "smoke", "emergency", "accident", "injury", "injured",
    "hurt", "blood", "dead", "death", "bomb", "threat", "violence",
    "attack", "fight", "assault", "collapse", "explosion", "stuck",
    "trapped", "unconscious", "fall", "fell", "fallen", "electric",
    "shock", "flood", "panic",
    # Hindi transliterations
    "aag", "dhuan", "aapat", "durghatana", "chot", "khoon", "maut",
    "bam", "himsa", "hamla", "fas gaya", "behosh",
    # Gujarati transliterations
    "aag", "dhumo", "tapas", "apghaat", "ighot", "lahi", "mrutyu",
    "bom", "hinsa", "hukumat", "fasi gayo", "behosh",
]

# ─── Department Keyword Map ──────────────────────────────────────────────────

DEPARTMENT_KEYWORDS: Dict[DepartmentEnum, List[str]] = {
    DepartmentEnum.safety: [
        "fire", "smoke", "emergency", "accident", "injury", "hurt",
        "blood", "dead", "bomb", "threat", "violence", "attack", "fight",
        "assault", "collapse", "explosion", "trapped", "stuck", "fall",
        "electric", "shock", "flood", "panic", "unsafe", "danger",
        "security", "guard", "cctv", "aag", "dhuan", "aapat", "himsa",
        "durghatana", "suraksha",
    ],
    DepartmentEnum.cleanliness: [
        "dirty", "clean", "garbage", "trash", "waste", "litter", "smell",
        "odour", "odor", "toilet", "washroom", "bathroom", "filth", "mess",
        "rat", "cockroach", "pest", "sweep", "mop", "spill", "stain",
        "ganda", "safai", "kachara", "saucha", "badbu", "saaf", "gandagi",
    ],
    DepartmentEnum.fare_ticketing: [
        "ticket", "fare", "token", "refund", "overcharge", "price", "pay",
        "payment", "card", "balance", "recharge", "atvm", "tap", "gate",
        "entry", "exit", "barrier", "fraud", "scam", "money", "rupee",
        "tiket", "kiraaya", "bhav", "paise", "refand", "bhugtan",
    ],
    DepartmentEnum.lifts_escalators: [
        "lift", "elevator", "escalator", "stairs", "step", "broken",
        "stuck", "not working", "out of order", "repair", "maintenance",
        "door", "button", "floor", "descend", "ascend",
        "lift band", "eskelator", "seedhi", "maintenance",
    ],
    DepartmentEnum.staff_behaviour: [
        "staff", "employee", "officer", "guard", "behavior", "behaviour",
        "rude", "impolite", "unhelpful", "attitude", "abuse", "insult",
        "harass", "harassment", "manners", "disrespect", "ignore",
        "karmachari", "seva", "andar", "behave", "vyavhar",
    ],
}

# ─── Urgency Keyword Weights ─────────────────────────────────────────────────

URGENCY_KEYWORD_WEIGHTS: List[Tuple[List[str], int]] = [
    # weight 90+: life-threatening
    (["fire", "aag", "explosion", "bomb", "collapse", "unconscious",
      "dead", "death", "maut", "mrutyu"], 95),
    # weight 75: injury / strong threat
    (["injury", "injured", "hurt", "blood", "attack", "assault",
      "violence", "trapped", "stuck", "panic", "shock"], 80),
    # weight 60: significant service failure
    (["broken", "not working", "out of order", "emergency", "danger",
      "unsafe", "fraud", "scam", "overcharge", "refund refused"], 65),
    # weight 40: moderate issue
    (["dirty", "smell", "rude", "abuse", "harassment", "pain"], 45),
    # weight 20: minor issue
    (["slow", "delayed", "missing", "lost", "confusing", "complaint"], 20),
]

# ─── Language → Reply Template Map ──────────────────────────────────────────

REPLY_TEMPLATES: Dict[str, str] = {
    "en": (
        "Dear Passenger, thank you for contacting Gujarat Metro. "
        "We have received your complaint and it has been forwarded to the "
        "concerned department. A team member will follow up with you shortly. "
        "We apologise for any inconvenience caused."
    ),
    "hi": (
        "प्रिय यात्री, गुजरात मेट्रो से संपर्क करने के लिए धन्यवाद। "
        "आपकी शिकायत प्राप्त हो गई है और संबंधित विभाग को भेज दी गई है। "
        "एक टीम सदस्य शीघ्र ही आपसे संपर्क करेगा। "
        "किसी भी असुविधा के लिए हम क्षमाप्रार्थी हैं।"
    ),
    "gu": (
        "પ્રિય મુસાફર, ગુજરાત મેટ્રો સાથે સંપર્ક કરવા બદલ આભાર. "
        "અમને તમારી ફરિયાદ મળી ગઈ છે અને સંબંધિત વિભાગને મોકલી આપવામાં આવી છે. "
        "એક ટીમ સભ્ય ટૂંક સમયમાં તમારો સંપર્ક કરશે. "
        "કોઈ પણ અગવડ માટે અમે દિલગીર છીએ."
    ),
    "mixed_gu_en": (
        "Dear Passenger / પ્રિય મુસાફર, your complaint has been received "
        "and forwarded to the appropriate department. "
        "We will follow up soon / અમે ટૂંક સમયમાં સંપર્ક કરીશું. "
        "Thank you / આભાર."
    ),
    "mixed_hi_en": (
        "Dear Passenger / प्रिय यात्री, your complaint has been received "
        "and forwarded to the appropriate department. "
        "We will follow up soon / हम शीघ्र संपर्क करेंगे. "
        "Thank you / धन्यवाद."
    ),
}


def _normalise(text: str) -> str:
    return text.lower().strip()


def _has_safety_signal(text: str) -> bool:
    norm = _normalise(text)
    return any(signal in norm for signal in SAFETY_SIGNALS)


def _score_department(text: str) -> Tuple[DepartmentEnum, float]:
    norm = _normalise(text)
    scores: Dict[DepartmentEnum, int] = {}
    for dept, keywords in DEPARTMENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in norm)
        if score > 0:
            scores[dept] = score

    if not scores:
        return DepartmentEnum.other, 0.0

    best_dept = max(scores, key=lambda d: scores[d])
    total = sum(scores.values())
    confidence = min(scores[best_dept] / total, 1.0) if total > 0 else 0.0
    return best_dept, round(confidence, 3)


def _score_urgency(text: str, safety_flag: bool) -> int:
    norm = _normalise(text)
    base = 0
    for keywords, weight in URGENCY_KEYWORD_WEIGHTS:
        if any(kw in norm for kw in keywords):
            base = max(base, weight)

    score = min(base, 100)

    # FR-03 guarantee: safety-flagged complaints are always Critical (≥80)
    if safety_flag and score < 80:
        score = 80

    return score


def _get_reply_template(language: str) -> str:
    return REPLY_TEMPLATES.get(language, REPLY_TEMPLATES["en"])


def classify_fallback(text: str, language: str) -> AIClassificationResult:
    """
    Deterministic offline classification — always available.

    Returns a fully valid AIClassificationResult with mode=Fallback.
    Safety signals override department and urgency independently of keyword matching.
    """
    safety_flag = _has_safety_signal(text)
    department, confidence = _score_department(text)

    # Safety always maps to Safety department if flagged
    if safety_flag and department == DepartmentEnum.other:
        department = DepartmentEnum.safety
        confidence = max(confidence, 0.9)

    urgency_score = _score_urgency(text, safety_flag)
    draft_reply = _get_reply_template(language)

    result = AIClassificationResult(
        department=department,
        confidence=confidence,
        urgency_score=urgency_score,
        safety_flag=safety_flag,
        draft_reply=draft_reply,
        reply_language=language,
        mode=ClassificationModeEnum.fallback,
    )

    logger.debug(
        "Fallback classification | dept=%s | urgency=%d | safety=%s",
        department.value, urgency_score, safety_flag,
    )
    return result


def compute_urgency_level(score: int) -> str:
    """Map numeric score to human urgency label using configurable thresholds."""
    t = settings.get_urgency_thresholds()
    if score >= t.critical_min:
        return "Critical"
    if score >= t.high_min:
        return "High"
    if score >= t.medium_min:
        return "Medium"
    return "Low"
