import { describe, expect, it, vi, beforeEach } from "vitest";

let mockRows: unknown[][] = [];
let mockStepIndex = 0;

const mockStatement = {
  step: vi.fn(),
  get: vi.fn(),
  free: vi.fn(),
};

const mockDb = {
  prepare: vi.fn(),
  exec: vi.fn(),
  close: vi.fn(),
};

function MockDatabase() {
  return mockDb;
}

vi.mock("sql.js/dist/sql-asm.js", () => ({
  default: () => Promise.resolve({ Database: MockDatabase }),
}));

describe("aceviewer-parser", () => {
  beforeEach(() => {
    mockRows = [];
    mockStepIndex = 0;
    mockStatement.step.mockClear().mockImplementation(() => {
      if (mockStepIndex < mockRows.length) {
        mockStepIndex++;
        return true;
      }
      return false;
    });
    mockStatement.get
      .mockClear()
      .mockImplementation(() => mockRows[mockStepIndex - 1]);
    mockStatement.free.mockClear();
    mockDb.prepare.mockClear().mockReturnValue(mockStatement);
    mockDb.exec.mockClear().mockReturnValue([]);
    mockDb.close.mockClear();
  });

  describe("parseAceViewerDb", () => {
    it("parses employee records with string values", async () => {
      const { parseAceViewerDb } = await import("../aceviewer-parser");
      mockRows = [
        [
          "25000001",
          "Kim",
          "CompanyA",
          "Manager",
          "Rebar",
          "2026-02-06 07:32:49",
        ],
        ["25000002", "Lee", null, null, null, null],
      ];

      const result = await parseAceViewerDb(new Uint8Array([1, 2, 3]));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        externalWorkerId: "25000001",
        name: "Kim",
        companyName: "CompanyA",
        position: "Manager",
        trade: "Rebar",
        lastSeen: "2026-02-06 07:32:49",
      });
      expect(result[1]).toEqual({
        externalWorkerId: "25000002",
        name: "Lee",
        companyName: null,
        position: null,
        trade: null,
        lastSeen: null,
      });
    });

    it("decodes Uint8Array values using EUC-KR", async () => {
      const { parseAceViewerDb } = await import("../aceviewer-parser");
      // EUC-KR bytes for "김" (0xB1, 0xE8)
      const koreanBytes = new Uint8Array([0xb1, 0xe8]);
      mockRows = [["001", koreanBytes, null, null, null, null]];

      const result = await parseAceViewerDb(new Uint8Array([]));

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("김");
    });

    it("skips rows with null empl_cd or empl_nm", async () => {
      const { parseAceViewerDb } = await import("../aceviewer-parser");
      mockRows = [
        [null, "Name", null, null, null, null],
        ["001", null, null, null, null, null],
        ["002", "Valid", null, null, null, null],
      ];

      const result = await parseAceViewerDb(new Uint8Array([]));

      expect(result).toHaveLength(1);
      expect(result[0].externalWorkerId).toBe("002");
    });

    it("always closes the database", async () => {
      const { parseAceViewerDb } = await import("../aceviewer-parser");
      mockRows = [];

      await parseAceViewerDb(new Uint8Array([]));

      expect(mockDb.close).toHaveBeenCalled();
    });

    it("closes database even on error", async () => {
      const { parseAceViewerDb } = await import("../aceviewer-parser");
      (mockDb.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("SQL error");
      });

      await expect(parseAceViewerDb(new Uint8Array([]))).rejects.toThrow(
        "SQL error",
      );
      expect(mockDb.close).toHaveBeenCalled();
    });

    it("converts numeric and other types via String()", async () => {
      const { parseAceViewerDb } = await import("../aceviewer-parser");
      mockRows = [[12345, 67890, null, null, null, null]];

      const result = await parseAceViewerDb(new Uint8Array([]));

      expect(result).toHaveLength(1);
      expect(result[0].externalWorkerId).toBe("12345");
      expect(result[0].name).toBe("67890");
    });
  });

  describe("getAceViewerStats", () => {
    it("returns stats with count, companies, and lastSync", async () => {
      const { getAceViewerStats } = await import("../aceviewer-parser");
      (mockDb.exec as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce([{ values: [[42]] }]) // COUNT
        .mockReturnValueOnce([{ values: [["CompA"], ["CompB"]] }]) // DISTINCT companies
        .mockReturnValueOnce([{ values: [["2026-02-06 08:00:00"]] }]); // MAX last_dt

      const result = await getAceViewerStats(new Uint8Array([]));

      expect(result).toEqual({
        totalEmployees: 42,
        companies: ["CompA", "CompB"],
        lastSync: "2026-02-06 08:00:00",
      });
    });

    it("returns defaults when database is empty", async () => {
      const { getAceViewerStats } = await import("../aceviewer-parser");
      (mockDb.exec as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce([{ values: [[0]] }])
        .mockReturnValueOnce([]) // no companies
        .mockReturnValueOnce([{ values: [[null]] }]); // no last_dt

      const result = await getAceViewerStats(new Uint8Array([]));

      expect(result).toEqual({
        totalEmployees: 0,
        companies: [],
        lastSync: null,
      });
    });

    it("always closes the database", async () => {
      const { getAceViewerStats } = await import("../aceviewer-parser");
      (mockDb.exec as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce([{ values: [[0]] }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ values: [[null]] }]);

      await getAceViewerStats(new Uint8Array([]));

      expect(mockDb.close).toHaveBeenCalled();
    });

    it("decodes EUC-KR company names", async () => {
      const { getAceViewerStats } = await import("../aceviewer-parser");
      const eucKrBytes = new Uint8Array([0xb9, 0xcc, 0xb7, 0xa1]); // "미래" in EUC-KR
      (mockDb.exec as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce([{ values: [[1]] }])
        .mockReturnValueOnce([{ values: [[eucKrBytes]] }])
        .mockReturnValueOnce([{ values: [[null]] }]);

      const result = await getAceViewerStats(new Uint8Array([]));

      expect(result.companies).toHaveLength(1);
      expect(result.companies[0]).toBe("미래");
    });
  });
});
