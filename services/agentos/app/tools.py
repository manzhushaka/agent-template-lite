from __future__ import annotations

from typing import Any

from agno.run import RunContext
from agno.tools import tool

from app.console_client import ConsoleApiError, ConsoleClient
from app.contracts import OrderCard, ProductCard, ToolResultEnvelope, serialize_envelope
from app.knowledge_store import KnowledgeStore


def envelope(
    code: str,
    message: str,
    *,
    data: Any = None,
    cards: list[ProductCard | OrderCard] | None = None,
    ok: bool = True,
    idempotent: bool = False,
) -> str:
    """Serialize the stable cross-language Tool result contract."""
    return serialize_envelope(
        ToolResultEnvelope(
            ok=ok,
            code=code,
            message=message,
            data=data,
            cards=cards or [],
            idempotent=idempotent,
        )
    )


def session_id(run_context: RunContext) -> str:
    return str(run_context.session_id or run_context.user_id or "anonymous")


def build_business_tools(client: ConsoleClient, knowledge: KnowledgeStore) -> list[Any]:
    """
    Build the sample business Tool set.

    EXTENSION: Add read Tools directly and decorate every write Tool with
    `@tool(requires_confirmation=True)`. Keep validation and transactions in Console services.
    """

    def search_knowledge(query: str) -> str:
        """Search published business knowledge before answering policy or factual questions.

        Args:
            query: A concise Chinese search query derived from the user's question.
        """
        results = knowledge.search(query)
        return envelope("KNOWLEDGE_FOUND", f"找到 {len(results)} 条知识片段", data=results)

    def search_products(query: str = "") -> str:
        """Search currently on-sale products from the controlled business system.

        Args:
            query: Optional product name, SKU, purpose or requirement keyword.
        """
        products = client.search_products(query)
        cards = [
            ProductCard(
                id=item.sku,
                title=item.name,
                description=item.description,
                price=f"¥{item.priceCents / 100:.2f}",
                stock=item.stock,
                imageUrl=item.imageUrl,
                actionLabel="选择商品",
            )
            for item in products
        ]
        return envelope(
            "PRODUCTS_FOUND",
            f"找到 {len(products)} 个在售商品",
            data=[item.model_dump(mode="json") for item in products],
            cards=cards,
        )

    def prepare_order(run_context: RunContext, sku: str, quantity: int = 1) -> str:
        """Prepare an expiring quote without creating an order or deducting stock.

        Args:
            sku: Exact SKU returned by search_products.
            quantity: Product quantity from 1 to 10.
        """
        quote = client.prepare_order(session_id(run_context), sku, quantity)
        return envelope(
            "QUOTE_PREPARED",
            "报价已准备，必须继续调用 confirm_order",
            data=quote.model_dump(mode="json"),
        )

    @tool(requires_confirmation=True)
    def confirm_order(run_context: RunContext, quote_id: str) -> str:
        """Create an order after explicit human confirmation.

        Args:
            quote_id: Exact quote ID returned by prepare_order.
        """
        current_session = session_id(run_context)
        try:
            result = client.confirm_order(
                current_session,
                quote_id,
                idempotency_key=f"{current_session}:{quote_id}",
            )
        except ConsoleApiError as error:
            return envelope(error.code, str(error), ok=False)
        order = result.order
        card = OrderCard(
            id=order.orderNo,
            title=f"订单 {order.orderNo}",
            description=f"{order.productName} × {order.quantity}",
            amount=f"¥{order.amountCents / 100:.2f}",
            status=order.status,
        )
        return envelope(
            "ORDER_CREATED",
            "演示订单已创建",
            data=order.model_dump(mode="json"),
            cards=[card],
            idempotent=result.idempotent,
        )

    return [search_knowledge, search_products, prepare_order, confirm_order]
