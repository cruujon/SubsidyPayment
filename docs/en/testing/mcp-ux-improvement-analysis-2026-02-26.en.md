# MCP UX / Authentication / Guidance Flow Improvement Analysis Report (2026-02-26)

## 1. Objective

This report analyzes the current MCP server behavior for public GPT App release readiness and summarizes root causes and solution directions for the following issues:

- Mandatory email authentication creates UX drop-off
- Embedded UI button interactions do not clearly tell users what to do next
- Post-action next-step guidance is weak, so users get lost
- `run_service` does not consistently reach GitHub execution flow
- Instance description and tool descriptions are too short to drive reliable guidance
- There is no dedicated recovery tool for users who ask “what should I do next?”

---

## 2. Scope and Date

- Investigation date: 2026-02-26
- Scope:
  - `mcp-server/src/**`
  - `mcp-server/src/widgets/src/**`
  - `src/gpt.rs` (`gpt_run_service` in Rust backend)
  - Existing tests (`mcp-server/tests/**`)

---

## 3. Current-State Diagnosis (with code evidence)

### 3.1 Structure that easily becomes authentication-gated

- If `AUTH_ENABLED` is not explicitly set, OAuth is auto-enabled when both `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` exist.
  - Evidence: `resolveAuthEnabled` in `mcp-server/src/config.ts`
- In tools such as `run_service`, `get_task_details`, `complete_task`, and `get_user_status`, when `authEnabled=true`, failed `TokenVerifier.verify()` returns `mcp/www_authenticate`.
  - Evidence: `resolveBearerToken` + `verify` branches across tool files
- Automatic noauth session generation (`resolveOrCreateNoAuthSessionToken`) is blocked when `authEnabled=true`.
  - Evidence: `if (config.authEnabled) return null;` in `mcp-server/src/tools/session-manager.ts`

### 3.2 Insufficient instance/tool descriptions

- MCP server initialization does not set `instructions`.
  - Evidence: `mcp-server/src/server.ts`
- App description exists but is short and does not define lost-user recovery flow.
  - Evidence: `mcp-server/app-metadata.json`
- Tool descriptions are mostly functional labels and do not strongly guide “what’s next.”
  - Evidence: `mcp-server/src/tools/*.ts`

### 3.3 Weak post-click guidance in widgets

- Widgets such as `services-list.html` implement `app.callTool`, but fallback guidance is weak for no-response/partial-response cases.
- No global banner exists that explicitly says: “Please type in chat (ask in chat to do tasks).”
  - Evidence: `mcp-server/src/widgets/src/*.html`

### 3.4 Path mismatch between `run_service` and GitHub execution

- MCP tool `create_github_issue` is independent and is not automatically chained from `run_service`.
  - Evidence: `mcp-server/src/tools/github-issue.ts`
- In Rust `gpt_run_service`, upstream API is called only when `sponsored_apis.service_key == service` after sponsored matching.
  - Evidence: `maybe_sponsored_api` lookup in `src/gpt.rs`
- Therefore, “calling `run_service` automatically calls GitHub API” is not guaranteed. It depends on strict service-key alignment and sponsored API configuration.

---

## 4. Root Causes

### Issue A: Mandatory email auth blocks user progress

- Core issue: Guest path is effectively closed when auth is enabled.
- Impact: Users drop off early in validation/public usage.

### Issue B: Button clicks look unresponsive

- Core issue: Widget-side tool calls do not guarantee visible state transition in all host conditions.
- Impact: Users interpret normal behavior as failure.

### Issue C: Users cannot tell next action

- Core issue: Tool outputs do not enforce a fixed “next action” structure.
- Impact: Guidance quality varies by conversation and model behavior.

### Issue D: `run_service` does not reach GitHub flow

- Core issue: Not primarily “tool-to-tool invocation capability,” but execution-path design mismatch (service keys, upstream bindings, guidance path).

---

## 5. Answers to Technical Questions

