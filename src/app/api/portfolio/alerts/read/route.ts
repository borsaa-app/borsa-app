import { NextResponse } from "next/server";
import { markAllAsRead } from "@/lib/db/alert-log";

export const dynamic = "force-dynamic";

export async function POST() {
  await markAllAsRead();
  return NextResponse.json({ ok: true });
}
