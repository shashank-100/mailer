import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface Campaign {
  id?: string;
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  sender_id: string;
  status: "draft" | "active" | "paused" | "completed";
  created_at?: string;
}

export interface EmailLog {
  id?: string;
  campaign_id: string;
  recipient_email: string;
  recipient_name?: string;
  sender_id: string;
  message_id: string;
  status: "sent" | "failed" | "replied" | "bounced" | "opened";
  sent_at?: string;
  replied_at?: string;
  error?: string;
}

export async function createCampaign(campaign: Campaign) {
  const sb = getSupabase();
  const { data, error } = await sb.from("email_campaigns").insert(campaign).select().single();
  if (error) throw error;
  return data;
}

export async function getCampaigns() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("email_campaigns")
    .select("*, email_logs(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCampaignStats(campaignId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("email_logs")
    .select("status")
    .eq("campaign_id", campaignId);
  if (error) throw error;

  const stats = { sent: 0, failed: 0, replied: 0, bounced: 0, opened: 0 };
  for (const row of data || []) {
    stats[row.status as keyof typeof stats]++;
  }
  return stats;
}

export async function logEmail(log: EmailLog) {
  const sb = getSupabase();
  const { data, error } = await sb.from("email_logs").insert(log).select().single();
  if (error) throw error;
  return data;
}

export async function markReplied(messageId: string) {
  const sb = getSupabase();
  const { error } = await sb
    .from("email_logs")
    .update({ status: "replied", replied_at: new Date().toISOString() })
    .eq("message_id", messageId);
  if (error) throw error;
}

export async function getEmailLogs(campaignId?: string) {
  const sb = getSupabase();
  let query = sb
    .from("email_logs")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(200);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
