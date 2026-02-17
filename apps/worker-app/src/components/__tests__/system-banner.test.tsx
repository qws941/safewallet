import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SystemBanner } from "@/components/system-banner";

const mockUseSystemStatus = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useSystemStatus: () => mockUseSystemStatus(),
}));

describe("SystemBanner", () => {
  it("returns null when no data", () => {
    mockUseSystemStatus.mockReturnValue({ data: undefined });
    const { container } = render(<SystemBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when hasIssues is false", () => {
    mockUseSystemStatus.mockReturnValue({
      data: { data: { hasIssues: false, notices: [] } },
    });
    const { container } = render(<SystemBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders critical notice with correct styling", () => {
    mockUseSystemStatus.mockReturnValue({
      data: {
        data: {
          hasIssues: true,
          notices: [
            {
              type: "maintenance",
              severity: "critical",
              message: "Server down",
            },
          ],
        },
      },
    });
    render(<SystemBanner />);
    expect(screen.getByText("Server down")).toBeInTheDocument();
    const container = screen.getByText("Server down").closest("div");
    expect(container?.className).toContain("bg-red-50");
  });

  it("renders warning notice with correct styling", () => {
    mockUseSystemStatus.mockReturnValue({
      data: {
        data: {
          hasIssues: true,
          notices: [
            { type: "degraded", severity: "warning", message: "Slow response" },
          ],
        },
      },
    });
    render(<SystemBanner />);
    expect(screen.getByText("Slow response")).toBeInTheDocument();
    const container = screen.getByText("Slow response").closest("div");
    expect(container?.className).toContain("bg-amber-50");
  });

  it("renders info notice with correct styling", () => {
    mockUseSystemStatus.mockReturnValue({
      data: {
        data: {
          hasIssues: true,
          notices: [
            { type: "announcement", severity: "info", message: "New feature" },
          ],
        },
      },
    });
    render(<SystemBanner />);
    expect(screen.getByText("New feature")).toBeInTheDocument();
    const container = screen.getByText("New feature").closest("div");
    expect(container?.className).toContain("bg-blue-50");
  });

  it("renders multiple notices", () => {
    mockUseSystemStatus.mockReturnValue({
      data: {
        data: {
          hasIssues: true,
          notices: [
            { type: "maintenance", severity: "critical", message: "DB outage" },
            { type: "info", severity: "info", message: "Deploy scheduled" },
          ],
        },
      },
    });
    render(<SystemBanner />);
    expect(screen.getByText("DB outage")).toBeInTheDocument();
    expect(screen.getByText("Deploy scheduled")).toBeInTheDocument();
  });

  it("falls back to info style for unknown severity", () => {
    mockUseSystemStatus.mockReturnValue({
      data: {
        data: {
          hasIssues: true,
          notices: [
            {
              type: "custom",
              severity: "unknown" as "info",
              message: "Fallback test",
            },
          ],
        },
      },
    });
    render(<SystemBanner />);
    expect(screen.getByText("Fallback test")).toBeInTheDocument();
    const container = screen.getByText("Fallback test").closest("div");
    expect(container?.className).toContain("bg-blue-50");
  });
});
