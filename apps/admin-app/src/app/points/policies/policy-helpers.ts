import type { CreatePolicyBody } from "@/hooks/use-api";

export function extractCreateData(
  formData: FormData,
  siteId: string,
): CreatePolicyBody {
  return {
    siteId,
    name: formData.get("name") as string,
    reasonCode: formData.get("reasonCode") as string,
    description: formData.get("description") as string,
    defaultAmount: Number(formData.get("defaultAmount")),
    minAmount: formData.get("minAmount")
      ? Number(formData.get("minAmount"))
      : undefined,
    maxAmount: formData.get("maxAmount")
      ? Number(formData.get("maxAmount"))
      : undefined,
    dailyLimit: formData.get("dailyLimit")
      ? Number(formData.get("dailyLimit"))
      : undefined,
    monthlyLimit: formData.get("monthlyLimit")
      ? Number(formData.get("monthlyLimit"))
      : undefined,
  };
}

export function extractUpdateData(formData: FormData) {
  return {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    defaultAmount: Number(formData.get("defaultAmount")),
    minAmount: formData.get("minAmount")
      ? Number(formData.get("minAmount"))
      : undefined,
    maxAmount: formData.get("maxAmount")
      ? Number(formData.get("maxAmount"))
      : undefined,
    dailyLimit: formData.get("dailyLimit")
      ? Number(formData.get("dailyLimit"))
      : undefined,
    monthlyLimit: formData.get("monthlyLimit")
      ? Number(formData.get("monthlyLimit"))
      : undefined,
    isActive: formData.get("isActive") === "on",
  };
}
