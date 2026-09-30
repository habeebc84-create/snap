import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ConfidenceBar, StatusBadge, TypeBadge, PipelineStages } from "../components/status";
import { Dropzone } from "../components/Dropzone";
import { Button } from "../components/ui";
import { DocumentTable } from "../pages/Documents";
import type { DocumentSummary } from "../types";

const makeDocument = (overrides: Partial<DocumentSummary> = {}): DocumentSummary => ({
  id: "abc123",
  filename: "invoice_1042.pdf",
  document_type: "invoice",
  status: "completed",
  file_type: "pdf",
  file_size: 102400,
  page_count: 1,
  overall_confidence: 0.94,
  processing_time_ms: 2100,
  is_demo: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  error_message: null,
  ...overrides,
});

describe("ConfidenceBar", () => {
  it("renders the rounded percentage with an accessible progressbar", () => {
    render(<ConfidenceBar value={0.94} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "94");
    expect(screen.getByText("94%")).toBeInTheDocument();
  });

  it("clamps to the 0–100 range", () => {
    render(<ConfidenceBar value={1.5} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("StatusBadge & TypeBadge", () => {
  it("labels known statuses", () => {
    render(<StatusBadge status="needs_review" />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("prettifies document types", () => {
    render(<TypeBadge type="purchase_order" />);
    expect(screen.getByText("Purchase order")).toBeInTheDocument();
  });
});

describe("PipelineStages", () => {
  it("shows all pipeline stages", () => {
    render(<PipelineStages status="ocr" />);
    expect(screen.getByText("File validated")).toBeInTheDocument();
    expect(screen.getByText("OCR extraction")).toBeInTheDocument();
    expect(screen.getByText("Validating data")).toBeInTheDocument();
  });

  it("surfaces friendly failure messages", () => {
    render(
      <PipelineStages status="failed" errorMessage="We couldn't find any readable text." />,
    );
    expect(screen.getByText(/couldn't find any readable text/)).toBeInTheDocument();
  });
});

describe("Dropzone", () => {
  it("accepts supported files and forwards them", async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} maxMb={25} />);

    const file = new File(["%PDF-1.4 fake"], "invoice.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.upload(input, file);

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe("invoice.pdf");
  });

  it("is keyboard operable", () => {
    render(<Dropzone onFiles={vi.fn()} />);
    const zone = screen.getByRole("button", { name: /drop documents here/i });
    expect(zone).toHaveAttribute("tabindex", "0");
  });
});

describe("DocumentTable", () => {
  const documents = [
    makeDocument(),
    makeDocument({ id: "def456", filename: "receipt_882.webp", document_type: "receipt", status: "needs_review", overall_confidence: 0.62 }),
  ];

  it("renders document rows with status and confidence", () => {
    render(
      <MemoryRouter>
        <DocumentTable documents={documents} onDelete={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("invoice_1042.pdf")).toBeInTheDocument();
    expect(screen.getByText("receipt_882.webp")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("links each row to its document workspace", () => {
    render(
      <MemoryRouter>
        <DocumentTable documents={documents} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Open").length).toBe(2);
    expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(2);
  });

  it("invokes delete with the right document", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <DocumentTable documents={documents} onDelete={onDelete} />
      </MemoryRouter>,
    );
    await user.click(screen.getAllByRole("button", { name: /delete invoice_1042.pdf/i })[0]);
    expect(onDelete).toHaveBeenCalledWith(documents[0]);
  });
});

describe("Button", () => {
  it("fires onClick and stays accessible", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Scan Document</Button>);
    await user.click(screen.getByRole("button", { name: "Scan Document" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("respects disabled state", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Upload
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
