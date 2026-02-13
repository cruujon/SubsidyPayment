# 🧠 Assistants API Reference

Complete reference for building programmatic AI assistants with OpenAI's Assistants API.

---

## Architecture Overview

```
Your App → Assistants API → Model (GPT-4o) → Tools → Response
                │
                ├── Code Interpreter (sandboxed Python)
                ├── File Search (vector store RAG)
                └── Function Calling (your custom functions)
```

### Core Objects

| Object | Lifecycle | Description |
|---|---|---|
| **Assistant** | Persistent | The AI configuration (instructions, model, tools). Create once, reuse. |
| **Thread** | Per conversation | A conversation session. Messages are appended over time. |
| **Message** | Per turn | A single user or assistant message within a thread. |
| **Run** | Per interaction | An execution of the assistant on a thread. Produces new messages. |
| **Run Step** | Per action | Individual steps within a run (tool calls, message creation). |

---

## Setup

### Installation

```bash
# Node.js
npm install openai

# Python
pip install openai
```

### Client Initialization

```typescript
// TypeScript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

```python
# Python
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
```

---

## Tool Types

### 1. Code Interpreter

Sandboxed Python environment for computation, data analysis, and file generation.

**Capabilities**:
- Run Python code (pandas, matplotlib, numpy, etc.)
- Read uploaded files (CSV, Excel, JSON, images)
- Generate files (charts, CSVs, PDFs)
- Perform math calculations

**Limitations**:
- No internet access
- No pip install (pre-installed packages only)
- 300-second execution timeout
- Sandbox is ephemeral (no state between runs)

```typescript
const assistant = await client.beta.assistants.create({
  name: "Data Analyst",
  instructions: "Analyze data files and create visualizations. Always show your code.",
  model: "gpt-4o",
  tools: [{ type: "code_interpreter" }],
});
```

### 2. File Search

Vector-store-based RAG over uploaded documents.

**Capabilities**:
- Search across up to 10,000 files
- Supports: PDF, MD, TXT, DOCX, HTML, JSON, CSV, and more
- Automatic chunking and embedding
- Citation support (returns source file and location)

**Configuration**:

```typescript
// Create a vector store
const vectorStore = await client.beta.vectorStores.create({
  name: "Product Documentation",
});

// Upload files to the vector store
await client.beta.vectorStores.files.create(vectorStore.id, {
  file_id: uploadedFile.id,
});

// Attach to assistant
const assistant = await client.beta.assistants.create({
  name: "Docs Assistant",
  instructions: "Answer questions using the product documentation. Always cite sources.",
  model: "gpt-4o",
  tools: [{ type: "file_search" }],
  tool_resources: {
    file_search: { vector_store_ids: [vectorStore.id] },
  },
});
```

### 3. Function Calling

Define custom functions the assistant can invoke. Your code executes the function and returns results.

```typescript
const assistant = await client.beta.assistants.create({
  name: "Weather Assistant",
  instructions: "Help users check weather. Always call get_weather for weather queries.",
  model: "gpt-4o",
  tools: [{
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city. Call this whenever the user asks about weather.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City name, e.g., 'Tokyo', 'New York'",
          },
          units: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit. Default: celsius",
          },
        },
        required: ["city"],
      },
    },
  }],
});
```

---

## Conversation Flow

### Basic Flow (Non-Streaming)

```typescript
// 1. Create thread
const thread = await client.beta.threads.create();

// 2. Add user message
await client.beta.threads.messages.create(thread.id, {
  role: "user",
  content: "Analyze this CSV file",
  attachments: [{
    file_id: uploadedFile.id,
    tools: [{ type: "code_interpreter" }],
  }],
});

// 3. Create run
const run = await client.beta.threads.runs.createAndPoll(thread.id, {
  assistant_id: assistant.id,
});

// 4. Get response
if (run.status === "completed") {
  const messages = await client.beta.threads.messages.list(thread.id);
  const lastMessage = messages.data[0];
  console.log(lastMessage.content[0].text.value);
}
```

### Streaming Flow (Recommended for UX)

```typescript
const stream = client.beta.threads.runs.stream(thread.id, {
  assistant_id: assistant.id,
});

