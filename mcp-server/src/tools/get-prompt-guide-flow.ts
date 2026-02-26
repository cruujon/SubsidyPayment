import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { BackendConfig } from '../config.ts';

const getPromptGuideFlowInputSchema = z.object({
  context_step: z.string().optional(),
  service: z.string().optional(),
  campaign_id: z.string().optional(),
});

type FlowStep = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';

interface FlowDefinition {
  step: FlowStep;
  goal: string;
  recommendedNextPrompt: string;
  copyPastePrompts: string[];
  nextActions: Array<{ action: string; prompt: string; tool: string }>;
}

const ALLOWED_ACTIONS = [
  'get_prompt_guide_flow',
  'create_campaign_from_goal',
  'search_services',
  'authenticate_user',
  'get_service_tasks',
  'get_task_details',
  'start_zkpassport_verification',
  'complete_task',
  'run_service',
  'get_user_status',
  'user_record',
  'get_preferences',
  'set_preferences',
  'weather',
  'create_github_issue',
] as const;

function normalizeStep(raw?: string): FlowStep {
  const normalized = String(raw ?? '').trim();
  if (
    normalized === '1' ||
    normalized === '2' ||
    normalized === '3' ||
    normalized === '4' ||
    normalized === '5' ||
    normalized === '6' ||
    normalized === '7'
  ) {
    return normalized;
  }
  return '0';
}

