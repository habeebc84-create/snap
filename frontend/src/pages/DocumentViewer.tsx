import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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
import {
  ConfidenceBar,
  ConfidenceRing,
  ErrorState,
  PipelineStages,
  StatusBadge,
  TypeBadge,
} from "../components/status";
import { useToast } from "../components/toast";
import { useDelete, useDocument, useProcess, useReview, useSettings } from "../hooks/useApi";
import { downloadExport, pageImageUrl } from "../api/endpoints";
import { ACTIVE_STATUSES, type ExtractedField } from "../types";
import { cn, formatBytes, formatDate, prettifyField, titleCase } from "../lib/utils";

const FIELD_GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Identification",
    keys: ["invoice_number", "receipt_number", "purchase_order_number", "reference_number", "po_number"],
  },
  {
    title: "Dates & terms",
    keys: ["invoice_date", "due_date", "date", "time", "payment_terms"],
  },
  {
    title: "Parties",
    keys: ["vendor_name", "vendor_address", "customer_name", "customer_address", "merchant"],
  },
  {
    title: "Identifiers",
    keys: ["gstin", "currency", "payment_method"],
  },
  {
    title: "Amounts",
    keys: ["subtotal", "discount", "tax", "cgst", "sgst", "igst", "total"],
  },
];

function groupFields(fields: ExtractedField[]) {
  const grouped = new Map<string, ExtractedField[]>();
  const used = new Set<string>();
  for (const group of FIELD_GROUPS) {
    const members = group.keys
      .map((key) => fields.find((field) => field.name === key))
      .filter((field): field is ExtractedField => Boolean(field));
    members.forEach((field) => used.add(field.name));
    if (members.length) grouped.set(group.title, members);
  }
  const rest = fields.filter((field) => !used.has(field.name));
  if (rest.length) grouped.set("Other fields", rest);
  return Array.from(grouped.entries());
}

