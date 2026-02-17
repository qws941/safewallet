import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createMockKV } from "../../__tests__/helpers";

type KVMock = ReturnType<typeof createMockKV>;

interface StatusResponse {
  success: boolean;
  data: {
    notices: Array<{
      type: string;
      message: string;
      severity: string;
    }>;
    hasIssues: boolean;
  };
  timestamp: string;
}

let kv: KVMock;

function buildApp() {
  const app = new Hono<{ Bindings: { KV: KVMock } }>();

  app.get("/api/system/status", async (c) => {
    const notices: Array<{
      type: "fas_down" | "maintenance" | "info";
      message: string;
      severity: "warning" | "critical" | "info";
    }> = [];

    try {
      const [fasStatus, maintenanceMessage] = await Promise.all([
        c.env.KV.get("fas-status"),
        c.env.KV.get("maintenance-message"),
      ]);

      if (fasStatus === "down") {
        notices.push({
          type: "fas_down",
          message:
            "출퇴근 시스템(FAS)에 일시적인 장애가 발생했습니다. 출근 확인 없이 일부 기능을 이용하실 수 있습니다.",
          severity: "warning",
        });
      }

      if (maintenanceMessage) {
        try {
          const parsed = JSON.parse(maintenanceMessage) as {
            message: string;
            severity?: "warning" | "critical" | "info";
          };
          notices.push({
            type: "maintenance",
            message: parsed.message,
            severity: parsed.severity ?? "info",
          });
        } catch {
          notices.push({
            type: "maintenance",
            message: maintenanceMessage,
            severity: "info",
          });
        }
      }
    } catch {
      /* empty — graceful degradation */
    }

    return c.json({
      success: true,
      data: { notices, hasIssues: notices.length > 0 },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

describe("GET /api/system/status", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    kv = createMockKV();
    app = buildApp();
  });

  async function req(): Promise<{ status: number; body: StatusResponse }> {
    const res = await app.request("/api/system/status", {}, { KV: kv });
    const body = (await res.json()) as StatusResponse;
    return { status: res.status, body };
  }

  it("returns empty notices when system is healthy", async () => {
    const { status, body } = await req();
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.notices).toEqual([]);
    expect(body.data.hasIssues).toBe(false);
  });

  it("returns fas_down notice when FAS is down", async () => {
    await kv.put("fas-status", "down");
    const { body } = await req();
    expect(body.data.hasIssues).toBe(true);
    expect(body.data.notices).toHaveLength(1);
    expect(body.data.notices[0].type).toBe("fas_down");
    expect(body.data.notices[0].severity).toBe("warning");
  });

  it("returns maintenance notice from JSON payload", async () => {
    await kv.put(
      "maintenance-message",
      JSON.stringify({ message: "점검 중입니다", severity: "critical" }),
    );
    const { body } = await req();
    expect(body.data.hasIssues).toBe(true);
    expect(body.data.notices).toHaveLength(1);
    expect(body.data.notices[0].type).toBe("maintenance");
    expect(body.data.notices[0].message).toBe("점검 중입니다");
    expect(body.data.notices[0].severity).toBe("critical");
  });

  it("returns maintenance notice from plain string", async () => {
    await kv.put("maintenance-message", "시스템 업데이트 예정");
    const { body } = await req();
    expect(body.data.notices[0].message).toBe("시스템 업데이트 예정");
    expect(body.data.notices[0].severity).toBe("info");
  });

  it("returns both notices when FAS down and maintenance active", async () => {
    await kv.put("fas-status", "down");
    await kv.put(
      "maintenance-message",
      JSON.stringify({ message: "서버 점검", severity: "warning" }),
    );
    const { body } = await req();
    expect(body.data.notices).toHaveLength(2);
    expect(body.data.notices[0].type).toBe("fas_down");
    expect(body.data.notices[1].type).toBe("maintenance");
    expect(body.data.hasIssues).toBe(true);
  });

  it("handles KV read failure gracefully", async () => {
    kv.get.mockRejectedValueOnce(new Error("KV unavailable"));
    const { status, body } = await req();
    expect(status).toBe(200);
    expect(body.data.notices).toEqual([]);
    expect(body.data.hasIssues).toBe(false);
  });

  it("defaults maintenance severity to info when not specified", async () => {
    await kv.put("maintenance-message", JSON.stringify({ message: "알림" }));
    const { body } = await req();
    expect(body.data.notices[0].severity).toBe("info");
  });
});
