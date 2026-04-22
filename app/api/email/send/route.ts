import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getNextSender, SENDERS } from "@/lib/email-sender";
import { logEmail, getCampaigns } from "@/lib/email-db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { campaignId, recipients, senderId } = body as {
    campaignId: string;
    recipients: { email: string; name?: string; vars?: Record<string, string> }[];
    senderId?: string;
  };

  if (!campaignId || !recipients?.length) {
    return NextResponse.json({ error: "campaignId and recipients required" }, { status: 400 });
  }

  // Look up campaign for subject + body
  const campaigns = await getCampaigns();
  const campaign = campaigns?.find((c: { id: string }) => c.id === campaignId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const results: { email: string; status: string; messageId?: string; error?: string }[] = [];

  for (const recipient of recipients) {
    const sender = senderId
      ? SENDERS.find((s) => s.id === senderId) || getNextSender()
      : getNextSender();

    // Simple variable substitution in subject/body: {{name}}, {{company}}, etc.
    const interpolate = (str: string) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        recipient.vars?.[key] ?? (key === "name" ? recipient.name ?? "" : `{{${key}}}`)
      );

    try {
      const { messageId } = await sendEmail({
        senderId: sender.id,
        to: recipient.email,
        subject: interpolate(campaign.subject),
        html: interpolate(campaign.html_body),
        text: campaign.text_body ? interpolate(campaign.text_body) : undefined,
        campaignId,
        recipientId: recipient.email,
      });

      await logEmail({
        campaign_id: campaignId,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        sender_id: sender.id,
        message_id: messageId,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      results.push({ email: recipient.email, status: "sent", messageId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await logEmail({
        campaign_id: campaignId,
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        sender_id: sender.id,
        message_id: `failed-${Date.now()}-${recipient.email}`,
        status: "failed",
        sent_at: new Date().toISOString(),
        error: message,
      });
      results.push({ email: recipient.email, status: "failed", error: message });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({ sent, failed, results });
}
