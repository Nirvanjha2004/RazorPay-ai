import { NextResponse } from "next/server";
import { handleChatMessage } from "@/lib/chat/runner";
import { loadChatSession } from "@/lib/chat/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat — conversational checkout.
 * Body: { sessionId?: string, message: string }
 * A new sessionId is generated when omitted.
 */
export async function POST(request: Request) {
  let body: { sessionId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "`message` is required" }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: "`message` too long (max 1000 chars)" }, { status: 400 });
  }

  const sessionId =
    body?.sessionId && typeof body.sessionId === "string" && body.sessionId.length <= 100
      ? body.sessionId
      : `chat_${crypto.randomUUID()}`;

  try {
    const response = await handleChatMessage(sessionId, message);
    return NextResponse.json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[api/chat] failed:", msg);
    return NextResponse.json({ error: "Chat processing failed" }, { status: 500 });
  }
}

/** GET /api/chat?sessionId=... — full conversation transcript + state. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "`sessionId` query param is required" }, { status: 400 });
  }
  const session = await loadChatSession(sessionId);
  return NextResponse.json(session);
}
