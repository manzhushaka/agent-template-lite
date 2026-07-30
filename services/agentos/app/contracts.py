"""Validated models shared by the Console client and Agent Tools."""

from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    """Reject unexpected fields so cross-runtime drift is visible immediately."""

    model_config = ConfigDict(extra="forbid", strict=True)


class ProductCard(ContractModel):
    type: Literal["product"] = "product"
    id: str
    title: str
    description: str
    price: str
    stock: int = Field(ge=0)
    imageUrl: str | None = None
    actionLabel: str | None = None


class OrderCard(ContractModel):
    type: Literal["order"] = "order"
    id: str
    title: str
    description: str
    amount: str
    status: str


DemoCard = Annotated[ProductCard | OrderCard, Field(discriminator="type")]


class ToolResultEnvelope(ContractModel):
    ok: bool
    code: str
    message: str
    data: Any = None
    cards: list[DemoCard] = Field(default_factory=list)
    idempotent: bool = False


class Product(ContractModel):
    id: int
    sku: str
    name: str
    description: str
    priceCents: int = Field(ge=0)
    stock: int = Field(ge=0)
    status: Literal["ON_SALE", "DRAFT", "OFF_SHELF"]
    imageUrl: str | None = None
    updatedAt: str


class ProductListResponse(ContractModel):
    items: list[Product]


class OrderQuote(ContractModel):
    quoteId: str
    sessionId: str
    sku: str
    productName: str
    quantity: int = Field(ge=1)
    amountCents: int = Field(ge=0)
    expiresAt: str


class Order(ContractModel):
    id: int
    orderNo: str
    sessionId: str
    productId: int
    productName: str
    quantity: int = Field(ge=1)
    amountCents: int = Field(ge=0)
    status: Literal["CREATED", "CANCELLED"]
    createdAt: str


class OrderResult(ContractModel):
    order: Order
    idempotent: bool


class PublishedKnowledge(ContractModel):
    id: int
    title: str
    category: str
    content: str
    source: str
    version: int = Field(ge=1)


class PublishedKnowledgeResponse(ContractModel):
    documents: list[PublishedKnowledge]


def serialize_envelope(envelope: ToolResultEnvelope) -> str:
    """Serialize one canonical Tool result shape for Agno and Chat."""

    return json.dumps(envelope.model_dump(mode="json"), ensure_ascii=False)