function FieldRow({
  field,
  editing,
  draft,
  onStart,
  onDraft,
  onCancel,
  onSave,
  saving,
}: {
  field: ExtractedField;
  editing: boolean;
  draft: string;
  onStart: () => void;
  onDraft: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const lowConfidence = field.confidence < 0.75;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="field-label">{prettifyField(field.name)}</span>
            {field.is_corrected && <Badge variant="success">Corrected</Badge>}
            {lowConfidence && !field.is_corrected && (
              <Badge variant="warning">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Review recommended
              </Badge>
            )}
          </div>
          {editing ? (
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={draft}
                autoFocus
                onChange={(event) => onDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSave();
                  if (event.key === "Escape") onCancel();
                }}
                aria-label={`Correct ${prettifyField(field.name)}`}
              />
              <Button size="icon" onClick={onSave} disabled={saving} aria-label="Save value">
                <Save className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onCancel} aria-label="Cancel editing">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <p className="mt-1 break-words text-sm font-medium">
              {field.value || <span className="text-muted-foreground">—</span>}
            </p>
          )}
          {field.is_corrected && field.original_value && !editing && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Original AI value: <span className="line-through">{field.original_value}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {!editing && (
            <Button size="icon" variant="ghost" onClick={onStart} aria-label={`Edit ${prettifyField(field.name)}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
          <ConfidenceBar value={field.confidence} />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {field.source}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DocumentViewer() {
  const { id } = useParams<{ id: string }>();
  const documentQuery = useDocument(id);
  const review = useReview(id ?? "");
  const process = useProcess();
  const remove = useDelete();
  const settings = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);

  const document = documentQuery.data;
  const status = document?.status;
  const active = status ? ACTIVE_STATUSES.includes(status) : false;

  // Reset the preview when navigating between documents.
  useEffect(() => {
    setPage(1);
    setImageFailed(false);
    setEditing(null);
  }, [id]);

  const grouped = useMemo(
    () => groupFields(document?.fields ?? []),
    [document?.fields],
  );

  const validations = document?.validations ?? [];
  const failedRules = validations.filter((rule) => !rule.passed);
  const mediumThreshold = settings.data?.confidence_medium ?? 0.75;

  if (documentQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[60vh]" />
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (documentQuery.isError || !document) {
    return (
      <ErrorState
        title="We couldn't load this document."
        description="It may have been deleted from this device."
        onRetry={() => documentQuery.refetch()}
      />
    );
  }

  const startEdit = (field: ExtractedField) => {
    setEditing(field.name);
    setDrafts((current) => ({ ...current, [field.name]: field.value }));
  };

  const saveField = (fieldName: string) => {
    const value = drafts[fieldName] ?? "";
    review.mutate(
      { fields: [{ field_name: fieldName, value }] },
      {
        onSuccess: () => {
          setEditing(null);
          toast.push(`${prettifyField(fieldName)} updated and saved locally.`, "success");
        },
        onError: (error) => toast.push(error.message, "error"),
      },
    );
  };

  const handleExport = async (format: "json" | "csv" | "xlsx" | "pdf") => {
    try {
      await downloadExport(document.id, format, document.filename);
      toast.push(`${format.toUpperCase()} export generated locally.`, "success");
    } catch (error) {
      toast.push(
        error instanceof Error ? error.message : "Export failed. Try another format.",
        "error",
      );
    }
  };

  const handleDelete = () => {
    const ok = window.confirm(
      `Permanently delete "${document.filename}"?\n\nThe original file, OCR text and extracted data will be removed from this device.`,
    );
    if (!ok) return;
    remove.mutate(
      { id: document.id },
      {
        onSuccess: () => {
          toast.push("Document deleted permanently.", "success");
          navigate("/documents");
        },
        onError: (error) => toast.push(error.message, "error"),
      },
    );
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/documents"
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All documents
          </Link>
          <h1 className="flex items-center gap-2.5 truncate font-display text-2xl font-semibold">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{document.filename}</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={document.document_type} />
            <StatusBadge status={document.status} />
            <Badge variant="outline">{document.page_count || 1} page(s)</Badge>
            <Badge variant="outline">{formatBytes(document.file_size)}</Badge>
            <Badge variant="outline">Imported {formatDate(document.created_at)}</Badge>
            {document.processing_time_ms > 0 && (
              <Badge variant="outline">
                Processed in {(document.processing_time_ms / 1000).toFixed(1)}s
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(document.status === "failed" || document.status === "uploaded") && (
            <Button
              variant="outline"
              onClick={() =>
                process.mutate(document.id, {
                  onError: (error) => toast.push(error.message, "error"),
                })
              }
              disabled={process.isPending}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Re-run pipeline
            </Button>
          )}
          <Button variant="outline" onClick={() => handleExport("json")}>
            <Download className="h-4 w-4" aria-hidden="true" /> JSON
          </Button>
          <Button variant="outline" onClick={() => handleExport("csv")}>
            CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("xlsx")}>
            XLSX
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")}>
            PDF
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={remove.isPending}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Split workspace */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: preview */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Document</CardTitle>
            <CardDescription>Preview rendered locally from your file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {active ? (
              <div className="space-y-5 rounded-xl border border-border/60 bg-background/40 p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  Processing document — local AI processing
                </div>
                <PipelineStages status={document.status} errorMessage={document.error_message} />
              </div>
            ) : document.pages.length === 0 || imageFailed ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
                <FileText className="h-6 w-6" aria-hidden="true" />
                <p>No preview available for this document.</p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                  <img
                    src={pageImageUrl(document.id, page)}
                    alt={`Preview of ${document.filename}, page ${page}`}
                    className="mx-auto max-h-[70vh] w-auto"
                    onError={() => setImageFailed(true)}
                  />
                </div>
                {document.pages.length > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      Page {page} of {document.pages.length}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= document.pages.length}
                      onClick={() => setPage((current) => current + 1)}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </>
            )}

            <details className="rounded-lg border border-border/60 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                Extracted text (OCR)
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-sans text-xs text-muted-foreground scrollbar-thin">
                {document.ocr_text || "No text was extracted."}
              </pre>
              <p className="mt-2 text-[11px] text-muted-foreground">
                AI confidence {Math.round(document.ocr_confidence * 100)}% · stored only on this
                device.
              </p>
            </details>
          </CardContent>
        </Card>

        {/* Right: extracted data */}
        <div className="space-y-5">
          {/* Classification + overall confidence */}
          <Card>
            <CardContent className="flex items-center gap-5 p-5">
              <ConfidenceRing value={document.overall_confidence} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="field-label">Classification</p>
                <p className="text-lg font-semibold capitalize">
                  {titleCase(document.classification?.document_type ?? document.document_type)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Classifier confidence{" "}
                  {Math.round((document.classification?.confidence ?? 0) * 100)}% · model{" "}
                  {document.classification?.model ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {document.overall_confidence >= 0.9
                    ? "High confidence"
                    : document.overall_confidence >= mediumThreshold
                      ? "Medium confidence"
                      : "Review required"}{" "}
                  — AI confidence is not a guarantee of correctness.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Validation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Validation
                <Badge variant={failedRules.length ? "warning" : "success"}>
                  {validations.length - failedRules.length}/{validations.length} rules passed
                </Badge>
              </CardTitle>
              <CardDescription>
                Deterministic checks: totals, dates, GST structure, required fields
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {validations.length === 0 && (
                <p className="text-sm text-muted-foreground">No validation results yet.</p>
              )}
              {validations.map((rule) => (
                <div
                  key={rule.rule}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
                    rule.passed
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : rule.severity === "warning"
                        ? "border-amber-500/25 bg-amber-500/5"
                        : "border-rose-500/25 bg-rose-500/5",
                  )}
                >
                  {rule.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        rule.severity === "warning" ? "text-amber-600" : "text-rose-600",
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <span className={rule.passed ? "" : "font-medium"}>{rule.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Extracted fields */}
          <Card>
            <CardHeader>
              <CardTitle>Extracted information</CardTitle>
              <CardDescription>
                Every value carries its AI confidence. Click the pencil to correct anything.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {document.fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No fields were extracted from this document.
                </p>
              )}
              {grouped.map(([title, fields]) => (
                <section key={title} className="space-y-2.5">
                  <h3 className="field-label">{title}</h3>
                  {fields.map((field) => (
                    <FieldRow
                      key={field.name}
                      field={field}
                      editing={editing === field.name}
                      draft={drafts[field.name] ?? ""}
                      onStart={() => startEdit(field)}
                      onDraft={(value) =>
                        setDrafts((current) => ({ ...current, [field.name]: value }))
                      }
                      onCancel={() => setEditing(null)}
                      onSave={() => saveField(field.name)}
                      saving={review.isPending}
                    />
                  ))}
                </section>
              ))}
            </CardContent>
          </Card>

          {/* Line items */}
          {document.line_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Line items</CardTitle>
                <CardDescription>{document.line_items.length} row(s) parsed from the table</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-semibold">Description</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">Qty</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">Rate</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">Tax</th>
                      <th scope="col" className="py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.line_items.map((item) => (
                      <tr key={item.position} className="border-b border-border/40">
                        <td className="py-2 pr-3">{item.description}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{item.unit_price.toFixed(2)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{item.tax.toFixed(2)}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Correction history */}
          {document.review_actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  Correction history
                </CardTitle>
                <CardDescription>Human corrections stored on this device</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {document.review_actions.map((action, index) => (
                  <div
                    key={`${action.field_name}-${index}`}
                    className="rounded-lg border border-border/60 p-3 text-xs"
                  >
                    <p className="font-medium">{prettifyField(action.field_name)}</p>
                    <p className="mt-1 text-muted-foreground">
                      <span className="line-through">{action.original_value || "—"}</span>
                      {" → "}
                      <span className="font-medium text-foreground">{action.new_value || "—"}</span>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
