/**
 * LLM client singleton — now supports both OpenAI and OpenRouter.
 *
 * Priority:
 *   1. OPENROUTER_API_KEY -> https://openrouter.ai/api/v1 (free models)
 *   2. OPENAI_API_KEY      -> https://api.openai.com/v1
 *   3. none                -> deterministic fallback (agents still work)
 *
 * Set OPENAI_BASE_URL to override either (e.g. for proxies).
 */

import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as { __openai?: OpenAI };

// Free / cheap OpenRouter models that support tool-calling (agents need tools)
// User-requested: inclusionai/ling-3.0-flash-sante:free
export const FREE_OPENROUTER_MODELS = [
  "inclusionai/ling-3.0-flash-sante:free", // ← active (user choice)
  "openai/gpt-oss-20b:free",          // best free tool-caller fallback, 131k context
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "qwen/qwen-2-7b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
] as const;

function resolveConfig() {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrlEnv = process.env.OPENAI_BASE_URL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (openRouterKey) {
    return {
      apiKey: openRouterKey,
      baseURL: baseUrlEnv || "https://openrouter.ai/api/v1",
      isOpenRouter: true,
      appUrl,
    };
  }
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseURL: baseUrlEnv || undefined, // undefined = OpenAI default
      isOpenRouter: false,
      appUrl,
    };
  }
  return null;
}

export function isOpenAIConfigured(): boolean {
  return resolveConfig() !== null;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getOpenAI(): OpenAI | null {
  const cfg = resolveConfig();
  if (!cfg) return null;
  if (globalForOpenAI.__openai) return globalForOpenAI.__openai;

  globalForOpenAI.__openai = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    maxRetries: 2,
    timeout: 30_000,
    // OpenRouter requires these for free-tier ranking/analytics — harmless for OpenAI
    defaultHeaders: cfg.isOpenRouter
      ? {
          "HTTP-Referer": cfg.appUrl,
          "X-Title": "CommerceAgent",
        }
      : undefined,
  });
  return globalForOpenAI.__openai;
}

// Default model: prefer env, then free OpenRouter model, then gpt-4o-mini
export const OPENAI_MODEL =
  process.env.OPENAI_MODEL?.trim() ||
  (isOpenRouterConfigured() ? "inclusionai/ling-3.0-flash-sante:free" : "gpt-4o-mini");
