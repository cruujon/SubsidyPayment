import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { BackendConfig } from './config.ts';
import { registerAllTools } from './tools/index.ts';
import { registerAllResources } from './widgets/index.ts';

export function createServer(config: BackendConfig): McpServer {
  const server = new McpServer({
    name: 'snapfuel',
    version: '1.0.0',
    description:
      'Guided 7-step MCP flow for campaign -> task -> run. Always show one explicit next prompt and prefer get_prompt_guide_flow when the user is unsure.',
    instructions:
      'Use a guided tool-chaining style. After each tool call, read structuredContent.recommended_next_prompt and structuredContent.next_actions, then suggest or execute exactly one next step. If the user is unsure/stuck or a tool errors, call get_prompt_guide_flow with context_step, service, and campaign_id when available. Do not invent tool names or parameters.',
  });

  registerAllTools(server, config);
  registerAllResources(server);

  return server;
}
