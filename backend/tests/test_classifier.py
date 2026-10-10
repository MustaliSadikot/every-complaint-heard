"""
TEST SUITE: Fallback Classifier
================================
Tests for deterministic local classifier — no AI required.

Test IDs: TC-CLASS-001 through TC-CLASS-010
"""

import pytest
from app.core.classifier import (
    classify_fallback, compute_urgency_level,
    _has_safety_signal, _score_department, _score_urgency,
)
from app.db.models import DepartmentEnum, ClassificationModeEnum


# ─── TC-CLASS-001: English safety complaint ──────────────────────────────────
def test_safety_english():
    """TC-CLASS-001 | English fire complaint → Safety dept, Critical urgency, safety_flag=True."""
    result = classify_fallback("There is a fire on platform 3, please help!", "en")
    assert result.department == DepartmentEnum.safety
    assert result.safety_flag is True
    assert result.urgency_score >= 80
    assert result.mode == ClassificationModeEnum.fallback


# ─── TC-CLASS-002: Hindi emergency ───────────────────────────────────────────
def test_safety_hindi():
    """TC-CLASS-002 | Hindi injury complaint → safety_flag=True."""
    result = classify_fallback("Platform par aag lag gayi hai aur log chot kha rahe hain", "hi")
    assert result.safety_flag is True
    assert result.urgency_score >= 80


# ─── TC-CLASS-003: Gujarati cleanliness ──────────────────────────────────────
def test_cleanliness_gujarati():
    """TC-CLASS-003 | Gujarati dirty toilet → Cleanliness dept."""
    result = classify_fallback("Saucha kharab chhe, toilet ganda chhe badbu ave chhe", "gu")
    assert result.department == DepartmentEnum.cleanliness
    assert result.safety_flag is False


# ─── TC-CLASS-004: English fare complaint ────────────────────────────────────
def test_fare_ticketing():
    """TC-CLASS-004 | Ticket overcharge complaint → Fare and Ticketing."""
    result = classify_fallback("I was overcharged for my metro ticket, I need a refund", "en")
    assert result.department == DepartmentEnum.fare_ticketing


# ─── TC-CLASS-005: Lift breakdown ────────────────────────────────────────────
def test_lifts_escalators():
    """TC-CLASS-005 | Broken lift complaint → Lifts and Escalators dept."""
    result = classify_fallback("The lift at Kalupur station is not working and out of order", "en")
    assert result.department == DepartmentEnum.lifts_escalators


# ─── TC-CLASS-006: Staff behaviour ───────────────────────────────────────────
def test_staff_behaviour():
    """TC-CLASS-006 | Rude staff → Staff Behaviour dept."""
    result = classify_fallback("The guard was very rude and disrespectful to me at the gate", "en")
    assert result.department == DepartmentEnum.staff_behaviour


# ─── TC-CLASS-007: Mixed Gujarati-English ────────────────────────────────────
def test_mixed_gu_en():
    """TC-CLASS-007 | Mixed Gu-En complaint → valid classification returned."""
    result = classify_fallback("Ticket machine chhe kharab — cannot recharge my card", "mixed_gu_en")
    assert result.department is not None
    assert result.mode == ClassificationModeEnum.fallback
    assert result.draft_reply


# ─── TC-CLASS-008: Unknown/general complaint ─────────────────────────────────
def test_other_general():
    """TC-CLASS-008 | Generic complaint → Other/General dept."""
    result = classify_fallback("I have a general inquiry about the metro service", "en")
    assert result.department == DepartmentEnum.other


# ─── TC-CLASS-009: Empty-ish complaint (single space handled by validator) ───
def test_low_urgency():
    """TC-CLASS-009 | Low-urgency complaint → Low urgency level."""
    result = classify_fallback("The metro was slightly delayed today", "en")
    level = compute_urgency_level(result.urgency_score)
    assert level in ("Low", "Medium")


# ─── TC-CLASS-010: Safety override — smoke keyword ───────────────────────────
def test_smoke_safety_override():
    """TC-CLASS-010 | 'smoke' keyword → safety_flag forced True regardless of department match."""
    result = classify_fallback("I can smell smoke coming from the vending machine area", "en")
    assert result.safety_flag is True
    assert result.urgency_score >= 80


# ─── Urgency threshold tests ─────────────────────────────────────────────────
def test_compute_urgency_level_critical():
    """compute_urgency_level(90) → Critical."""
    assert compute_urgency_level(90) == "Critical"


def test_compute_urgency_level_high():
    """compute_urgency_level(65) → High."""
    assert compute_urgency_level(65) == "High"


def test_compute_urgency_level_medium():
    """compute_urgency_level(40) → Medium."""
    assert compute_urgency_level(40) == "Medium"


def test_compute_urgency_level_low():
    """compute_urgency_level(10) → Low."""
    assert compute_urgency_level(10) == "Low"


def test_safety_signal_detection():
    """_has_safety_signal detects various safety keywords."""
    assert _has_safety_signal("There is a fire!") is True
    assert _has_safety_signal("aag lag gayi") is True
    assert _has_safety_signal("The ticket machine is broken") is False
