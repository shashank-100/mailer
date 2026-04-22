import { NextRequest, NextResponse } from "next/server";
import { getEmailLogs } from "@/lib/email-db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId") || undefined;
  const logs = await getEmailLogs(campaignId);
  return NextResponse.json(logs);
}
