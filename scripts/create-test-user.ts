/**
 * 테스트 유저 생성 스크립트
 *
 * 사용법:
 *   HMAC_SECRET=your-secret npx tsx scripts/create-test-user.ts
 *
 * 생성되는 유저:
 *   이름: 테스트관리자
 *   전화번호: 01099990001
 *   생년월일: 19900101
 *   역할: SUPER_ADMIN
 *
 * 출력: scripts/create-test-user.sql (wrangler d1 execute 로 적용)
 */

import { createHmac, randomUUID } from "crypto";
import { writeFileSync } from "fs";
import { join } from "path";

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function generateId(): string {
  return randomUUID().replace(/-/g, "").substring(0, 25);
}

function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

function escapeSQL(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const hmacSecret = process.env.HMAC_SECRET;
if (!hmacSecret) {
  console.error("Error: HMAC_SECRET environment variable is required");
  console.error(
    "  HMAC_SECRET=your-secret npx tsx scripts/create-test-user.ts",
  );
  process.exit(1);
}

interface TestUser {
  name: string;
  phone: string;
  dob: string;
  role: "WORKER" | "SITE_ADMIN" | "SUPER_ADMIN" | "SYSTEM";
}

const testUsers: TestUser[] = [
  {
    name: "테스트관리자",
    phone: "01099990001",
    dob: "19900101",
    role: "SUPER_ADMIN",
  },
  {
    name: "테스트작업자",
    phone: "01099990002",
    dob: "19900202",
    role: "WORKER",
  },
];

const now = Math.floor(Date.now() / 1000); // Unix epoch seconds (schema uses integer timestamps)
const lines: string[] = [
  `-- Test users generated at ${now}`,
  `-- Login credentials:`,
];

for (const user of testUsers) {
  lines.push(
    `--   Name: ${user.name}, Phone: ${user.phone}, DOB: ${user.dob}, Role: ${user.role}`,
  );
}

lines.push("", "BEGIN TRANSACTION;", "");

for (const user of testUsers) {
  const id = generateId();
  const phoneHash = hmac(hmacSecret, user.phone);
  const dobHash = hmac(hmacSecret, user.dob);
  const nameMasked = maskName(user.name);

  lines.push(`DELETE FROM users WHERE phone_hash = ${escapeSQL(phoneHash)};`);

  lines.push(
    `INSERT INTO users (id, phone, phone_hash, dob, dob_hash, name, name_masked, role, created_at, updated_at)` +
      ` VALUES (${escapeSQL(id)}, ${escapeSQL(user.phone)}, ${escapeSQL(phoneHash)}, ${escapeSQL(user.dob)}, ${escapeSQL(dobHash)}, ${escapeSQL(user.name)}, ${escapeSQL(nameMasked)}, ${escapeSQL(user.role)}, ${now}, ${now});`,
  );

  lines.push("");
}

lines.push("COMMIT;");

const outputPath = join(process.cwd(), "scripts", "create-test-user.sql");
writeFileSync(outputPath, lines.join("\n"), "utf8");

console.log(`✅ SQL generated: ${outputPath}`);
console.log("");
console.log("To apply locally:");
console.log(
  "  npx wrangler d1 execute safework2-db --local --file=./scripts/create-test-user.sql",
);
console.log("");
console.log("To apply to production:");
console.log(
  "  npx wrangler d1 execute safework2-db --remote --file=./scripts/create-test-user.sql",
);
console.log("");
console.log("Login credentials:");
for (const user of testUsers) {
  console.log(
    `  ${user.role}: name=${user.name}, phone=${user.phone}, dob=${user.dob}`,
  );
}