### Q1. Can an MCP tool call another tool?

Yes. Two patterns exist:

1. **Recommended**: Call shared service/client code directly inside the same process.
2. Call another tool through an MCP-client layer (usually more complex and fragile).

For this project, the main gap is not pattern (2) absence, but lack of unified direct execution design inside `run_service`.

### Q2. Is expanding descriptions enough?

**Partially helpful, but not sufficient.**  
Description improvements help model guidance, but they do not fix execution-path mismatches (e.g., service key mismatch).

---

## 6. Improvement Directions (proposed)

## 6.1 Authentication UX improvement (highest priority)

- Policy: “Guest-allow for discovery, step-up checks for execution”
- Proposed implementation:
  - New flag `GUEST_MODE_ENABLED=true`
  - `search_services`, `get_service_tasks`, `get_task_details`, `get_prompt_guide_flow` allowed in guest mode
  - Enforce conditions at execution points (`complete_task`, `run_service`)

## 6.2 Global chat guidance across all screens

- Add fixed banner to all widgets:
  - Text: `Please type in chat (ask in chat to do tasks)`
  - On click: trigger `sendFollowUpMessage` with recommended prompt

## 6.3 Enforce next-action output

- Add common fields to all tool `structuredContent`:
  - `flow_step`
  - `can_proceed`
  - `next_actions[]` (max 3; each includes exact next prompt)
- This standardizes post-action guidance.

## 6.4 Add dedicated prompt-guide tool

- New tool: `get_prompt_guide_flow`
- Responsibilities:
  - Enumerate available tools
  - Provide one recommended next step
  - Provide copy-paste prompts
  - Prevent irrelevant/fabricated detours

## 6.5 Align `run_service` and GitHub execution

- Recommended approach:
  - Either make `run_service` own GitHub execution path for `service=github` class inputs
  - Or strictly unify naming between `sponsored_apis.service_key`, `campaign.target_tools`, and MCP `service` input
- Output enhancement:
  - Return `issue_url`, `repo`, `issue_number`, etc., for explicit success visibility

---

## 7. Fit Against Target Public Flow

Against target flow steps 0-5, current gaps are:

- 0: No guaranteed first-response guide
- 1-3: Weakly enforced response templates for user actions
- 4: Post-task “what to type next” is inconsistent
- 5: End-to-end consistency from `run_service` to GitHub confirmation is insufficient

Applying 6.1-6.5 would close these gaps with fixed guidance, fixed progression, and consistent execution visibility.

---

## 8. Test Compatibility

Current tests include OAuth-enforced static assertions and will require updates when auth/gating behavior changes:

- `mcp-server/tests/task-5.2-authenticate-user.test.mjs`
- `mcp-server/tests/task-5.3-task-tools.test.mjs`
- `mcp-server/tests/task-5.4-run-service.test.mjs`
- `mcp-server/tests/task-6.3-oauth-enforcement.test.mjs`

Execution check on 2026-02-26:
- Related tests are currently passing, confirming the existing behavior is fixed around OAuth-first assumptions.

---

## 9. Risks and Mitigations

- Risk: Expanding noauth paths increases abuse potential
  - Mitigation: execution-stage gating, rate limits, stronger audit logs
- Risk: Guidance text becomes too verbose and ignored
  - Mitigation: always put one exact next prompt at the top
- Risk: Team updates descriptions only and misses path bugs
  - Mitigation: add `run_service -> github` E2E checks in CI

---

## 10. Conclusion

The issues are not only “insufficient wording”; they are mainly about **authentication boundary design** and **execution-path consistency**.  
To reliably fix public GPT App UX, the following must be implemented together:

1. Rework guest-access path at the policy level
2. Add global chat-input guidance UI across all screens
3. Enforce next-action candidates in all tool outputs
4. Add `get_prompt_guide_flow`
5. Align `run_service` with GitHub execution path (with expanded descriptions)

This combined approach is required to make the end-user journey consistently “non-confusing and finishable.”