function buildFlow(step: FlowStep, service?: string, campaignId?: string): FlowDefinition {
  const resolvedService = typeof service === 'string' && service.trim().length > 0 ? service.trim() : 'github';
  const resolvedCampaign = typeof campaignId === 'string' && campaignId.trim().length > 0 ? campaignId.trim() : '<campaign_id>';

  switch (step) {
    case '1':
      return {
        step,
        goal: 'Create a campaign so the guided task flow can proceed with a real sponsor offer.',
        recommendedNextPrompt:
          `Please run create_campaign_from_goal with purpose="Validate ${resolvedService} flow", sponsor="SnapFuel Demo", target_roles=["developer"], target_tools=["${resolvedService}"], required_task="product_feedback", subsidy_per_call_cents=5000, budget_cents=50000.`,
        copyPastePrompts: [
          `Please run create_campaign_from_goal with purpose="Validate ${resolvedService} flow", sponsor="SnapFuel Demo", target_roles=["developer"], target_tools=["${resolvedService}"], required_task="product_feedback", subsidy_per_call_cents=5000, budget_cents=50000.`,
          'After creation, report campaign_id and selected_service_key in one line.',
        ],
        nextActions: [
          {
            action: 'Create campaign',
            prompt: `Please run create_campaign_from_goal for service=${resolvedService}.`,
            tool: 'create_campaign_from_goal',
          },
        ],
      };
    case '2':
      return {
        step,
        goal: 'Search sponsored services and choose one service_key to inspect tasks.',
        recommendedNextPrompt:
          `Please run search_services with q=${resolvedService}, intent="I want to use ${resolvedService}", max_budget_cents=50000${resolvedCampaign !== '<campaign_id>' ? `, campaign_id=${resolvedCampaign}` : ''}.`,
        copyPastePrompts: [
          `Please run search_services with q=${resolvedService}, intent="I want to use ${resolvedService}", max_budget_cents=50000${resolvedCampaign !== '<campaign_id>' ? `, campaign_id=${resolvedCampaign}` : ''}.`,
          'Pick one service_key from the results and report it in one line.',
        ],
        nextActions: [
          {
            action: 'Search services',
            prompt:
              `Please run search_services with q=${resolvedService}, max_budget_cents=50000${resolvedCampaign !== '<campaign_id>' ? `, campaign_id=${resolvedCampaign}` : ''}.`,
            tool: 'search_services',
          },
        ],
      };
    case '3':
      return {
        step,
        goal: 'Check subsidized tasks for the selected service_key and identify the campaign_id.',
        recommendedNextPrompt: `Please run get_service_tasks with service_key=${resolvedService}.`,
        copyPastePrompts: [
          `Please run get_service_tasks with service_key=${resolvedService}.`,
          'Report the selected campaign_id from the returned tasks list.',
        ],
        nextActions: [
          {
            action: 'Check service tasks',
            prompt: `Please run get_service_tasks with service_key=${resolvedService}.`,
            tool: 'get_service_tasks',
          },
        ],
      };
    case '4':
      return {
        step,
        goal: 'Load exact task requirements for the chosen campaign before submitting completion.',
        recommendedNextPrompt: `Please run get_task_details with campaign_id=${resolvedCampaign}.`,
        copyPastePrompts: [
          `Please run get_task_details with campaign_id=${resolvedCampaign}.`,
          'Return required_task and task_input_format required fields only.',
        ],
        nextActions: [
          {
            action: 'Get task details',
            prompt: `Please run get_task_details with campaign_id=${resolvedCampaign}.`,
            tool: 'get_task_details',
          },
        ],
      };
    case '5':
      return {
        step,
        goal: 'Submit task completion with consent so sponsor coverage can unlock.',
        recommendedNextPrompt:
          `Please run complete_task with campaign_id=${resolvedCampaign}, task_name=product_feedback, consent={"data_sharing_agreed":true,"purpose_acknowledged":true,"contact_permission":false}, and details="<follow task_input_format>".`,
        copyPastePrompts: [
          `Please run complete_task with campaign_id=${resolvedCampaign}, task_name=product_feedback, consent={"data_sharing_agreed":true,"purpose_acknowledged":true,"contact_permission":false}.`,
          'After completion, report can_use_service and task_completion_id in one line.',
        ],
        nextActions: [
          {
            action: 'Complete task',
            prompt: `Please run complete_task with campaign_id=${resolvedCampaign}.`,
            tool: 'complete_task',
          },
        ],
      };
    case '6':
      return {
        step,
        goal: 'Confirm run readiness and identify the exact runnable service name.',
        recommendedNextPrompt: 'Please run get_user_status.',
        copyPastePrompts: [
          'Please run get_user_status.',
          `Confirm whether ${resolvedService} is listed in available_services.`,
        ],
        nextActions: [
          {
            action: 'Check user status',
            prompt: 'Please run get_user_status.',
            tool: 'get_user_status',
          },
        ],
      };
    case '7':
      return {
        step,
        goal: 'Run the service and return the execution/payment result.',
        recommendedNextPrompt: `Please run run_service with service=${resolvedService} and input="<your request>".`,
        copyPastePrompts: [
          `Please run run_service with service=${resolvedService} and input="Create a GitHub issue with clear reproduction steps."`,
          'Return payment_mode, sponsored_by, and a short output summary.',
        ],
        nextActions: [
          {
            action: 'Run service',
            prompt: `Please run run_service with service=${resolvedService}.`,
            tool: 'run_service',
          },
          {
            action: 'Check latest usage record',
            prompt: 'Please run user_record and summarize the latest execution.',
            tool: 'user_record',
          },
        ],
      };
    case '0':
    default:
      return {
        step: '0',
        goal: 'Start with guided flow setup so the next step is deterministic.',
        recommendedNextPrompt: `Please run create_campaign_from_goal for ${resolvedService} first, then call get_prompt_guide_flow with context_step=2.`,
        copyPastePrompts: [
          `Please run get_prompt_guide_flow with context_step=1 and service=${resolvedService}.`,
          `If you already have a campaign_id, rerun get_prompt_guide_flow with context_step=2, service=${resolvedService}, campaign_id=${resolvedCampaign}.`,
          'When stuck at any step, rerun get_prompt_guide_flow with the current context_step.',
        ],
        nextActions: [
          {
            action: 'Open step guide for campaign creation',
            prompt: `Please run get_prompt_guide_flow with context_step=1 and service=${resolvedService}.`,
            tool: 'get_prompt_guide_flow',
          },
        ],
      };
  }
}

export function registerGetPromptGuideFlowTool(server: McpServer, _config: BackendConfig): void {
  registerAppTool(
    server,
    'get_prompt_guide_flow',
    {
      title: 'Get Prompt Guide Flow',
      description: 'Return the exact next prompt and allowed actions for the current guided flow step.',
      inputSchema: getPromptGuideFlowInputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: [{ type: 'noauth' }],
        'openai/toolInvocation/invoking': 'Loading guided flow...',
        'openai/toolInvocation/invoked': 'Guided flow ready. Copy the next prompt.',
        'openai/widgetDescription':
          'Use this tool when the user is unsure. Return one explicit next prompt and avoid inventing alternative flows.',
      },
    },
    async (input) => {
      const flow = buildFlow(normalizeStep(input.context_step), input.service, input.campaign_id);
      return {
        structuredContent: {
          flow_step: flow.step,
          goal: flow.goal,
          recommended_next_prompt: flow.recommendedNextPrompt,
          copy_paste_prompts: flow.copyPastePrompts.slice(0, 3),
          allowed_actions: ALLOWED_ACTIONS,
          next_actions: flow.nextActions,
        },
        content: [
          {
            type: 'text' as const,
            text: `Step ${flow.step}: ${flow.goal} Next prompt: ${flow.recommendedNextPrompt}`,
          },
        ],
      };
    }
  );
}
