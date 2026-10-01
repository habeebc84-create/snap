import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Database,
  FileStack,
  Inbox,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton, Button, Badge } from "../components/ui";
import { DocumentRow, EmptyState, StatusBadge, TypeBadge } from "../components/status";
import { useAnalytics, useLoadDemo, useSearch } from "../hooks/useApi";
import { useToast } from "../components/toast";
import { formatBytes, formatNumber, greeting, cn } from "../lib/utils";

const TYPE_COLORS: Record<string, string> = {
  invoice: "#2563eb",
  receipt: "#0284c7",
  purchase_order: "#7c3aed",
  contract: "#d97706",
  form: "#10b981",
  other: "#64748b",
  unclassified: "#94a3b8",
};

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "success" | "info";
}) {
  return (
    <Card className="lift-3d relative overflow-hidden border border-border/80 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <p className="field-label">{label}</p>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
            tone === "warning"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : tone === "success"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : tone === "info"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const analytics = useAnalytics();
  const reviewQueue = useSearch({ needs_review: true, limit: 5 });
  const demo = useLoadDemo();
  const toast = useToast();
  const navigate = useNavigate();

  const kpis = analytics.data?.kpis;
  const isEmpty = analytics.isSuccess && (kpis?.total_documents ?? 0) === 0;

  const distribution = (analytics.data?.by_type ?? []).filter((entry) => entry.count > 0);
  const activity = (analytics.data?.over_time ?? [])
    .filter((entry) => entry.date >= new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10))
    .map((entry) => ({ ...entry, day: entry.date.slice(5) }));

  const loadDemo = () => {
    demo.mutate(undefined, {
      onSuccess: (result) => {
        toast.push(`${result.total} synthetic demo documents are being processed locally.`, "success");
        navigate("/documents");
      },
      onError: (error) => toast.push(error.message, "error"),
    });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              100% Local & Offline Processing
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting()}
            </h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-500" aria-hidden="true" />
              Your documents are processed locally. Intelligent document extraction on your device.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={loadDemo} disabled={demo.isPending} className="shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {demo.isPending ? "Generating…" : "Load Demo Data"}
            </Button>
            <Button onClick={() => navigate("/scan")} className="shadow-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Scan Document
            </Button>
          </div>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          title="Your document workspace is empty."
          description="Start by scanning or uploading a document — invoices and receipts are classified and structured in seconds, entirely on this device."
          icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
        >
          <Button onClick={() => navigate("/scan")}>
            <Upload className="h-4 w-4" aria-hidden="true" /> Scan Document
          </Button>
          <Button variant="outline" onClick={() => navigate("/scan")}>
            <FileStack className="h-4 w-4" aria-hidden="true" /> Upload Document
          </Button>
          <Button variant="ghost" onClick={loadDemo} disabled={demo.isPending}>
            Load Demo Data
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {analytics.isLoading ? (
              [0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-32" />)
            ) : (
              <>
                <KpiCard
                  label="Total documents"
                  value={formatNumber(kpis?.total_documents ?? 0)}
                  hint="Stored in local database"
                  icon={<FileStack className="h-4.5 w-4.5" aria-hidden="true" />}
                  tone="info"
                />
                <KpiCard
                  label="Processed today"
                  value={formatNumber(kpis?.processed_today ?? 0)}
                  hint="Imported in last 24h"
                  icon={<BarChart3 className="h-4.5 w-4.5" aria-hidden="true" />}
                  tone="success"
                />
                <KpiCard
                  label="Needs review"
                  value={formatNumber(kpis?.needs_review ?? 0)}
                  hint="Low AI confidence or validation"
                  icon={<ClipboardCheck className="h-4.5 w-4.5" aria-hidden="true" />}
                  tone={(kpis?.needs_review ?? 0) > 0 ? "warning" : "default"}
                />
                <KpiCard
                  label="Storage used"
                  value={formatBytes(kpis?.storage_used_bytes ?? 0)}
                  hint="Documents & cache"
                  icon={<Database className="h-4.5 w-4.5" aria-hidden="true" />}
                />
              </>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card
              onClick={() => navigate("/scan")}
              className="cursor-pointer border-border/80 p-4 transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Upload & Scan</h3>
                  <p className="text-xs text-muted-foreground">Add new invoices, receipts or PDFs</p>
                </div>
              </div>
            </Card>

            <Card
              onClick={() => navigate("/review")}
              className="cursor-pointer border-border/80 p-4 transition-all hover:border-amber-500/50 hover:bg-amber-500/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Review Queue</h3>
                  <p className="text-xs text-muted-foreground">Inspect fields requiring human verification</p>
                </div>
              </div>
            </Card>

            <Card
              onClick={() => navigate("/analytics")}
              className="cursor-pointer border-border/80 p-4 transition-all hover:border-blue-500/50 hover:bg-blue-500/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Analytics</h3>
                  <p className="text-xs text-muted-foreground">Detailed processing trends & insights</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Document distribution</CardTitle>
                <CardDescription>By classification, from local database</CardDescription>
              </CardHeader>
              <CardContent>
                {distribution.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No classified documents yet.
                  </p>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="h-44 w-44 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={distribution}
                            dataKey="count"
                            nameKey="type"
                            innerRadius={44}
                            outerRadius={70}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {distribution.map((entry) => (
                              <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#94a3b8"} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 10,
                              fontSize: 12,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="flex-1 space-y-2">
                      {distribution.map((entry) => (
                        <li key={entry.type} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2 capitalize">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: TYPE_COLORS[entry.type] ?? "#94a3b8" }}
                              aria-hidden="true"
                            />
                            {entry.type.replace("_", " ")}
                          </span>
                          <span className="font-medium tabular-nums">{entry.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Processing activity</CardTitle>
                <CardDescription>Documents imported over the last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activity}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        width={24}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--accent) / 0.5)" }}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Review queue preview */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Review queue</CardTitle>
                <CardDescription>Documents with low AI confidence or validation issues</CardDescription>
              </div>
              <Link
                to="/review"
                className="flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Open queue <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-1">
              {reviewQueue.isLoading && <Skeleton className="h-24" />}
              {reviewQueue.isSuccess && reviewQueue.data.total === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nothing needs attention. Every processed document passed review thresholds. ✅
                </p>
              )}
              {(reviewQueue.data?.items ?? []).map((document) => (
                <div key={document.id} className="space-y-1">
                  <DocumentRow document={document} />
                  <div className="flex flex-wrap gap-1.5 px-3 pb-1.5">
                    <TypeBadge type={document.document_type} />
                    <Badge variant="warning">Confidence {Math.round(document.overall_confidence * 100)}%</Badge>
                    <StatusBadge status={document.status} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
