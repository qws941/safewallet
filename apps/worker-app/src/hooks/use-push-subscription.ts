"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

interface VapidKeyResponse {
  success: boolean;
  data: { publicKey: string };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: false,
    error: null,
  });

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState((prev) => ({ ...prev, isSubscribed: !!subscription }));
    } catch {}
  }, []);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setState((prev) => ({ ...prev, isSupported: supported }));

    if (supported && isAuthenticated) {
      checkExistingSubscription();
    }
  }, [checkExistingSubscription, isAuthenticated]);

  const subscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "알림 권한이 거부되었습니다.",
        }));
        return false;
      }

      const vapidResponse = await apiFetch<VapidKeyResponse>(
        "/notifications/vapid-key",
      );
      if (!vapidResponse.data?.publicKey) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "푸시 알림 서비스를 사용할 수 없습니다.",
        }));
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidResponse.data.publicKey,
        ).buffer as ArrayBuffer,
      });

      const sub = subscription.toJSON();
      await apiFetch("/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys?.p256dh ?? "",
            auth: sub.keys?.auth ?? "",
          },
          userAgent: navigator.userAgent,
        }),
      });

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "푸시 알림 등록에 실패했습니다.";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiFetch(
          `/notifications/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`,
          { method: "DELETE" },
        );
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "푸시 알림 해제에 실패했습니다.";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      return false;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
