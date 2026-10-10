"""
FastAPI application entry point — Every Complaint Heard.
"""

from __future__ import annotations
import logging
import logging.config
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import init_db
from app.core.ai_engine import check_ai_available
from app.api.complaints import router as complaints_router
from app.api.dashboard import router as dashboard_router
from app.api.system import router as system_router

# ─── Structured Logging ───────────────────────────────────────────────────────
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        }
    },
    "root": {"level": "INFO", "handlers": ["console"]},
    "loggers": {
        "app": {"level": "DEBUG" if settings.debug else "INFO", "propagate": True},
        "sqlalchemy.engine": {"level": "WARNING", "propagate": True},
    },
}
logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    await init_db()
    logger.info("Database ready.")
    ai_ok = await check_ai_available()
    logger.info(
        "Local AI status: %s (model=%s, endpoint=%s)",
        "AVAILABLE" if ai_ok else "UNAVAILABLE — fallback mode active",
        settings.ollama_model,
        settings.ollama_base_url,
    )
    yield
    logger.info("Shutting down %s.", settings.app_name)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Offline-first AI complaint triage system for Gujarat Metro. "
        "PS-07 hackathon submission."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(complaints_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(system_router, prefix="/api")


@app.get("/", tags=["health"])
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
