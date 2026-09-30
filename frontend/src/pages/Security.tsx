import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Database,
  FileX2,
  HardDrive,
  History,
  Lock,
  ServerOff,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Switch,
} from "../components/ui";
import { useSecurityStatus, useAuditLogs, useSettings, useUpdateSettings } from "../hooks/useApi";
import { useToast } from "../components/toast";
import { cn, formatBytes, formatDateTime } from "../lib/utils";

function StatusRow({
  ok,
  label,
  description,
  icon,
}: {
  ok: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3.5">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          ok ? "bg-emerald-500/12 text-emerald-600" : "bg-rose-500/12 text-rose-600",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {label}
          {ok ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Enabled
            </Badge>
          ) : (
            <Badge variant="danger">Off</Badge>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function PrivacyToggle({
  label,
  description,
  checked,
  onChange,
  consent,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  consent?: boolean;
}) {
  const [pending, setPending] = useState(false);

  const handle = (next: boolean) => {
    if (next && consent) {
      const ok = window.confirm(
        `${label} would send data outside this device.\n\nEnable it only if you explicitly consent. It stays disabled by default.`,
      );
      if (!ok) return;
    }
    setPending(true);
    onChange(next);
    window.setTimeout(() => setPending(false), 400);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/40 p-3.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            checked ? "text-amber-600" : "text-emerald-600",
          )}
        >
          {checked ? "On" : "Off"}
        </span>
        <Switch checked={checked} onCheckedChange={handle} disabled={pending} aria-label={label} />
      </div>
    </div>
  );
}

function StorageBar({ bytes, label, total }: { bytes: number; label: string; total: number }) {
  const share = total > 0 ? (bytes / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{formatBytes(bytes)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/80" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

export default function Security() {
  const status = useSecurityStatus();
  const settings = useSettings();
  const update = useUpdateSettings();
  const audit = useAuditLogs({ limit: 30 });
  const toast = useToast();

  const setPrivacy = (key: "cloud_processing" | "telemetry" | "anonymous_analytics", next: boolean) => {
    update.mutate(
      { [key]: next, consent: true },
      {
        onSuccess: () =>
          toast.push(
            next
              ? `${key.replace(/_/g, " ")} enabled with your explicit consent.`
              : `${key.replace(/_/g, " ")} disabled.`,
            "success",
          ),
        onError: (error) => toast.push(error.message, "error"),
      },
    );
  };

  const storage = status.data?.storage;
  const total = storage?.total_bytes || 1;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Security Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live status of the privacy guarantees this application enforces.
        </p>
      </div>

      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Security status
          </CardTitle>
          <CardDescription>Verified against the running local service</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {status.isLoading ? (
            [0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-20" />)
          ) : (
            <>
              <StatusRow
                ok={status.data?.local_processing ?? false}
                label="Local processing"
                description="OCR, classification and extraction run on this device."
                icon={<Lock className="h-4 w-4" aria-hidden="true" />}
              />
              <StatusRow
                ok={status.data?.no_cloud_upload ?? false}
                label="No cloud upload"
                description="Documents are never sent to external services."
                icon={<ServerOff className="h-4 w-4" aria-hidden="true" />}
              />
              <StatusRow
                ok={status.data?.local_database ?? false}
                label="Local database"
                description={`SQLite file stored at ${status.data?.database_path ?? "data/securedoc.db"}.`}
                icon={<Database className="h-4 w-4" aria-hidden="true" />}
              />
              <StatusRow
                ok={status.data?.audit_logging ?? false}
                label="Audit logging"
                description="Actions recorded without document contents."
                icon={<History className="h-4 w-4" aria-hidden="true" />}
              />
              <StatusRow
                ok={status.data?.document_deletion ?? false}
                label="Document deletion"
                description="Permanent deletion including OCR text is available."
                icon={<FileX2 className="h-4 w-4" aria-hidden="true" />}
              />
              <StatusRow
                ok={status.data?.offline_mode ?? false}
                label="Offline mode"
                description="Core workflows function with no internet connection."
                icon={<WifiOff className="h-4 w-4" aria-hidden="true" />}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Storage + privacy */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" aria-hidden="true" /> Storage
            </CardTitle>
            <CardDescription>All data lives in the local workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <StorageBar bytes={storage?.documents_bytes ?? 0} label="Documents" total={total} />
                <StorageBar bytes={storage?.database_bytes ?? 0} label="Database" total={total} />
                <StorageBar bytes={storage?.processed_bytes ?? 0} label="Page images" total={total} />
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3.5 py-3 text-sm">
                  <span className="text-muted-foreground">Total used</span>
                  <span className="font-semibold tabular-nums">
                    {formatBytes(storage?.total_bytes ?? 0)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground break-all">
                  Documents: {status.data?.document_storage_path}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>
              External processing is disabled by default and requires explicit consent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.isLoading ? (
              <Skeleton className="h-44" />
            ) : (
              <>
                <PrivacyToggle
                  label="Cloud processing"
                  description="Off — documents stay on this device."
                  checked={settings.data?.cloud_processing ?? false}
                  onChange={(next) => setPrivacy("cloud_processing", next)}
                  consent
                />
                <PrivacyToggle
                  label="Telemetry"
                  description="Off — no usage data leaves the app."
                  checked={settings.data?.telemetry ?? false}
                  onChange={(next) => setPrivacy("telemetry", next)}
                  consent
                />
                <PrivacyToggle
                  label="Anonymous analytics"
                  description="Off — dashboard stats are computed locally."
                  checked={settings.data?.anonymous_analytics ?? false}
                  onChange={(next) => setPrivacy("anonymous_analytics", next)}
                  consent
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" /> Audit log
          </CardTitle>
          <CardDescription>
            Action-level history — never contains document contents or field values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {audit.isLoading && <Skeleton className="h-40" />}
          {audit.isSuccess && audit.data.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          )}
          {audit.data && audit.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-2 py-2 font-semibold">Action</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Detail</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Entity</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/40">
                      <td className="px-2 py-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{entry.detail || "—"}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {entry.entity_type ? `${entry.entity_type}:${entry.entity_id.slice(0, 8)}` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right text-xs text-muted-foreground">
                        {formatDateTime(entry.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
