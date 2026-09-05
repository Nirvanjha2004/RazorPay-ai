/**
 * GROWTH AGENT — analyzes the cart/catalog and suggests upsells/cross-sells.
 *
 * Hard rules (enforced in code, not just the prompt):
 *   - At most ONE suggested item.
 *   - Its price must be strictly less than 40% of the cart value.
 *   - A "reason" string is always attached.
 *
 * Uses OpenAI tool-calling with a `get_catalog` tool when OPENAI_API_KEY is
 * set; otherwise falls back to deterministic logic so the pipeline always runs.
 */

import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

import { buildAgentCatalog } from "@/lib/catalog";
import { getOpenAI, OPENAI_MODEL } from "@/lib/openai";
import { logAgentDecision } from "@/lib/agents/multiagent/audit";
import type { CartItem, UpsellSuggestion } from "@/lib/agents/multiagent/types";

export const MAX_UPSELL_PRICE_RATIO = 0.4;

export interface GrowthResult {
  suggestion: UpsellSuggestion | null;
  reasoning: string;
  source: "openai" | "deterministic-fallback";
}

function extractJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Enforce the hard rules on whatever the LLM proposed (may return null). */
function enforceRules(
  proposal: { product_id?: string; reason?: string } | null,
  catalog: Awaited<ReturnType<typeof buildAgentCatalog>>,
  cart: CartItem[],
  cartTotalPaise: number
): { suggestion: UpsellSuggestion | null; reasoning: string; dropped: string[] } {
  const dropped: string[] = [];
  if (!proposal || !proposal.product_id) {
    return { suggestion: null, reasoning: "No upsell proposed.", dropped };
  }

  const product = catalog.products.find((p) => p.id === proposal.product_id);
  if (!product) {
    return {
      suggestion: null,
      reasoning: `Proposed product "${proposal.product_id}" is not in the catalog.`,
      dropped,
    };
  }

  // Rule: price must be < 40% of cart value.
  if (cartTotalPaise <= 0 || product.price_in_paise >= MAX_UPSELL_PRICE_RATIO * cartTotalPaise) {
    dropped.push(`${product.id} (price >= 40% of cart value)`);
    return {
      suggestion: null,
      reasoning: `Upsell "${product.name}" rejected: ₹${(product.price_in_paise / 100).toFixed(
        2
      )} is not below ${Math.round(MAX_UPSELL_PRICE_RATIO * 100)}% of the cart value.`,
      dropped,
    };
  }

  // Rule: never suggest something already in the cart, or out of stock.
  if (cart.some((item) => item.productId === product.id)) {
    dropped.push(`${product.id} (already in cart)`);
    return { suggestion: null, reasoning: `Upsell "${product.name}" is already in the cart.`, dropped };
  }
  if (product.availability === "out_of_stock") {
    dropped.push(`${product.id} (out of stock)`);
    return { suggestion: null, reasoning: `Upsell "${product.name}" is out of stock.`, dropped };
  }

  return {
    suggestion: {
      productId: product.id,
      name: product.name,
      priceInPaise: product.price_in_paise,
      reason: proposal.reason ?? "Complements the items in your cart.",
    },
    reasoning: `Suggested "${product.name}" — under the 40% cart-value cap.`,
    dropped,
  };
}

/** Deterministic fallback: priciest in-stock item under the 40% cap. */
async function deterministicSuggestion(
  cart: CartItem[],
  cartTotalPaise: number
): Promise<GrowthResult> {
  const catalog = await buildAgentCatalog();
  const cap = MAX_UPSELL_PRICE_RATIO * cartTotalPaise;
  const candidates = catalog.products
    .filter((p) => p.availability !== "out_of_stock")
    .filter((p) => !cart.some((item) => item.productId === p.id))
    .filter((p) => p.price_in_paise < cap)
    .sort((a, b) => b.price_in_paise - a.price_in_paise);

  if (candidates.length === 0) {
    return {
      suggestion: null,
      reasoning: "No in-stock product is priced below 40% of the cart value — no upsell.",
      source: "deterministic-fallback",
    };
  }

  const pick = candidates[0];
  return {
    suggestion: {
      productId: pick.id,
      name: pick.name,
      priceInPaise: pick.price_in_paise,
      reason: `Frequently added with items like yours; at ₹${(pick.price_in_paise / 100).toFixed(
        2
      )} it stays under 40% of your cart value.`,
    },
    reasoning: `Deterministic pick: "${pick.name}" is the highest-value in-stock item under the 40% cap.`,
    source: "deterministic-fallback",
  };
}

