import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ClipboardCheck, Loader2, Search } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from "../components/ui";
import { ConfidenceBar, EmptyState, StatusBadge, TypeBadge } from "../components/status";
import { useDebounced, useReview, useSearch, useSettings } from "../hooks/useApi";
import { useToast } from "../components/toast";
import type { DocumentSummary, ExtractedField } from "../types";
import { cn, formatDate, prettifyField } from "../lib/utils";

type FilterKey = "attention" | "low_confidence" | "missing_fields" | "validation_errors" | "unclassified" | "recent";

const FILTERS: { key: FilterKey; label: string; params: Record<string, unknown> }[] = [
  { key: "attention", label: "Needs review", params: { needs_review: true } },
  { key: "low_confidence", label: "Low confidence", params: { review_filter: "low_confidence" } },
  { key: "missing_fields", label: "Missing fields", params: { review_filter: "missing_fields" } },
  { key: "validation_errors", label: "Validation errors", params: { review_filter: "validation_errors" } },
  { key: "unclassified", label: "Unclassified", params: { review_filter: "unclassified" } },
  { key: "recent", label: "Recently processed", params: { review_filter: "recent" } },
];

function FieldEditor({ documentId }: { documentId: string }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const toast = useToast();
  const settings = useSettings();

  const detailQuery = useMemo(() => documentId, [documentId]);
  const [detail, setDetail] = useState<{
    fields: ExtractedField[];
    validations: { message: string; passed: boolean; severity: string }[];
    filename: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    fetch(`/api/documents/${detailQuery}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("load failed"))))
      .then((data) => {
        if (!cancelled) {
          setDetail({
            fields: data.fields ?? [],
            validations: data.validations ?? [],
            filename: data.filename,
          });
          setDrafts({});
        }
      })
      .catch(() => {
        if (!cancelled) setDetail({ fields: [], validations: [], filename: "" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailQuery]);

  const review = useReview(documentId);
  const medium = settings.data?.confidence_medium ?? 0.75;

  const changed = (detail?.fields ?? [])
    .map((field) => ({ field_name: field.name, value: drafts[field.name] ?? field.value }))
    .filter((entry, index) => {
      const original = detail?.fields[index]?.value ?? "";
      return entry.value !== original;
    });

  const saveAll = () => {
    if (!changed.length) return;
    review.mutate(
      { fields: changed },
      {
        onSuccess: () => {
          toast.push(`${changed.length} correction(s) saved to the local database.`, "success");
          setDrafts({});
        },
        onError: (error) => toast.push(error.message, "error"),
      },
    );
  };

  if (loading) return <Skeleton className="h-64" />;
  if (!detail) return <p className="text-sm text-muted-foreground">Document unavailable.</p>;

  const failed = detail.validations.filter((rule) => !rule.passed);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{detail.filename}</p>
          <p className="text-xs text-muted-foreground">
            Correct any value — the original AI output is preserved.
          </p>
        </div>
        <Button onClick={saveAll} disabled={!changed.length || review.isPending}>
          {review.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Save {changed.length ? `${changed.length} change(s)` : "corrections"}
        </Button>
      </div>

      {failed.length > 0 && (
        <div className="space-y-1.5">
          {failed.map((rule, index) => (
            <p
              key={index}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                rule.severity === "warning"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:text-rose-300",
              )}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {rule.message}
            </p>
          ))}
        </div>
      )}

      {detail.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No extracted fields for this document.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-2 py-2 font-semibold">Field</th>
                <th scope="col" className="px-2 py-2 font-semibold">Extracted value</th>
                <th scope="col" className="px-2 py-2 font-semibold">AI confidence</th>
                <th scope="col" className="px-2 py-2 font-semibold">Your value</th>
              </tr>
            </thead>
            <tbody>
              {detail.fields.map((field) => {
                const value = drafts[field.name] ?? field.value;
                const dirty = value !== field.value;
                const low = field.confidence < medium && !field.is_corrected;
                return (
                  <tr key={field.name} className="border-b border-border/40 align-top">
                    <td className="px-2 py-2.5">
                      <span className="font-medium">{prettifyField(field.name)}</span>
                      {low && (
                        <Badge variant="warning" className="ml-2">
                          review
                        </Badge>
                      )}
                    </td>
                    <td className="max-w-56 px-2 py-2.5">
                      <span className="block break-words text-muted-foreground">
                        {field.value || "—"}
                      </span>
                      {field.is_corrected && field.original_value && (
                        <span className="text-[11px] text-muted-foreground">
                          (was: {field.original_value})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <ConfidenceBar value={field.confidence} />
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        value={value}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                        className="h-9 min-w-40"
                        aria-label={`Corrected value for ${prettifyField(field.name)}`}
                      />
                      {dirty && (
                        <span className="mt-1 block text-[11px] text-primary">Unsaved change</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReviewQueue() {
  const [filter, setFilter] = useState<FilterKey>("attention");
  const [selected, setSelected] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const debouncedQuery = useDebounced(queryText, 300);

  const activeFilter = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0];
  const params = useMemo(
    () => ({ ...activeFilter.params, q: debouncedQuery || undefined, limit: 30 }),
    [activeFilter, debouncedQuery],
  );
  const results = useSearch(params);
  const items = results.data?.items ?? [];

  useEffect(() => {
    if (!selected && items.length) setSelected(items[0].id);
  }, [items, selected]);

  useEffect(() => {
    setSelected(null);
  }, [filter]);

  const selectedDocument = items.find((item) => item.id === selected) ?? null;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Documents that need a human eye — low confidence, missing fields, or validation errors.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Filter by vendor, invoice no…"
            className="pl-9"
            aria-label="Filter review queue"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Review filters">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={filter === entry.key}
            onClick={() => setFilter(entry.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === entry.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {results.data?.total ?? 0} document{(results.data?.total ?? 0) === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>Select a document to review its fields</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[65vh] space-y-1.5 overflow-y-auto scrollbar-thin">
            {results.isLoading && <Skeleton className="h-40" />}
            {results.isSuccess && items.length === 0 && (
              <div className="py-6">
                <EmptyState
                  title="Queue is clear."
                  description="No documents match this filter right now."
                  icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
                />
              </div>
            )}
            {items.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => setSelected(document.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  selected === document.id
                    ? "border-primary/50 bg-accent/60"
                    : "border-border/60 hover:bg-accent/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{document.filename}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {Math.round(document.overall_confidence * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <TypeBadge type={document.document_type} />
                  <StatusBadge status={document.status} />
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(document.created_at)}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Extracted values</CardTitle>
            <CardDescription>
              Original value · your corrected value · AI confidence. Corrections persist in the
              local database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDocument ? (
              <FieldEditor key={selectedDocument.id} documentId={selectedDocument.id} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Select a document from the queue to begin reviewing.
              </p>
            )}
            {selectedDocument && (
              <p className="mt-4 text-center text-xs">
                <Link
                  to={`/documents/${selectedDocument.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Open full document workspace →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
