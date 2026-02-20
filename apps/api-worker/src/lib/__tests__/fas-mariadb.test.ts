import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { HyperdriveBinding } from "../../types";

// Mock mysql2/promise
const mockQuery = vi.fn();
const mockPing = vi.fn().mockResolvedValue(undefined);
const mockEnd = vi.fn().mockResolvedValue(undefined);
const mockConnection = {
  query: mockQuery,
  ping: mockPing,
  end: mockEnd,
};

vi.mock("mysql2/promise", () => ({
  default: {
    createConnection: vi.fn().mockResolvedValue(mockConnection),
  },
}));

// Mock the validator to pass through
vi.mock("../../validators/fas-sync", () => ({
  FasGetUpdatedEmployeesParamsSchema: {
    parse: (v: unknown) => v,
  },
}));

const mockHyperdrive: HyperdriveBinding = {
  connectionString: "mysql://user:pass@localhost:3306/jeil_cmi",
  host: "localhost",
  port: 3306,
  user: "testuser",
  password: "testpass",
  database: "jeil_cmi",
};

function sampleEmployeeRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    empl_cd: "24000001",
    empl_nm: "김우현",
    part_cd: "P001",
    part_nm: "제일건설",
    tel_no: "01091865156",
    social_no: "6905281",
    gojo_cd: "G01",
    jijo_cd: "J01",
    care_cd: "C01",
    role_cd: "R01",
    state_flag: "W",
    entr_day: "20240101",
    retr_day: "",
    rfid: "RFID001",
    viol_cnt: 0,
    update_dt: new Date("2026-02-06T00:00:00Z"),
    ...overrides,
  };
}

function sampleAttendanceRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    empl_cd: "24000001",
    accs_day: "20260206",
    in_time: "0830",
    out_time: "1730",
    state: 0,
    part_cd: "P001",
    ...overrides,
  };
}

