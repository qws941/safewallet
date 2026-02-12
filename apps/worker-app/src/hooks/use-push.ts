import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID key from backend
      const response = await apiFetch<{
        success: boolean;
        data: { publicKey: string };
      }>("/notifications/vapid-key");
      const convertedVapidKey = urlBase64ToUint8Array(response.data.publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // Send subscription to backend
      await apiFetch("/notifications/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Failed to subscribe:", err);
      setError(err instanceof Error ? err : new Error("Failed to subscribe"));
      // Check permission state
      if (Notification.permission === "denied") {
        alert("알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error("Failed to unsubscribe:", err);
      setError(err instanceof Error ? err : new Error("Failed to unsubscribe"));
    } finally {
      setLoading(false);
    }
  };

  return { isSubscribed, subscribe, unsubscribe, loading, error };
}
