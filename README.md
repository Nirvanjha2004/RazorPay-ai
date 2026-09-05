# CommerceAgent — Autonomous Commerce for Razorpay

> **AI agents that buy & sell on Razorpay — with full audit trails, hard guardrails, and human-in-the-loop approvals.**

CommerceAgent is a multi-agent system where **Growth**, **Checkout**, and **Guardian** agents transact autonomously on Razorpay. Every money action is **bounded, gated, and explainable** — the bar for autonomous commerce.

---

## Quick start

```bash
git clone https://github.com/Nirvanjha2004/RazorPay-ai.git
cd RazorPay-ai
npm run setup
cp .env.example .env

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
    Orders --> Logs

## The "bar" checklist

| Principle | How CommerceAgent delivers |
|---|---|
| ✅ **Explainable** | Every agent decision is logged with `reasoning` — the audit trail shows *why*, not just *what*. The replay page animates the full reasoning chain. |
| ✅ **Bounded** | Hard limits in code (not prompts): ₹2,000/session spend cap, 3 orders/session, ₹1,000 per-action cap, daily caps. The agent *cannot* exceed these. |
| ✅ **Gated** | The Guardian Agent is deterministic code (never LLM-driven). It enforces allowlists, spend caps, and human-in-the-loop approval. No money action runs without it. |
| ✅ **Audit trail** | Every agent run → `audit_logs` table (agent, action, amount, reasoning, status, timestamp). Replayable at `/replay/[sessionId]`. |
| ✅ **Graceful failure** | Payment failures retry once, then fall back to a Razorpay Payment Link with a user-friendly message. No crashes, no lost state. |

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent-buy` | AI Buyer — natural-language transaction pipeline |
| `POST` | `/api/chat` | Conversational checkout |
| `GET` | `/api/chat` | Get chat session transcript |
| `GET` | `/api/chat/stream` | Poll for live agent activity + guardian status |
| `POST` | `/api/orchestrator` | Run Growth → Guardian → Checkout pipeline |
| `GET` | `/api/catalog` | Agent-readable product catalog |
| `GET` | `/api/audit` | Audit trail (JSON) |
| `GET` | `/api/analytics/revenue` | Revenue metrics (agents ON vs baseline) |
| `POST` | `/api/payments/order` | Create Razorpay order (guardrail-gated) |
| `POST` | `/api/simulate-payment-failure` | Demo helper: forces next payment to fail |

## DEMO SCRIPT — 3-minute judge walkthrough

### Minute 0:00–0:45 — The pitch
1. Open **http://localhost:3000** — show the landing hero with the one-line bar checklist
2. Click **LAUNCH DEMO** → terminal opens

> *"This is CommerceAgent. Watch three AI agents — Growth, Checkout, and Guardian — transact autonomously on Razorpay. Every money action is bounded, gated, and audited."*

### Minute 0:45–1:30 — Conversational checkout
3. In the left **Customer Simulator**, click **"Buy coffee machine"**
4. Growth Agent finds the espresso machine and proposes an upsell ("Add the burr grinder for ₹8,499")
5. Click **"Accept upsell"** → Guardian reviews → cart exceeds ₹2,000 cap → **BLOCKED**

> *"See the Guardian agent block it — the ₹33,498 cart exceeds the ₹2,000 session cap. This is a hard limit in code, not a prompt suggestion."*

### Minute 1:30–2:00 — Human-in-the-loop
6. Click **"NEW SESSION"**, then type "I want the french press"
7. Growth confirms (₹1,899), accept upsell → **NEEDS_APPROVAL** (₹1,899 > ₹1,000 threshold)

> *"The Guardian paused the flow — any action over ₹1,000 requires human approval."*

8. Click **✓ APPROVE** on the Guardian card

