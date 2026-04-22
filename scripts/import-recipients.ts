import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseCSV(file: string) {
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || "").trim()]));
  });
}

async function importGroup(csvFile: string, group: "A" | "B") {
  const rows = parseCSV(path.resolve(csvFile));
  console.log(`Importing Group ${group}: ${rows.length} recipients...`);

  const records = rows
    .filter((r) => r.email)
    .map((r) => ({
      first_name: r.first_name || null,
      company: r.company || null,
      email: r.email.toLowerCase(),
      phone: r.phone || null,
      campaign_group: group,
      status: "unsent",
    }));

  // Batch insert in chunks of 100
  let inserted = 0;
  for (let i = 0; i < records.length; i += 100) {
    const chunk = records.slice(i, i + 100);
    const { error } = await supabase
      .from("email_recipients")
      .upsert(chunk, { onConflict: "email", ignoreDuplicates: true });
    if (error) console.error(`Chunk error:`, error.message);
    else inserted += chunk.length;
  }

  console.log(`Group ${group}: ${inserted} imported\n`);
}

async function main() {
  await importGroup("zillow_19apr_a.csv", "A");
  await importGroup("zillow_19apr_b.csv", "B");

  // Summary
  const { data } = await supabase
    .from("email_recipients")
    .select("campaign_group, status")
    .order("campaign_group");

  const summary: Record<string, Record<string, number>> = {};
  for (const row of data || []) {
    summary[row.campaign_group] = summary[row.campaign_group] || {};
    summary[row.campaign_group][row.status] = (summary[row.campaign_group][row.status] || 0) + 1;
  }
  console.log("DB Summary:", JSON.stringify(summary, null, 2));
}

main();
