import mysql from "mysql2/promise";
import type { HyperdriveBinding } from "../types";
import { FasGetUpdatedEmployeesParamsSchema } from "../validators/fas-sync";

// AceTime MariaDB uses EUC-KR charset (jeil_cmi database)
// site_cd is always '10' at this construction site
const SITE_CD = "10";

// mysql2/promise의 createConnection은 Connection 타입을 반환하지만
// 실제로는 query 메서드를 포함함. 타입 정의가 불완전하므로 any 사용.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MySqlConnection = any;

/**
 * AceTime employee record from MariaDB `employee` table
 * Joined with `partner` table for company name
 */
export interface FasEmployee {
  /** 사원코드 (employee.empl_cd) e.g. '24000001' */
  emplCd: string;
  /** 사원명 (employee.empl_nm) e.g. '김우현' */
  name: string;
  /** 협력사코드 (employee.part_cd) FK→partner */
  partCd: string;
  /** 협력사명 (partner.part_nm) e.g. '제일건설' */
  companyName: string;
  /** 전화번호 (employee.tel_no) e.g. '01091865156' */
  phone: string;
  /** 주민번호 앞7자리 (employee.social_no) e.g. '6905281' */
  socialNo: string;
  /** 공종코드 (employee.gojo_cd) FK→gongjong */
  gojoCd: string;
  /** 직종코드 (employee.jijo_cd) FK→jikjong */
  jijoCd: string;
  /** 직책코드 (employee.care_cd) */
  careCd: string;
  /** 역할코드 (employee.role_cd) */
  roleCd: string;
  /** 재직상태 (employee.state_flag) 'W'=재직 */
  stateFlag: string;
  /** 입사일 YYYYMMDD (employee.entr_day) */
  entrDay: string;
  /** 퇴직일 YYYYMMDD (employee.retr_day) */
  retrDay: string;
  /** RFID (employee.rfid) */
  rfid: string;
  /** 위반횟수 (employee.viol_cnt) */
  violCnt: number;
  /** 수정일시 (employee.update_dt) */
  updatedAt: Date;
  /** 재직여부 — derived from state_flag === 'W' */
  isActive: boolean;
}

/**
 * AceTime daily attendance from MariaDB `access_daily` table
 */
export interface FasAttendance {
  /** 사원코드 */
  emplCd: string;
  /** 출근일 YYYYMMDD */
  accsDay: string;
  /** 입장시간 HHMM (null if absent) */
  inTime: string | null;
  /** 퇴장시간 HHMM (null if not checked out) */
  outTime: string | null;
  /** 상태 (0=normal) */
  state: number;
  /** 협력사코드 */
  partCd: string;
}

interface PooledConnection {
  connection: MySqlConnection;
  lastUsed: number;
}

const connectionCache = new Map<string, PooledConnection>();
const CACHE_TIMEOUT_MS = 30 * 1000; // 30 seconds TTL for cached connections

/**
 * Get or create a pooled connection with TTL-based caching.
 * Reduces connection overhead from ~5s per query to ~50-100ms.
 * CloudFlare Workers ephemeral nature limits true pooling,
 * but single-connection caching helps significantly.
 */
