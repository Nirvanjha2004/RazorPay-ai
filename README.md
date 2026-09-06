# CommerceAgent — Autonomous Commerce for Razorpay

> **AI agents that buy & sell on Razorpay — with full audit trails, hard guardrails, and human-in-the-loop approvals.**

CommerceAgent is a multi-agent commerce system where **Growth**, **Checkout**, and **Guardian** agents transact autonomously on Razorpay. Every money action is **bounded, gated, and explainable** — the bar for autonomous commerce.

Built for the Razorpay AI hackathon: a live demo of safe, auditable agentic payments on real Razorpay test-mode rails.

---

## Table of Contents

- [Why CommerceAgent?](#why-commerceagent)
- [Features](#features)
- [The "Bar" Checklist — Bounded, Gated, Explainable](#the-bar-checklist--bounded-gated-explainable)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Models](#data-models)
- [Agents in Detail](#agents-in-detail)
- [Guardrails & Safety](#guardrails--safety)
- [Pages / Surfaces](#pages--surfaces)
- [API Reference](#api-reference)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Razorpay Test-Mode Setup](#razorpay-test-mode-setup)
- [Webhooks](#webhooks)
- [Demo Script — 3-Minute Judge Walkthrough](#demo-script--3-minute-judge-walkthrough)
- [Data Flow for a Single Transaction](#data-flow-for-a-single-transaction)
- [Analytics & Revenue Simulation](#analytics--revenue-simulation)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why CommerceAgent?

Autonomous shopping agents are powerful but dangerous: an LLM with a payments API key can overspend, hallucinate products, refund the wrong payment, or leave no trace of why it acted.

CommerceAgent solves this with three principles:

1. **Bounded** — hard spend caps and allowlists enforced in deterministic code, not prompts.
2. **Gated** — a non-LLM Guardian governor + human approvals sit in front of every money action.
3. **Explainable** — every decision is logged with `reasoning` and replayable step-by-step.

Result: agents that can upsell, checkout, retry, and recover — without ever moving money unsafely.

---

## Features

- **Conversational checkout** — natural-language shopping ("I want a coffee machine") with product matching, cart, and upsells.
- **AI Buyer pipeline** — `POST /api/agent-buy` parses free-text intent → matches catalog → Guardian review → Razorpay order → payment → audit.
- **Growth Agent** — proposes context-aware upsells (price < 40% of cart, with human-readable reason).
- **Checkout Agent** — creates Razorpay Orders, handles payment retries (1 retry), and falls back to Payment Links on failure.
- **Guardian Agent (governor)** — deterministic TypeScript, never LLM-driven. Enforces session caps, order caps, product allowlists, and human-approval thresholds.
- **Human-in-the-loop approvals** — any action over ₹1,000 pauses the session until a human clicks Approve/Reject in the Terminal.
- **Failure injection demo** — red `INJECT FAILURE` button forces the next payment to fail to showcase graceful recovery.
- **Full audit trail** — every agent run → `AuditLog` table (agent, action, amount, reasoning, status, timestamp).
- **Session replay** — `/replay/[sessionId]` animates the full reasoning chain.
- **Revenue analytics** — agents ON vs baseline (+23% lift hero card), catalog health, daily revenue charts.
- **Live terminal dashboard** — `/terminal` with Customer Simulator, Activity Feed, Guardian Card, Audit Panel, and Chat.
- **Razorpay webhooks** — HMAC-SHA256 verified `payment.captured` / `payment.failed` → order status sync.
- **LLM-optional** — works with OpenRouter / OpenAI tool-calling; falls back to deterministic matching when no key is set.

---

## The "Bar" Checklist — Bounded, Gated, Explainable

| Principle | How CommerceAgent delivers |
|---|---|
| ✅ **Explainable** | Every agent decision is logged with `reasoning` — the audit trail shows *why*, not just *what*. The replay page animates the full reasoning chain. See `lib/agents/multiagent/audit.ts`. |
| ✅ **Bounded** | Hard limits in code (not prompts): ₹2,000/session spend cap, 3 orders/session, ₹1,000 per-action cap, ₹5,000 daily cap, 10 refunds/day. The agent *cannot* exceed these. See `lib/guardrails/index.ts` + `lib/agents/multiagent/guardian.ts`. |
| ✅ **Gated** | The Guardian Agent is deterministic code (never LLM-driven). It enforces allowlists, spend caps, and human-in-the-loop approval. No money action runs without it. |
| ✅ **Audit trail** | Every agent run → `audit_logs` table (agent, action, amount, reasoning, status, timestamp). Replayable at `/replay/[sessionId]`. Queryable at `GET /api/audit`. |
| ✅ **Graceful failure** | Payment failures retry once, then fall back to a Razorpay Payment Link with a user-friendly message. No crashes, no lost state. |

---

## Architecture

```mermaid
flowchart TB
    subgraph User["👤 User"]
        UI["Terminal Dashboard<br/>/terminal"]
        Chat["Customer Chat"]
        Buyer["AI Buyer Demo"]
    end

    subgraph Agents["🤖 Multi-Agent System"]
        G["Growth Agent<br/>Upsell / Cross-sell"]
        C["Checkout Agent<br/>Orders / Payments"]
        Guardian["Guardian Agent<br/>🧠 Governor (code, not LLM)"]
    end

    subgraph Core["⚙️ Core"]
        Catalog["/api/catalog<br/>Agent-readable feed"]
        Orchestrator["Orchestrator<br/>State Machine"]
        Razorpay["Razorpay Client<br/>Orders · Links · Refunds"]
        Audit["Audit Trail<br/>lib/agents/multiagent/audit.ts"]
    end

    subgraph DB["🗄️ SQLite (Prisma)"]
        Products["Products"]
        Orders["Orders"]
        Logs["AuditLogs"]
        ChatSess["ChatSessions"]
        Runs["BuyerRuns"]
    end

    UI --> Chat
    UI --> Buyer
    Chat --> Orchestrator
    Buyer --> Orchestrator
    Orchestrator --> G
    Orchestrator --> C
    Orchestrator --> Guardian
    G --> Catalog
    C --> Razorpay
    Guardian --> Audit
    C --> Audit
    G --> Audit
    Catalog --> Products
    Razorpay -->|"webhooks (HMAC verified)"| Orders
    Orders --> Logs
    ChatSess --> Logs
    Runs --> Logs
```

**Key modules:**

- `lib/agents/orchestrator.ts` — shared state machine (chat phases: `BROWSING → AWAITING_CONFIRMATION → AWAITING_APPROVAL → AWAITING_PAYMENT → COMPLETED / BLOCKED / FAILED / FALLBACK_LINK_SENT`).
- `lib/agents/multiagent/growth.ts` — upsell logic.
- `lib/agents/multiagent/checkout.ts` — Razorpay order creation + retry + link fallback.
- `lib/agents/multiagent/guardian.ts` — session ledger, spend/order caps, allowlist, approvals.
- `lib/guardrails/index.ts` — global executor guardrails (per-action cap, daily spend/refund caps, currency/action allowlists).
- `lib/buyer/` — AI Buyer intent parsing + transaction pipeline.
- `lib/chat/` — conversational checkout (session, matcher, runner, payment).
- `lib/razorpay/client.ts` — Razorpay SDK wrapper (test mode).
- `lib/catalog.ts` — agent-readable catalog builder.

---

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (dark theme)
- **Framer Motion** · **Recharts** · **Sonner** (toasts)
- **Prisma** + **SQLite** (`file:./dev.db`, Postgres-ready)
- **Razorpay SDK** (`razorpay@^2.9.5`, test mode) — Orders, Payment Links, Refunds, Webhooks
- **OpenAI SDK** (`openai@^4.104.0`) with OpenRouter support — tool-calling, with deterministic fallback when no key is set
- **lucide-react** icons · **class-variance-authority / clsx / tailwind-merge**

---

## Project Structure

```
├── app/
│   ├── page.tsx                    # Landing hero (pitch + bar checklist + LAUNCH DEMO)
│   ├── terminal/page.tsx           # Live agent terminal dashboard
│   ├── replay/[sessionId]/page.tsx # Session replay player
│   ├── analytics/page.tsx          # Revenue analytics (+23% lift, charts)
│   ├── audit/page.tsx              # Audit trail table
│   ├── agents/page.tsx             # Agent registry (Growth/Checkout/Guardian cards)
│   ├── settings/page.tsx           # Config & guardrail policy viewer
│   └── api/
│       ├── agent-buy/route.ts              # AI Buyer pipeline
│       ├── agent-buy/runs/route.ts         # List BuyerRuns
│       ├── agent-buy/[id]/route.ts         # Get BuyerRun
│       ├── agent-buy/[id]/approve/route.ts # Approve paused BuyerRun
│       ├── chat/route.ts                   # Conversational checkout (POST + GET)
│       ├── chat/stream/route.ts            # Poll live agent activity + guardian status
│       ├── orchestrator/route.ts           # Growth → Guardian → Checkout pipeline
│       ├── catalog/route.ts                # Agent-readable product feed
│       ├── audit/route.ts                  # Audit trail JSON
│       ├── agents/route.ts                 # Agent registry JSON
│       ├── analytics/route.ts              # Analytics summary
│       ├── analytics/revenue/route.ts      # Revenue metrics (agents ON vs baseline)
│       ├── payments/order/route.ts         # Create Razorpay order (guardrail-gated)
│       ├── payments/mark-paid/route.ts     # Demo helper: mark order PAID
│       ├── simulate-payment-failure/route.ts # Demo helper: force next payment to fail
│       ├── replay/[sessionId]/route.ts     # Replay data for a session
│       ├── razorpay/key/route.ts           # Expose public key id to client
│       └── webhooks/razorpay/route.ts      # Razorpay webhook (HMAC-SHA256 verified)
├── components/
│   ├── terminal/                   # Dashboard panels (activity feed, guardian card, audit, chat)
│   ├── ai-buyer/                   # AI Buyer demo modal
│   ├── analytics/                  # Revenue dashboard charts
│   └── ui/                         # shadcn-style primitives (button, card, badge, etc.)
├── lib/
│   ├── agents/
│   │   ├── orchestrator.ts         # Shared state machine
│   │   ├── executor.ts             # Guardrail-wrapped Razorpay execution
│   │   ├── types.ts                # Agent types
│   │   ├── payment-link-agent.ts   # Payment Link agent
│   │   ├── payment-status-agent.ts # Payment Status agent
│   │   ├── refund-agent.ts         # Refund agent (allowlisted)
│   │   └── multiagent/             # Growth, Checkout, Guardian, audit logging, types
│   ├── buyer/                      # AI Buyer (intent.ts + agent.ts)
│   ├── chat/                       # Conversational checkout (session, matcher, runner, payment)
│   ├── razorpay/client.ts          # Razorpay client wrapper
│   ├── guardrails/index.ts         # Spend caps, allowlists, refund rules
│   ├── catalog.ts                  # Agent-readable catalog builder
│   ├── openai.ts                   # OpenAI / OpenRouter singleton
│   ├── utils.ts                    # cn() + helpers
│   └── db.ts                       # Prisma client singleton
├── prisma/
│   ├── schema.prisma               # Products, Orders, AuditLogs, ChatSessions, BuyerRuns
│   └── seed.js                     # 9 coffee equipment products (1 out-of-stock for allowlist demo)
├── scripts/
│   └── seed-revenue.mjs            # 50 baseline vs 50 agent orders → +23% lift over 14 days
├── .env.example                    # All env vars with comments
├── tailwind.config.ts
├── components.json                 # shadcn config
└── next.config.mjs
```

---

## Data Models

Defined in `prisma/schema.prisma` (SQLite, Postgres-compatible):

**Product** — catalog item
- `id` (e.g. `prod_french_press`), `name`, `description`, `priceInPaise`, `imageUrl?`, `category`, `stock`, timestamps
- Seed: 9 Brewline coffee products (espresso machine ₹24,999 → maintenance kit ₹499). One (`prod_tamper_58mm`) has `stock: 0` to demo Guardian allowlist blocking.

**Order** — Razorpay order record
- `razorpayOrderId` (unique), `razorpayPaymentLinkId?`, `razorpayPaymentId?`, `amountInPaise`, `currency` (default `INR`), `receipt?`
- `status`: `CREATED | LINK_SENT | PAID | FAILED`
- `channel`: `manual | chat | baseline | agent`
- `itemsJson` (`[{ productId, name, priceInPaise, quantity }]`), `notes?`, timestamps

**ChatSession** — conversational checkout state machine
- `phase`: `BROWSING | AWAITING_CONFIRMATION | AWAITING_APPROVAL | AWAITING_PAYMENT | FALLBACK_LINK_SENT | COMPLETED | BLOCKED | FAILED`
- `cartJson`, `upsellJson?`, `contextJson` (`selectedProductId, simulatePaymentFailure, pendingApproval, orderId, paymentLinkUrl, paymentAttempts`), `messagesJson`

**BuyerRun** — AI Buyer execution
- `request`, `intentJson`, `stepsJson` (`[{ at, agent, action, detail, status }]`), `summaryJson`

**AuditLog** — every agent decision
- `agentType` (`payment-link | refund | payment-status | GROWTH | CHECKOUT | GUARDIAN …`), `action`, `status` (`SUCCESS | FAILED | BLOCKED | APPROVED | NEEDS_APPROVAL …`)
- `blockedReason?`, `reasoning?` (why the agent acted), `input` / `output?` / `error?` (JSON strings)
- `amountInPaise?`, `currency?`, `razorpayOrderId?`, `razorpayPaymentId?`, `razorpayRefundId?`, `requestId?`

---

## Agents in Detail

### 1. Growth Agent (`lib/agents/multiagent/growth.ts`)
- Matches user intent to catalog products (LLM tool-call or deterministic keyword fallback).
- Proposes **one** upsell: cheapest relevant accessory ≤ 40% of cart value, with a reason string (e.g. "Add the burr grinder for ₹8,499 — ground fresh beats pre-ground").
- Never touches money. All proposals go through Guardian.

### 2. Checkout Agent (`lib/agents/multiagent/checkout.ts`)
- Creates Razorpay Orders via `lib/razorpay/client.ts`.
- Payment flow: attempt → on failure retry once → on second failure create Razorpay Payment Link + graceful message ("We couldn't process your payment. Here's a secure link to complete it manually.").
- Commits spend to Guardian ledger only on success.
- Logs every step with reasoning to `AuditLog`.

### 3. Guardian Agent (`lib/agents/multiagent/guardian.ts`)
- **Deterministic governor — no LLM.** Every money action calls `review({ sessionId, action, amountInPaise, productIds })` → `APPROVED | BLOCKED | NEEDS_APPROVAL`.
- Per-session ledger (in-memory singleton, survives across dev requests):
  1. **Product allowlist** — unknown IDs, `stock <= 0`, or excluded by `PRODUCT_ALLOWLIST` env → `BLOCKED`.
  2. **Order-count cap** — `MAX_SESSION_ORDERS` (default 3) → `BLOCKED`.
  3. **Session spend cap** — `MAX_SESSION_SPEND` (default 200000 paise = ₹2,000) → `BLOCKED`.
  4. **Human approval** — amount > `HUMAN_APPROVAL_THRESHOLD_PAISE` (default 100000 = ₹1,000) and not previously approved → `NEEDS_APPROVAL` (pauses session).
- `recordApproval(sessionId, amount, approved)` resumes or blocks; `commitSpend()` updates ledger.
- All verdicts logged via `logAgentDecision()` with rule + reason.

### 4. Executor Agents (`lib/agents/`)
- `payment-link-agent.ts`, `refund-agent.ts`, `payment-status-agent.ts` behind `executor.ts`.
- Every run passes through `assertAllowedToAct()` from `lib/guardrails/` before hitting Razorpay. Violations throw `GuardrailViolation` → caught → recorded as `BLOCKED` in audit.

---

## Guardrails & Safety

Two layers (both code, not prompts):

**Layer A — Global executor guardrails (`lib/guardrails/index.ts`)**

| Rule | Default | Env override |
|---|---|---|
| Per-action spend cap | ₹1,000 | `GUARDRAIL_PER_ACTION_CAP_PAISE` |
| Daily spend cap (UTC) | ₹5,000 | `GUARDRAIL_DAILY_CAP_PAISE` |
| Daily refund count cap | 10 | `GUARDRAIL_DAILY_REFUND_CAP` |
| Allowed currencies | `INR` only | — (code) |
| Allowed money actions | `create_payment_link`, `create_order`, `refund_payment` | — (code) |
| Refund allowlist | enabled; `pay_test_*` always allowed | `GUARDRAIL_REFUND_ALLOWLIST=false` to disable; `GUARDRAIL_REFUND_ALLOWLIST_IDS` for IDs |

**Layer B — Session Guardian (`lib/agents/multiagent/guardian.ts`)**

| Rule | Default | Env override |
|---|---|---|
| Session spend cap | ₹2,000 | `MAX_SESSION_SPEND` (paise) |
| Session order cap | 3 | `MAX_SESSION_ORDERS` |
| Human approval threshold | ₹1,000 | `HUMAN_APPROVAL_THRESHOLD_PAISE` (paise) |
| Product allowlist | all in-stock DB products | `PRODUCT_ALLOWLIST` (comma-separated IDs) |

Amounts are always in **paise** (₹1 = 100 paise) to avoid float errors.

---

## Pages / Surfaces

| Route | Description |
|---|---|
| `/` | Landing hero — pitch, bar checklist, LAUNCH DEMO CTA |
| `/terminal` | Live agent terminal: Customer Simulator (left), Activity Feed + Guardian Card (center), Audit Panel + Chat (right), sidebar nav |
| `/replay/[sessionId]` | Animated replay of a session's reasoning chain |
| `/analytics` | Revenue dashboard: +23% lift hero, daily revenue chart, channel split, catalog health |
| `/audit` | Full audit trail table (filter by agent / status) |
| `/agents` | Agent registry cards (Growth / Checkout / Guardian + executor agents) |
| `/settings` | Guardrail policy viewer + env-derived config |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent-buy` | AI Buyer — natural-language transaction pipeline (`{ request }` → intent → Guardian → order → steps + summary). May return `NEEDS_APPROVAL` with `runId`. |
| `GET` | `/api/agent-buy/runs` | List recent BuyerRuns |
| `GET` | `/api/agent-buy/[id]` | Get a BuyerRun + steps |
| `POST` | `/api/agent-buy/[id]/approve` | Approve/reject a paused BuyerRun (`{ approved: boolean }`) |
| `POST` | `/api/chat` | Conversational checkout — send user message (`{ sessionId, message }`) → agent reply + phase + guardian verdict |
| `GET` | `/api/chat?sessionId=…` | Get chat session transcript + cart + phase |
| `GET` | `/api/chat/stream?sessionId=…` | Poll for live agent activity + guardian status |
| `POST` | `/api/orchestrator` | Run Growth → Guardian → Checkout pipeline directly |
| `GET` | `/api/catalog` | Agent-readable product catalog (id, name, price, stock, category) |
| `GET` | `/api/audit` | Audit trail JSON (`?agent=, ?status=, ?limit=`) |
| `GET` | `/api/agents` | Agent registry JSON |
| `GET` | `/api/analytics` | Analytics summary JSON |
| `GET` | `/api/analytics/revenue` | Revenue metrics — agents ON vs baseline (lift %, daily series) |
| `POST` | `/api/payments/order` | Create Razorpay order (guardrail-gated, `{ amountInPaise, currency, receipt?, notes? }`) |
| `POST` | `/api/payments/mark-paid` | Demo helper: mark an order `PAID` |
| `POST` | `/api/simulate-payment-failure` | Demo helper: forces next payment to fail (`{ sessionId }`) |
| `POST` | `/api/webhooks/razorpay` | Razorpay webhook (HMAC-SHA256 verified, `payment.captured` / `payment.failed`) |
| `GET` | `/api/replay/[sessionId]` | Replay data (ordered audit steps) for a session |
| `GET` | `/api/razorpay/key` | Expose `RAZORPAY_KEY_ID` to the client for Checkout.js |

---

## Prerequisites

- **Node.js 18+** and **npm** (Next.js 14 requires Node ≥ 18.17)
- **Git**
- **Razorpay test-mode keys** — Dashboard → Settings → API Keys → Generate Test Key (`rzp_test_…`). No real money moves in test mode.
- *(Optional)* **OpenRouter key** (free, no card: https://openrouter.ai/keys) or **OpenAI key** — if absent, agents use deterministic fallback and everything still works.

---

## Quick Start

```bash
# 1. Clone and enter
git clone https://github.com/Nirvanjha2004/RazorPay-ai.git
cd RazorPay-ai

# 2. Install + generate Prisma client + push SQLite schema + seed catalog + seed revenue sim
npm run setup
# = prisma generate && prisma db push && prisma db seed && npm run seed:revenue

# 3. Configure environment
cp .env.example .env
# → edit .env with your rzp_test_ key id and secret (see below)

# 4. Run
npm run dev
# → http://localhost:3000 → click "LAUNCH DEMO" → /terminal
```

Useful commands:

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # prisma generate + next build
npm run start        # serve production build
npm run typecheck    # tsc --noEmit — must be clean before push
npm run lint         # next lint
npm run setup        # full first-time setup (install is separate: npm install)
npm run seed:revenue # reseed 50 baseline vs 50 agent orders
npx prisma studio    # visual DB browser (Products, Orders, AuditLogs…)
npx prisma db seed   # reseed coffee catalog only
```

> First run creates `prisma/dev.db` (SQLite). Delete it + re-run `npm run setup` for a clean slate.

---

## Environment Variables

Copy `.env.example` → `.env`. Amounts in **paise** (₹1 = 100 paise).

| Variable | Required | Default | Description |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | **Yes** | — | Razorpay key (`rzp_test_…` for test mode) |
| `RAZORPAY_KEY_SECRET` | **Yes** | — | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Recommended | — | For webhook signature verification (Dashboard → Settings → Webhooks) |
| `DATABASE_URL` | No | `file:./dev.db` | SQLite default. Postgres: `postgresql://user:pass@host/db` |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | App URL (webhooks, headers) |
| `OPENROUTER_API_KEY` | No* | — | Option A: OpenRouter (recommended — free models, no billing). Get one at https://openrouter.ai/keys |
| `OPENAI_MODEL` | No | `inclusionai/ling-3.0-flash-sante:free` | Any OpenRouter model. Free tool-caller fallback: `openai/gpt-oss-20b:free` |
| `OPENAI_API_KEY` | No* | — | Option B: OpenAI directly (e.g. `gpt-4o-mini`). Pick ONE of A/B; if neither is set, deterministic fallback is used |
| `MAX_SESSION_SPEND` | No | `200000` (= ₹2,000) | Session spend cap (paise) |
| `MAX_SESSION_ORDERS` | No | `3` | Orders per session |
| `HUMAN_APPROVAL_THRESHOLD_PAISE` | No | `100000` (= ₹1,000) | Above this → `NEEDS_APPROVAL`, human must approve |
| `PRODUCT_ALLOWLIST` | No | all in-stock | Comma-separated product IDs (e.g. `prod_milk_pitcher,prod_coffee_scale`) |
| `GUARDRAIL_PER_ACTION_CAP_PAISE` | No | `100000` | Per-action cap (executor layer) |
| `GUARDRAIL_DAILY_CAP_PAISE` | No | `500000` | Daily spend cap (executor layer) |
| `GUARDRAIL_DAILY_REFUND_CAP` | No | `10` | Daily refund count cap |
| `GUARDRAIL_REFUND_ALLOWLIST` | No | `true` | Set `false` to disable refund allowlist |
| `GUARDRAIL_REFUND_ALLOWLIST_IDS` | No | — | Comma-separated payment IDs allowed for refund |

\* LLM keys are optional — the demo runs fully without them via keyword matching + scripted upsells.

---

## Razorpay Test-Mode Setup

1. Sign in at https://dashboard.razorpay.com → **Test Mode** toggle (top).
2. **Settings → API Keys → Generate Test Key** → copy `rzp_test_…` ID + secret into `.env`.
3. *(Optional, for webhooks locally)* install ngrok, run `ngrok http 3000`, add webhook `https://<you>.ngrok.io/api/webhooks/razorpay` in Dashboard → Settings → Webhooks (events: `payment.captured`, `payment.failed`), copy the webhook secret into `.env` as `RAZORPAY_WEBHOOK_SECRET`.
4. Verify: `POST http://localhost:3000/api/payments/order` with `{ "amountInPaise": 19900, "currency": "INR" }` → returns `order.id` starting with `order_`.

No real money moves in test mode. Use test card `4111 1111 1111 1111` / any future expiry / any CVV on Razorpay Checkout.

---

## Webhooks

`POST /api/webhooks/razorpay` verifies `x-razorpay-signature` with HMAC-SHA256 (`RAZORPAY_WEBHOOK_SECRET`), then:

- `payment.captured` → matching `Order` → `PAID` (+ audit log).
- `payment.failed` → matching `Order` → `FAILED` (+ audit log, retry/link logic can pick it up).

If `RAZORPAY_WEBHOOK_SECRET` is unset, signatures are skipped with a warning (dev convenience — never do this in production).

---

## Demo Script — 3-Minute Judge Walkthrough

### Minute 0:00–0:45 — The pitch
1. Open **http://localhost:3000** — show the landing hero with the one-line bar checklist.
2. Click **LAUNCH DEMO** → `/terminal` opens.

> *"This is CommerceAgent. Watch three AI agents — Growth, Checkout, and Guardian — transact autonomously on Razorpay. Every money action is bounded, gated, and audited."*

### Minute 0:45–1:30 — Conversational checkout + Guardian block
3. In the left **Customer Simulator**, click **"Buy coffee machine"**.
4. Growth Agent finds the espresso machine and proposes an upsell ("Add the burr grinder for ₹8,499").
5. Click **"Accept upsell"** → Guardian reviews → cart exceeds ₹2,000 cap → **BLOCKED**.

> *"See the Guardian block it — the ₹33,498 cart exceeds the ₹2,000 session cap. This is a hard limit in code, not a prompt suggestion."*

### Minute 1:30–2:00 — Human-in-the-loop
6. Click **"NEW SESSION"**, then type *"I want the french press"*.
7. Growth confirms (₹1,899), accept upsell → **NEEDS_APPROVAL** (₹1,899 > ₹1,000 threshold).

> *"The Guardian paused the flow — any action over ₹1,000 requires human approval."*

8. Click **✓ APPROVE** on the Guardian card → Checkout creates the Razorpay order.

### Minute 2:00–2:45 — ⚠ Failure injection (the dramatic moment)
9. Click the red **⚠ INJECT FAILURE** button (calls `POST /api/simulate-payment-failure`), then pay.
10. The activity feed shows:
    - Attempt 1: failed ❌
    - Attempt 2 (retry): failed ❌
    - Fallback: Razorpay Payment Link created 🔗
    - Graceful message: *"We couldn't process your payment. Here's a secure link to complete it manually."*

> *"Watch the graceful failure handling. The agent retried once, then fell back to a payment link. No crash, no lost state."*

### Minute 2:45–3:00 — Audit & replay
11. Open **Audit Trail** from the sidebar — every decision is logged with reasoning.
12. Click any session → **/replay/[sessionId]** animates the full agent flow.
13. Open **Analytics** → show "+23% revenue from agents" hero card + catalog health card.

> *"Every rupee is explainable. Every decision replays. That's the bar for autonomous commerce."*

---

## Data Flow for a Single Transaction

1. **Customer** says "I want a coffee machine" → **Growth** matches from catalog (`/api/catalog`).
2. **Growth** proposes an upsell (price < 40% of cart, with reason).
3. **Customer** accepts → **Guardian** reviews the full amount + product IDs.
4. If > ₹1,000 → **NEEDS_APPROVAL** (pauses for human Approve/Reject).
5. If ≤ cap + allowlist → **Checkout** creates Razorpay order (`POST /api/payments/order`).
6. Payment succeeds → webhook → order marked `PAID`.
7. Payment fails → **retry once** → fall back to Payment Link with a graceful message.
8. **Every step** → `audit_logs` table with `reasoning` (replayable at `/replay/[sessionId]`).

---

## Analytics & Revenue Simulation

`npm run seed:revenue` (auto-run by `npm run setup`) creates a deterministic 14-day dataset:

- **50 baseline orders** (agents OFF, no upsells) vs **50 agent orders** (agents ON, same product mix + upsells).
- Calibrated via LCG RNG sweep so lift lands on exactly **+23%** (the hero metric).
- Idempotent: clears `order_sim_*` rows before reseeding.
- Powers `/analytics` (daily revenue Recharts, channel split, upsell conversion, catalog health) and `GET /api/analytics/revenue`.

Catalog seed (`npx prisma db seed`): 9 Brewline coffee products across `espresso-machines / grinders / kettles / brewers / accessories / maintenance`, ₹499–₹24,999.

---

## Development

```bash
npm run typecheck   # must pass — fix ALL errors, not just the first
npm run build       # prisma generate + next build — must pass
npx prisma studio   # inspect Products / Orders / AuditLogs / ChatSessions / BuyerRuns
```

Conventions:

- Money in **paise** (`Int`), never floats. Format with `(paise / 100).toFixed(2)`.
- Every new money path must call `assertAllowedToAct()` (executor) and/or `Guardian.review()` (session) **and** write an `AuditLog` with `reasoning`.
- Guardian stays deterministic — never call an LLM from `lib/agents/multiagent/guardian.ts` or `lib/guardrails/`.
- `.env` is gitignored — never commit secrets. Commit + push after every change with a clear message, only after `typecheck`/`build` pass.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `RAZORPAY_KEY_ID is not set` / order creation 500s | `cp .env.example .env`, fill `rzp_test_…` ID + secret, restart `npm run dev` |
| `No products found — run prisma db seed first` | `npx prisma db seed` then `npm run seed:revenue` |
| Prisma `dev.db` corrupted / schema drift | Delete `prisma/dev.db*`, re-run `npm run setup` |
| Webhook 400 signature mismatch | Check `RAZORPAY_WEBHOOK_SECRET` matches Dashboard → Webhooks; ensure raw-body verification (no body-parser mangling) |
| LLM errors / 401 from OpenRouter | Leave keys blank to use deterministic fallback, or set `OPENAI_MODEL=openai/gpt-oss-20b:free` (best free tool-caller) |
| Guardian blocks everything | Check `MAX_SESSION_SPEND` / `PRODUCT_ALLOWLIST` in `.env`; click NEW SESSION to reset the in-memory ledger |
| Port 3000 in use | `npx next dev -p 3001` (update `NEXT_PUBLIC_APP_URL` accordingly) |
| TypeScript errors after edit | `npm run typecheck`, fix all, then `npm run build` |

---

## Roadmap

- [ ] Postgres + Redis-backed Guardian ledgers (multi-instance safe; current singleton is single-node)
- [ ] RazorpayX payouts + refunds UI with allowlist management
- [ ] Real Checkout.js modal + UPI intent flow in Terminal
- [ ] Policy editor in `/settings` (persist guardrail changes to DB instead of env-only)
- [ ] Evals: adversarial prompt-injection suite for the buyer ("ignore guardrails…")
- [ ] Multi-currency + GST invoice generation

---

## Contributing

PRs welcome. Keep the bar: **bounded, gated, explainable.**

1. Fork → branch → change.
2. `npm run typecheck && npm run build` must pass.
3. Add audit logging + guardrail coverage for any money path.
4. Open a PR with screenshots of `/terminal` + `/replay` for agent changes.

---

## License

MIT — see `LICENSE` (or add one). Razorpay test-mode keys only; never commit `.env`.