### Minute 2:00–2:45 — ⚠ FAILURE INJECTION (the dramatic moment)
9. **Click the red ⚠ INJECT FAILURE button**

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `RAZORPAY_KEY_ID` | Yes | Your Razorpay key (`rzp_test_...` for test mode) |
| `RAZORPAY_KEY_SECRET` | Yes | Your Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Recommended | For webhook signature verification |
| `DATABASE_URL` | No | Defaults to `file:./dev.db` |
| `OPENAI_API_KEY` | No | If absent, agents use deterministic fallback |
| `MAX_SESSION_SPEND` | No | Session spend cap in paise (default: 200000 = ₹2,000) |
| `MAX_SESSION_ORDERS` | No | Orders per session (default: 3) |
| `HUMAN_APPROVAL_THRESHOLD_PAISE` | No | Requires approval above this (default: 100000 = ₹1,000) |
| `PRODUCT_ALLOWLIST` | No | Comma-separated product IDs (default: all) |

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (dark theme)
- **Framer Motion** · **Recharts** · **Sonner**
- **Prisma** + **SQLite** · **Razorpay SDK** (test mode) · **OpenAI** (tool-calling, with fallback)

---

## Project structure

```
├── app/
│   ├── page.tsx                    # Landing hero
│   ├── terminal/page.tsx           # Live agent terminal dashboard
│   ├── replay/[session]/page.tsx   # Session replay player
│   ├── analytics/page.tsx          # Revenue analytics
│   ├── audit/page.tsx              # Audit trail table
│   ├── agents/page.tsx             # Agent registry
│   ├── settings/page.tsx           # Config & guardrail policy
│   └── api/                        # 12+ API routes
├── components/
│   ├── terminal/                   # Dashboard panels (activity feed, guardian, audit, chat)
│   ├── ai-buyer/                   # AI Buyer demo modal
│   ├── analytics/                  # Revenue dashboard
│   └── ui/                         # shadcn-style primitives
├── lib/
│   ├── agents/
│   │   ├── orchestrator.ts         # Shared state machine
│   │   └── multiagent/             # Growth, Checkout, Guardian, audit logging
│   ├── buyer/                      # AI Buyer (intent parsing + transaction pipeline)
│   ├── chat/                       # Conversational checkout
│   ├── razorpay/                   # Razorpay client wrapper
│   ├── guardrails/                 # Spend caps, allowlists, refund rules
│   ├── catalog.ts                  # Agent-readable catalog builder
│   ├── openai.ts                   # OpenAI singleton
│   └── db.ts                       # Prisma client singleton
└── prisma/
    ├── schema.prisma               # Products, Orders, AuditLogs, ChatSessions, BuyerRuns
    └── seed.js                     # 8 coffee equipment products
```

10. The activity feed shows:
    - Attempt 1: failed ❌
    - Attempt 2 (retry): failed ❌
    - Fallback: Razorpay Payment Link created
    - Graceful message: *"We couldn't process your payment. Here's a secure link to complete it manually."*

> *"Watch the graceful failure handling. The agent retried once, then fell back to a payment link. No crash, no lost state."*

### Minute 2:45–3:00 — Audit & replay
11. Open **Audit Trail** from the sidebar — every decision is logged with reasoning
12. Click any session → **/replay/[sessionId]** animates the full agent flow
13. Open **Analytics** → show "+23% revenue from agents" hero card + catalog health card

| `POST` | `/api/webhooks/razorpay` | Razorpay webhook (HMAC-SHA256 verified) |
| `GET` | `/api/replay/[session]` | Replay data for a session |


    Razorpay -->|"webhooks"| Orders
    ChatSess --> Logs
    Runs --> Logs
```

### Data flow for a single transaction

1. **Customer** says "I want a coffee machine" → **Growth** matches from catalog
2. **Growth** proposes an upsell (price < 40% of cart, with reason)
3. **Customer** accepts → **Guardian** reviews the full amount
4. If > ₹1,000 → **NEEDS_APPROVAL** (pauses for human)
5. If ≤ cap + allowlist → **Checkout** creates Razorpay order
6. Payment succeeds → order marked `PAID`
7. Payment fails → **retry once** → fall back to Payment Link with a graceful message
8. **Every step** → `audit_logs` table with reasoning

# edit .env with your rzp_test_ key id and secret
npm run dev
# → http://localhost:3000  → click "LAUNCH DEMO"
```

> `npm run setup` = `npm install && prisma generate && prisma db push && prisma db seed && npm run seed:revenue`
