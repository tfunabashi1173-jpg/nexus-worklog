"use client";

import { useEffect, useState } from "react";

type AutoDismissAlertProps = {
  message: string;
  tone?: "success" | "error";
  durationMs?: number;
};

export default function AutoDismissAlert({
  message,
  tone = "success",
  durationMs = 4000,
}: AutoDismissAlertProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timeoutId = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(timeoutId);
  }, [message, durationMs]);

  if (!visible) {
    return null;
  }

  const baseClass = "rounded border px-4 py-2 text-sm";
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <div className={`${baseClass} ${toneClass}`}>{message}</div>;
}
