import { HealthResponseSchema } from "@watchroom/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const body = HealthResponseSchema.parse({
    status: "ok",
    service: "watchroom-web",
    version: "0.0.0",
    timestamp: new Date().toISOString(),
    checks: [{ name: "render", status: "ok" }],
  });

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
