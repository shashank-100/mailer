import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";

const SENDERS = [
  { id: "sender_1", user: process.env.SENDER_1_USER!, pass: process.env.SENDER_1_PASS! },
  { id: "sender_2", user: process.env.SENDER_2_USER!, pass: process.env.SENDER_2_PASS! },
  { id: "sender_3", user: process.env.SENDER_3_USER!, pass: process.env.SENDER_3_PASS! },
  { id: "sender_4", user: process.env.SENDER_4_USER!, pass: process.env.SENDER_4_PASS! },
];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function extractBody(raw: string): string {
  // Split headers from body on first blank line
  const headerBodySplit = raw.indexOf("\r\n\r\n");
  if (headerBodySplit === -1) return raw;
  const headers = raw.slice(0, headerBodySplit);
  const fullBody = raw.slice(headerBodySplit + 4);

  // Detect multipart boundary
  const boundaryMatch = headers.match(/Content-Type:[^\r\n]*boundary="?([^";\r\n]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1].trim();
    const parts = fullBody.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?`));

    // Prefer text/plain part
    for (const part of parts) {
      const partHeaderEnd = part.indexOf("\r\n\r\n");
      if (partHeaderEnd === -1) continue;
      const partHeaders = part.slice(0, partHeaderEnd);
      const partBody = part.slice(partHeaderEnd + 4).trim();
      if (/Content-Type:\s*text\/plain/i.test(partHeaders) && partBody) {
        return partBody;
      }
    }
    // Fall back to text/html part
    for (const part of parts) {
      const partHeaderEnd = part.indexOf("\r\n\r\n");
      if (partHeaderEnd === -1) continue;
      const partHeaders = part.slice(0, partHeaderEnd);
      const partBody = part.slice(partHeaderEnd + 4).trim();
      if (/Content-Type:\s*text\/html/i.test(partHeaders) && partBody) {
        return partBody;
      }
    }
  }

  return fullBody.trim();
}

async function syncAccount(sender: typeof SENDERS[0]) {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: sender.user, pass: sender.pass },
    logger: false,
  });

  const synced: string[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch unseen emails from the last 7 days
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const messages = client.fetch(
        { since, seen: false },
        { envelope: true, bodyStructure: true, source: true }
      );

      const sb = getSupabase();

      for await (const msg of messages) {
        const from = msg.envelope.from?.[0];
        if (!from) continue;

        const email = from.address?.toLowerCase();
        const name = (from as unknown as Record<string, string>).name || (from as unknown as Record<string, string>).personalName || email;
        const subject = msg.envelope.subject || "(no subject)";

        if (!email) continue;

        // Check if we sent to this email (via email_logs)
        const { count } = await sb
          .from("email_logs")
          .select("*", { count: "exact", head: true })
          .eq("recipient_email", email);

        if (!count) continue;

        // Check if already stored (by message-id to avoid duplicates)
        const messageId = msg.envelope.messageId || `${email}-${subject}`;
        const { count: exists } = await sb
          .from("email_replies")
          .select("*", { count: "exact", head: true })
          .eq("original_message_id", messageId);

        if (exists) continue;

        // Get email body — prefer text/plain, fall back to raw source after headers
        const source = msg.source?.toString("utf-8") || "";
        const body = extractBody(source);

        await sb.from("email_replies").insert({
          recipient_email: email,
          recipient_name: name,
          sender_id: sender.id,
          original_message_id: messageId,
          reply_subject: subject,
          reply_body: body.trimStart().startsWith("<")
            ? body
            : `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`,
          received_at: msg.envelope.date?.toISOString() || new Date().toISOString(),
          status: "unread",
        });

        // Mark email_logs entry as replied
        await sb.from("email_logs").update({
          status: "replied",
          replied_at: new Date().toISOString(),
        }).eq("recipient_email", email);

        synced.push(email);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error(`Sync error for ${sender.user}:`, err);
  }

  return synced;
}

export async function GET() {
  const results: Record<string, string[]> = {};

  for (const sender of SENDERS) {
    results[sender.id] = await syncAccount(sender);
  }

  const total = Object.values(results).flat().length;
  return NextResponse.json({ synced: total, bySender: results });
}
