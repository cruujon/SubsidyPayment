import '@modelcontextprotocol/ext-apps/server';

declare module '@modelcontextprotocol/ext-apps/server' {
  interface ToolConfig {
    securitySchemes?: Array<Record<string, unknown>>;
  }
}

export {};
