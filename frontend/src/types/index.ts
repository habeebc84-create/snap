export type DocumentStatus =
  | "uploaded"
  | "queued"
  | "preprocessing"
  | "ocr"
  | "classifying"
  | "extracting"
  | "validating"
  | "completed"
  | "needs_review"
  | "failed";

export type DocumentType =
  | "invoice"
  | "receipt"
  | "purchase_order"
  | "contract"
  | "form"
  | "other"
  | "unclassified";

export const ACTIVE_STATUSES: DocumentStatus[] = [
  "uploaded",
  "queued",
  "preprocessing",
  "ocr",
  "classifying",
  "extracting",
  "validating",
];

export interface DocumentSummary {
  id: string;
  filename: string;
  document_type: DocumentType | string;
  status: DocumentStatus;
  file_type: string;
  file_size: number;
  page_count: number;
  overall_confidence: number;
  processing_time_ms: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

export interface Classification {
  document_type: string;
  confidence: number;
  model: string;
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  source: string;
  is_corrected: boolean;
  original_value: string | null;
  band: "high" | "medium" | "review";
}

export interface LineItem {
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax: number;
  total: number;
}

export interface ValidationRule {
  rule: string;
  passed: boolean;
  message: string;
  severity: "error" | "warning";
  fields: string[];
  details: Record<string, unknown>;
}

export interface PageImage {
  page_number: number;
  width: number;
  height: number;
}

export interface ReviewAction {
  field_name: string;
  original_value: string;
  new_value: string;
  created_at: string;
}

export interface DocumentDetail extends DocumentSummary {
  classification: Classification | null;
  fields: ExtractedField[];
  line_items: LineItem[];
  validations: ValidationRule[];
  pages: PageImage[];
  ocr_text: string;
  ocr_confidence: number;
  review_actions: ReviewAction[];
}

export interface SearchResult {
  total: number;
  items: DocumentSummary[];
}

export interface StatusPayload {
  id: string;
  status: DocumentStatus;
  document_type: string;
  overall_confidence: number;
  page_count: number;
  error_message: string | null;
  updated_at: string;
}

export interface Analytics {
  kpis: {
    total_documents: number;
    processed_today: number;
    needs_review: number;
    failed: number;
    storage_used_bytes: number;
    audit_entries: number;
  };
  by_type: { type: string; count: number }[];
  over_time: { date: string; count: number }[];
  totals: {
    invoice_value: number;
    invoice_tax: number;
    invoices: number;
    receipts: number;
  };
  confidence: { average: number; high: number; medium: number; review: number };
  review: { needs_review: number; rate: number };
  validation: { passed: number; failed: number };
  performance: {
    avg_processing_ms: number;
    storage: {
      documents_bytes: number;
      database_bytes: number;
      processed_bytes: number;
    };
  };
}

export interface AppSettings {
  ocr_language: string;
  confidence_threshold: number;
  max_file_size_mb: number;
  parallel_processing: boolean;
  cloud_processing: boolean;
  telemetry: boolean;
  anonymous_analytics: boolean;
  auto_delete_temp: boolean;
  retention_days: number;
  export_format: "json" | "csv" | "xlsx" | "pdf";
  export_include_confidence: boolean;
  export_include_validation: boolean;
  theme: "light" | "dark" | "system";
  confidence_high: number;
  confidence_medium: number;
}

export interface SecurityStatus {
  local_processing: boolean;
  no_cloud_upload: boolean;
  local_database: boolean;
  audit_logging: boolean;
  document_deletion: boolean;
  offline_mode: boolean;
  privacy: {
    cloud_processing: boolean;
    telemetry: boolean;
    anonymous_analytics: boolean;
  };
  storage: {
    documents_bytes: number;
    database_bytes: number;
    processed_bytes: number;
    total_bytes: number;
  };
  database_path: string;
  document_storage_path: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: string;
  created_at: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  runtime: string;
  version: string | null;
  installed: boolean;
  status: string;
  fallback: string | null;
}
