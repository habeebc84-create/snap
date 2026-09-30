import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Search,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
} from "../components/ui";
import { EmptyState, StatusBadge, TypeBadge } from "../components/status";
import { useDebounced, useDelete, useSearch, useSettings } from "../hooks/useApi";
import { useToast } from "../components/toast";
import type { DocumentSummary } from "../types";
import { formatDate, formatNumber } from "../lib/utils";

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "invoice", label: "Invoices" },
  { value: "receipt", label: "Receipts" },
  { value: "purchase_order", label: "Purchase orders" },
  { value: "contract", label: "Contracts" },
  { value: "form", label: "Forms" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "completed", label: "Completed" },
  { value: "needs_review", label: "Needs review" },
  { value: "failed", label: "Failed" },
  { value: "queued", label: "Queued / processing" },
];

export function DocumentTable({
  documents,
  onDelete,
  deletingId,
}: {
  documents: DocumentSummary[];
  onDelete?: (document: DocumentSummary) => void;
  deletingId?: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-[11px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-semibold">Document</th>
            <th scope="col" className="px-4 py-3 font-semibold">Type</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">AI confidence</th>
            <th scope="col" className="px-4 py-3 font-semibold">Imported</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => {
            const percent = Math.round(document.overall_confidence * 100);
            return (
              <tr
                key={document.id}
                className="border-b border-border/40 transition-colors hover:bg-accent/40"
              >
                <td className="max-w-64 px-4 py-3">
                  <Link
                    to={`/documents/${document.id}`}
                    className="block truncate font-medium underline-offset-4 hover:underline"
                  >
                    {document.filename}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {document.page_count || 1} page{(document.page_count || 1) > 1 ? "s" : ""}
                    {document.is_demo && " · demo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={document.document_type} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={document.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          percent >= 90
                            ? "bg-emerald-500"
                            : percent >= 75
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">{percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(document.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <Link
                      to={`/documents/${document.id}`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${document.filename}`}
                        disabled={deletingId === document.id}
                        onClick={() => onDelete(document)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Documents() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [offset, setOffset] = useState(0);
  const debouncedQuery = useDebounced(query, 300);
  const settings = useSettings();
  const toast = useToast();
  const deleteMutation = useDelete();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      document_type: type || undefined,
      status: status || undefined,
      needs_review: needsReview || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [debouncedQuery, type, status, needsReview, offset],
  );

  const results = useSearch(params);

  const handleDelete = (document: DocumentSummary) => {
    const ok = window.confirm(
      `Delete "${document.filename}"?\n\nThis permanently removes the file, its OCR text and extracted data from this device.`,
    );
    if (!ok) return;
    setDeletingId(document.id);
    deleteMutation.mutate(
      { id: document.id },
      {
        onSuccess: () => toast.push("Document deleted permanently.", "success"),
        onError: (error) => toast.push(error.message, "error"),
        onSettled: () => setDeletingId(null),
      },
    );
  };

  const total = results.data?.total ?? 0;
  const items = results.data?.items ?? [];
  const confidenceMedium = settings.data?.confidence_medium ?? 0.75;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {results.isSuccess ? `${formatNumber(total)} document${total === 1 ? "" : "s"} found` : "Loading…"} — searched locally.
          </p>
        </div>
        <Link to="/scan">
          <Button>
            <Search className="h-4 w-4" aria-hidden="true" /> Scan &amp; Upload
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOffset(0);
            }}
            placeholder="Search vendor, invoice no, GSTIN, amount…"
            className="pl-9"
            aria-label="Search documents"
          />
        </div>
        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setOffset(0);
          }}
          aria-label="Filter by document type"
          className="w-44"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setOffset(0);
          }}
          aria-label="Filter by status"
          className="w-44"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Badge
          variant={needsReview ? "warning" : "outline"}
          className="cursor-pointer px-3 py-1.5"
          onClick={() => {
            setNeedsReview((current) => !current);
            setOffset(0);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter") setNeedsReview((current) => !current);
          }}
        >
          Needs review only
        </Badge>
        <span className="text-xs text-muted-foreground">
          Confidence threshold {Math.round(confidenceMedium * 100)}%
        </span>
      </Card>

      {/* Results */}
      <Card>
        {results.isLoading && (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        )}
        {results.isSuccess && items.length === 0 && (
          <div className="p-6">
            <EmptyState
              title="No documents match."
              description="Try clearing filters or upload a new document to work with."
              icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
            >
              <Link to="/scan">
                <Button>Upload Document</Button>
              </Link>
            </EmptyState>
          </div>
        )}
        {items.length > 0 && (
          <>
            <DocumentTable documents={items} onDelete={handleDelete} deletingId={deletingId} />
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((current) => current + PAGE_SIZE)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
