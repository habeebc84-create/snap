import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "../pages/Dashboard";
import Documents from "../pages/Documents";
import DocumentViewer from "../pages/DocumentViewer";
import ReviewQueue from "../pages/ReviewQueue";
import { ToastProvider } from "../components/toast";
import type { DocumentDetail } from "../types";

type RouteHandler = unknown | ((url: string) => unknown);

function mockFetch(routes: Record<string, RouteHandler>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url + (init?.body ? ` BODY:${String(init.body)}` : ""));
    for (const [key, handler] of Object.entries(routes)) {
      if (url.includes(key)) {
        const body = typeof handler === "function" ? (handler as (u: string) => unknown)(url) : handler;
        return {
          ok: true,
          status: 200,
          json: async () => body,
          text: async () => JSON.stringify(body),
          headers: new Headers({ "content-type": "application/json" }),
        } as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "not_found", message: "Not found" } }),
      text: async () => JSON.stringify({ error: { code: "not_found", message: "Not found" } }),
      headers: new Headers({ "content-type": "application/json" }),
    } as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { calls, fetchMock };
}

function renderWithProviders(ui: React.ReactElement, route = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const settingsFixture = {
  ocr_language: "eng",
  confidence_threshold: 0.75,
  max_file_size_mb: 25,
  parallel_processing: false,
  cloud_processing: false,
  telemetry: false,
  anonymous_analytics: false,
  auto_delete_temp: true,
  retention_days: 30,
  export_format: "csv",
  export_include_confidence: true,
  export_include_validation: true,
  theme: "system",
  confidence_high: 0.9,
  confidence_medium: 0.75,
};

const analyticsFixture = {
  kpis: {
    total_documents: 42,
    processed_today: 5,
    needs_review: 7,
    failed: 0,
    storage_used_bytes: 1_800_000,
    audit_entries: 20,
  },
  by_type: [
    { type: "invoice", count: 30 },
    { type: "receipt", count: 12 },
  ],
  over_time: Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.now() - (29 - index) * 86400_000).toISOString().slice(0, 10),
    count: index % 5,
  })),
  totals: { invoice_value: 120400, invoice_tax: 18400, invoices: 30, receipts: 12 },
  confidence: { average: 0.9, high: 30, medium: 8, review: 4 },
  review: { needs_review: 7, rate: 0.16 },
  validation: { passed: 80, failed: 12 },
  performance: {
    avg_processing_ms: 2100,
    storage: { documents_bytes: 1_700_000, database_bytes: 60_000, processed_bytes: 40_000 },
  },
};

const detailFixture: DocumentDetail = {
  id: "abc123",
  filename: "INV-2026-1042.pdf",
  document_type: "invoice",
  status: "completed",
  file_type: "pdf",
  file_size: 20480,
  page_count: 1,
  overall_confidence: 0.94,
  processing_time_ms: 1900,
  is_demo: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  error_message: null,
  classification: { document_type: "invoice", confidence: 0.97, model: "heuristic" },
  fields: [
    {
      name: "invoice_number",
      value: "INV-2026-1042",
      confidence: 0.93,
      source: "pattern",
      is_corrected: false,
      original_value: null,
      band: "high",
    },
    {
      name: "total",
      value: "12440.00",
      confidence: 0.61,
      source: "pattern",
      is_corrected: false,
      original_value: null,
      band: "review",
    },
  ],
  line_items: [
    { position: 0, description: "Cement Bags", quantity: 20, unit_price: 420, tax: 1512, total: 9912 },
  ],
  validations: [
    {
      rule: "total_consistency",
      passed: false,
      message: "⚠ Total mismatch — expected 12,040.00, extracted 12,440.00",
      severity: "error",
      fields: ["total"],
      details: {},
    },
    {
      rule: "gstin_format",
      passed: true,
      message: "GSTIN structure is valid",
      severity: "error",
      fields: ["gstin"],
      details: {},
    },
  ],
  pages: [{ page_number: 1, width: 2472, height: 3200 }],
  ocr_text: "Tax Invoice\nInvoice No: INV-2026-1042",
  ocr_confidence: 0.91,
  review_actions: [],
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Dashboard", () => {
  it("renders KPIs from the database", async () => {
    mockFetch({
      "/api/analytics": analyticsFixture,
      "/api/search": { total: 1, items: [] },
      "/api/settings": settingsFixture,
    });
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Total documents")).toBeInTheDocument();
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText(/processed locally/i)).toBeInTheDocument();
  });

  it("shows the empty state when there are no documents", async () => {
    mockFetch({
      "/api/analytics": { ...analyticsFixture, kpis: { ...analyticsFixture.kpis, total_documents: 0 } },
      "/api/search": { total: 0, items: [] },
      "/api/settings": settingsFixture,
    });
    renderWithProviders(<Dashboard />);
    expect(await screen.findByText("Your document workspace is empty.")).toBeInTheDocument();
    expect(screen.getAllByText(/Scan Document/i).length).toBeGreaterThan(0);
  });
});

