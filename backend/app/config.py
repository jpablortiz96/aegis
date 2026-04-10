import logging
from functools import lru_cache

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Gemini (sole LLM provider)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # Observability
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    # Storage
    upload_dir: str = "/app/uploads"
    db_path: str = "/app/db/aegis.db"

    # ── Internal compat fields (used by orchestrator — do not remove) ──────
    # orchestrator.py checks llm_provider and openrouter_model for Langfuse
    # metadata logging; keeping them here as silent defaults avoids breakage.
    llm_provider: str = "gemini"
    openrouter_model: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Module-level singleton — allows `from app.config import settings`
settings = get_settings()


def log_config():
    """Print Gemini config at startup for easy debugging."""
    s = get_settings()
    gem_key = f"set ({s.gemini_api_key[:8]}...)" if s.gemini_api_key else "NOT SET"
    lf_ok   = bool(s.langfuse_public_key and s.langfuse_secret_key)

    print("=" * 60, flush=True)
    print(f"[AEGIS CONFIG] GEMINI_API_KEY : {gem_key}", flush=True)
    print(f"[AEGIS CONFIG] GEMINI_MODEL   : {s.gemini_model}", flush=True)
    print(f"[AEGIS CONFIG] LANGFUSE       : {'configured' if lf_ok else 'NOT configured'}", flush=True)
    print("=" * 60, flush=True)


# ---------------------------------------------------------------------------
# Langfuse singleton — returns None gracefully if keys are not configured
# ---------------------------------------------------------------------------

_langfuse_client = None
_langfuse_attempted = False


def get_langfuse():
    """Return the Langfuse client singleton, or None if not configured."""
    global _langfuse_client, _langfuse_attempted
    if _langfuse_attempted:
        return _langfuse_client

    _langfuse_attempted = True
    s = get_settings()

    if not s.langfuse_public_key or not s.langfuse_secret_key:
        logger.warning("Langfuse keys not configured — tracing disabled.")
        return None

    try:
        from langfuse import Langfuse

        _langfuse_client = Langfuse(
            public_key=s.langfuse_public_key,
            secret_key=s.langfuse_secret_key,
            host=s.langfuse_host or "https://cloud.langfuse.com",
        )
        logger.info("Langfuse tracing enabled (host: %s).", s.langfuse_host)
    except Exception as exc:
        logger.warning("Langfuse init failed — tracing disabled: %s", exc)
        _langfuse_client = None

    return _langfuse_client
