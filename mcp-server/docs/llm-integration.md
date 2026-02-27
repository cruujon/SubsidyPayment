# LLM Integration Guide (MCP + zkPassport Flow)

This file is the handoff doc for another LLM (or agent framework) to interact with SubsidyPayment.

## What To Give The LLM

Preferred (MCP / tool-based):

- MCP endpoint: `https://subsidypayment-1.onrender.com/mcp`
- Transport: Streamable HTTP MCP
- Primary interaction mode: MCP tools (not direct REST)

Optional fallback (direct Rust API):

- Rust API base: `https://subsidypayment-1k0h.onrender.com`
- OpenAPI spec: `https://subsidypayment-1k0h.onrender.com/.well-known/openapi.yaml`

## Recommended Interface (MCP)

Use MCP tools as the source of truth for LLM interaction. MCP tools handle:

- session token management for no-auth GPT flows
- widget metadata / embedded UI
- normalization of backend responses
- zkPassport verification session bootstrap

### Core MCP Tools

- `search_services`
- `get_service_tasks`
- `get_task_details`
- `start_zkpassport_verification`
- `complete_task`
- `run_service`
- `get_user_status`
- `create_campaign_from_goal`

## Standard User Flow (Service Discovery -> Task -> Access)

1. Call `search_services`
2. Call `get_service_tasks` (when user picks a service)
3. Call `get_task_details` (when user picks a campaign/task)
4. If task type is zkPassport age/country:
   - call `start_zkpassport_verification`
5. After task completion:
   - call `run_service`

## zkPassport Verification (Important)

When calling `start_zkpassport_verification`, the tool now returns:

- `verification_url`: hosted verification page (fallback flow)
- `zkpassport_request_url`: direct zkPassport challenge URL (preferred QR target)
- `qr_image_url`: QR image URL (served from MCP domain, intended for embedded UI)
- `zkpassport_install_url`: install/info link for zkPassport app
- `verification_token`, `expires_at`

### Embedded UI Behavior (Expected)

If the user presses the green verification button in the embedded widget:

- the widget should render a QR code inside the embedded UI
- QR should target `zkpassport_request_url` when available
- fallback to `verification_url` if direct request URL is unavailable

This allows a user to scan the QR on their phone and continue the zkPassport verification challenge for this app.

## Campaign Creation Flow (LLM/Sponsor Side)

Use `create_campaign_from_goal`.

The tool returns:

- created campaign object
- `frontend_dashboard_url` (deep link to frontend dashboard with the created campaign highlighted)
- `frontend_campaign_url` (currently same deep-link pattern)
- backend URLs for debugging (`backend_campaign_url`, `backend_dashboard_api_url`)

### Frontend Deep Link Format

The frontend supports:

- `?view=dashboard&campaign_id=<campaign-id>`

This forces the dashboard view and loads the campaign into the dashboard list even if it is not present in the default filtered `/campaigns` response.

## Direct REST Fallback (If No MCP Runtime)

Use the Rust backend only if MCP is unavailable.

Base:

- `https://subsidypayment-1k0h.onrender.com`

Important endpoints:

- `GET /gpt/services`
- `GET /gpt/tasks/{campaign_id}`
- `POST /gpt/tasks/{campaign_id}/zkpassport/init`
- `POST /gpt/tasks/{campaign_id}/complete`
- `POST /gpt/services/{service}/run`
- `GET /gpt/user/status`

Notes:

- Direct REST calls require the configured GPT API key (Bearer auth) when enabled.
- You must handle session tokens and retries yourself in direct mode.

## Error Handling Notes

- Rate limits may return `429` with `Retry-After`
- For MCP flows, retry on transient tool failures
- zkPassport flows can fail due to:
  - expired verification session
  - SDK unavailable on MCP
  - proof rejection / verification failure

## Minimal Handoff Payload (Example)

```json
{
  "preferred_interface": "mcp",
  "mcp_url": "https://subsidypayment-1.onrender.com/mcp",
  "rust_api_base": "https://subsidypayment-1k0h.onrender.com",
  "openapi_url": "https://subsidypayment-1k0h.onrender.com/.well-known/openapi.yaml",
  "primary_tools": [
    "search_services",
    "get_service_tasks",
    "get_task_details",
    "start_zkpassport_verification",
    "complete_task",
    "run_service",
    "create_campaign_from_goal"
  ],
  "zkpassport_qr_preferred_field": "zkpassport_request_url",
  "zkpassport_qr_fallback_field": "verification_url"
}
```

## Deployment Config Needed For Full UX

For the best campaign-create + frontend redirect experience, set on the MCP server:

- `FRONTEND_URL=<your deployed frontend URL>`

Without `FRONTEND_URL`, campaign creation still works, but the tool may not return a correct frontend deep link.
