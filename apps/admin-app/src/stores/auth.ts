import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UserRole } from "@safetywallet/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface User {
  id: string;
  phone: string;
  nameMasked: string;
  role: UserRole;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  currentSiteId: string | null;
  isAdmin: boolean;
  _hasHydrated: boolean;
  login: (user: User, tokens: Tokens) => void;
  logout: () => void;
  setTokens: (tokens: Tokens) => void;
  setSiteId: (siteId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      currentSiteId: null,
      isAdmin: false,
      _hasHydrated: false,
      login: (user, tokens) =>
        set({
          user,
          tokens,
          isAdmin:
            user.role === UserRole.SITE_ADMIN ||
            user.role === UserRole.SUPER_ADMIN,
        }),
      logout: () => {
        const { tokens: currentTokens } = get();
        if (currentTokens?.refreshToken) {
          fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: currentTokens.refreshToken }),
          }).catch(() => {});
        }
        set({
          user: null,
          tokens: null,
          currentSiteId: null,
          isAdmin: false,
        });
      },
      setTokens: (tokens) => set({ tokens }),
      setSiteId: (siteId) => set({ currentSiteId: siteId }),
    }),
    {
      name: "safetywallet-admin-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        currentSiteId: state.currentSiteId,
        isAdmin: state.isAdmin,
      }),
    },
  ),
);

// onRehydrateStorage callback fails silently in CF Pages static exports
if (typeof window !== "undefined") {
  useAuthStore.persist.onFinishHydration(() => {
    useAuthStore.setState({ _hasHydrated: true });
  });
  if (useAuthStore.persist.hasHydrated()) {
    useAuthStore.setState({ _hasHydrated: true });
  }
}
