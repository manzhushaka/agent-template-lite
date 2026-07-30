from __future__ import annotations

from collections import defaultdict
from hashlib import sha256
from typing import Any

from agno.db.base import SessionType
from agno.db.mysql import MySQLDb

from app.project_config import AGENT_ID


def _number(value: Any) -> float:
    return float(value) if isinstance(value, (int, float)) else 0.0


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "to_dict"):
        result = value.to_dict()
        return result if isinstance(result, dict) else {}
    return {}


def _timestamp(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        return int(value)
    return None


def _visitor_label(user_id: Any) -> str:
    if not isinstance(user_id, str) or not user_id:
        return "anonymous"
    return sha256(user_id.encode()).hexdigest()[:12]


def build_observability(database: MySQLDb, page: int = 1, limit: int = 20) -> dict[str, Any]:
    """Build bounded operational metrics from Agno's persisted sessions, runs, and traces."""
    sessions, total_sessions = database.get_sessions(
        session_type=SessionType.AGENT,
        component_id=AGENT_ID,
        limit=limit,
        page=page,
        sort_by="updated_at",
        sort_order="desc",
        deserialize=False,
    )
    all_sessions, _ = database.get_sessions(
        session_type=SessionType.AGENT,
        component_id=AGENT_ID,
        deserialize=False,
    )
    traces, total_traces = database.get_traces(agent_id=AGENT_ID, limit=50, page=1)

    totals: dict[str, float] = {
        "sessions": float(len(all_sessions)),
        "runs": 0,
        "errors": 0,
        "paused": 0,
        "inputTokens": 0,
        "outputTokens": 0,
        "totalTokens": 0,
        "cost": 0,
        "durationSeconds": 0,
        "toolCalls": 0,
        "toolFailures": 0,
        "confirmations": 0,
    }
    recent_runs: list[dict[str, Any]] = []
    tool_stats: dict[str, dict[str, float]] = defaultdict(
        lambda: {"calls": 0, "failures": 0, "confirmations": 0}
    )

    for session in all_sessions:
        for raw_run in session.get("runs") or []:
            run = _mapping(raw_run)
            metrics = _mapping(run.get("metrics"))
            status = str(run.get("status") or "UNKNOWN").upper()
            tools = [_mapping(item) for item in (run.get("tools") or [])]
            totals["runs"] += 1
            totals["errors"] += int(status in {"ERROR", "FAILED", "CANCELLED"})
            totals["paused"] += int(status == "PAUSED")
            totals["inputTokens"] += _number(metrics.get("input_tokens"))
            totals["outputTokens"] += _number(metrics.get("output_tokens"))
            totals["totalTokens"] += _number(metrics.get("total_tokens"))
            totals["cost"] += _number(metrics.get("cost"))
            totals["durationSeconds"] += _number(metrics.get("duration"))
            for tool in tools:
                name = str(tool.get("tool_name") or tool.get("name") or "unknown")
                failed = bool(tool.get("tool_call_error"))
                confirmation = bool(tool.get("requires_confirmation"))
                totals["toolCalls"] += 1
                totals["toolFailures"] += int(failed)
                totals["confirmations"] += int(confirmation)
                tool_stats[name]["calls"] += 1
                tool_stats[name]["failures"] += int(failed)
                tool_stats[name]["confirmations"] += int(confirmation)
            recent_runs.append(
                {
                    "runId": str(run.get("run_id") or ""),
                    "sessionId": str(session.get("session_id") or ""),
                    "visitor": _visitor_label(session.get("user_id")),
                    "status": status,
                    "createdAt": _timestamp(run.get("created_at")),
                    "durationMs": round(_number(metrics.get("duration")) * 1000),
                    "inputTokens": round(_number(metrics.get("input_tokens"))),
                    "outputTokens": round(_number(metrics.get("output_tokens"))),
                    "toolCount": len(tools),
                    "inputPreview": str(run.get("run_input") or "")[:120],
                }
            )

    recent_runs.sort(key=lambda item: item["createdAt"] or 0, reverse=True)
    session_items = [
        {
            "sessionId": str(session.get("session_id") or ""),
            "visitor": _visitor_label(session.get("user_id")),
            "name": _mapping(session.get("session_data")).get("session_name") or "未命名会话",
            "runCount": len(session.get("runs") or []),
            "createdAt": _timestamp(session.get("created_at")),
            "updatedAt": _timestamp(session.get("updated_at")),
        }
        for session in sessions
    ]
    trace_items = []
    for trace_value in traces:
        trace = _mapping(trace_value)
        trace_items.append(
            {
                "traceId": str(trace.get("trace_id") or ""),
                "runId": trace.get("run_id"),
                "sessionId": trace.get("session_id"),
                "name": trace.get("name"),
                "status": trace.get("status"),
                "durationMs": round(_number(trace.get("duration_ms"))),
                "spanCount": round(_number(trace.get("span_count"))),
                "startedAt": trace.get("start_time"),
            }
        )

    run_count = max(1, int(totals["runs"]))
    totals["errorRate"] = round(totals["errors"] / run_count * 100, 2)
    totals["averageDurationMs"] = round(totals["durationSeconds"] / run_count * 1000)
    return {
        "totals": {key: round(value, 6) for key, value in totals.items()},
        "sessions": {
            "items": session_items,
            "page": page,
            "pageSize": limit,
            "total": total_sessions,
            "totalPages": max(1, (total_sessions + limit - 1) // limit),
        },
        "recentRuns": recent_runs[:50],
        "tools": [
            {"name": name, **{key: round(value) for key, value in values.items()}}
            for name, values in sorted(tool_stats.items(), key=lambda item: item[1]["calls"], reverse=True)
        ],
        "traces": {"items": trace_items, "total": total_traces},
    }
