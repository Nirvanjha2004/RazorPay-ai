/**
 * Free-text product matching for the conversational checkout.
 * Deterministic keyword scoring over the agent-readable catalog — no LLM
 * needed for intent, so the flow stays fast and testable.
 */

import { buildAgentCatalog } from "@/lib/catalog";
import type { CatalogProduct } from "@/lib/catalog";

const STOPWORDS = new Set([
  "i", "want", "a", "an", "the", "for", "me", "please", "to", "buy", "some",
  "get", "need", "looking", "add", "and", "of", "it", "my", "can", "you",
  "give", "show", "do", "have", "any", "would", "like",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function scoreProduct(product: CatalogProduct, tokens: string[]): number {
  const nameWords = new Set(tokenize(product.name));
  const categoryWords = new Set(tokenize(product.category.replace(/-/g, " ")));
  const descriptionWords = new Set(tokenize(product.description));

  let score = 0;
  for (const token of tokens) {
    if (nameWords.has(token)) score += 3;
    if (categoryWords.has(token)) score += 2;
    if (descriptionWords.has(token)) score += 1;
  }
  return score;
}

export interface ProductMatch {
  product: CatalogProduct | null;
  alternatives: CatalogProduct[];
}

/**
 * Match a free-text user message to a catalog product.
 * Returns null when nothing scores above zero.
 */
export async function findBestProduct(message: string): Promise<ProductMatch> {
  const catalog = await buildAgentCatalog();
  const tokens = tokenize(message);
  if (tokens.length === 0) return { product: null, alternatives: [] };

  const scored = catalog.products
    .map((product) => ({ product, score: scoreProduct(product, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { product: null, alternatives: [] };
  }

  return {
    product: scored[0].product,
    alternatives: scored.slice(1, 4).map((entry) => entry.product),
  };
}
