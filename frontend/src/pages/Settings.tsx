import { useEffect, useState } from "react";
import { Cpu, HardDrive, Moon, Save, Server, Sun, SunMoon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Skeleton,
  Switch,
} from "../components/ui";
import { useModels, useSettings, useUpdateSettings } from "../hooks/useApi";
import { useToast } from "../components/toast";
import type { AppSettings } from "../types";
import { cn } from "../lib/utils";

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/40 p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const THEME_OPTIONS: { key: AppSettings["theme"]; label: string; icon: React.ReactNode }[] = [
  { key: "light", label: "Light", icon: <Sun className="h-4 w-4" aria-hidden="true" /> },
  { key: "dark", label: "Dark", icon: <Moon className="h-4 w-4" aria-hidden="true" /> },
  { key: "system", label: "System", icon: <SunMoon className="h-4 w-4" aria-hidden="true" /> },
];

function applyTheme(theme: AppSettings["theme"]) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("securedoc.theme", theme);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

export default function Settings() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const models = useModels();
  const toast = useToast();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data && !form) {
      setForm(settings.data);
      applyTheme(settings.data.theme);
    }
  }, [settings.data, form]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
    if (key === "theme") applyTheme(value as AppSettings["theme"]);
  };

  const save = () => {
    if (!form) return;
    update.mutate(form, {
      onSuccess: () => {
        setDirty(false);
        toast.push("Settings saved to the local database.", "success");
      },
      onError: (error) => toast.push(error.message, "error"),
    });
  };

  if (settings.isLoading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const thresholdPercent = Math.round(form.confidence_threshold * 100);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stored locally in the settings table. No account, no sync.
          </p>
        </div>
        <Button onClick={save} disabled={update.isPending || !dirty}>
          {update.isPending ? (
            <Save className="h-4 w-4 animate-pulse" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Processing */}
        <Card>
          <CardHeader>
            <CardTitle>Processing</CardTitle>
            <CardDescription>OCR and pipeline behaviour</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              label="OCR language"
              description="Tesseract language pack used for text recognition"
            >
              <Select
                value={form.ocr_language}
                onChange={(event) => set("ocr_language", event.target.value)}
                className="w-36"
                aria-label="OCR language"
              >
                <option value="eng">English (eng)</option>
                <option value="hin">Hindi (hin)</option>
                <option value="eng+hin">English + Hindi</option>
                <option value="deu">German (deu)</option>
                <option value="fra">French (fra)</option>
                <option value="spa">Spanish (spa)</option>
              </Select>
            </Row>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Confidence threshold</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Documents below this AI confidence are flagged for review
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{thresholdPercent}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={99}
                value={thresholdPercent}
                onChange={(event) => set("confidence_threshold", Number(event.target.value) / 100)}
                className="mt-3 w-full accent-[hsl(var(--primary))]"
                aria-label="Confidence threshold"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>50%</span>
                <span>75% recommended</span>
                <span>99%</span>
              </div>
            </div>

            <Row label="Maximum document size" description="Uploads above this are rejected">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={form.max_file_size_mb}
                  onChange={(event) => set("max_file_size_mb", Number(event.target.value))}
                  className="w-24"
                  aria-label="Maximum file size in MB"
                />
                <span className="text-xs text-muted-foreground">MB</span>
              </div>
            </Row>

            <Row
              label="Parallel processing"
              description="Reserved for future multi-document batches"
            >
              <Switch
                checked={form.parallel_processing}
                onCheckedChange={(next) => set("parallel_processing", next)}
                aria-label="Parallel processing"
              />
            </Row>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>Local-first defaults — opt-ins are explicit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Cloud processing" description="Disabled by default; requires consent">
              <Switch
                checked={form.cloud_processing}
                onCheckedChange={(next) => {
                  if (next) {
                    const ok = window.confirm(
                      "Cloud processing would send document data outside this device.\n\nDo you explicitly consent?",
                    );
                    if (!ok) return;
                  }
                  set("cloud_processing", next);
                }}
                aria-label="Cloud processing"
              />
            </Row>
            <Row label="Telemetry" description="No usage data is ever collected by default">
              <Switch
                checked={form.telemetry}
                onCheckedChange={(next) => set("telemetry", next)}
                aria-label="Telemetry"
              />
            </Row>
            <Row
              label="Auto-delete temporary files"
              description="Remove intermediate page images after processing"
            >
              <Switch
                checked={form.auto_delete_temp}
                onCheckedChange={(next) => set("auto_delete_temp", next)}
                aria-label="Auto delete temporary files"
              />
            </Row>
            <Row label="Retention period" description="Days to keep imported documents">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={3650}
                  value={form.retention_days}
                  onChange={(event) => set("retention_days", Number(event.target.value))}
                  className="w-24"
                  aria-label="Retention period in days"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </Row>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Defaults for generated files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Default format" description="Pre-selected on the Exports page">
              <Select
                value={form.export_format}
                onChange={(event) =>
                  set("export_format", event.target.value as AppSettings["export_format"])
                }
                className="w-36"
                aria-label="Default export format"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
                <option value="pdf">PDF report</option>
              </Select>
            </Row>
            <Row label="Include confidence scores" description="Add AI confidence per field">
              <Switch
                checked={form.export_include_confidence}
                onCheckedChange={(next) => set("export_include_confidence", next)}
                aria-label="Include confidence scores"
              />
            </Row>
            <Row label="Include validation results" description="Append rule outcomes to exports">
              <Switch
                checked={form.export_include_validation}
                onCheckedChange={(next) => set("export_include_validation", next)}
                aria-label="Include validation results"
              />
            </Row>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Theme for this device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => set("theme", option.key)}
                  aria-pressed={form.theme === option.key}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                    form.theme === option.key
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border/60 hover:bg-accent/50",
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-3.5 text-xs text-muted-foreground">
              {form.theme === "system"
                ? "Follows your operating system preference."
                : form.theme === "dark"
                  ? "Dark theme active — tuned for long review sessions."
                  : "Light theme active — tuned for print and shared screens."}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-4 w-4" aria-hidden="true" /> Installed models
          </CardTitle>
          <CardDescription>
            Honest registry status — missing models fall back to deterministic local logic, the app
            never breaks.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {models.isLoading && <Skeleton className="h-28 sm:col-span-3" />}
          {models.data?.map((model) => (
            <div key={model.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{model.name}</p>
                <Badge variant={model.installed ? "success" : "warning"}>{model.status}</Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {model.provider} · {model.runtime}
                {model.version ? ` · v${model.version}` : ""}
              </p>
              {model.fallback && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                  <Server className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {model.fallback}
                </p>
              )}
              {!model.fallback && model.installed && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                  <HardDrive className="h-3 w-3" aria-hidden="true" /> Runs fully offline
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
