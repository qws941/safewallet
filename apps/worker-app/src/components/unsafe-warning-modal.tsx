"use client";

import { useTranslation } from "@/hooks/use-translation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@safetywallet/ui";

interface UnsafeWarningModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsafeWarningModal({
  open,
  onConfirm,
  onCancel,
}: UnsafeWarningModalProps) {
  const t = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("components.unsafeWarningTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{t("components.unsafeWarningImprovementNote")}</p>
            <p>{t("components.unsafeWarningPrivacyNote")}</p>
            <p className="text-sm text-muted-foreground">
              {t("components.unsafeWarningAdminNote")}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("components.unsafeWarningConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