describe("fas-mariadb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mapToFasEmployee (tested via fasGetEmployeeInfo)", () => {
    it("maps a DB row to FasEmployee with isActive=true when state_flag is W", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "24000001");

      expect(result).not.toBeNull();
      expect(result?.emplCd).toBe("24000001");
      expect(result?.name).toBe("김우현");
      expect(result?.companyName).toBe("제일건설");
      expect(result?.phone).toBe("01091865156");
      expect(result?.isActive).toBe(true);
      expect(result?.stateFlag).toBe("W");
      expect(result?.violCnt).toBe(0);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it("maps isActive=false when state_flag is not W", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [sampleEmployeeRow({ state_flag: "R" })],
      ]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "24000001");

      expect(result?.isActive).toBe(false);
    });

    it("returns null when no rows found", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[]]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "NOTFOUND");

      expect(result).toBeNull();
    });

    it("defaults update_dt to new Date() when not a Date instance", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [sampleEmployeeRow({ update_dt: "not-a-date" })],
      ]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "24000001");

      expect(result?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("fasGetEmployeesBatch", () => {
    it("returns empty map for empty input", async () => {
      const { fasGetEmployeesBatch } = await import("../fas-mariadb");

      const result = await fasGetEmployeesBatch(mockHyperdrive, []);

      expect(result.size).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("returns map of employees keyed by emplCd", async () => {
      const { fasGetEmployeesBatch } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [
          sampleEmployeeRow({ empl_cd: "001" }),
          sampleEmployeeRow({ empl_cd: "002" }),
        ],
      ]);

      const result = await fasGetEmployeesBatch(mockHyperdrive, ["001", "002"]);

      expect(result.size).toBe(2);
      expect(result.get("001")?.emplCd).toBe("001");
      expect(result.get("002")?.emplCd).toBe("002");
    });
  });

  describe("fasGetUpdatedEmployees", () => {
    it("queries all employees when sinceTimestamp is null", async () => {
      const { fasGetUpdatedEmployees } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      const result = await fasGetUpdatedEmployees(mockHyperdrive, null);

      expect(result).toHaveLength(1);
      // Should NOT include timestamp filter
      const queryStr = mockQuery.mock.calls[0][0] as string;
      expect(queryStr).not.toContain("update_dt >");
    });

    it("queries with timestamp filter when sinceTimestamp provided", async () => {
      const { fasGetUpdatedEmployees } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      await fasGetUpdatedEmployees(mockHyperdrive, "2026-02-01 00:00:00");

      const queryStr = mockQuery.mock.calls[0][0] as string;
      expect(queryStr).toContain("update_dt >");
    });
  });

  describe("fasGetAllEmployeesPaginated", () => {
    it("returns employees and total count", async () => {
      const { fasGetAllEmployeesPaginated } = await import("../fas-mariadb");
      // First call: COUNT
      mockQuery.mockResolvedValueOnce([[{ cnt: 100 }]]);
      // Second call: actual rows
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      const result = await fasGetAllEmployeesPaginated(mockHyperdrive, 0, 10);

      expect(result.total).toBe(100);
      expect(result.employees).toHaveLength(1);
    });
  });

  describe("fasGetDailyAttendance", () => {
    it("maps attendance rows correctly", async () => {
      const { fasGetDailyAttendance } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [
          sampleAttendanceRow(),
          sampleAttendanceRow({ in_time: null, out_time: null }),
        ],
      ]);

      const result = await fasGetDailyAttendance(mockHyperdrive, "20260206");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        emplCd: "24000001",
        accsDay: "20260206",
        inTime: "0830",
        outTime: "1730",
        state: 0,
        partCd: "P001",
      });
      expect(result[1].inTime).toBeNull();
      expect(result[1].outTime).toBeNull();

      const queryStr = mockQuery.mock.calls[0][0] as string;
      const params = mockQuery.mock.calls[0][1] as string[];
      expect(queryStr).toContain("WHERE ad.accs_day = ?");
      expect(queryStr).not.toContain("ad.site_cd = ?");
      expect(params).toEqual(["20260206"]);
    });
  });

  describe("fasSearchEmployeeByPhone", () => {
    it("normalizes phone number by removing dashes", async () => {
      const { fasSearchEmployeeByPhone } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      await fasSearchEmployeeByPhone(mockHyperdrive, "010-9186-5156");

      const params = mockQuery.mock.calls[0][1] as string[];
      expect(params).toContain("01091865156");
    });

    it("returns null when no match", async () => {
      const { fasSearchEmployeeByPhone } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[]]);

      const result = await fasSearchEmployeeByPhone(
        mockHyperdrive,
        "01000000000",
      );

      expect(result).toBeNull();
    });
  });

  describe("fasSearchEmployeeByName", () => {
    it("returns matching employees by name", async () => {
      const { fasSearchEmployeeByName } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [sampleEmployeeRow(), sampleEmployeeRow({ empl_cd: "002" })],
      ]);

      const result = await fasSearchEmployeeByName(mockHyperdrive, "김");

      expect(result).toHaveLength(2);
      const params = mockQuery.mock.calls[0][1] as string[];
      expect(params).toContain("%김%");
    });
  });

  describe("cleanupExpiredConnections", () => {
    it("is exported and callable", async () => {
      const { cleanupExpiredConnections } = await import("../fas-mariadb");
      expect(typeof cleanupExpiredConnections).toBe("function");
      // Should not throw when called
      cleanupExpiredConnections();
    });
  });

  describe("testConnection", () => {
    it("returns true when ping succeeds", async () => {
      const { testConnection } = await import("../fas-mariadb");
      mockPing.mockResolvedValue(undefined);

      const result = await testConnection(mockHyperdrive);

      expect(result).toBe(true);
    });

    it("returns false when connection fails", async () => {
      const { testConnection } = await import("../fas-mariadb");
      // Force ping to fail (cached connection is reused, so createConnection won't be called)
      mockPing.mockRejectedValueOnce(new Error("Connection lost"));
      // After cache miss, also fail createConnection
      const mysql = await import("mysql2/promise");
      (
        mysql.default.createConnection as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await testConnection(mockHyperdrive);

      expect(result).toBe(false);
    });
  });
});
