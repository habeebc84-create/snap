import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, digits = 1): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${units[unit]}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function confidenceLabel(score: number, medium = 0.75, high = 0.9): string {
  if (score >= high) return "High confidence";
  if (score >= medium) return "Medium confidence";
  return "Review recommended";
}

export function confidenceBand(score: number, medium = 0.75, high = 0.9): "high" | "medium" | "review" {
  if (score >= high) return "high";
  if (score >= medium) return "medium";
  return "review";
}

/** invoice_number → "Invoice number" */
export function prettifyField(name: string): string {
  const special: Record<string, string> = {
    gstin: "GSTIN",
    cgst: "CGST",
    sgst: "SGST",
    igst: "IGST",
    po: "PO",
  };
  const parts = name.split("_");
  if (parts.length === 1) {
    return special[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
  }
  const head = special[parts[0]] ?? parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return `${head} ${parts.slice(1).join(" ").toLowerCase()}`;
}

export function titleCase(value: string): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
