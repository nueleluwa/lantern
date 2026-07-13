// Phase 3: issues a B2B/B2G export API key. Prints the raw key once —
// only its SHA-256 hash is stored, so it can't be recovered later.
//
// Usage: npm run partner:create-key -- --name "NGO name"

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { hashApiKey } from "../src/lib/partner-auth";

function parseArgs() {
  const args = process.argv.slice(2);
  const nameIndex = args.indexOf("--name");
  if (nameIndex === -1) throw new Error('Usage: --name "Partner name"');
  return { name: args[nameIndex + 1] };
}

async function main() {
  const { name } = parseArgs();
  const rawKey = crypto.randomUUID() + crypto.randomUUID();

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  await db.insert(schema.partnerApiKeys).values({
    partnerName: name,
    hashedKey: hashApiKey(rawKey),
  });

  console.log(`API key for "${name}" (save this now, it won't be shown again):`);
  console.log(rawKey);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
