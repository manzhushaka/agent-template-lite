from app.knowledge_store import split_text


def test_split_text_preserves_overlap_and_tail():
    text = "甲" * 20
    chunks = split_text(text, chunk_size=10, overlap=2)
    assert chunks == ["甲" * 10, "甲" * 10, "甲" * 4]


def test_split_text_ignores_empty_lines():
    assert split_text("\n  \n") == []