export async function runGrowthAgent(
  sessionId: string,
  cart: CartItem[],
  cartTotalPaise: number
): Promise<GrowthResult> {
  const openai = getOpenAI();

  if (!openai) {
    const result = await deterministicSuggestion(cart, cartTotalPaise);
    await logAgentDecision({
      agentName: "GROWTH",
      action: "suggest_upsell",
      status: result.suggestion ? "SUCCESS" : "SKIPPED",
      reasoning: `${result.reasoning} [${result.source}]`,
      amountInPaise: result.suggestion?.priceInPaise ?? null,
      sessionId,
      meta: result.suggestion ? { product_id: result.suggestion.productId } : null,
    });
    return result;
  }

  try {
    const tools: ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "get_catalog",
          description:
            "Fetch the current product catalog with prices (paise), availability and pre-computed upsell candidates.",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
    ];

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: [
          "You are the GROWTH agent of an autonomous commerce system.",
          "Analyze the user's cart and suggest AT MOST ONE upsell/cross-sell item.",
          "Hard rules: the suggested item's price must be STRICTLY LESS than 40% of the cart total;",
          "it must not already be in the cart; it must be in stock; and you must always attach a short 'reason' string.",
          "Call get_catalog to see the products. If nothing qualifies, suggest nothing.",
          'Final answer must be JSON only: {"suggestion": {"product_id": "...", "reason": "..."} | null, "reasoning": "..."}',
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({ cart, cart_total_paise: cartTotalPaise }),
      },
    ];

    let content: string | null = null;
    for (let iteration = 0; iteration < 4; iteration++) {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        tools,
        temperature: 0.2,
      });
      const message = completion.choices[0]?.message;
      if (!message) break;

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message as ChatCompletionMessageParam);
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === "get_catalog") {
            const catalog = await buildAgentCatalog();
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(catalog),
            });
          }
        }
        continue;
      }

      content = message.content ?? null;
      break;
    }

    const parsed = extractJson(content);
    const proposal =
      parsed && typeof parsed === "object" && "suggestion" in parsed
        ? ((parsed.suggestion ?? null) as { product_id?: string; reason?: string } | null)
        : null;
    const llmReasoning =
      parsed && typeof parsed.reasoning === "string" ? parsed.reasoning : "No reasoning returned.";

    const { suggestion, reasoning, dropped } = enforceRules(
      proposal,
      await buildAgentCatalog(),
      cart,
      cartTotalPaise
    );
    const finalReasoning = `${llmReasoning} ${reasoning}`.trim();

    await logAgentDecision({
      agentName: "GROWTH",
      action: "suggest_upsell",
      status: suggestion ? "SUCCESS" : "SKIPPED",
      reasoning: `${finalReasoning}${dropped.length ? ` Dropped: ${dropped.join("; ")}.` : ""} [openai]`,
      amountInPaise: suggestion?.priceInPaise ?? null,
      sessionId,
      meta: suggestion ? { product_id: suggestion.productId } : null,
    });

    return { suggestion, reasoning: finalReasoning, source: "openai" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[growth-agent] OpenAI call failed, falling back:", message);
    const result = await deterministicSuggestion(cart, cartTotalPaise);
    await logAgentDecision({
      agentName: "GROWTH",
      action: "suggest_upsell",
      status: result.suggestion ? "SUCCESS" : "SKIPPED",
      reasoning: `${result.reasoning} (OpenAI error: ${message}) [deterministic-fallback]`,
      amountInPaise: result.suggestion?.priceInPaise ?? null,
      sessionId,
    });
    return result;
  }
}
