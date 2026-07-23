"use client";

import * as React from "react";
import { IconAlertTriangle, IconCheck, IconInfoCircle } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * App-wide, dependency-free toast surface. Toasts render above sheets/dialogs
 * (z-[200]) so save/delete/error feedback is visible even with a form open.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = React.useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 p-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toneStyles: Record<ToastTone, { icon: typeof IconCheck; className: string }> = {
  success: { icon: IconCheck, className: "text-pos" },
  error: { icon: IconAlertTriangle, className: "text-destructive" },
  info: { icon: IconInfoCircle, className: "text-muted-foreground" },
};

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { icon: Icon, className } = toneStyles[toast.tone];
  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-border/60 bg-card px-4 py-3 text-left text-sm shadow-lg",
        "animate-in slide-in-from-bottom-2 fade-in-0",
      )}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />
      <span className="text-foreground">{toast.message}</span>
    </button>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
