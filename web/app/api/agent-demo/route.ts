import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_URL = process.env.ACH_AGENT_URL ?? "http://127.0.0.1:4170";

export async function POST(req: NextRequest) {
  let rounds = 1;
  try {
    const body = await req.json();
    if (typeof body.rounds === "number") rounds = body.rounds;
  } catch {
    // default
  }
  try {
    const res = await fetch(`${AGENT_URL}/demo/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Agent unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