describe("Documents search", () => {
  it("debounces the query and hits the local search endpoint", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetch({
      "/api/search": { total: 0, items: [] },
      "/api/settings": settingsFixture,
    });
    renderWithProviders(<Documents />);

    const input = screen.getByLabelText("Search documents");
    await user.type(input, "ABC Traders");

    await waitFor(
      () => {
        expect(calls.some((url) => url.includes("q=ABC%20Traders") || url.includes("q=ABC+Traders"))).toBe(true);
      },
      { timeout: 3000 },
    );
    expect(screen.getByDisplayValue("ABC Traders")).toBeInTheDocument();
  });
});

describe("Document viewer", () => {
  const renderViewer = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/documents/abc123"]}>
          <ToastProvider>
            <Routes>
              <Route path="/documents/:id" element={<DocumentViewer />} />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("shows classification, fields with confidence, and validation", async () => {
    mockFetch({
      "/api/documents/abc123": detailFixture,
      "/api/settings": settingsFixture,
    });
    renderViewer();

    expect(await screen.findByText("INV-2026-1042.pdf")).toBeInTheDocument();
    expect(screen.getByText("Invoice number")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-1042")).toBeInTheDocument();
    expect(screen.getByText(/Total mismatch/)).toBeInTheDocument();
    expect(screen.getByText(/GSTIN structure is valid/)).toBeInTheDocument();
    expect(screen.getAllByText(/Review recommended/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cement Bags/)).toBeInTheDocument();
  });

  it("saves a corrected field to the local database", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetch({
      "/api/documents/abc123": detailFixture,
      "/api/settings": settingsFixture,
    });
    renderViewer();

    await screen.findByText("INV-2026-1042.pdf");
    await user.click(screen.getByRole("button", { name: "Edit Total" }));
    const input = screen.getByLabelText("Correct Total");
    await user.clear(input);
    await user.type(input, "12040.00");
    await user.click(screen.getByRole("button", { name: "Save value" }));

    await waitFor(() => {
      const reviewCall = calls.find(
        (url) => url.includes("/review") && url.includes("field_name"),
      );
      expect(reviewCall).toBeTruthy();
      expect(reviewCall).toContain("12040.00");
    });
  });
});

describe("Review queue", () => {
  it("lists queue documents and submits corrections", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetch({
      "/api/search": {
        total: 1,
        items: [
          {
            id: "abc123",
            filename: "INV-2026-1042.pdf",
            document_type: "invoice",
            status: "needs_review",
            file_type: "pdf",
            file_size: 20480,
            page_count: 1,
            overall_confidence: 0.61,
            processing_time_ms: 1900,
            is_demo: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: null,
          },
        ],
      },
      "/api/documents/abc123": detailFixture,
      "/api/settings": settingsFixture,
    });
    renderWithProviders(<ReviewQueue />, "/review");

    // Editor loads the selected document
    expect(await screen.findByText("INV-2026-1042.pdf")).toBeInTheDocument();
    const input = await screen.findByLabelText("Corrected value for Total");
    await user.clear(input);
    await user.type(input, "12040.00");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save 1 change/ })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /Save 1 change/ }));

    await waitFor(() => {
      const reviewCall = calls.find((url) => url.includes("/review") && url.includes("12040.00"));
      expect(reviewCall).toBeTruthy();
    });
  });
});
