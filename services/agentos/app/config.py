from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent.parent
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    """Validated service configuration loaded once when AgentOS starts."""

    model_name: str
    model_base_url: str
    model_api_key: str
    agent_database_url: str
    agent_database_schema: str
    console_url: str
    internal_api_token: str
    lancedb_uri: Path
    host: str
    port: int
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> Settings:
        """
        Fail fast when the real model is missing.

        EXTENSION: Add provider-specific settings here, but normalize them before Agent creation
        so the rest of the runtime remains provider-independent.
        """
        model_name = _required("MODEL_NAME")
        model_base_url = _required("MODEL_BASE_URL").rstrip("/")
        model_api_key = _required("MODEL_API_KEY")
        database_url = _required("AGENT_DATABASE_URL")
        schema = urlparse(database_url).path.lstrip("/")
        if not schema:
            raise RuntimeError("AGENT_DATABASE_URL 必须包含数据库名")
        port = int(os.getenv("AGENTOS_PORT", "8000"))
        if not 1 <= port <= 65535:
            raise RuntimeError("AGENTOS_PORT 必须在 1 到 65535 之间")
        vector_path = Path(os.getenv("LANCEDB_URI", "../../var/lancedb"))
        if not vector_path.is_absolute():
            vector_path = (BASE_DIR / vector_path).resolve()
        origins = tuple(
            item.strip()
            for item in os.getenv("AGENTOS_CORS_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000").split(",")
            if item.strip()
        )
        return cls(
            model_name=model_name,
            model_base_url=model_base_url,
            model_api_key=model_api_key,
            agent_database_url=database_url,
            agent_database_schema=schema,
            console_url=os.getenv("CONSOLE_URL", "http://127.0.0.1:3001").rstrip("/"),
            internal_api_token=_required("INTERNAL_API_TOKEN"),
            lancedb_uri=vector_path,
            host=os.getenv("AGENTOS_HOST", "127.0.0.1"),
            port=port,
            cors_origins=origins,
        )


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"缺少必填环境变量：{name}")
    return value