stream
  .on('textCreated', () => process.stdout.write('\n'))
  .on('textDelta', (delta) => process.stdout.write(delta.value ?? ''))
  .on('toolCallCreated', (toolCall) => {
    console.log(`\nUsing tool: ${toolCall.type}`);
  })
  .on('toolCallDelta', (delta) => {
    if (delta.type === 'code_interpreter' && delta.code_interpreter?.input) {
      process.stdout.write(delta.code_interpreter.input);
    }
  });

await stream.finalRun();
```

### Function Calling Flow

```typescript
const run = await client.beta.threads.runs.createAndPoll(thread.id, {
  assistant_id: assistant.id,
});

if (run.status === "requires_action") {
  const toolCalls = run.required_action.submit_tool_outputs.tool_calls;

  const toolOutputs = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.function.arguments);

      // Execute your function
      let result;
      if (toolCall.function.name === "get_weather") {
        result = await fetchWeather(args.city, args.units);
      }

      return {
        tool_call_id: toolCall.id,
        output: JSON.stringify(result),
      };
    })
  );

  // Submit results back
  await client.beta.threads.runs.submitToolOutputsAndPoll(
    thread.id,
    run.id,
    { tool_outputs: toolOutputs }
  );
}
```

---

## Model Selection

| Model | Best For | Cost | Context |
|---|---|---|---|
| `gpt-4o` | Complex reasoning, multi-tool use | $$$ | 128K |
| `gpt-4o-mini` | Simple tasks, high volume, cost-sensitive | $ | 128K |
| `gpt-4-turbo` | Legacy, being replaced by gpt-4o | $$ | 128K |

**Recommendation**: Start with `gpt-4o-mini` for development, switch to `gpt-4o` for production if quality requires it.

---

## Thread Management

### Context Window Strategy

Threads accumulate messages. When context gets too long:

1. **Truncation** (automatic): The API truncates older messages to fit context
2. **Summarization** (manual): Periodically summarize the thread and start fresh
3. **Metadata tagging**: Use `metadata` to track conversation state

```typescript
// Add metadata to threads for tracking
const thread = await client.beta.threads.create({
  metadata: {
    user_id: "user_123",
    session_type: "data_analysis",
    created_at: new Date().toISOString(),
  },
});
```

### Thread Cleanup

```typescript
// Delete old threads (implement a cleanup job)
async function cleanupOldThreads(olderThanDays: number) {
  // List threads from your database (API doesn't list threads)
  // Delete threads older than threshold
  await client.beta.threads.del(threadId);
}
```

---

## Error Handling

| Error | Status | Cause | Recovery |
|---|---|---|---|
| `rate_limit_exceeded` | 429 | Too many requests | Exponential backoff: wait 2^n seconds |
| `context_length_exceeded` | 400 | Thread too long | Summarize thread, start new one |
| `run_failed` | — | Tool execution error | Check `run.last_error`, retry or fix tool |
| `expired` | — | Run took >10 minutes | Optimize tool execution, break into smaller steps |
| `invalid_api_key` | 401 | Wrong or expired key | Regenerate key at platform.openai.com |

### Robust Run Handler

```typescript
async function safeRun(threadId: string, assistantId: string, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const run = await client.beta.threads.runs.createAndPoll(threadId, {
        assistant_id: assistantId,
      });

      if (run.status === "completed") return run;
      if (run.status === "requires_action") return run; // Handle tool calls

      console.error(`Run failed: ${run.status}`, run.last_error);
    } catch (error) {
      if (error.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Run failed after ${maxRetries} attempts`);
}
```

---

## Pricing Awareness

| Component | Cost Factor |
|---|---|
| **API calls** | Input + output tokens (model-dependent) |
| **Code Interpreter** | $0.03 per session (per run that uses it) |
| **File Search** | $0.10/GB/day for vector storage + $2.50 per 1000 tool calls |
| **File storage** | Free up to limits, then per-GB |

**Cost optimization tips**:
1. Use `gpt-4o-mini` where possible (10x cheaper than `gpt-4o`)
2. Limit code interpreter sessions (batch operations into single runs)
3. Clean up unused vector stores
4. Set `max_prompt_tokens` and `max_completion_tokens` on runs
