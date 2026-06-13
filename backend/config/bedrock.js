import { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const region = process.env.AWS_REGION || 'us-east-1';

const bedrockClient = new BedrockRuntimeClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ── Rate limiter: max 1 call per 3 seconds ──────────────────
let lastCallTime = 0;
const MIN_INTERVAL_MS = 3000;

async function rateLimitGuard() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    const waitMs = MIN_INTERVAL_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastCallTime = Date.now();
}

/**
 * Invoke a Bedrock model using the Converse API (works with all model types
 * including inference profiles like us.amazon.nova-*, us.anthropic.claude-*, etc.)
 *
 * @param {string} prompt - The prompt text
 * @param {number} maxTokens - Max tokens for response (default 512)
 * @returns {Promise<string>} Model output text
 */
export async function invokeModel(prompt, maxTokens = 512) {
  await rateLimitGuard();

  const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0';

  const command = new ConverseCommand({
    modelId,
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      maxTokens,
      temperature: 0.2,
      topP: 0.9,
    },
  });

  const response = await bedrockClient.send(command);

  console.log('[Bedrock] Stop reason:', response.stopReason);
  console.log('[Bedrock] Usage:', JSON.stringify(response.usage));

  // Converse API returns output.message.content[0].text
  const outputText = response.output?.message?.content?.[0]?.text || '';
  console.log('[Bedrock] Output text (first 200 chars):', outputText.slice(0, 200));

  return outputText;
}

// Backward-compatible alias
export const invokeTitan = invokeModel;
