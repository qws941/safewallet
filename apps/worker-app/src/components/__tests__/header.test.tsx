import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/header";
import { useAuth } from "@/hooks/use-auth";

vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock("@/components/locale-switcher", () => ({
  LocaleSwitcher: () => <div>locale-switcher</div>,
}));
vi.mock("@/components/system-banner", () => ({
  SystemBanner: () => null,
}));

describe("Header", () => {
  it("shows app title and locale switcher", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      currentSiteId: null,
      _hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    render(<Header />);

    expect(screen.getByText("components.appTitle")).toBeInTheDocument();
    expect(screen.getByText("locale-switcher")).toBeInTheDocument();
    expect(
      screen.queryByText(/components.siteIdLabel/),
    ).not.toBeInTheDocument();
  });

  it("shows truncated site id when currentSiteId exists", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      currentSiteId: "1234567890abcdef",
      _hasHydrated: true,
      login: vi.fn(),
      logout: vi.fn(),
      setCurrentSite: vi.fn(),
    });

    render(<Header />);

    expect(
      screen.getByText("components.siteIdLabel 12345678"),
    ).toBeInTheDocument();
  });
});
