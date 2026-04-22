import nodemailer from "nodemailer";

export interface SenderAccount {
  id: string;
  name: string;
  email: string;
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Two sender accounts — configure via env vars
export const SENDERS: SenderAccount[] = [
  {
    id: "sender_1",
    name: process.env.SENDER_1_NAME || "GenAI Studio",
    email: process.env.SENDER_1_EMAIL || "",
    host: process.env.SENDER_1_HOST || "smtp.gmail.com",
    port: Number(process.env.SENDER_1_PORT) || 587,
    user: process.env.SENDER_1_USER || "",
    pass: process.env.SENDER_1_PASS || "",
  },
  {
    id: "sender_2",
    name: process.env.SENDER_2_NAME || "GenAI Studio Team",
    email: process.env.SENDER_2_EMAIL || "",
    host: process.env.SENDER_2_HOST || "smtp.gmail.com",
    port: Number(process.env.SENDER_2_PORT) || 587,
    user: process.env.SENDER_2_USER || "",
    pass: process.env.SENDER_2_PASS || "",
  },
  {
    id: "sender_3",
    name: process.env.SENDER_3_NAME || "GenAI Studio Support",
    email: process.env.SENDER_3_EMAIL || "",
    host: process.env.SENDER_3_HOST || "smtp.gmail.com",
    port: Number(process.env.SENDER_3_PORT) || 587,
    user: process.env.SENDER_3_USER || "",
    pass: process.env.SENDER_3_PASS || "",
  },
  {
    id: "sender_4",
    name: process.env.SENDER_4_NAME || "GenAI Studio Pro",
    email: process.env.SENDER_4_EMAIL || "",
    host: process.env.SENDER_4_HOST || "smtp.gmail.com",
    port: Number(process.env.SENDER_4_PORT) || 587,
    user: process.env.SENDER_4_USER || "",
    pass: process.env.SENDER_4_PASS || "",
  },
];

function createTransport(sender: SenderAccount) {
  return nodemailer.createTransport({
    host: sender.host,
    port: sender.port,
    secure: sender.port === 465,
    auth: { user: sender.user, pass: sender.pass },
  });
}

export interface SendEmailOptions {
  senderId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  // For tracking: unique message ID to store in DB
  campaignId: string;
  recipientId?: string;
}

export async function sendEmail(opts: SendEmailOptions) {
  const sender = SENDERS.find((s) => s.id === opts.senderId);
  if (!sender) throw new Error(`Sender ${opts.senderId} not found`);

  const transport = createTransport(sender);
  const info = await transport.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo || sender.email,
    headers: {
      "X-Campaign-Id": opts.campaignId,
      ...(opts.recipientId ? { "X-Recipient-Id": opts.recipientId } : {}),
    },
  });

  return { messageId: info.messageId, accepted: info.accepted };
}

// Round-robin sender selection
let senderIndex = 0;
export function getNextSender(): SenderAccount {
  const sender = SENDERS[senderIndex % SENDERS.length];
  senderIndex++;
  return sender;
}
