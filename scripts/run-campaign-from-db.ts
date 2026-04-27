import { sendEmail, SENDERS } from "../lib/email-sender";
import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = process.env.CAMPAIGN_ID;
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT) || 50;
const DELAY_MS = Number(process.env.DELAY_MS) || 3000;

if (!CAMPAIGN_ID) {
  console.error("CAMPAIGN_ID env var required");
  process.exit(1);
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function interpolate(str: string, vars: Record<string, string>) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const sb = getSupabase();

  // Fetch campaign
  const { data: campaign, error: campErr } = await sb
    .from("email_campaigns")
    .select("*")
    .eq("id", CAMPAIGN_ID)
    .single();

  if (campErr || !campaign) {
    console.error("Campaign not found:", campErr?.message);
    process.exit(1);
  }

  console.log(`\nCampaign: ${campaign.name}`);
  console.log(`Subject: ${campaign.subject}`);

  // Fetch leads that haven't been emailed yet in this campaign
  const { data: alreadySent } = await sb
    .from("email_logs")
    .select("recipient_email")
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("status", "sent");

  const sentEmails = new Set((alreadySent || []).map((r: { recipient_email: string }) => r.recipient_email));

  // Fetch leads from campaign_leads table
  const { data: leads, error: leadsErr } = await sb
    .from("campaign_leads")
    .select("*")
    .eq("campaign_id", CAMPAIGN_ID);

  if (leadsErr) {
    console.error("Error fetching leads:", leadsErr.message);
    process.exit(1);
  }

  const pending = (leads || []).filter((l: { email: string }) => !sentEmails.has(l.email));
  const maxToSend = SENDERS.length * DAILY_LIMIT;
  const toSend = pending.slice(0, maxToSend);

  console.log(`Total leads: ${leads?.length || 0}`);
  console.log(`Already sent: ${sentEmails.size}`);
  console.log(`Sending today (${SENDERS.length} senders × ${DAILY_LIMIT}): ${toSend.length}\n`);

  let senderIndex = 0;
  let sent = 0, failed = 0;

  for (const lead of toSend) {
    const sender = SENDERS[senderIndex % SENDERS.length];
    senderIndex++;

    const vars = {
      first_name: lead.first_name || lead.name || "there",
      name: lead.first_name || lead.name || "there",
      company: lead.company || "your team",
      ...lead,
    };

    const subject = interpolate(campaign.subject, vars);
    const html = interpolate(campaign.html_body, vars);
    const text = campaign.text_body ? interpolate(campaign.text_body, vars) : undefined;

    process.stdout.write(`[${sent + failed + 1}/${toSend.length}] ${lead.email} (${sender.id}) → `);

    try {
      const { messageId } = await sendEmail({
        senderId: sender.id,
        to: lead.email,
        subject,
        html,
        text,
        campaignId: CAMPAIGN_ID,
        recipientId: lead.email,
      });

      await sb.from("email_logs").insert({
        campaign_id: CAMPAIGN_ID,
        recipient_email: lead.email,
        recipient_name: lead.first_name || lead.name,
        sender_id: sender.id,
        message_id: messageId,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      console.log("✓");
      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await sb.from("email_logs").insert({
        campaign_id: CAMPAIGN_ID,
        recipient_email: lead.email,
        recipient_name: lead.first_name || lead.name,
        sender_id: sender.id,
        message_id: `failed-${Date.now()}-${lead.email}`,
        status: "failed",
        sent_at: new Date().toISOString(),
        error: message,
      });
      console.log(`✗ ${message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone — Sent: ${sent}, Failed: ${failed}`);
  if (pending.length > toSend.length) {
    console.log(`Remaining for next run: ${pending.length - toSend.length}`);
  }
}

main();
