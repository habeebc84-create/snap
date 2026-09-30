import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, FileText, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { Dropzone } from "../components/Dropzone";
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Skeleton } from "../components/ui";
import { ErrorState, PipelineStages, StatusBadge, TypeBadge } from "../components/status";
import { useToast } from "../components/toast";
import { useDocuments, useLoadDemo, useProcess, useSettings, useUpload } from "../hooks/useApi";
import { ACTIVE_STATUSES, type DocumentSummary } from "../types";
import { formatBytes, cn } from "../lib/utils";

interface UploadItem {
  key: string;
  fileName: string;
  fileSize: number;
  documentId?: string;
  error?: string;
}

function PipelineCard({ document }: { document: DocumentSummary }) {
  const process = useProcess();
  const toast = useToast();
  const active = ACTIVE_STATUSES.includes(document.status);

  return (
    <Card className="animate-fade-up">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 truncate">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{document.filename}</span>
          </CardTitle>
          <CardDescription>
            {formatBytes(document.file_size)} · {document.page_count || "—"} page
            {document.page_count === 1 ? "" : "s"} · {document.file_type.toUpperCase()}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TypeBadge type={document.document_type} />
          <StatusBadge status={document.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="field-label mb-3">Pipeline</p>
            <PipelineStages status={document.status} errorMessage={document.error_message} />
          </div>
          <div className="flex flex-col justify-between gap-3">
            <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
              {document.status === "failed" && document.error_message ? (
                <span className="text-rose-600 dark:text-rose-400">{document.error_message}</span>
              ) : active ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                  Local AI processing — nothing is uploaded.
                </span>
              ) : (
                <span>
                  Processed in {(document.processing_time_ms / 1000).toFixed(1)}s · AI confidence{" "}
                  {Math.round(document.overall_confidence * 100)}%
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {document.status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    process.mutate(document.id, {
                      onError: (error) => toast.push(error.message, "error"),
                    })
                  }
                  disabled={process.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                </Button>
              )}
              {!active && document.status !== "failed" && (
                <Link to={`/documents/${document.id}`} className="inline-flex">
                  <Button size="sm">
                    Open document <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScanUpload() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const upload = useUpload();
  const process = useProcess();
  const settings = useSettings();
  const documents = useDocuments({ limit: 12 });
  const demo = useLoadDemo();
  const toast = useToast();
  const navigate = useNavigate();

  const maxMb = settings.data?.max_file_size_mb ?? 25;

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      const key = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setUploads((current) => [
        { key, fileName: file.name, fileSize: file.size },
        ...current,
      ]);
      try {
        const document = await upload.mutateAsync(file);
        setUploads((current) =>
          current.map((item) => (item.key === key ? { ...item, documentId: document.id } : item)),
        );
        await process.mutateAsync(document.id);
        toast.push(`${file.name} — queued for local processing.`, "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed.";
        setUploads((current) =>
          current.map((item) => (item.key === key ? { ...item, error: message } : item)),
        );
        toast.push(message, "error");
      }
    }
  };

  const recent = (documents.data?.items ?? []).slice(0, 8);
  const visibleUploadIds = new Set(
    uploads.filter((item) => item.documentId).map((item) => item.documentId),
  );
  const recentVisible = recent.filter((document) => !visibleUploadIds.has(document.id));

  const loadDemo = () => {
    demo.mutate(undefined, {
      onSuccess: (result) => {
        toast.push(`${result.total} synthetic demo documents queued.`, "success");
        navigate("/documents");
      },
      onError: (error) => toast.push(error.message, "error"),
    });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Scan & Upload</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add invoices, receipts and business documents — every stage runs on this device.
          </p>
        </div>
        <Button variant="outline" onClick={loadDemo} disabled={demo.isPending}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {demo.isPending ? "Generating…" : "Load Demo Data"}
        </Button>
      </div>

      <Dropzone onFiles={handleFiles} maxMb={maxMb} disabled={upload.isPending} />

      {upload.isPending && (
        <Card className="p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Storing file locally…
          </p>
        </Card>
      )}

      {uploads.length > 0 && (
        <div className="space-y-4">
          <h2 className="field-label">This session</h2>
          {uploads.map((item) => (
            <Card key={item.key} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">{item.fileName}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(item.fileSize)}</span>
                </div>
                {item.error ? (
                  <span className="flex items-center gap-1.5 text-xs text-rose-600" role="alert">
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> {item.error}
                  </span>
                ) : item.documentId ? (
                  <Link
                    to={`/documents/${item.documentId}`}
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View progress →
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Uploading…
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="field-label">Recent documents</h2>
          <Link
            to="/documents"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            View all →
          </Link>
        </div>
        {documents.isLoading && <Skeleton className="h-40" />}
        {documents.isSuccess && recentVisible.length === 0 && uploads.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No documents yet. Drop a file above to get started.
          </Card>
        )}
        <div className="space-y-4">
          {recentVisible.map((document) => (
            <PipelineCard key={document.id} document={document} />
          ))}
        </div>
      </div>
    </div>
  );
}
