import { NextResponse } from "next/server";
import { generateDailyPicks } from "@/lib/analysis/picks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const debug = new URL(req.url).searchParams.get("debug") === "1";
    const result = await generateDailyPicks(debug);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Günlük seçimler üretilemedi.", detail: e instanceof Error ? e.message : "bilinmeyen hata" },
      { status: 502 }
    );
  }
}
