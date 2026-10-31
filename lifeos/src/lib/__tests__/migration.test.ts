import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { COLLECTIONS, type CollectionName } from "../types";
import { TABLES, camelToSnake, fieldsOf } from "../store/repo";

const dir = path.resolve(__dirname, "../../../supabase/migrations");
const sql = readdirSync(dir).sort().map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");

function columnsOf(table: string): Set<string> {
  const m = sql.match(new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`));
  if (!m) throw new Error(`table ${table} missing from migration`);
  const cols = new Set<string>();
  for (const line of m[1].split("\n")) {
    const c = line.trim().match(/^"?([a-z_]+)"?\s+(text|uuid|date|boolean|numeric|integer|smallint|double|jsonb|timestamptz)/);
    if (c) cols.add(c[1]);
  }
  return cols;
}

describe("database migration matches the app data model", () => {
  for (const c of Object.keys(COLLECTIONS) as CollectionName[]) {
    it(`${c} → ${TABLES[c]}`, () => {
      const cols = columnsOf(TABLES[c]);
      const expected = fieldsOf(c).map(camelToSnake);
      expect(expected.filter((f) => !cols.has(f))).toEqual([]);
      expect(cols.has("user_id")).toBe(true);
      cols.delete("user_id");
      expect([...cols].filter((col) => !expected.includes(col))).toEqual([]);
    });
  }
  it("every table has RLS", () => {
    for (const t of Object.values(TABLES)) expect(sql).toContain(`'${t}'`);
  });
});
