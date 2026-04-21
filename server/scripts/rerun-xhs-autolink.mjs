#!/usr/bin/env node
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { runAutoLinkRulesForCard } from "../src/storage-pg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const ssl =
  process.env.PG_SSL === "false" ? false : { rejectUnauthorized: false };
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

try {
  await client.connect();
  const rows = (
    await client.query(
      `SELECT c.id, c.user_id
         FROM cards c
         JOIN card_types ct ON ct.id = c.card_type_id
        WHERE c.trashed_at IS NULL AND ct.preset_slug = 'post_xhs'`
    )
  ).rows;
  let processed = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await runAutoLinkRulesForCard(r.user_id, r.id);
      processed += 1;
    } catch {
      failed += 1;
    }
  }
  console.log(JSON.stringify({ scanned: rows.length, processed, failed }, null, 2));
} finally {
  await client.end().catch(() => {});
}
