/**
 * AceViewer.db3 → D1 자동 import 스크립트
 *
 * Usage:
 *   npx tsx scripts/import-aceviewer.ts [db-path]
 *
 * Examples:
 *   npx tsx scripts/import-aceviewer.ts                    # ./AceTime/AceViewer.db3
 *   npx tsx scripts/import-aceviewer.ts /mnt/nas/AceViewer.db3  # NAS 경로
 *   ACEVIEWER_DB=/volume1/acetime/AceViewer.db3 npx tsx scripts/import-aceviewer.ts
 *
 * 환경변수:
 *   ACEVIEWER_DB - DB 파일 경로 (CLI 인자가 우선)
 *   HMAC_SECRET - 해시 생성용 (optional)
 *   AUTO_EXECUTE - "true"면 wrangler d1 execute 자동 실행
 */

import Database from "better-sqlite3";
import { createHash, randomUUID } from "crypto";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_DB_PATHS = [
  "./AceTime/AceViewer.db3",
  "/mnt/nas/AceTime/AceViewer.db3",
  "/mnt/nfs/AceTime/AceViewer.db3",
  "/volume1/acetime/AceViewer.db3",
  "/mnt/synology/AceTime/AceViewer.db3",
  "/nfs/acetime/AceViewer.db3",
];

const OUTPUT_SQL_PATH = "./scripts/import-aceviewer.sql";

function findDbPath(explicitPath?: string): string | null {
  if (explicitPath && fs.existsSync(explicitPath)) {
    return explicitPath;
  }

  const envPath = process.env.ACEVIEWER_DB;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  for (const p of DEFAULT_DB_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

function decodeEucKr(buffer: Buffer | null): string {
  if (!buffer) return "";
  try {
    const decoder = new TextDecoder("euc-kr");
    return decoder.decode(buffer);
  } catch {
    return buffer.toString("utf-8");
  }
}

function hmacSync(secret: string, data: string): string {
  return createHash("sha256")
    .update(secret + data)
    .digest("hex");
}

function generateId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 25);
}

function escapeSQL(str: string | null): string {
  if (str === null || str === undefined) return "NULL";
  return `'${str.replace(/'/g, "''")}'`;
}

async function main() {
  console.log("=== AceViewer.db3 → D1 Auto Import ===\n");

  const dbPath = findDbPath(process.argv[2]);

  if (!dbPath) {
    console.error("Error: AceViewer.db3 not found");
    console.error("\nSearched locations:");
    DEFAULT_DB_PATHS.forEach((p) => console.error(`  - ${p}`));
    console.error("\nUsage:");
    console.error("  npx tsx scripts/import-aceviewer.ts [path-to-db]");
    console.error(
      "  ACEVIEWER_DB=/path/to/db npx tsx scripts/import-aceviewer.ts",
    );
    process.exit(1);
  }

  console.log(`Found: ${dbPath}`);

  const db = new Database(dbPath, { readonly: true });

  // CAST AS BLOB to get raw EUC-KR bytes, then decode properly
  const employees = db
    .prepare(
      `SELECT empl_cd,
              CAST(empl_nm AS BLOB) as empl_nm,
              CAST(part_nm AS BLOB) as part_nm,
              CAST(jijo_nm AS BLOB) as jijo_nm,
              CAST(gojo_nm AS BLOB) as gojo_nm,
              last_dt
       FROM employee`,
    )
    .all() as Array<{
    empl_cd: string;
    empl_nm: Buffer;
    part_nm: Buffer;
    jijo_nm: Buffer;
    gojo_nm: Buffer;
    last_dt: string;
  }>;

  console.log(`Employees: ${employees.length}\n`);

  const hmacSecret = process.env.HMAC_SECRET || "dummy-secret-for-import";
  const now = new Date().toISOString();

  const inserts: string[] = [];

  for (const emp of employees) {
    const id = generateId();
    const emplCd = String(emp.empl_cd);
    const name = decodeEucKr(emp.empl_nm);
    const companyName = decodeEucKr(emp.part_nm);
    const tradeType = decodeEucKr(emp.jijo_nm);

    // AceViewer에 phone이 없어서 empl_cd를 임시로 사용
    const dummyPhone = `FAS-${emplCd}`;
    const phoneHash = hmacSync(hmacSecret, dummyPhone);
    const nameMasked = name.length > 0 ? name[0] + "**" : "***";

    const sql = `INSERT OR IGNORE INTO users (id, phone, phone_hash, name, name_masked, external_system, external_worker_id, company_name, trade_type, role, created_at, updated_at) VALUES (${escapeSQL(id)}, ${escapeSQL(dummyPhone)}, ${escapeSQL(phoneHash)}, ${escapeSQL(name)}, ${escapeSQL(nameMasked)}, 'FAS', ${escapeSQL(emplCd)}, ${escapeSQL(companyName)}, ${escapeSQL(tradeType)}, 'WORKER', ${escapeSQL(now)}, ${escapeSQL(now)});`;

    inserts.push(sql);
  }

  const sqlContent = `-- AceViewer.db3 import (${employees.length} employees)
-- Source: ${dbPath}
-- Generated: ${now}

BEGIN TRANSACTION;

${inserts.join("\n")}

COMMIT;
`;

  fs.writeFileSync(OUTPUT_SQL_PATH, sqlContent);
  console.log(`Generated: ${OUTPUT_SQL_PATH}`);
  console.log(`Statements: ${inserts.length}\n`);

  db.close();

  if (process.env.AUTO_EXECUTE === "true") {
    console.log("=== Auto-executing D1 import ===\n");
    try {
      execSync(
        `npx wrangler d1 execute safework2-db --local --file=${OUTPUT_SQL_PATH}`,
        { stdio: "inherit", cwd: path.resolve(__dirname, "..") },
      );
      console.log("\n✅ Import completed!");
    } catch (err) {
      console.error("\n❌ Import failed:", err);
      process.exit(1);
    }
  } else {
    console.log(`=== Next Steps ===
1. Local: npx wrangler d1 execute safework2-db --local --file=${OUTPUT_SQL_PATH}
2. Production: npx wrangler d1 execute safework2-db --file=${OUTPUT_SQL_PATH}
3. Auto: AUTO_EXECUTE=true npx tsx scripts/import-aceviewer.ts
`);
  }
}

main().catch(console.error);
