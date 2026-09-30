import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileJson, FileSpreadsheet, FileType2, Search, Table2 } from "lucide-react";
import { Button, Card, Input, Badge, Skeleton } from "../components/ui";
import { EmptyState, TypeBadge } from "../components/status";
import { useDebounced, useSearch, useSettings } from "../hooks/useApi";
import { useToast } from "../components/toast";
import { downloadExport } from "../api/endpoints";
import type { DocumentSummary } from "../types";
import { formatDate, titleCase } from "../lib/utils";

type Format = "json" | "csv" | "xlsx" | "pdf";

const FORMATS: { key: Format; label: string; description: string; icon: React.ReactNode }[] = [
  {
    key: "json",
    label: "JSON",
    description: "Structured document data, fields with confidence, validation results",
    icon: <FileJson className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: "csv",
    label: "CSV",
    description: "Flat table of extracted fields — opens in any spreadsheet",
    icon: <Table2 className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: "xlsx",
    label: "Excel",
    description: "Workbook with Summary, Fields, Line Items and Validation sheets",
    icon: <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: "pdf",
    label: "PDF report",
    description: "Clean extraction report for sharing with clients or accountants",
    icon: <FileType2 className="h-4 w-4" aria-hidden="true" />,
  },
];

export default function Exports() {
  const [queryText, setQueryText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const debounced = useDebounced(queryText, 300);
  const results = useSearch({ q: debounced || undefined, limit: 30 });
  const settings = useSettings();
  const toast = useToast();

  const defaultFormat = (settings.data?.export_format ?? "csv") as Format;
  const items = results.data?.items ?? [];

  const handleExport = async (document: DocumentSummary, format: Format) => {
    setBusyId(document.id);
    try {
      await downloadExport(document.id, format, document.filename);
      toast.push(`${format.toUpperCase()} generated locally for ${document.filename}.`, "success");
    } catch (error) {
      toast.push(
        error instanceof Error ? error.message : "Export failed. Please try again.",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Exports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured data leaves this app only when you download it. Default format:{" "}
            <span className="font-medium uppercase">{defaultFormat}</span>.
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Find a document to export…"
            className="pl-9"
            aria-label="Search documents to export"
          />
        </div>
      </div>

      {/* Format explainer */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATS.map((format) => (
          <Card key={format.key} className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {format.icon}
              {format.label}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {format.description}
            </p>
          </Card>
        ))}
      </div>

      {/* Document list */}
      <Card>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-sm font-semibold">Documents</h2>
          <Badge variant="outline">{results.data?.total ?? 0} available</Badge>
        </div>
        {results.isLoading && (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        )}
        {results.isSuccess && items.length === 0 && (
          <div className="p-6">
            <EmptyState
              title="Nothing to export yet."
              description="Process a document first — then download it as JSON, CSV, Excel or a PDF report."
              icon={<Download className="h-6 w-6" aria-hidden="true" />}
            >
              <Link to="/scan">
                <Button>Scan Document</Button>
              </Link>
            </EmptyState>
          </div>
        )}
        <ul className="divide-y divide-border/50">
          {items.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
            >
              <div className="min-w-0">
                <Link
                  to={`/documents/${document.id}`}
                  className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                >
                  {document.filename}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <TypeBadge type={document.document_type} />
                  <span>{titleCase(document.document_type)}</span>
                  <span>·</span>
                  <span>{formatDate(document.created_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map((format) => (
                  <Button
                    key={format.key}
                    size="sm"
                    variant={format.key === defaultFormat ? "default" : "outline"}
                    disabled={busyId === document.id}
                    onClick={() => handleExport(document, format.key)}
                    aria-label={`Export ${document.filename} as ${format.label}`}
                  >
                    {format.label}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
