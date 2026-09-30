import { api, qs } from "./client";
import type {
  AppSettings,
  AuditEntry,
  Analytics,
  DocumentDetail,
  DocumentSummary,
  ModelInfo,
  SearchResult,
  SecurityStatus,
  StatusPayload,
} from "../types";

// ---------------------------------------------------------------- documents
export function listDocuments(
  params: Record<string, unknown> = {},
): Promise<SearchResult> {
  return api<SearchResult>(`/api/documents${qs(params)}`);
}

export function getDocument(id: string): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${id}`);
}

export function getStatus(id: string): Promise<StatusPayload> {
  return api<StatusPayload>(`/api/documents/${id}/status`);
}

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const form = new FormData();
  form.append("file", file, file.name);
  return api<DocumentSummary>("/api/documents/upload", {
    method: "POST",
    body: form,
  });
}

export function processDocument(id: string): Promise<{ id: string; status: string; queued: boolean }> {
  return api(`/api/documents/${id}/process`, { method: "POST" });
}

export function deleteDocument(id: string, purgeOcr = true): Promise<{ deleted: boolean }> {
  return api(`/api/documents/${id}${qs({ purge_ocr: purgeOcr })}`, { method: "DELETE" });
}

export interface ReviewPayload {
  fields: { field_name: string; value: string }[];
  note?: string;
}

export function reviewDocument(id: string, payload: ReviewPayload): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/api/documents/${id}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loadDemoData(): Promise<SearchResult> {
  return api<SearchResult>("/api/documents/demo", { method: "POST" });
}

export function pageImageUrl(id: string, page: number): string {
  return `/api/documents/${id}/pages/${page}/image`;
}

// ------------------------------------------------------------------- search
export function searchDocuments(params: Record<string, unknown>): Promise<SearchResult> {
  return api<SearchResult>(`/api/search${qs(params)}`);
}

// --------------------------------------------------------------- analytics
export function getAnalytics(): Promise<Analytics> {
  return api<Analytics>("/api/analytics");
}

// ---------------------------------------------------------------- settings
export function getSettings(): Promise<AppSettings> {
  return api<AppSettings>("/api/settings");
}

export function updateSettings(payload: Partial<AppSettings> & { consent?: boolean }): Promise<AppSettings> {
  return api<AppSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------- security
export function getSecurityStatus(): Promise<SecurityStatus> {
  return api<SecurityStatus>("/api/security/status");
}

export function getAuditLogs(params: Record<string, unknown> = {}): Promise<AuditEntry[]> {
  return api<AuditEntry[]>(`/api/audit-logs${qs(params)}`);
}

// ------------------------------------------------------------------ models
export function getModels(): Promise<ModelInfo[]> {
  return api<ModelInfo[]>("/api/models");
}

// ------------------------------------------------------------------ export
export function exportUrl(id: string, format: "json" | "csv" | "xlsx" | "pdf"): string {
  return `/api/export/${id}/${format}`;
}

export async function downloadExport(
  id: string,
  format: "json" | "csv" | "xlsx" | "pdf",
  fallbackName: string,
): Promise<void> {
  const response = await fetch(exportUrl(id, format));
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `${fallbackName}.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
