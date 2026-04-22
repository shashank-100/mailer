import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, SENDERS } from "@/lib/email-sender";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — fetch all replies
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "unread";
  const sb = getSupabase();

  const query = sb
    .from("email_replies")
    .select("*")
    .order("received_at", { ascending: false });

  if (status !== "all") query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — send a reply
export async function POST(request: NextRequest) {
  const { replyId, to, subject, html, senderId } = await request.json();
  if (!replyId || !to || !subject || !html) {
    return NextResponse.json({ error: "replyId, to, subject, html required" }, { status: 400 });
  }

  const sb = getSupabase();
  const sender = SENDERS.find((s) => s.id === senderId) || SENDERS[0];

  await sendEmail({
    senderId: sender.id,
    to,
    subject,
    html,
    campaignId: "inbox-reply",
  });

  await sb.from("email_replies").update({
    status: "replied",
    our_reply: html,
    replied_at: new Date().toISOString(),
  }).eq("id", replyId);

  // Also update email_logs entry
  await sb.from("email_logs").update({
    status: "replied",
    replied_at: new Date().toISOString(),
  }).eq("recipient_email", to);

  return NextResponse.json({ ok: true });
}

// PATCH — mark as read
export async function PATCH(request: NextRequest) {
  const { id, status } = await request.json();
  const sb = getSupabase();
  await sb.from("email_replies").update({ status }).eq("id", id);
  return NextResponse.json({ ok: true });
}
