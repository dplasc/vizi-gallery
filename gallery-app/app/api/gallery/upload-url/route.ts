import { NextResponse } from "next/server";

export async function POST(request: Request) {
  return NextResponse.json(
    { ok: true, note: "minimal-route-working" },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405 }
  );
}
