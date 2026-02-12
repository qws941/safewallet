"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiFetch } from "./use-api-base";

export interface Site {
  id: string;
  name: string;
  active: boolean;
  joinEnabled?: boolean;
  createdAt: string;
  memberCount?: number;
}

export function useSite(siteId?: string) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["site", targetSiteId],
    queryFn: async () => {
      const response = await apiFetch<{ site: Site }>(`/sites/${targetSiteId}`);
      return response.site;
    },
    enabled: !!targetSiteId,
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      siteId,
      data,
    }: {
      siteId: string;
      data: { name?: string; active?: boolean };
    }) =>
      apiFetch<{ site: Site }>(`/sites/${siteId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["site", variables.siteId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "my-sites"] });
    },
  });
}
