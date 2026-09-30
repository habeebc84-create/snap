import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileQuestion,
  Loader2,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { DocumentStatus, DocumentSummary } from "../types";
import { ACTIVE_STATUSES } from "../types";
import { Badge, Button, Card, Progress } from "./ui";
import { cn, confidenceLabel } from "../lib/utils";

// ------------------------------------------------------- local status pill
export function LocalStatusPill({ offline = false }: { offline?: boolean }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5"
      role="status"
      aria-live="polite"
    >        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 animate-pulse-dot rounded-full bg-emerald-500" />
        </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
        {offline ? "Offline mode active" : "Local processing"}
      </span>
      {!offline && (
        <span className="hidden text-[11px] text-emerald-700/70 dark:text-emerald-400/70 sm:inline">
          · on this device
        </span>
      )}
    </div>
  );
}

export function SecurePill() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
      <Lock className="h-3 w-3" aria-hidden="true" />
      <span className="tracking-wide">LOCAL · SECURE</span>
    </div>
  );
}

// ------------------------------------------------------------ status badge
const STATUS_META: Record<DocumentStatus, { label: string; variant: "success" | "warning" | "danger" | "info" | "default" | "outline" }> = {
  uploaded: { label: "Uploaded", variant: "outline" },
  queued: { label: "Queued", variant: "info" },
  preprocessing: { label: "Preprocessing", variant: "info" },
  ocr: { label: "Running OCR", variant: "info" },
  classifying: { label: "Classifying", variant: "info" },
  extracting: { label: "Extracting fields", variant: "info" },
  validating: { label: "Validating", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  needs_review: { label: "Needs review", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const meta = STATUS_META[status] ?? { label: status, variant: "outline" as const };
  const active = ACTIVE_STATUSES.includes(status);
  return (
    <Badge variant={meta.variant}>
      {active && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {meta.label}
    </Badge>
  );
}

const TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  purchase_order: "Purchase order",
  contract: "Contract",
  form: "Form",
  other: "Other",
  unclassified: "Unclassified",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="capitalize">
      {TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

// -------------------------------------------------------- confidence bar
export function ConfidenceBar({
  value,
  label = true,
  high = 0.9,
  medium = 0.75,
  className,
}: {
  value: number;
  label?: boolean;
  high?: number;
  medium?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const percent = Math.round(clamped * 100);
  const band = value >= high ? "high" : value >= medium ? "medium" : "review";
  const color =
    band === "high"
      ? "bg-emerald-500"
      : band === "medium"
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`AI confidence ${percent}%`}
        className="h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${percent}%` }} />
      </div>
      {label && (
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{percent}%</span>
      )}
    </div>
  );
}

export function ConfidenceRing({ value, size = 84 }: { value: number; size?: number }) {
  const percent = Math.round(value * 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 90 ? "#10b981" : percent >= 75 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={`AI confidence ${percent}%`}>
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-semibold tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ pipeline
const STAGES: { key: DocumentStatus; label: string }[] = [
  { key: "uploaded", label: "File validated" },
  { key: "preprocessing", label: "Image preprocessing" },
  { key: "ocr", label: "OCR extraction" },
  { key: "classifying", label: "Identifying document" },
  { key: "extracting", label: "Extracting fields" },
  { key: "validating", label: "Validating data" },
  { key: "completed", label: "Completed" },
];

export function PipelineStages({ status, errorMessage }: { status: DocumentStatus; errorMessage?: string | null }) {
  const failed = status === "failed";
  const terminal = status === "completed" || status === "needs_review";
  const currentIndex = STAGES.findIndex((stage) => stage.key === status);

  return (
    <ol className="space-y-2.5" aria-label="Processing pipeline">
      {STAGES.map((stage, index) => {
        const done = failed ? index < Math.max(currentIndex, 0) || terminal : terminal || index < currentIndex;
        const current = !failed && !terminal && index === currentIndex;
        return (
          <li key={stage.key} className="flex items-center gap-3 text-sm">
            <span aria-hidden="true">
              {failed && index === Math.max(currentIndex, 0) ? (
                <XCircle className="h-4 w-4 text-rose-500" />
              ) : done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : current ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40" />
              )}
            </span>
            <span
              className={cn(
                done ? "text-foreground" : current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {stage.label}
            </span>
            <span className="sr-only">
              {done ? "(done)" : current ? "(in progress)" : "(pending)"}
            </span>
          </li>
        );
      })}
      {failed && errorMessage && (
        <li className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </li>
      )}
    </ol>
  );
}

// ------------------------------------------------------- empty / error state
export function EmptyState({
  title,
  description,
  children,
  icon,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center animate-fade-up">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        {icon ?? <FileQuestion className="h-6 w-6" aria-hidden="true" />}
      </div>
      <div className="space-y-1.5">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Your files are processed locally.
      </p>
    </Card>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="flex flex-col items-center gap-4 border-rose-500/25 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry}>
            Try again <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </Card>
  );
}

// --------------------------------------------------------- document row
export function DocumentRow({ document }: { document: DocumentSummary }) {
  return (
    <Link
      to={`/documents/${document.id}`}
      className="group flex items-center justify-between gap-4 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border/70 hover:bg-card/70"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{document.filename}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(document.created_at).toLocaleString()} · {document.page_count || 1} page
          {(document.page_count || 1) > 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs font-medium tabular-nums text-muted-foreground sm:block">
          {Math.round(document.overall_confidence * 100)}%
        </span>
        <StatusBadge status={document.status} />
      </div>
    </Link>
  );
}

export function ConfidenceSummary({
  value,
  high = 0.9,
  medium = 0.75,
}: {
  value: number;
  high?: number;
  medium?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">AI confidence</span>
        <span className="text-sm font-semibold tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <Progress
        value={value * 100}
        barClassName={value >= high ? "bg-emerald-500" : value >= medium ? "bg-amber-500" : "bg-rose-500"}
      />
      <p className="text-[11px] text-muted-foreground">{confidenceLabel(value, medium, high)} — not a guarantee of correctness.</p>
    </div>
  );
}
