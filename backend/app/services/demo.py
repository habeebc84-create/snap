"""Synthetic demo documents.

Everything generated here is clearly marked SYNTHETIC and uses invented
companies/people — never real personal data. PDFs are rendered locally with
reportlab and then flow through the exact same pipeline as user uploads.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.config import settings
from app.security.files import store_document

W, H = letter


def _demo_invoice(path: Path, *, number: str, date_line: str, due_line: str, wrong_total: bool = False) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(60, H - 70, "ACME TRADERS (DEMO)")
    c.setFont("Helvetica", 10)
    c.drawString(60, H - 88, "SYNTHETIC DEMO DOCUMENT - NOT A REAL INVOICE")
    c.drawString(60, H - 110, "Plot 12, Industrial Estate, Pune 411019")
    c.drawString(60, H - 126, "GSTIN: 27AAACA1234A1Z5")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(60, H - 156, "Tax Invoice")
    c.setFont("Helvetica", 11)
    c.drawString(60, H - 180, f"Invoice No: {number}")
    c.drawString(60, H - 198, f"Invoice Date: {date_line}")
    c.drawString(60, H - 216, f"Due Date: {due_line}")

    c.drawString(60, H - 248, "Bill To:")
    c.drawString(60, H - 266, "Nimbus Retail Pvt Ltd")
    c.drawString(60, H - 284, "42 MG Road, Bengaluru 560001")
    c.drawString(60, H - 302, "GSTIN: 29ABCDE1234F1Z5")

    y = H - 344
    c.setFont("Helvetica-Bold", 10)
    headers = [("Description", 60), ("Qty", 300), ("Rate", 360), ("Tax%", 430), ("Amount", 490)]
    for label, x in headers:
        c.drawString(x, y, label)
    c.line(60, y - 6, 540, y - 6)
    c.setFont("Helvetica", 10)

    rows = [
        ("Cement Bags", "20", "420.00", "18", "9912.00"),
        ("PVC Pipes", "10", "260.00", "18", "3068.00"),
    ]
    y -= 26
    for row in rows:
        for value, (_, x) in zip(row, headers):
            c.drawString(x, y, value)
        y -= 20

    y -= 16
    subtotal, tax = "11,000.00", "1,980.00"
    total = "12,980.00" if not wrong_total else "13,280.00"
    for label, value in (("Subtotal", subtotal), ("Tax (18%)", tax), ("Grand Total", total)):
        c.setFont("Helvetica-Bold", 11)
        c.drawString(360, y, label)
        c.drawString(470, y, value)
        y -= 22
    c.setFont("Helvetica", 10)
    c.drawString(60, y - 18, "Payment Terms: Net 30")
    c.drawString(60, y - 36, "Email: billing@acmetraders.demo")
    c.drawString(60, y - 54, "Phone: 9876543210")
    if wrong_total:
        c.drawString(60, y - 80, "SYNTHETIC DEMO: totals intentionally inconsistent for review demo")
    c.save()


def _demo_receipt(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, H - 70, "QUICKMART STORES (DEMO)")
    c.setFont("Helvetica", 9)
    c.drawString(60, H - 86, "SYNTHETIC DEMO RECEIPT - NOT A REAL RECEIPT")
    c.setFont("Helvetica", 11)
    c.drawString(60, H - 112, "Receipt No: RCP-88213")
    c.drawString(60, H - 130, "Date: 26/09/2026")
    c.drawString(60, H - 148, "Time: 14:35")
    c.drawString(60, H - 166, "Store: Shivaji Nagar, Pune")

    y = H - 204
    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, y, "Item")
    c.drawString(300, y, "Qty")
    c.drawString(360, y, "Rate")
    c.drawString(460, y, "Amount")
    c.line(60, y - 6, 540, y - 6)
    c.setFont("Helvetica", 10)
    rows = [
        ("Fresh Milk 1L", "2", "62.00", "124.00"),
        ("Brown Bread", "1", "45.00", "45.00"),
    ]
    y -= 26
    for row in rows:
        c.drawString(60, y, row[0])
        c.drawString(300, y, row[1])
        c.drawString(360, y, row[2])
        c.drawString(460, y, row[3])
        y -= 22

    y -= 14
    for label, value in (("Subtotal", "169.00"), ("Tax", "6.00"), ("Discount", "5.00"), ("Total", "170.00")):
        c.setFont("Helvetica-Bold", 11)
        c.drawString(360, y, label)
        c.drawString(460, y, value)
        y -= 22
    c.setFont("Helvetica", 10)
    c.drawString(60, y - 16, "Payment Method: UPI")
    c.drawString(60, y - 34, "Thank you for your purchase!")
    c.save()


def _demo_purchase_order(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(60, H - 70, "NIMBUS RETAIL PVT LTD (DEMO)")
    c.setFont("Helvetica", 9)
    c.drawString(60, H - 86, "SYNTHETIC DEMO DOCUMENT - NOT A REAL PURCHASE ORDER")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(60, H - 118, "Purchase Order")
    c.setFont("Helvetica", 11)
    c.drawString(60, H - 144, "Purchase Order No: PO-2026-0771")
    c.drawString(60, H - 162, "Date: 21/09/2026")
    c.drawString(60, H - 180, "Expected Delivery: 05/10/2026")
    c.drawString(60, H - 206, "Supplier:")
    c.drawString(60, H - 224, "Acme Traders")
    c.drawString(60, H - 242, "Plot 12, Industrial Estate, Pune 411019")

    y = H - 284
    c.setFont("Helvetica-Bold", 10)
    headers = [("Description", 60), ("Qty", 300), ("Rate", 360), ("Amount", 470)]
    for label, x in headers:
        c.drawString(x, y, label)
    c.line(60, y - 6, 540, y - 6)
    c.setFont("Helvetica", 10)
    y -= 26
    rows = [
        ("Office Chairs", "15", "3,500.00", "52,500.00"),
        ("Writing Desks", "8", "7,200.00", "57,600.00"),
    ]
    for row in rows:
        for value, (_, x) in zip(row, headers):
            c.drawString(x, y, value)
        y -= 22
    c.setFont("Helvetica-Bold", 11)
    c.drawString(370, y - 16, "Total")
    c.drawString(470, y - 16, "1,10,100.00")
    c.setFont("Helvetica", 10)
    c.drawString(60, y - 52, "Terms of Purchase: Delivery in one lot")
    c.save()


def _demo_contract(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(60, H - 70, "SERVICE AGREEMENT (DEMO)")
    c.setFont("Helvetica", 9)
    c.drawString(60, H - 86, "SYNTHETIC DEMO DOCUMENT - NOT A REAL CONTRACT")
    c.setFont("Helvetica", 11)
    c.drawString(60, H - 116, "Date: 18/09/2026")
    y = H - 150
    paragraphs = [
        "This Agreement is made between Acme Traders (DEMO) and Nimbus Retail",
        "Pvt Ltd (DEMO) for the provision of consulting services described in",
        "Schedule A attached hereto.",
        "",
        "Terms and Conditions:",
        "1. The parties agree to the scope of work outlined in Schedule A.",
        "2. Payment shall be made within 30 days of invoice receipt.",
        "3. This Agreement shall be governed by the laws of India.",
        "4. Either party may terminate with 30 days written notice.",
        "",
        "IN WITNESS WHEREOF, the parties have executed this Agreement as of",
        "the date first written above.",
        "",
        "Signature (Provider): _________________  Date: ____________",
        "Signature (Client):   _________________  Date: ____________",
    ]
    for line in paragraphs:
        c.drawString(60, y, line)
        y -= 22
    c.save()


def _demo_form(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(60, H - 70, "VENDOR REGISTRATION FORM")
    c.setFont("Helvetica", 9)
    c.drawString(60, H - 86, "SYNTHETIC DEMO DOCUMENT - NOT A REAL FORM")
    c.setFont("Helvetica", 11)
    c.drawString(60, H - 118, "Form No: VR-0091")
    c.drawString(60, H - 136, "Date: 20/09/2026")
    y = H - 172
    for label in [
        "Company Name: ______________________________",
        "GSTIN: ______________________________________",
        "Email: ______________________________________",
        "Phone: ______________________________________",
        "",
        "Declaration: I hereby declare that the details provided above",
        "are correct to the best of my knowledge.",
        "",
        "Signature: _________________   Date: ____________",
    ]:
        c.drawString(60, y, label)
        y -= 24
    c.save()


def generate_demo_documents() -> list[tuple[str, str]]:
    """Create synthetic demo PDFs in storage. Returns [(document_id, filename)]."""
    specs: list[tuple[str, object]] = [
        ("demo_invoice_01.pdf", lambda p: _demo_invoice(
            p, number="INV-2026-1042", date_line="25 Sep 2026", due_line="25 Oct 2026")),
        ("demo_invoice_02.pdf", lambda p: _demo_invoice(
            p, number="INV-2026-1043", date_line="18 Sep 2026", due_line="18 Oct 2026", wrong_total=True)),
        ("demo_receipt_01.pdf", _demo_receipt),
        ("demo_purchase_order_01.pdf", _demo_purchase_order),
        ("demo_contract_01.pdf", _demo_contract),
        ("demo_form_01.pdf", _demo_form),
    ]

    created: list[tuple[str, str]] = []
    for filename, writer in specs:
        temp = settings.processed_path / f"_demo_{filename}"
        temp.parent.mkdir(parents=True, exist_ok=True)
        writer(temp)
        content = temp.read_bytes()
        temp.unlink(missing_ok=True)
        document_id, _stored = store_document(content, "pdf")
        created.append((document_id, filename))
    return created
