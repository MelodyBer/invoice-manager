import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

const NETWORK_ERROR_RETRIES = 1;

export function getAnthropicClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }
    cachedClient = new Anthropic({ apiKey, maxRetries: NETWORK_ERROR_RETRIES });
  }
  return cachedClient;
}
