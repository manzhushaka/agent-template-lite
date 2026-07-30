import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.contracts import ProductCard, ToolResultEnvelope, serialize_envelope

EXAMPLES = Path(__file__).parents[3] / "packages/shared/contracts/tool-result.examples.json"


def test_tool_result_contract_serializes_valid_cards():
    value = ToolResultEnvelope(
        ok=True,
        code="PRODUCTS_FOUND",
        message="ok",
        cards=[ProductCard(id="SKU-1", title="示例", description="", price="¥1.00", stock=2)],
    )
    body = json.loads(serialize_envelope(value))
    assert body["cards"][0]["type"] == "product"


def test_tool_result_contract_rejects_negative_stock():
    with pytest.raises(ValidationError):
        ProductCard(id="SKU-1", title="示例", description="", price="¥1.00", stock=-1)


def test_python_validates_the_canonical_cross_language_examples():
    examples = json.loads(EXAMPLES.read_text())
    for value in examples["valid"]:
        ToolResultEnvelope.model_validate(value)
    for value in examples["invalid"]:
        with pytest.raises(ValidationError):
            ToolResultEnvelope.model_validate(value)
