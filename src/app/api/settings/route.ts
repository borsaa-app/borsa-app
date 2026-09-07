import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json(s);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Geçerli veri gerekli." }, { status: 400 });
  }

  const allowed = [
    "dropAlertPct",
    "riseAlertPct",
    "targetAlertPct",
    "cooldownMinutes",
    "pollingSeconds",
    "emailTo",
    "emailEnabled",
    "browserNotify",
    "soundNotify",
    "minInvestment",
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
  }

  await updateSettings(patch);
  const updated = await getSettings();
  return NextResponse.json({ ok: true, settings: updated });
}
