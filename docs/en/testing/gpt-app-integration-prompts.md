# GPT App Integration Test Guide (Natural English Prompts)

This guide is written so anyone can complete the flow end-to-end without getting stuck.  
You can copy and paste each prompt as-is.

---

## 0. What This Test Validates

You will validate this 7-step flow:

1. Create campaign
2. Search services
3. Pick a service and check tasks
4. Get task details
5. Complete task
6. Confirm run readiness
7. Run service

---

## 1. Prerequisites

- SnapFuel MCP is connected in your GPT App
- MCP tools can be executed from chat
- If you are unsure what to do next, run `get_prompt_guide_flow`

> Note: If `search_services` fails with `Invalid API key`, check backend config (usually `GPT_API_KEY_ENFORCEMENT=false`).

---

## 2. Ground Rules

- Follow `structuredContent.next_actions` from each tool response first
- If anything is unclear, call `get_prompt_guide_flow`
- Do not guess missing data; rely only on tool output

---

## 3. Run the 7 Steps (Natural Chat Prompts)

## Step 0: Start with guidance

### Prompt (copy/paste)

```text
I want to start the flow correctly. Please run get_prompt_guide_flow with context_step=0 and service=github.
```

### Success criteria

- `flow_step` is returned
- `recommended_next_prompt` is returned
- `next_actions` includes at least one item

---

## Step 1: Create a campaign

### Prompt (copy/paste)

```text
I want to create a campaign for GitHub flow testing. Please run create_campaign_from_goal with:
- purpose: Validate GitHub issue creation flow
- sponsor: SnapFuel Demo
- target_roles: ["developer"]
- target_tools: ["github"]
- required_task: product_feedback
- subsidy_per_call_cents: 5000
- budget_cents: 50000
```

### Success criteria

- `campaign_id` is returned
- Campaign is created for `service_key=github`
- `next_actions` is returned

### If it fails

```text
I could not complete campaign creation. Please guide me to the next correct step with get_prompt_guide_flow using context_step=1 and service=github.
```

---

## Step 2: Search for services

### Prompt (copy/paste)

```text
Please find service candidates for creating a GitHub issue. Run search_services with q=github, intent=I want to create a GitHub issue, max_budget_cents=50000, and campaign_id=<campaign_id>.
```

### Success criteria

- Service candidate list is returned
- `next_actions` is returned

### If it fails

```text
Please show me the next best step here. Run get_prompt_guide_flow with context_step=2, service=github, and campaign_id=<campaign_id>.
```

---

## Step 3: Check tasks for the selected service

> Use one `service_key` from Step 2 (example: `github`)

### Prompt (copy/paste)

```text
I selected a service and want to see the required tasks. Please run get_service_tasks with service_key=github.
```

### Success criteria

- `tasks` is returned
- `campaign_id` is confirmed

### If it fails

```text
Please guide me for this stage. Run get_prompt_guide_flow with context_step=3 and service=github.
```

---

## Step 4: Get task details

> Use the `campaign_id` confirmed in Step 3

### Prompt (copy/paste)

```text
I want to confirm the exact task input requirements. Please run get_task_details with campaign_id=<campaign_id>.
```

### Success criteria

- `required_task` and `task_input_format` are returned
- `next_actions` is returned

### If it fails

```text
Please tell me the next action for this step. Run get_prompt_guide_flow with context_step=4, campaign_id=<campaign_id>, and service=github.
```

---

## Step 5: Complete the task

### Prompt (copy/paste)

```text
I want to submit task completion. Please run complete_task with:
- campaign_id: <campaign_id>
- task_name: product_feedback
- details: {"github_username":"octocat","github_repo":"octo-org/subsidy-payment","issue_title":"[Bug] OAuth callback fails on Safari","issue_body":"Repro: 1) Login 2) Redirect loop 3) 401 on callback. Expected: successful callback."}
- consent: {"data_sharing_agreed":true,"purpose_acknowledged":true,"contact_permission":false}
```

### Success criteria

- `can_use_service=true` or success completion message
- `task_completion_id` is returned

### If it fails

```text
I need help completing the task step. Please run get_prompt_guide_flow with context_step=5, campaign_id=<campaign_id>, and service=github.
```

---

## Step 6: Confirm run readiness

### Prompt (copy/paste)

```text
Please check my current status and what I can run now. Run get_user_status.
```

### Success criteria

- Target service appears in `available_services`
- `next_actions` is returned

### If it fails

```text
Please suggest the next operation I should run. Execute get_prompt_guide_flow with context_step=6 and service=github.
```

---

## Step 7: Run the service

### Prompt (copy/paste)

```text
I want to run the final service action now. Please run run_service with service=github and input=Create a GitHub issue in octo-org/subsidy-payment with title "[Bug] OAuth callback fails on Safari" and include reproduction steps.
```

### Success criteria

- `payment_mode` is returned
- `sponsored_by` is returned (when sponsored)
- `output` contains execution result

### If it fails

```text
I am stuck in the run phase. Please guide me with get_prompt_guide_flow using context_step=7 and service=github.
```

---

## 4. 2-Minute Triage When `run_service` Fails

Check these four points:

1. Value used in `run_service.service` (example: `github`)
2. Matching key in `campaign.target_tools`
3. Matching key in `sponsored_apis.service_key`
4. Raw `run_service.output`

### Prompt (copy/paste)

```text
I need quick triage for a run_service failure.
Please report in this order:
1) service value actually used
2) matching campaign.target_tools
3) matching sponsored_apis.service_key
4) full raw run_service output (no truncation)
5) one most likely fix to try next
```

---

## 5. Final Report Template

### Prompt (copy/paste)

```text
Please summarize the 7-step result in this format:
- Step1 create_campaign_from_goal: pass/fail (one-line reason)
- Step2 search_services: pass/fail (one-line reason)
- Step3 get_service_tasks: pass/fail (one-line reason)
- Step4 get_task_details: pass/fail (one-line reason)
- Step5 complete_task: pass/fail (one-line reason)
- Step6 get_user_status: pass/fail (one-line reason)
- Step7 run_service: pass/fail (one-line reason)
Finally, list up to 3 unresolved issues if any.
```

---

## 6. Product Feedback Submission Prompt

Use this template when you want to submit `product_feedback`.  
Just replace `<campaign_id>`.

### Prompt (copy/paste)

```text
I want to submit product feedback. Please run complete_task with:
- campaign_id: <campaign_id>
- task_name: product_feedback
- details: {
  "product_link": "https://github.com/octo-org/subsidy-payment",
  "feedback_rating": 4,
  "feedback_tags": "Usability, Guidance",
  "feedback_reason": "The overall flow was smooth, but in first-time use the next prompt was not always obvious."
}
- consent: {"data_sharing_agreed": true, "purpose_acknowledged": true, "contact_permission": false}
```
