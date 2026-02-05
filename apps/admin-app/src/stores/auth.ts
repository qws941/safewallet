import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole } from '@safetywallet/types';

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
      login: (user, tokens) =>
        set({
          user,
          tokens,
          isAdmin:
            user.role === UserRole.SITE_ADMIN ||
            user.role === UserRole.SUPER_ADMIN,
        }),
      logout: () =>
        set({
          user: null,
          tokens: null,
          currentSiteId: null,
          isAdmin: false,
        }),
      setTokens: (tokens) => set({ tokens }),
      setSiteId: (siteId) => set({ currentSiteId: siteId }),
    }),
    {
      name: 'safetywallet-admin-auth',
    }
  )
);
