---
name: manzhushaka-agent-template-builder
description: Build an independently evolving business demo from the Manzhushaka Next.js plus Agno template. Use when a user wants to clone this template, detach the template Git history, research a business opportunity, choose Chinese and English project names, design a demo workflow, and implement and verify the resulting Chat, Console, MySQL, knowledge, and AgentOS changes.
---

# Manzhushaka Agent Template Builder

Use this workflow to turn a business idea into a reviewable, runnable, independently owned demo. The output is a project, not a multi-tenant platform and not a proposal-only document.

## Operating Rules

- Keep the user in control of business scope and names. Do not write business code before both are confirmed.
- Preserve the template's three-service boundary: public Chat, control-plane Console, and Agno AgentOS.
- Require a real OpenAI-compatible model API. Do not add a runtime fake-model fallback; mocks belong only in tests.
- Keep business truth and transactions in Console/MySQL. AgentOS calls typed internal APIs and never writes business tables directly.
- Keep MySQL as the knowledge lifecycle source of truth and rebuild LanceDB vectors from published documents.
- Add Chinese JSDoc/docstrings and `EXTENSION:` comments at every new integration boundary.
- Never expose API keys, internal tokens, full personal data, or stack traces.
- Do not add a new Git remote or push unless the user explicitly asks.

## Phase 1: Acquire and Detach

1. Ask for the template GitHub URL and the target local directory if they are not already known.
2. Clone into the exact target directory and confirm `template.config.json` exists before changing anything.
3. Run the bundled `scripts/detach-template.sh <target>` from this Skill. It validates the target, removes only its `.git` directory, initializes a new `main` repository, and creates a local initialization commit. Never run it against a workspace root or an unvalidated path.
4. Keep the new project offline from the template until the user later supplies a new remote URL.

## Phase 2: Understand the Business

Ask questions in small groups and record answers in `docs/business-discovery.md`:

- Who uses the demo, who buys or evaluates it, and what meeting or workflow it should demonstrate.
- The one sentence business problem, the preferred user journey, and the data that must look real.
- Read-only questions, consequential actions, confirmation points, human fallback, and integration constraints.
- Required model provider, language, branding tone, expected demo duration, and deployment target.

Do not choose a name or implement screens during this phase.

## Phase 3: Research and Recommend

Research three to five comparable products or workflows using available web or primary-source tools. Separate sourced facts from inference. Produce:

- Comparable capability map and visible user workflow.
- What the proposed demo should show to feel credible.
- A small MVP loop with no more than one or two consequential actions.
- Explicit exclusions, data assumptions, risks, and follow-up opportunities.

Read `references/research-output.md` for the required compact format. Ask the user to confirm the recommendation before implementation.

## Phase 4: Name and Freeze

Offer three to five project-name options. For each option provide Chinese name, English name, repository slug, Agent display name, and a one-line rationale. Check that the slug is lowercase ASCII and does not collide with existing package names. Wait for explicit confirmation and write the result to `template.config.json` and `docs/business-discovery.md`.

## Phase 5: Construct

1. Write the confirmed identity to `business.yaml`, preview with `pnpm demo:init -- --config business.yaml --dry-run`, then run the same command without `--dry-run`. Do not perform free-form global replacement.
2. Create domain tables and Drizzle migrations for real-looking demo data. Use the Console演示中心 for CRUD, not a generic JSON table.
3. Optionally create each vertical slice with `pnpm demo:add-feature -- --name <name> --type query|action`, then add Console repositories, internal APIs, validation, transactions, idempotency, and audit records.
4. Add Python Console Client methods, Agent instructions, knowledge sources, and Tools. Use `@tool(requires_confirmation=True)` for consequential actions.
5. Add shared card contracts, Chat renderers, confirmation copy, errors, retry behavior, and responsive verification.
6. Add Chinese extension comments in both TypeScript and Python. Update `docs/EXTENDING.md` whenever a new extension pattern is introduced.

Read `references/construction-checklist.md` before touching a cross-service contract.

## Phase 6: Verify and Hand Off

Run, in order:

```bash
pnpm db:generate
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm check:placeholders
pnpm eval
pnpm e2e
git diff --check
```

If MySQL and the model API are available, run the three services and verify health, Chat streaming, a read Tool, the confirmation pause, confirmation continuation, idempotent repeat, and Console CRUD. If an external service is unavailable, report the exact unverified step instead of claiming completion.

Finish with the business loop, changed files, commands, known limitations, and the command to add a new Git remote. Never push automatically.

## Resources

- `scripts/detach-template.sh`: safe clone-to-independent-repository transition.
- `references/research-output.md`: compact research and recommendation format.
- `references/construction-checklist.md`: cross-language extension and verification checklist.
