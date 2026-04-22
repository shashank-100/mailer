"use client";

import { useState, useEffect, useCallback } from "react";

interface Reply {
  id: string;
  recipient_email: string;
  recipient_name?: string;
  sender_id: string;
  reply_subject?: string;
  reply_body?: string;
  received_at: string;
  status: "unread" | "read" | "replied";
  our_reply?: string;
  replied_at?: string;
}

const SENDERS = [
  { id: "sender_1", email: "amitydewbre377@gmail.com" },
  { id: "sender_2", email: "shashanktv413@gmail.com" },
  { id: "sender_3", email: "shashankvasantrao@gmail.com" },
  { id: "sender_4", email: "shashanktv005@gmail.com" },
];

export default function InboxPage() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [selected, setSelected] = useState<Reply | null>(null);
  const [filter, setFilter] = useState<"unread" | "read" | "replied" | "all">("unread");
  const [replyText, setReplyText] = useState("");
  const [senderId, setSenderId] = useState("sender_1");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);

  const fetchReplies = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inbox?status=${filter}`);
    setReplies(await res.json());
    setLoading(false);
  }, [filter]);

  const syncInbox = useCallback(async () => {
    setSyncing(true);
    await fetch("/api/inbox/sync");
    await fetchReplies();
    setSyncing(false);
  }, [fetchReplies]);

  // Sync on load, then every 5 minutes
  useEffect(() => {
    syncInbox();
    const interval = setInterval(syncInbox, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncInbox]);

  async function openReply(reply: Reply) {
    setSelected(reply);
    setReplyText("");
    if (reply.status === "unread") {
      await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reply.id, status: "read" }),
      });
      setReplies((prev) => prev.map((r) => r.id === reply.id ? { ...r, status: "read" } : r));
    }
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replyId: selected.id,
        to: selected.recipient_email,
        subject: `Re: ${selected.reply_subject || "Follow up"}`,
        html: `<p>${replyText.replace(/\n/g, "<br/>")}</p><br/><p>— Shashank</p>`,
        senderId,
      }),
    });
    setReplies((prev) => prev.map((r) => r.id === selected.id ? { ...r, status: "replied", our_reply: replyText } : r));
    setSelected(null);
    setReplyText("");
    setSending(false);
  }

  const unreadCount = replies.filter((r) => r.status === "unread").length;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
          {unreadCount > 0 && (
            <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex gap-2">
          {(["unread", "read", "replied", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setSelected(null); }}
              className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                filter === f ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
          <button onClick={syncInbox} disabled={syncing} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Reply list */}
        <div className="w-80 border-r bg-white overflow-y-auto flex-shrink-0">
          {loading && <p className="text-sm text-gray-400 p-4">Loading...</p>}
          {!loading && replies.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-gray-400 text-sm">No {filter} replies</p>
              <p className="text-gray-300 text-xs mt-1">Replies will appear here once agents respond</p>
            </div>
          )}
          {replies.map((reply) => (
            <div
              key={reply.id}
              onClick={() => openReply(reply)}
              className={`p-4 border-b cursor-pointer transition-colors ${
                selected?.id === reply.id ? "bg-blue-50 border-l-2 border-l-black" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm truncate ${reply.status === "unread" ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                    {reply.recipient_name || reply.recipient_email}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{reply.recipient_email}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{reply.reply_subject}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {reply.status === "unread" && <span className="w-2 h-2 bg-blue-500 rounded-full inline-block mb-1" />}
                  <p className="text-xs text-gray-400">
                    {new Date(reply.received_at).toLocaleDateString()}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    reply.status === "unread" ? "bg-blue-100 text-blue-700" :
                    reply.status === "replied" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {reply.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Email thread + reply */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Email header */}
            <div className="bg-white border-b px-6 py-4">
              <h2 className="font-semibold text-gray-900">{selected.reply_subject || "(no subject)"}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                From: <span className="text-gray-700">{selected.recipient_name || ""} &lt;{selected.recipient_email}&gt;</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(selected.received_at).toLocaleString()}
              </p>
            </div>

            {/* Email body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-white rounded-xl border p-5 max-w-2xl">
                {selected.reply_body ? (
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: selected.reply_body }}
                  />
                ) : (
                  <p className="text-gray-400 text-sm">(no body)</p>
                )}
              </div>

              {selected.our_reply && (
                <div className="mt-4 max-w-2xl">
                  <p className="text-xs text-gray-400 mb-2">Your reply ({selected.replied_at ? new Date(selected.replied_at).toLocaleString() : ""})</p>
                  <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.our_reply}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Reply box */}
            {selected.status !== "replied" && (
              <div className="bg-white border-t p-4">
                <div className="flex gap-2 mb-2">
                  <select
                    className="text-sm border rounded-lg px-2 py-1.5"
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                  >
                    {SENDERS.map((s) => (
                      <option key={s.id} value={s.id}>{s.email}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 self-center">
                    Replying to {selected.recipient_email}
                  </p>
                </div>
                <textarea
                  className="w-full border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
                  rows={5}
                  placeholder="Write your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
                  }}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-400">Cmd+Enter to send</p>
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="bg-black text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-800"
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg">Select a reply to read</p>
              <p className="text-sm mt-1">Replies from agents will appear in the list</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
