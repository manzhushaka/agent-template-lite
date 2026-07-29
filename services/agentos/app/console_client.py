from __future__ import annotations

from typing import Any

import httpx


class ConsoleApiError(RuntimeError):
    """A controlled business error returned by the Next.js Console service."""

    def __init__(self, code: str, message: str, status_code: int = 502):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class ConsoleClient:
    """
    Typed boundary between AgentOS and business data.

    EXTENSION: Add one method per controlled Console endpoint. Tools should call this client,
    never connect to MySQL directly, so permissions, transactions and audits stay in Next.js.
    """

    def __init__(self, base_url: str, token: str, timeout: float = 12.0):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def search_products(self, query: str) -> list[dict[str, Any]]:
        body = self._request("GET", "/api/internal/agent/products", params={"q": query})
        return list(body.get("items", []))

    def prepare_order(self, session_id: str, sku: str, quantity: int) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/internal/agent/quotes",
            json={"sessionId": session_id, "sku": sku, "quantity": quantity},
        )

    def confirm_order(
        self, session_id: str, quote_id: str, idempotency_key: str
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/internal/agent/orders",
            json={
                "sessionId": session_id,
                "quoteId": quote_id,
                "idempotencyKey": idempotency_key,
            },
        )

    def published_knowledge(self) -> list[dict[str, Any]]:
        body = self._request("GET", "/api/internal/agent/knowledge")
        return list(body.get("documents", []))

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout) as client:
            response = client.request(
                method,
                f"{self.base_url}{path}",
                headers={"x-internal-token": self.token},
                **kwargs,
            )
        try:
            body = response.json()
        except ValueError:
            body = {}
        if not response.is_success:
            raise ConsoleApiError(
                str(body.get("code", "CONSOLE_API_ERROR")),
                str(body.get("message", "业务服务暂时不可用")),
                response.status_code,
            )
        return body
