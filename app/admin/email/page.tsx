"use client";

import { useState, useEffect, useCallback } from "react";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  sender_id: string;
  status: string;
  created_at: string;
}

interface Stats {
  sent: number;
  failed: number;
  replied: number;
  bounced: number;
  opened: number;
}

interface EmailLog {
  id: string;
  campaign_id: string;
  recipient_email: string;
  recipient_name?: string;
  sender_id: string;
  status: string;
  sent_at: string;
  replied_at?: string;
  error?: string;
}

const SENDERS = [
  { id: "sender_1", label: "amitydewbre377 (Sender 1)" },
  { id: "sender_2", label: "shashanktv413 (Sender 2)" },
  { id: "sender_3", label: "shashankvasantrao (Sender 3)" },
  { id: "sender_4", label: "shashanktv005 (Sender 4)" },
];

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  replied: "bg-green-100 text-green-800",
  bounced: "bg-orange-100 text-orange-800",
  opened: "bg-purple-100 text-purple-800",
  draft: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
};

export default function EmailAdminPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [tab, setTab] = useState<"campaigns" | "create" | "send" | "logs">("campaigns");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Create campaign form
  const [form, setForm] = useState({
    name: "",
    subject: "",
    html_body: "",
    text_body: "",
    sender_id: "sender_1",
    status: "draft" as "draft" | "active" | "paused" | "completed",
  });

  // Send form
  const [sendForm, setSendForm] = useState({
    campaignId: "",
    recipientsRaw: "",
    senderId: "",
  });

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/email/campaigns");
    const data = await res.json();
    setCampaigns(data || []);
  }, []);

  const fetchStats = useCallback(async (id: string) => {
    const res = await fetch(`/api/email/campaigns?id=${id}`);
    setStats(await res.json());
  }, []);

  const fetchLogs = useCallback(async (campaignId?: string) => {
    const url = campaignId ? `/api/email/logs?campaignId=${campaignId}` : "/api/email/logs";
    const res = await fetch(url);
    setLogs(await res.json());
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchStats(selectedCampaign);
      fetchLogs(selectedCampaign);
    }
  }, [selectedCampaign, fetchStats, fetchLogs]);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsg("Campaign created!");
      fetchCampaigns();
      setTab("campaigns");
      setForm({ name: "", subject: "", html_body: "", text_body: "", sender_id: "sender_1", status: "draft" });
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setLoading(false);
  }

  async function sendEmails(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const lines = sendForm.recipientsRaw.trim().split("\n").filter(Boolean);
      const recipients = lines.map((line) => {
        const [email, name] = line.split(",").map((s) => s.trim());
        return { email, name };
      });

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: sendForm.campaignId,
          recipients,
          senderId: sendForm.senderId || undefined,
        }),
      });
      const data = await res.json();
      setMsg(`Done — Sent: ${data.sent}, Failed: ${data.failed}`);
      if (selectedCampaign) { fetchStats(selectedCampaign); fetchLogs(selectedCampaign); }
    } catch (err: unknown) {
      setMsg("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/email/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchCampaigns();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Email Campaign Manager</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {(["campaigns", "create", "send", "logs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? "border-black text-black" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {msg && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">{msg}</div>
        )}

        {/* Campaigns list */}
        {tab === "campaigns" && (
          <div className="space-y-3">
            {campaigns.length === 0 && (
              <p className="text-gray-500 text-sm">No campaigns yet. Create one to get started.</p>
            )}
            {campaigns.map((c) => (
              <div
                key={c.id}
                className={`bg-white rounded-xl p-4 border cursor-pointer transition-all ${
                  selectedCampaign === c.id ? "border-black shadow-md" : "border-gray-200 hover:border-gray-400"
                }`}
                onClick={() => setSelectedCampaign(c.id === selectedCampaign ? null : c.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.subject}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {SENDERS.find((s) => s.id === c.sender_id)?.label} •{" "}
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                    <select
                      className="text-xs border rounded px-1 py-0.5"
                      value={c.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStatus(c.id, e.target.value)}
                    >
                      {["draft", "active", "paused", "completed"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedCampaign === c.id && stats && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-5 gap-3">
                    {Object.entries(stats).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <p className="text-xl font-bold text-gray-900">{val}</p>
                        <p className="text-xs text-gray-500 capitalize">{key}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create campaign */}
        {tab === "create" && (
          <form onSubmit={createCampaign} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">New Campaign</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Q1 Outreach"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sender</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.sender_id}
                  onChange={(e) => setForm({ ...form, sender_id: e.target.value })}
                >
                  {SENDERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject <span className="text-gray-400 font-normal">(use {"{{name}}"}, {"{{company}}"} for personalization)</span>
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Hi {{name}}, quick question about {{company}}"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HTML Body</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                rows={8}
                value={form.html_body}
                onChange={(e) => setForm({ ...form, html_body: e.target.value })}
                placeholder="<p>Hi {{name}},</p><p>...</p>"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plain Text Body (optional)</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={4}
                value={form.text_body}
                onChange={(e) => setForm({ ...form, text_body: e.target.value })}
                placeholder="Hi {{name}}, ..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-black text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Campaign"}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, status: "active" })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Set as active
              </button>
            </div>
          </form>
        )}

        {/* Send emails */}
        {tab === "send" && (
          <form onSubmit={sendEmails} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Send Emails</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={sendForm.campaignId}
                  onChange={(e) => setSendForm({ ...sendForm, campaignId: e.target.value })}
                  required
                >
                  <option value="">Select campaign…</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Force Sender (optional)</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={sendForm.senderId}
                  onChange={(e) => setSendForm({ ...sendForm, senderId: e.target.value })}
                >
                  <option value="">Auto round-robin</option>
                  {SENDERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipients <span className="text-gray-400 font-normal">(one per line: email, Name)</span>
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                rows={8}
                value={sendForm.recipientsRaw}
                onChange={(e) => setSendForm({ ...sendForm, recipientsRaw: e.target.value })}
                placeholder={`john@acme.com, John Smith\njane@corp.com, Jane Doe`}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Emails"}
            </button>
          </form>
        )}

        {/* Logs */}
        {tab === "logs" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Email Logs</h2>
              <div className="flex items-center gap-2">
                <select
                  className="text-sm border rounded px-2 py-1"
                  onChange={(e) => fetchLogs(e.target.value || undefined)}
                >
                  <option value="">All campaigns</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  onClick={() => fetchLogs()}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 border rounded"
                >
                  Refresh
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["To", "Sender", "Status", "Sent At", "Replied At"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-400">No logs yet</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <p>{log.recipient_email}</p>
                      {log.recipient_name && <p className="text-xs text-gray-400">{log.recipient_name}</p>}
                      {log.error && <p className="text-xs text-red-500">{log.error}</p>}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {SENDERS.find((s) => s.id === log.sender_id)?.label || log.sender_id}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[log.status]}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {log.replied_at ? new Date(log.replied_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
