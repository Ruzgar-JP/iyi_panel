import { NextResponse } from "next/server";
import { yoneticiOturumKapat } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await yoneticiOturumKapat();
  return NextResponse.json({ ok: true });
}
