// MVP_SCOPE.md Phase 2, item 1: "Partner-seed data import tool
// (CSV/GeoJSON bulk import from an NGO or campus safety office, tagged
// with a seed_source field distinct from organic tags)". Run directly
// against the DB by Lantern staff (bypasses the public rate-limited API
// on purpose — this is a trusted operational action, not a user flow).
//
// Usage:
//   npm run seed:partner -- --file ./partner-data.csv --source "GRA Women's Safety Group"
//   npm run seed:partner -- --file ./partner-data.geojson --source "UNIPORT Safety Office"
//
// CSV columns: segment_id,time_of_day,lighting,safety_feeling,category,note
// GeoJSON: FeatureCollection whose feature.properties has the same fields
// (geometry is ignored — features must reference an existing segment_id,
// since DO_NOT.md requires segment-level specificity, never a whole-area
// bulk tag).

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

type Category =
  | "harassment"
  | "no_sidewalk"
  | "flooding"
  | "animals"
  | "no_transport_available"
  | "other";

type SeedRow = {
  segment_id: string;
  time_of_day: "day" | "evening" | "night";
  lighting: "lit" | "dim" | "dark";
  safety_feeling: "safe" | "caution" | "avoid";
  category?: Category;
  note?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  const sourceIndex = args.indexOf("--source");
  if (fileIndex === -1 || sourceIndex === -1) {
    throw new Error("Usage: --file <path> --source \"<partner name>\"");
  }
  return { file: args[fileIndex + 1], source: args[sourceIndex + 1] };
}

// Minimal RFC4180-ish CSV parser (handles quoted fields with commas) —
// avoids adding a CSV-parsing dependency for a one-off admin script.
function parseCsv(text: string): SeedRow[] {
  const lines = text.trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => (row[key] = values[i] ?? ""));
    return row as unknown as SeedRow;
  });
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function parseGeoJson(text: string): SeedRow[] {
  const json = JSON.parse(text) as { features: { properties: SeedRow }[] };
  return json.features.map((f) => f.properties);
}

async function main() {
  const { file, source } = parseArgs();
  const fs = await import("node:fs/promises");
  const text = await fs.readFile(file, "utf-8");
  const rows = file.endsWith(".geojson") || file.endsWith(".json") ? parseGeoJson(text) : parseCsv(text);

  console.log(`Importing ${rows.length} rows from "${source}"...`);

  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const [segment] = await db
      .select({ id: schema.segments.id })
      .from(schema.segments)
      .where(eq(schema.segments.id, row.segment_id));

    if (!segment) {
      console.warn(`Skipping unknown segment_id: ${row.segment_id}`);
      skipped++;
      continue;
    }

    await db.insert(schema.tags).values({
      segmentId: row.segment_id,
      timeOfDay: row.time_of_day,
      lighting: row.lighting,
      safetyFeeling: row.safety_feeling,
      category: row.category || null,
      note: row.note || null,
      kind: "infrastructure",
      seedSource: source,
    });
    // audit-project review: this previously never touched
    // segments.tag_count/last_tagged_at, so partner-seeded contributions
    // permanently undercounted in /api/segments and /api/v1/export.
    await db
      .update(schema.segments)
      .set({
        tagCount: sql`${schema.segments.tagCount} + 1`,
        lastTaggedAt: new Date(),
      })
      .where(eq(schema.segments.id, row.segment_id));
    inserted++;
  }

  console.log(`Inserted ${inserted} seed tags, skipped ${skipped}.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
