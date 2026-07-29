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
- [ ] Knowledge facts are not invented by the Agent instructions.

## Comments and Handoff

- [ ] New TypeScript boundary has JSDoc.
- [ ] New Python boundary has docstring.
- [ ] New extension point has an `EXTENSION:` comment.
- [ ] `docs/EXTENDING.md` explains the next developer's change path.
- [ ] No secret or full personal data appears in logs or responses.
