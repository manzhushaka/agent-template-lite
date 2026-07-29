from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from contextlib import asynccontextmanager

from agno.db.mysql import MySQLDb
from agno.os import AgentOS
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.agent import AGENT_ID, build_agent
from app.config import Settings
from app.console_client import ConsoleClient
from app.knowledge_store import KnowledgeDocument, LanceDbKnowledgeStore

settings = Settings.from_env()
logger = logging.getLogger(__name__)
agent_database = MySQLDb(
    id="agent-template-mysql",
    db_url=settings.agent_database_url,
    db_schema=settings.agent_database_schema,
    create_schema=False,
    session_table="agent_sessions",
    memory_table="agent_memories",
    metrics_table="agent_metrics",
    eval_table="agent_evaluations",
    knowledge_table="agent_knowledge",
)
knowledge_store = LanceDbKnowledgeStore(settings.lancedb_uri)
business_agent = build_agent(settings, knowledge_store, agent_database)
console_client = ConsoleClient(settings.console_url, settings.internal_api_token)


def rebuild_knowledge() -> list[int]:
    documents = [KnowledgeDocument(**item) for item in console_client.published_knowledge()]
    return knowledge_store.rebuild(documents)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Warm the vector index from MySQL metadata without blocking process startup forever."""
    try:
        await asyncio.wait_for(asyncio.to_thread(rebuild_knowledge), timeout=90)
    except Exception as error:  # noqa: BLE001 - startup must remain available for a manual retry.
        # Console may be starting concurrently; operators can retry from the knowledge page.
        logger.warning("Initial knowledge reindex skipped: %s", type(error).__name__)
    yield


base_app = FastAPI(title="Agent Template AgentOS", version="0.1.0")


@base_app.middleware("http")
async def internal_auth(request: Request, call_next: Callable):
    """Protect AgentOS because only the Next.js BFF and Console should call it."""
    if request.url.path in {"/api/health", "/docs", "/openapi.json"}:
        return await call_next(request)
    expected = f"Bearer {settings.internal_api_token}"
    if request.headers.get("authorization") != expected:
        return JSONResponse({"detail": "forbidden"}, status_code=403)
    return await call_next(request)


@base_app.get("/api/health", tags=["Application"])
def health() -> dict:
    return {
        "status": "ok",
        "runtime": "AgentOS",
        "model_configured": bool(settings.model_api_key),
        "model": settings.model_name,
        "agent_id": AGENT_ID,
        "knowledge_store": "LanceDB",
    }


@base_app.get("/api/admin/overview", tags=["Admin"])
def admin_overview() -> dict:
    tools = []
    for item in business_agent.tools or []:
        entry = getattr(item, "entrypoint", item)
        tools.append(
            {
                "name": getattr(entry, "name", None)
                or getattr(entry, "__name__", entry.__class__.__name__),
                "confirmation": bool(getattr(entry, "requires_confirmation", False)),
            }
        )
    return {
        "status": "ok",
        "agent": {"id": business_agent.id, "name": business_agent.name},
        "model": {
            "name": settings.model_name,
            "baseUrl": settings.model_base_url,
            "configured": bool(settings.model_api_key),
        },
        "tools": tools,
        "knowledge": {
            "store": "LanceDB",
            "indexedDocuments": knowledge_store.count_documents(),
        },
    }


@base_app.post("/api/admin/knowledge/reindex", tags=["Admin"])
async def admin_reindex_knowledge() -> dict:
    try:
        indexed_ids = await asyncio.to_thread(rebuild_knowledge)
        return {"status": "ok", "indexedIds": indexed_ids, "count": len(indexed_ids)}
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"知识索引失败：{type(error).__name__}") from error


agent_os = AgentOS(
    id="business-demo-agent-os",
    name="智能业务助手",
    description="Next.js 全栈与 Agno 的独立业务 Demo 运行时",
    agents=[business_agent],
    db=agent_database,
    base_app=base_app,
    lifespan=lifespan,
    cors_allowed_origins=list(settings.cors_origins),
    tracing=True,
)
app = agent_os.get_app()


if __name__ == "__main__":
    agent_os.serve(
        app="app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