async function getConnection(
  hyperdrive: HyperdriveBinding,
): Promise<MySqlConnection> {
  const cacheKey = `${hyperdrive.host}:${hyperdrive.port}`;
  const now = Date.now();

  // Check if we have a cached connection that's still alive
  const cached = connectionCache.get(cacheKey);
  if (cached && now - cached.lastUsed < CACHE_TIMEOUT_MS) {
    try {
      // Verify connection is still alive with ping
      await cached.connection.ping();
      cached.lastUsed = now;
      return cached.connection;
    } catch {
      // Connection is dead, remove from cache
      connectionCache.delete(cacheKey);
    }
  }

  // Create new connection
  const conn = await mysql.createConnection({
    host: hyperdrive.host,
    port: hyperdrive.port,
    user: hyperdrive.user,
    password: hyperdrive.password,
    database: hyperdrive.database,
    namedPlaceholders: true,
    connectTimeout: 5000,
    disableEval: true,
    waitForConnections: true,
    connectionLimit: 1, // Single connection per isolate
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  connectionCache.set(cacheKey, { connection: conn, lastUsed: now });
  return conn;
}

/**
 * Cleanup expired cached connections.
 * Should be called periodically (e.g., in scheduled tasks).
 */
export function cleanupExpiredConnections(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];

  for (const [key, pooled] of connectionCache.entries()) {
    if (now - pooled.lastUsed > CACHE_TIMEOUT_MS) {
      expiredKeys.push(key);
    }
  }

  for (const key of expiredKeys) {
    const pooled = connectionCache.get(key);
    if (pooled) {
      pooled.connection.end().catch(() => {
        // Connection already closed, ignore
      });
      connectionCache.delete(key);
    }
  }
}

/** Shared SELECT columns for employee queries */
const EMPLOYEE_SELECT = `
  e.empl_cd, e.empl_nm, e.part_cd, e.tel_no, e.social_no,
  e.state_flag, e.entr_day, e.retr_day, e.update_dt,
  e.gojo_cd, e.jijo_cd, e.care_cd, e.role_cd, e.rfid,
  e.viol_cnt, e.viol_yn,
  p.part_nm`;

/** Shared FROM + JOIN for employee queries */
const EMPLOYEE_FROM = `
  FROM employee e
  LEFT JOIN partner p ON e.site_cd = p.site_cd AND e.part_cd = p.part_cd`;

/**
 * Get a single employee by empl_cd
 */
export async function fasGetEmployeeInfo(
  hyperdrive: HyperdriveBinding,
  emplCd: string,
): Promise<FasEmployee | null> {
  const conn = await getConnection(hyperdrive);
  try {
    const [rows] = await conn.query(
      `SELECT ${EMPLOYEE_SELECT} ${EMPLOYEE_FROM}
       WHERE e.site_cd = ? AND e.empl_cd = ?
       LIMIT 1`,
      [SITE_CD, emplCd],
    );
    const results = rows as Array<Record<string, unknown>>;
    if (results.length === 0) {
      return null;
    }
    return mapToFasEmployee(results[0]);
  } finally {
    await conn.end();
  }
}

/**
 * Get multiple employees by empl_cd in a single batch query.
 * Optimizes CRON cross-match sync by reducing N individual queries to 1.
 */
export async function fasGetEmployeesBatch(
  hyperdrive: HyperdriveBinding,
  emplCds: string[],
): Promise<Map<string, FasEmployee>> {
  if (emplCds.length === 0) {
    return new Map();
  }

  const conn = await getConnection(hyperdrive);
  try {
    const placeholders = emplCds.map(() => "?").join(",");
    const [rows] = await conn.query(
      `SELECT ${EMPLOYEE_SELECT} ${EMPLOYEE_FROM}
       WHERE e.site_cd = ? AND e.empl_cd IN (${placeholders})`,
      [SITE_CD, ...emplCds],
    );
    const results = rows as Array<Record<string, unknown>>;
    const map = new Map<string, FasEmployee>();
    for (const row of results) {
      const employee = mapToFasEmployee(row);
      if (employee.emplCd) {
        map.set(employee.emplCd, employee);
      }
    }
    return map;
  } finally {
    await conn.end();
  }
}

/**
 * Get employees updated since a given timestamp (for delta sync).
 * Returns all employees if sinceTimestamp is empty/null.
 */
export async function fasGetUpdatedEmployees(
  hyperdrive: HyperdriveBinding,
  sinceTimestamp: string | null,
): Promise<FasEmployee[]> {
  // Validate timestamp parameter
  const validated = FasGetUpdatedEmployeesParamsSchema.parse({
    sinceTimestamp,
  });

  const conn = await getConnection(hyperdrive);
  try {
    let query = `SELECT ${EMPLOYEE_SELECT} ${EMPLOYEE_FROM}
      WHERE e.site_cd = ?`;
    const params: unknown[] = [SITE_CD];

    if (validated.sinceTimestamp) {
      query += ` AND e.update_dt > ?`;
      params.push(validated.sinceTimestamp);
    }

    query += ` ORDER BY e.update_dt ASC`;

    const [rows] = await conn.query(query, params);
    const results = rows as Array<Record<string, unknown>>;
    return results.map(mapToFasEmployee);
  } finally {
    await conn.end();
  }
}

/**
 * Get all employees with pagination (for bulk sync).
 */
export async function fasGetAllEmployeesPaginated(
  hyperdrive: HyperdriveBinding,
  offset: number,
  limit: number,
): Promise<{ employees: FasEmployee[]; total: number }> {
  const conn = await getConnection(hyperdrive);
  try {
    const [countRows] = await conn.query(
      `SELECT COUNT(*) as cnt ${EMPLOYEE_FROM} WHERE e.site_cd = ?`,
      [SITE_CD],
    );
    const total = (countRows as Array<Record<string, unknown>>)[0]
      .cnt as number;

    const [rows] = await conn.query(
      `SELECT ${EMPLOYEE_SELECT} ${EMPLOYEE_FROM}
       WHERE e.site_cd = ?
       ORDER BY e.empl_cd ASC
       LIMIT ? OFFSET ?`,
      [SITE_CD, limit, offset],
    );
    const results = rows as Array<Record<string, unknown>>;
    return { employees: results.map(mapToFasEmployee), total };
  } finally {
    await conn.end();
  }
}

/**
 * Get today's attendance records from `access_daily`
 */
export async function fasGetDailyAttendance(
  hyperdrive: HyperdriveBinding,
  accsDay: string,
): Promise<FasAttendance[]> {
  const conn = await getConnection(hyperdrive);
  try {
    const [rows] = await conn.query(
      `SELECT ad.empl_cd, ad.accs_day, ad.in_time, ad.out_time,
              ad.state, ad.part_cd
       FROM access_daily ad
       WHERE ad.site_cd = ? AND ad.accs_day = ?
       ORDER BY ad.in_time ASC`,
      [SITE_CD, accsDay],
    );
    const results = rows as Array<Record<string, unknown>>;
    return results.map(mapToFasAttendance);
  } finally {
    await conn.end();
  }
}

/**
 * Search employee by phone number (normalized, dashes removed)
 */
export async function fasSearchEmployeeByPhone(
  hyperdrive: HyperdriveBinding,
  phone: string,
): Promise<FasEmployee | null> {
  const conn = await getConnection(hyperdrive);
  try {
    const normalizedPhone = phone.replace(/-/g, "");
    const [rows] = await conn.query(
      `SELECT ${EMPLOYEE_SELECT} ${EMPLOYEE_FROM}
       WHERE e.site_cd = ? AND REPLACE(e.tel_no, '-', '') = ?
       LIMIT 1`,
      [SITE_CD, normalizedPhone],
    );
    const results = rows as Array<Record<string, unknown>>;
    if (results.length === 0) {
      return null;
    }
    return mapToFasEmployee(results[0]);
  } finally {
    await conn.end();
  }
}

/** Search FAS employees by name (partial match). */
export async function fasSearchEmployeeByName(
  hyperdrive: HyperdriveBinding,
  name: string,
): Promise<FasEmployee[]> {
  const conn = await getConnection(hyperdrive);
  try {
    const [rows] = await conn.query(
      `SELECT ${EMPLOYEE_SELECT} ${EMPLOYEE_FROM}
       WHERE e.site_cd = ? AND e.empl_nm LIKE ?`,
      [SITE_CD, `%${name}%`],
    );
    return (rows as Array<Record<string, unknown>>).map(mapToFasEmployee);
  } finally {
    await conn.end();
  }
}

function mapToFasEmployee(row: Record<string, unknown>): FasEmployee {
  const stateFlag = String(row["state_flag"] || "");
  return {
    emplCd: String(row["empl_cd"] || ""),
    name: String(row["empl_nm"] || ""),
    partCd: String(row["part_cd"] || ""),
    companyName: String(row["part_nm"] || ""),
    phone: String(row["tel_no"] || ""),
    socialNo: String(row["social_no"] || ""),
    gojoCd: String(row["gojo_cd"] || ""),
    jijoCd: String(row["jijo_cd"] || ""),
    careCd: String(row["care_cd"] || ""),
    roleCd: String(row["role_cd"] || ""),
    stateFlag,
    entrDay: String(row["entr_day"] || ""),
    retrDay: String(row["retr_day"] || ""),
    rfid: String(row["rfid"] || ""),
    violCnt: Number(row["viol_cnt"] || 0),
    updatedAt: row["update_dt"] instanceof Date ? row["update_dt"] : new Date(),
    isActive: stateFlag === "W",
  };
}

function mapToFasAttendance(row: Record<string, unknown>): FasAttendance {
  const inTime = row["in_time"];
  const outTime = row["out_time"];
  return {
    emplCd: String(row["empl_cd"] || ""),
    accsDay: String(row["accs_day"] || ""),
    inTime: inTime ? String(inTime) : null,
    outTime: outTime ? String(outTime) : null,
    state: Number(row["state"] || 0),
    partCd: String(row["part_cd"] || ""),
  };
}

/**
 * Test MariaDB connectivity via Hyperdrive
 */
export async function testConnection(
  hyperdrive: HyperdriveBinding,
): Promise<boolean> {
  try {
    const conn = await getConnection(hyperdrive);
    await conn.ping();
    await conn.end();
    return true;
  } catch {
    return false;
  }
}
