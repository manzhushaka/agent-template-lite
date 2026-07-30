# Construction Checklist

## Cross-Service Contract

- [ ] MySQL table and migration exist.
- [ ] Console service owns validation and transaction rules.
- [ ] Internal API has an explicit `x-internal-token` check.
- [ ] Python Console Client has typed inputs and controlled errors.
- [ ] Tool returns `ToolResultEnvelope` JSON, not UI-specific prose.
- [ ] Shared TypeScript card type and Chat renderer agree.
- [ ] Consequential Tool has Agno native confirmation and idempotency.

## Knowledge

- [ ] MySQL stores title, source, content, status, version, and index status.
- [ ] Only published documents enter LanceDB.
- [ ] Reindex is safe to repeat and reports failures.
- [ ] Imported files and web pages record source hash, immutable version and a retryable index job.
- [ ] Web import rejects local/private addresses, unsupported MIME types and oversized bodies.
- [ ] Console can inspect the latest index status, failure reason and chunk preview.
- [ ] Knowledge facts are not invented by the Agent instructions.

## Comments and Handoff

- [ ] New TypeScript boundary has JSDoc.
- [ ] New Python boundary has docstring.
- [ ] New extension point has an `EXTENSION:` comment.
- [ ] `docs/EXTENDING.md` explains the next developer's change path.
- [ ] No secret or full personal data appears in logs or responses.
- [ ] Chat session reads and mutations verify server-side visitor ownership.
- [ ] Observability returns aggregates and masked visitor labels, not full prompts or identities.
