import { wrapAxiosWithPayment, x402Client } from '@x402/axios';
import { ExactEvmScheme } from '@x402/evm';
import axios, { type AxiosError, isAxiosError } from 'axios';
import { privateKeyToAccount } from 'viem/accounts';

import { BackendClientError } from '../backend-client.ts';
import type { BackendConfig } from '../config.ts';

type GithubIssueApiResponse = {
  status?: string;
};

function parseGithubIssueResponse(payload: unknown): { status: string } {
  const body = payload as GithubIssueApiResponse | null;
  const status = body?.status;

  if (typeof status !== 'string' || status.length === 0) {
    throw new BackendClientError(
      'github_issue_invalid_response',
      'GitHub issue API returned an invalid response payload.',
      payload
    );
  }

  return { status };
}

function toBackendClientError(error: AxiosError): BackendClientError {
  if (error.code === 'ECONNABORTED') {
    return new BackendClientError('backend_timeout', 'GitHub issue API request timed out.', {
      message: error.message,
    });
  }

  if (error.response) {
    return new BackendClientError(
      'github_issue_request_failed',
      `GitHub issue API request failed with status ${error.response.status}.`,
      {
        status: error.response.status,
        data: error.response.data,
      }
    );
  }

  return new BackendClientError('backend_unavailable', 'GitHub issue API is unavailable.', {
    message: error.message,
  });
}

export class X402GithubIssueClient {
  private readonly api;
  private readonly githubIssueUrl: string;

  constructor(config: BackendConfig) {
    if (!config.x402PrivateKey) {
      throw new BackendClientError(
        'x402_config_error',
        'X402_PRIVATE_KEY is required to call x402 GitHub issue endpoint. Set it in mcp-server/.env or process environment.'
      );
    }

    this.githubIssueUrl = config.x402GithubIssueUrl;

    const account = privateKeyToAccount(config.x402PrivateKey as `0x${string}`);
    const paymentClient = new x402Client().register(config.x402Network, new ExactEvmScheme(account));

    this.api = wrapAxiosWithPayment(
      axios.create({
        timeout: config.x402RequestTimeoutMs,
      }),
      paymentClient
    );
  }

  async createGithubIssue(): Promise<{ status: string }> {
    try {
      const response = await this.api.get(this.githubIssueUrl);
      return parseGithubIssueResponse(response.data);
    } catch (error) {
      if (isAxiosError(error)) {
        throw toBackendClientError(error);
      }
      if (error instanceof BackendClientError) {
        throw error;
      }
      throw new BackendClientError('backend_unavailable', 'GitHub issue API is unavailable.', error);
    }
  }
}
