import { NextResponse } from "next/server";
import { musteriOturumKapat } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await musteriOturumKapat();
  return NextResponse.json({ ok: true });
}
