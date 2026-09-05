/**
 * Natural-language intent parsing for the AI Buyer.
 * Deterministic and keyword-based (no LLM needed at parse time) so the demo
 * is fully reproducible and auditable.
 */

export interface BuyerIntent {
  budgetPaise: number | null; // null = no budget constraint in the request
  categories: string[]; // catalog categories the buyer is interested in ([] = all)
  wantMaintenanceKit: boolean;
  raw: string;
}

const CATEGORY_KEYWORDS: { pattern: RegExp; categories: string[] }[] = [
  { pattern: /espresso/i, categories: ["espresso-machines"] },
  { pattern: /coffee (maker|machine)|cappuccino|latte/i, categories: ["espresso-machines", "brewers"] },
  { pattern: /grinder/i, categories: ["grinders"] },
  { pattern: /kettle/i, categories: ["kettles"] },
  { pattern: /french press/i, categories: ["brewers"] },
  { pattern: /aeropress/i, categories: ["brewers"] },
  { pattern: /scale/i, categories: ["accessories"] },
  { pattern: /pitcher|froth/i, categories: ["accessories"] },
  { pattern: /tamper/i, categories: ["accessories"] },
];

const BUDGET_RE =
  /(?:under|below|upto|up\s*to|less\s*than|within|beneath|max(?:imum)?\s*(?:budget|price)|budget\s*(?:of)?|around|about)\s*(?:₹|rs\.?)?\s*([\d,]+)\s*(k|lakh)?/i;

function moneyToPaise(value: number, unit?: string): number {
  if (/^lakh/i.test(unit ?? "")) return Math.round(value * 100_000 * 100);
  if (/^k/i.test(unit ?? "")) return Math.round(value * 1_000 * 100);
  return Math.round(value * 100);
}

export function parseBuyerIntent(request: string): BuyerIntent {
  const raw = request;

  // Budget ------------------------------------------------------------------
  let budgetPaise: number | null = null;
  const budgetMatch = raw.match(BUDGET_RE);
  if (budgetMatch) {
    budgetPaise = moneyToPaise(parseFloat(budgetMatch[1].replace(/,/g, "")), budgetMatch[2]);
  } else {
    // Fallback: first bare currency-ish number in the sentence.
    const bare = raw.match(/(?:₹|rs\.?)?\s*([\d,]+)(?:\s*(k|lakh))?/i);
    if (bare) budgetPaise = moneyToPaise(parseFloat(bare[1].replace(/,/g, "")), bare[2]);
  }

  // Categories ----------------------------------------------------------------
  const categories: string[] = [];
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.pattern.test(raw)) {
      for (const category of entry.categories) {
        if (!categories.includes(category)) categories.push(category);
      }
    }
  }

  // Add-ons -------------------------------------------------------------------
  const wantMaintenanceKit = /maintenance|descaling|cleaning kit|service kit/i.test(raw);

  return { budgetPaise, categories, wantMaintenanceKit, raw };
}