import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

let bedrockClient = null;

try {
  // Try to initialize the client. This will use credentials from env vars if available.
  bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
} catch (error) {
  console.warn("Failed to initialize Bedrock Runtime Client. Ensure AWS credentials are set if using AI features.");
}

export const invokeTitan = async (prompt) => {
  if (!bedrockClient) {
    console.warn("Bedrock client not initialized. Returning STUB response.");
    return `[STUB - Bedrock not configured] I would have answered your question: "${prompt}"`;
  }

  try {
    const command = new InvokeModelCommand({
      modelId: "amazon.titan-text-lite-v1",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: 512,
          stopSequences: [],
          temperature: 0.7,
          topP: 0.9
        }
      })
    });

    const response = await bedrockClient.send(command);
    // Parse the response body (it's a Uint8Array)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.results[0].outputText;
  } catch (error) {
    console.error("Error invoking Bedrock:", error);
    return `[ERROR - Fallback STUB] Could not reach AWS Bedrock. You asked: "${prompt}"`;
  }
};
