/**
 * OpenAI client singleton. Returns null when OPENAI_API_KEY is not set so
 * agents can fall back to deterministic logic instead of crashing.
 */

import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as { __openai?: OpenAI };

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI | null {
  if (!isOpenAIConfigured()) return null;
  if (globalForOpenAI.__openai) return globalForOpenAI.__openai;

  globalForOpenAI.__openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 2,
    timeout: 30_000,
  });
  return globalForOpenAI.__openai;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
