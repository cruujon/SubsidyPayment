/**
 * Assistants API Client — Complete Example
 *
 * A data analysis assistant that:
 * 1. Accepts CSV file uploads
 * 2. Analyzes data with Code Interpreter
 * 3. Streams responses in real-time
 * 4. Handles function calling for external data
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx ts-node index.ts
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Configuration ---
const ASSISTANT_CONFIG = {
  name: 'Data Analyst',
  instructions: `You are a senior data analyst. You help users understand their data through analysis and visualization.

Rules:
- Always start by examining the data structure (columns, types, row count)
- Create clear, labeled visualizations with matplotlib
- Explain findings in plain language, not just statistics
- When creating charts, always include titles, axis labels, and legends
- If the data has issues (missing values, wrong types), report them first

Response Format:
- Start with a brief summary of what you found
- Show key statistics in a table
- Include visualizations when they add insight
- End with actionable recommendations`,
  model: 'gpt-4o' as const,
  tools: [
    { type: 'code_interpreter' as const },
    {
      type: 'function' as const,
      function: {
        name: 'get_industry_benchmark',
        description:
          'Get industry benchmark data for comparison. Call this when the user wants to compare their data against industry standards.',
        parameters: {
          type: 'object' as const,
          properties: {
            industry: {
              type: 'string',
              description: "Industry name, e.g., 'e-commerce', 'saas', 'fintech'",
            },
            metric: {
              type: 'string',
              description: "Metric to benchmark, e.g., 'conversion_rate', 'churn_rate', 'revenue_growth'",
            },
          },
          required: ['industry', 'metric'],
        },
      },
    },
  ],
};

// --- Mock External Function ---
async function getIndustryBenchmark(industry: string, metric: string): Promise<object> {
  const benchmarks: Record<string, Record<string, object>> = {
    'e-commerce': {
      conversion_rate: { median: 2.5, top_quartile: 5.0, unit: '%' },
      average_order_value: { median: 85, top_quartile: 150, unit: 'USD' },
    },
    saas: {
      churn_rate: { median: 5.0, top_quartile: 2.0, unit: '% monthly' },
      revenue_growth: { median: 15, top_quartile: 40, unit: '% YoY' },
    },
  };

  return (
    benchmarks[industry]?.[metric] ?? {
      error: `No benchmark data for ${industry}/${metric}`,
      suggestion: 'Try: e-commerce/conversion_rate or saas/churn_rate',
    }
  );
}

// --- Main Flow ---
async function main() {
  console.log('🤖 Creating assistant...');

  // 1. Create Assistant
  const assistant = await client.beta.assistants.create(ASSISTANT_CONFIG);
  console.log(`   Assistant ID: ${assistant.id}`);

  // 2. Upload a sample file (optional)
  let fileId: string | undefined;
  const samplePath = path.join(__dirname, 'sample_data.csv');
  if (fs.existsSync(samplePath)) {
    console.log('📁 Uploading file...');
    const file = await client.files.create({
      file: fs.createReadStream(samplePath),
      purpose: 'assistants',
    });
    fileId = file.id;
    console.log(`   File ID: ${fileId}`);
  }

  // 3. Create Thread
  console.log('💬 Creating thread...');
  const thread = await client.beta.threads.create();

  // 4. Add User Message
  const userMessage = fileId
    ? 'Analyze this data file. Show me the key trends and create a visualization.'
    : 'Generate a sample dataset of monthly sales data for 2024 and analyze the trends.';

  await client.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: userMessage,
    ...(fileId && {
      attachments: [{ file_id: fileId, tools: [{ type: 'code_interpreter' }] }],
    }),
  });

  console.log(`\n👤 User: ${userMessage}\n`);
  console.log('🤖 Assistant:');

  // 5. Run with Streaming
  const stream = client.beta.threads.runs.stream(thread.id, {
    assistant_id: assistant.id,
  });

  // Handle streaming events
  stream
    .on('textCreated', () => process.stdout.write(''))
    .on('textDelta', (delta) => {
      process.stdout.write(delta.value ?? '');
    })
    .on('toolCallCreated', (toolCall) => {
      if (toolCall.type === 'code_interpreter') {
        console.log('\n📊 [Running code...]');
      } else if (toolCall.type === 'function') {
        console.log(`\n🔧 [Calling function: ${toolCall.function?.name}]`);
      }
    })
    .on('toolCallDelta', (delta) => {
      if (delta.type === 'code_interpreter' && delta.code_interpreter?.input) {
        process.stdout.write(delta.code_interpreter.input);
      }
    })
    .on('event', async (event) => {
      // Handle function calling
      if (
        event.event === 'thread.run.requires_action' &&
        event.data.required_action?.type === 'submit_tool_outputs'
      ) {
        const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = await Promise.all(
          toolCalls.map(async (tc) => {
            const args = JSON.parse(tc.function.arguments);
            let result: object;

            if (tc.function.name === 'get_industry_benchmark') {
              result = await getIndustryBenchmark(args.industry, args.metric);
            } else {
              result = { error: `Unknown function: ${tc.function.name}` };
            }

            return { tool_call_id: tc.id, output: JSON.stringify(result) };
          })
        );

        // Submit tool outputs and continue streaming
        const continueStream = client.beta.threads.runs.submitToolOutputsStream(
          thread.id,
          event.data.id,
          { tool_outputs: toolOutputs }
        );

        continueStream
          .on('textDelta', (delta) => process.stdout.write(delta.value ?? ''))
          .on('end', () => console.log('\n'));

        await continueStream.finalRun();
      }
    });

  await stream.finalRun();

  console.log('\n\n✅ Done!');

  // 6. Cleanup
  console.log('🧹 Cleaning up...');
  await client.beta.assistants.del(assistant.id);
  if (fileId) await client.files.del(fileId);
  await client.beta.threads.del(thread.id);
  console.log('   Cleaned up assistant, file, and thread.');
}

main().catch(console.error);
