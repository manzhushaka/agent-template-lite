from app.observability import build_observability


class Trace:
    def to_dict(self):
        return {
            "trace_id": "trace-1",
            "run_id": "run-1",
            "session_id": "session-1",
            "name": "Agent.run",
            "status": "OK",
            "duration_ms": 120,
            "span_count": 3,
            "start_time": "2026-07-29T10:00:00Z",
        }


class Database:
    def __init__(self):
        self.sessions = [
            {
                "session_id": "session-1",
                "user_id": "visitor-1",
                "session_data": {"session_name": "商品咨询"},
                "created_at": 100,
                "updated_at": 200,
                "runs": [
                    {
                        "run_id": "run-1",
                        "status": "COMPLETED",
                        "run_input": "推荐商品",
                        "created_at": 101,
                        "metrics": {
                            "input_tokens": 10,
                            "output_tokens": 5,
                            "total_tokens": 15,
                            "duration": 0.5,
                            "cost": 0.001,
                        },
                        "tools": [
                            {
                                "tool_name": "search_products",
                                "requires_confirmation": False,
                                "tool_call_error": False,
                            }
                        ],
                    }
                ],
            }
        ]

    def get_sessions(self, **kwargs):
        return self.sessions, len(self.sessions)

    def get_traces(self, **kwargs):
        return [Trace()], 1


def test_observability_aggregates_runs_tools_tokens_and_traces():
    result = build_observability(Database())
    assert result["totals"]["runs"] == 1
    assert result["totals"]["totalTokens"] == 15
    assert result["totals"]["averageDurationMs"] == 500
    assert result["tools"][0]["name"] == "search_products"
    assert result["traces"]["items"][0]["spanCount"] == 3
    assert result["sessions"]["items"][0]["visitor"] != "visitor-1"
