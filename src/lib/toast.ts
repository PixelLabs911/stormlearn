"use client";

import { useCallback, useEffect, useState } from "react";

export type ToastKind = "success" | "error" | "info";
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

let push: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(message: string, kind: ToastKind = "info") {
  if (push) push({ message, kind });
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    push = (t) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...t, id }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
    };
    return () => {
      push = null;
    };
  }, []);

  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, dismiss };
}
