import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { agents, dispatchAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";

/** GET /api/agents — list registered agents and their metadata. */
export async function GET() {
  return NextResponse.json({ agents });
}

/**
 * POST /api/agents — run an agent.
 * Body: { type: AgentType, input: <agent-specific payload> }
 */
export async function POST(request: NextRequest) {
  let body: { type?: string; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, input } = body ?? {};
  if (!type || typeof type !== "string") {
    return NextResponse.json({ error: "`type` is required" }, { status: 400 });
  }
  if (input == null || typeof input !== "object") {
    return NextResponse.json({ error: "`input` must be a JSON object" }, { status: 400 });
  }

  const known = agents.some((a) => a.type === type);
  if (!known) {
    return NextResponse.json(
      { error: `Unknown agent type "${type}"`, available: agents.map((a) => a.type) },
      { status: 404 }
    );
  }

  const result = await dispatchAgent(type, input);
  if (!result) {
    return NextResponse.json({ error: `No runner for agent "${type}"` }, { status: 404 });
  }

  const status = result.status === "SUCCESS" ? 200 : result.status === "BLOCKED" ? 403 : 502;
  return NextResponse.json(result, { status });
}
