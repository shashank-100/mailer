import { sendEmail, SENDERS } from "../lib/email-sender";

async function main() {
  console.log(`Testing ${SENDERS.length} senders...\n`);

  for (const sender of SENDERS) {
    process.stdout.write(`${sender.id} (${sender.email}) → `);
    try {
      const { messageId } = await sendEmail({
        senderId: sender.id,
        to: "shashank.telkhade@gmail.com",
        subject: `Test from ${sender.id}`,
        html: `<p>Test email from <b>${sender.email}</b></p>`,
        campaignId: "test",
      });
      console.log(`✓ sent (${messageId})`);
    } catch (err: unknown) {
      console.log(`✗ failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main();
