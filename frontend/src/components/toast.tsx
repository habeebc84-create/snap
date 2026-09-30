import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3.5 text-sm shadow-soft backdrop-blur-xl animate-fade-up",
              toast.kind === "success" &&
                "border-emerald-500/25 bg-emerald-50/90 text-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100",
              toast.kind === "error" &&
                "border-rose-500/25 bg-rose-50/90 text-rose-900 dark:bg-rose-950/90 dark:text-rose-100",
              toast.kind === "info" &&
                "border-border bg-card/90 text-foreground",
            )}
            role="status"
          >
            {toast.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            {toast.kind === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            {toast.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 opacity-60 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
