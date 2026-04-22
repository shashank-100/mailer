import { NextRequest, NextResponse } from "next/server";
import { createCampaign, getCampaigns, getCampaignStats, getSupabase } from "@/lib/email-db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const stats = await getCampaignStats(id);
    return NextResponse.json(stats);
  }

  const campaigns = await getCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, subject, html_body, text_body, sender_id, status } = body;

  if (!name || !subject || !html_body || !sender_id) {
    return NextResponse.json(
      { error: "name, subject, html_body, sender_id required" },
      { status: 400 }
    );
  }

  const campaign = await createCampaign({
    name,
    subject,
    html_body,
    text_body,
    sender_id,
    status: status || "draft",
  });

  return NextResponse.json(campaign);
}

export async function PATCH(request: NextRequest) {
  const { id, ...updates } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("email_campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
