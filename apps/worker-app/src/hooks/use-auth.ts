"use client";

import { useAuthStore } from "@/stores/auth";

export function useAuth() {
  const {
    user,
    isAuthenticated,
    currentSiteId,
    _hasHydrated,
    login,
    logout,
    setCurrentSite,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    currentSiteId,
    _hasHydrated,
    login,
    logout,
    setCurrentSite,
  };
}
