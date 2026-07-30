from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import lancedb
from fastembed import TextEmbedding


@dataclass(frozen=True)
class KnowledgeDocument:
    id: int
    title: str
    category: str
    content: str
    source: str
    version: int


class KnowledgeStore(Protocol):
    """Stable contract that allows LanceDB to be replaced without changing Agent Tools."""

    def rebuild(self, documents: list[KnowledgeDocument]) -> list[int]: ...

    def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]: ...

    def count_documents(self) -> int: ...

    def document_chunks(self, document_id: int, limit: int = 100) -> list[dict[str, Any]]: ...


def split_text(text: str, chunk_size: int = 700, overlap: int = 100) -> list[str]:
    """Split Chinese-friendly text by characters while retaining context across boundaries."""
    normalized = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if not normalized:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(len(normalized), start + chunk_size)
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = max(start + 1, end - overlap)
    return chunks


class LanceDbKnowledgeStore:
    """
    Embedded vector store for single-host demos.

    MySQL remains the source of truth; this table is rebuilt from published documents. EXTENSION:
    Implement the same protocol for Qdrant when a generated project needs multi-node deployment.
    """

    table_name = "business_knowledge"

    def __init__(self, uri: Path | str, model_name: str = "BAAI/bge-small-zh-v1.5"):
        self.uri = Path(uri)
        self.model_name = model_name
        self._embedder: TextEmbedding | None = None

    @property
    def embedder(self) -> TextEmbedding:
        if self._embedder is None:
            self._embedder = TextEmbedding(model_name=self.model_name)
        return self._embedder

    def rebuild(self, documents: list[KnowledgeDocument]) -> list[int]:
        self.uri.mkdir(parents=True, exist_ok=True)
        database = lancedb.connect(str(self.uri))
        if self.table_name in database.table_names():
            database.drop_table(self.table_name)
        rows: list[dict[str, Any]] = []
        texts: list[str] = []
        metadata: list[tuple[KnowledgeDocument, int, str]] = []
        for document in documents:
            for index, chunk in enumerate(split_text(document.content)):
                texts.append(chunk)
                metadata.append((document, index, chunk))
        if texts:
            vectors = list(self.embedder.embed(texts))
            for vector, (document, index, chunk) in zip(vectors, metadata, strict=True):
                rows.append(
                    {
                        "chunk_id": f"{document.id}:{document.version}:{index}",
                        "document_id": document.id,
                        "version": document.version,
                        "title": document.title,
                        "category": document.category,
                        "source": document.source,
                        "content": chunk,
                        "vector": vector.tolist(),
                    }
                )
            database.create_table(self.table_name, data=rows)
        return sorted({document.id for document in documents})

    def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        database = lancedb.connect(str(self.uri))
        if self.table_name not in database.table_names():
            return []
        vector = next(iter(self.embedder.embed([query]))).tolist()
        results = database.open_table(self.table_name).search(vector).metric("cosine").limit(limit).to_list()
        return [
            {
                "document_id": item["document_id"],
                "title": item["title"],
                "category": item["category"],
                "source": item["source"],
                "content": item["content"],
                "distance": item.get("_distance"),
            }
            for item in results
        ]

    def count_documents(self) -> int:
        database = lancedb.connect(str(self.uri))
        if self.table_name not in database.table_names():
            return 0
        rows = database.open_table(self.table_name).to_pandas(columns=["document_id"])
        return int(rows["document_id"].nunique())

    def document_chunks(self, document_id: int, limit: int = 100) -> list[dict[str, Any]]:
        """Return bounded chunk previews without exposing embedding vectors."""
        database = lancedb.connect(str(self.uri))
        if self.table_name not in database.table_names():
            return []
        rows = (
            database.open_table(self.table_name)
            .search()
            .where(f"document_id = {int(document_id)}")
            .limit(max(1, min(limit, 100)))
            .to_list()
        )
        return [
            {
                "chunkId": item["chunk_id"],
                "version": item["version"],
                "content": item["content"],
            }
            for item in rows
        ]
