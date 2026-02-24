import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { BackendClientError } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';
import { X402GithubIssueClient } from '../x402/github-issue-client.ts';

const githubIssueInputSchema = z.object({});

export function registerCreateGithubIssueTool(server: McpServer, config: BackendConfig): void {
  registerAppTool(
    server,
    'create_github_issue',
    {
      title: 'Create GitHub Issue',
      description: 'Create a GitHub issue via x402-protected endpoint.',
      inputSchema: githubIssueInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        securitySchemes: [{ type: 'noauth' }],
        'openai/toolInvocation/invoking': 'Creating GitHub issue...',
        'openai/toolInvocation/invoked': 'GitHub issue created',
      },
    },
    async () => {
      try {
        const client = new X402GithubIssueClient(config);
        const result = await client.createGithubIssue();

        return {
          structuredContent: {
            status: result.status,
            source: 'x402server',
            paid: true,
          },
          content: [
            {
              type: 'text' as const,
              text: 'GitHub issue was created via x402 endpoint.',
            },
          ],
          _meta: {
            endpoint: config.x402GithubIssueUrl,
            response: result,
          },
        };
      } catch (error) {
        if (error instanceof BackendClientError) {
          return {
            content: [{ type: 'text' as const, text: error.message }],
            _meta: { code: error.code, details: error.details },
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: 'An unexpected error occurred while creating GitHub issue.' }],
          _meta: { code: 'unexpected_error' },
          isError: true,
        };
      }
    }
  );
}
