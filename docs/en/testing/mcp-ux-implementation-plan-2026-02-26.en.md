# MCP UX Improvement Implementation Plan (2 Hours, Minimal Impact)

## 1. Summary

This plan prioritizes **low risk and high certainty**. We will **not** change authentication boundaries in this 2-hour window, and will implement:

1. A global “ask in chat” guidance banner across all widget screens
2. A recovery tool for confused users: `get_prompt_guide_flow`
3. Expanded tool descriptions / widget descriptions / invocation messages
4. A minimal, consistent `next_actions` structure in key tool outputs
5. `run_service`→GitHub issue handled as diagnostic + reproducible runbook only (no deep integration in this phase)

---

## 2. Scope

### IN

1. Changes limited to `mcp-server` (Rust backend stays unchanged unless absolutely required)
2. Add/update operational runbook content under `docs/ja/testing`
3. Keep changes minimal and preserve existing E2E behavior

### OUT

1. OAuth/auth policy changes (no noauth expansion, no guest execution relaxation)
2. Deep integration of GitHub execution directly inside `run_service`
3. DB schema changes or migrations

---

## 3. Target Files

1. `mcp-server/src/tools/index.ts`
2. `mcp-server/src/tools/*` (existing key tools)
3. `mcp-server/src/tools/get-prompt-guide-flow.ts` (new)
4. `mcp-server/src/server.ts`
5. `mcp-server/app-metadata.json`
6. `mcp-server/src/widgets/src/services-list.html`
7. `mcp-server/src/widgets/src/service-tasks.html`
8. `mcp-server/src/widgets/src/task-form.html`
9. `mcp-server/src/widgets/src/service-access.html`
10. `mcp-server/src/widgets/src/user-dashboard.html`
11. `mcp-server/tests/*` (new tests + minimal updates)
12. `docs/ja/testing/mcp-ux-improvement-analysis-2026-02-26.md` (if needed)
13. `docs/ja/testing/gpt-app-integration-prompts.md`

---

## 4. Implementation Details

## 4.1 Expand Server/App-Level Guidance

1. Add `instructions` to `new McpServer(...)` in `mcp-server/src/server.ts`.
2. Include these rules:
- Always provide the next concrete step first
- When users are off-track, prioritize `get_prompt_guide_flow`
- Do not fabricate alternative workflows with uncertain outcomes
3. Update `mcp-server/app-metadata.json` description to explicitly communicate the guided 6-step experience.

## 4.2 Add New Tool: `get_prompt_guide_flow`

1. Create `mcp-server/src/tools/get-prompt-guide-flow.ts`.
2. Tool spec:
- name: `get_prompt_guide_flow`
- security: `noauth`
- readOnlyHint: `true`
- input: `{ context_step?: string, service?: string, campaign_id?: string }`
- structured output:
  - `flow_step` (`"0"` to `"5"`)
  - `goal`
  - `recommended_next_prompt` (exactly one mandatory recommendation)
  - `copy_paste_prompts` (up to 3)
  - `allowed_actions` (available tools at this stage)
  - `next_actions` (shared output format)
3. Register in `mcp-server/src/tools/index.ts`.
4. Set `openai/toolInvocation/*` and `openai/widgetDescription` (text-first, no dedicated widget required).

## 4.3 Minimal Common `next_actions`

1. Add `structuredContent.next_actions` to key tools:
- `search_services`
- `get_service_tasks`
- `get_task_details`
- `complete_task`
- `run_service`
- `get_user_status`
- `authenticate_user`
2. Unified shape:
- `{ action: string, prompt: string, tool: string }[]`
3. For successful responses, return at least one next action.
4. For error responses, include one explicit “what to type next” sentence in `content.text`.

## 4.4 Improve Descriptions and Invocation Messages

1. Update each tool `description` to include:
- what it returns
- what the user can do next
2. For tools with `openai/widgetDescription`, add explicit “chat command to run next.”
3. Update `openai/toolInvocation/invoked` text to imply next step direction (not just “done”).

## 4.5 Add Global Banner to All Widgets

1. Add a shared visual banner in all 5 widget HTML files:
- Text: `Please type in chat (ask in chat to do tasks)`
- High visibility (top placement, strong contrast)
2. On click:
- If `app.sendFollowUpMessage` exists, send a stage-specific recommended prompt
3. If `sendFollowUpMessage` is unavailable:
- Keep visible instruction and show a manual prompt example in footer text
4. Keep implementation isolated in each HTML file to minimize risk (no cross-file refactor in this phase).

## 4.6 `run_service`→GitHub in This Phase

1. No deep integration change in code for this 2-hour phase.
2. Add deterministic diagnosis steps in `docs/ja/testing/gpt-app-integration-prompts.md`:
- `service` value consistency
- `campaign.target_tools`
- `sponsored_apis.service_key`
- `run_service` output interpretation
3. Add a copy-paste reproducible test prompt block for 2-minute triage.

---

## 5. Public API / Interface Changes

1. New MCP tool: `get_prompt_guide_flow`
2. Add `structuredContent.next_actions` to key existing tools (backward compatible; no key removal)
3. Add server-level `instructions` to MCP handshake metadata
4. Update app-level metadata description for external GPT App positioning

---

## 6. Test Plan

## 6.1 New Tests

1. Add `mcp-server/tests/task-*.test.mjs` checks for:
- `get_prompt_guide_flow` registration
- `noauth` security scheme
- output keys: `recommended_next_prompt`, `next_actions`
2. Extend widget tests:
- Banner text presence across all 5 screens
- `sendFollowUpMessage` call path exists

## 6.2 Regression Tests

1. `npm test -- tests/task-5.2-authenticate-user.test.mjs`
2. `npm test -- tests/task-5.3-task-tools.test.mjs`
3. `npm test -- tests/task-5.4-run-service.test.mjs`
4. `npm test -- tests/task-6.2-services-list-widget.test.mjs`
5. `npm test -- tests/task-6.3-task-form-widget.test.mjs`
6. `npm test -- tests/task-7.5-widget-resources.test.mjs`

---

## 7. 2-Hour Timebox Breakdown

1. 0:00-0:15 Add and register `get_prompt_guide_flow`
2. 0:15-0:45 Add `next_actions` + text improvements in key tools
3. 0:45-1:20 Implement global banner across 5 widgets
4. 1:20-1:40 Add/update tests
5. 1:40-1:55 Run tests and fix regressions
6. 1:55-2:00 Final docs updates and sanity check

---

## 8. Acceptance Criteria

1. Every widget screen displays: `Please type in chat (ask in chat to do tasks)`
2. `get_prompt_guide_flow` always returns one concrete next prompt
3. Key tool success responses include `next_actions`
4. OAuth boundary remains unchanged and existing auth-related tests still pass
5. `run_service` GitHub issue can be reliably reproduced/triaged using documented steps

---

## 9. Assumptions and Defaults

1. Priority is “minimal risk, guaranteed delivery”
2. No auth boundary changes in this phase
3. GitHub deep integration is explicitly deferred to next phase
4. Backward compatibility is preserved (no removal of existing response keys)
