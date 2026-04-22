import { sendEmail, SENDERS } from "../lib/email-sender";
import * as fs from "fs";
import * as path from "path";

// ── Config ──────────────────────────────────────────────────────
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "test";
const CSV_FILE    = process.argv[2];
const DAILY_LIMIT = 50; // per sender
const DELAY_MS    = 3000; // 3s between emails to avoid rate limits

const EMAIL_A = {
  subject: "{{first_name}}, how fast does your team call new leads?",
  html: `<p>Hi {{first_name}},</p>
<p>Studies show 78% of deals go to the agent who responds first.</p>
<p>Most teams in LA are still calling back leads 2–4 hours later — by then, the prospect has already talked to 3 other agents.</p>
<p>We built an AI voice agent that calls new leads within 60 seconds of inquiry, qualifies them, and either books a callback or live-transfers them straight to you.</p>
<p>No scripts to manage. No ISA to hire.</p>
<p>Worth a 15-min call to see if it fits {{company}}?</p>
<p>— Shashank</p>`,
};

const EMAIL_B = {
  subject: "{{first_name}}, you're sitting on deals in your old CRM",
  html: `<p>Hi {{first_name}},</p>
<p>Every agent has a graveyard of leads — people who weren't ready 6 months ago but might be now.</p>
<p>Most teams never follow up with them because there's no bandwidth. Those leads just go cold forever.</p>
<p>Our AI agent automatically re-engages your stale contacts, tracks life events (job change, marriage, etc.), and flags the ones showing buy/sell signals — so your team only talks to people who are actually ready.</p>
<p>Takes 10 mins to set up. No new software your team needs to learn.</p>
<p>Open to a quick call this week, {{first_name}}?</p>
<p>— Shashank</p>`,
};

// ── Helpers ──────────────────────────────────────────────────────
function interpolate(str: string, vars: Record<string, string>) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || "");
}

function parseCSV(file: string) {
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] || "").trim()]));
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  if (!CSV_FILE) {
    console.error("Usage: npx tsx scripts/send-campaign.ts <csv_file>");
    process.exit(1);
  }

  const isGroupB = CSV_FILE.includes("_b.");
  const template = isGroupB ? EMAIL_B : EMAIL_A;
  const label    = isGroupB ? "B (Long-Term Nurture)" : "A (Speed to Lead)";

  const recipients = parseCSV(path.resolve(CSV_FILE));
  const toSend     = recipients.slice(0, SENDERS.length * DAILY_LIMIT); // max 200 today

  console.log(`\nCampaign: ${label}`);
  console.log(`Recipients in file: ${recipients.length}`);
  console.log(`Sending today (${SENDERS.length} senders × ${DAILY_LIMIT}): ${toSend.length}\n`);

  let senderIndex = 0;
  let sent = 0, failed = 0;

  for (const row of toSend) {
    const sender = SENDERS[senderIndex % SENDERS.length];
    senderIndex++;

    const vars = {
      first_name: row.first_name || "there",
      company: row.company || "your team",
    };

    const subject = interpolate(template.subject, vars);
    const html    = interpolate(template.html, vars);

    process.stdout.write(`[${sent + failed + 1}/${toSend.length}] ${row.email} (${sender.id}) → `);

    try {
      await sendEmail({
        senderId: sender.id,
        to: row.email,
        subject,
        html,
        campaignId: CAMPAIGN_ID,
        recipientId: row.email,
      });
      console.log("✓");
      sent++;
    } catch (err: unknown) {
      console.log(`✗ ${err instanceof Error ? err.message : err}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone — Sent: ${sent}, Failed: ${failed}`);
  if (recipients.length > toSend.length) {
    console.log(`Remaining for tomorrow: ${recipients.length - toSend.length}`);
  }
}

main();
