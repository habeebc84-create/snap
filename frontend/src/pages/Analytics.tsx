import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, FileCheck2, Percent, Receipt, Timer, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "../components/ui";
import { useAnalytics } from "../hooks/useApi";
import { formatBytes, formatMoney, formatNumber, titleCase } from "../lib/utils";

const TYPE_COLORS: Record<string, string> = {
  invoice: "#4f46e5",
  receipt: "#0891b2",
  purchase_order: "#7c3aed",
  contract: "#d97706",
  form: "#475569",
  other: "#94a3b8",
  unclassified: "#cbd5e1",
};

function Metric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="field-label">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
} as const;

export default function Analytics() {
  const analytics = useAnalytics();

  if (analytics.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (analytics.isError || !analytics.data) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Analytics are unavailable right now. Your data stays local — try again shortly.
      </Card>
    );
  }

  const data = analytics.data;
  const categories = data.by_type.map((entry) => ({
    ...entry,
    label: titleCase(entry.type),
  }));
  const reviewRate = Math.round(data.review.rate * 100);
  const avgConfidence = Math.round(data.confidence.average * 100);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every figure is computed from your local database — nothing is sent anywhere.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Documents processed"
          value={formatNumber(data.kpis.total_documents)}
          hint={`${formatNumber(data.kpis.processed_today)} today`}
          icon={<FileCheck2 className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Total invoice value"
          value={formatMoney(data.totals.invoice_value)}
          hint={`${data.totals.invoices} invoices`}
          icon={<Receipt className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Total tax"
          value={formatMoney(data.totals.invoice_tax)}
          hint="Sum of extracted tax fields"
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Average confidence"
          value={`${avgConfidence}%`}
          hint="AI confidence across documents"
          icon={<Percent className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Avg processing time"
          value={`${(data.performance.avg_processing_ms / 1000).toFixed(1)}s`}
          hint="OCR → validation, locally"
          icon={<Timer className="h-4 w-4" aria-hidden="true" />}
        />
        <Metric
          label="Requires review"
          value={formatNumber(data.review.needs_review)}
          hint={`${reviewRate}% review rate`}
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents over time</CardTitle>
            <CardDescription>Imports across the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.over_time}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Documents"
                    stroke="hsl(243 70% 55%)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document categories</CardTitle>
            <CardDescription>Classification breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories.filter((entry) => entry.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={50}
                      outerRadius={82}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {categories
                        .filter((entry) => entry.count > 0)
                        .map((entry) => (
                          <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#94a3b8"} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      verticalAlign="bottom"
                      formatter={(value: string) => (
                        <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Invoice value overview</CardTitle>
            <CardDescription>Value vs. tax captured</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Value", amount: data.totals.invoice_value },
                    { name: "Tax", amount: data.totals.invoice_tax },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis
                    width={52}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) =>
                      value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                    }
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} />
                  <Bar dataKey="amount" fill="hsl(243 70% 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence distribution</CardTitle>
            <CardDescription>High / medium / review bands</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { band: "High", count: data.confidence.high, fill: "#10b981" },
                    { band: "Medium", count: data.confidence.medium, fill: "#f59e0b" },
                    { band: "Review", count: data.confidence.review, fill: "#f43f5e" },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {[
                      { band: "High", fill: "#10b981" },
                      { band: "Medium", fill: "#f59e0b" },
                      { band: "Review", fill: "#f43f5e" },
                    ].map((entry) => (
                      <Cell key={entry.band} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation & review</CardTitle>
            <CardDescription>Rule outcomes and review rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Validation rules passed</span>
                <span className="font-semibold tabular-nums">
                  {data.validation.passed}/{data.validation.passed + data.validation.failed}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      data.validation.passed + data.validation.failed > 0
                        ? (data.validation.passed /
                            (data.validation.passed + data.validation.failed)) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Review rate</span>
                <span className="font-semibold tabular-nums">{reviewRate}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${reviewRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage used</span>
                <span className="font-semibold tabular-nums">
                  {formatBytes(data.kpis.storage_used_bytes)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      (data.kpis.storage_used_bytes / (500 * 1024 * 1024)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Relative to a 500 MB working budget.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
