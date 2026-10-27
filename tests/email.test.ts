import { describe, expect, it } from "vitest";
import { buildInvoiceEmail } from "../lib/email";
import { computeTotals } from "../lib/money";
import type { Invoice, LineItem } from "../lib/types";

const items: LineItem[] = [
  { id: "a", description: "Design <b>work</b>", quantity: 2, unitPriceMills: 50000 },
];

function make(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "1",
    number: "INV-0001",
    issueDate: "2026-10-20",
    dueDate: "2026-11-03",
    business: { name: "Acme & Co", address: "1 Main St\nSpringfield", email: "hi@acme.test" },
    customer: { name: "Bob", address: "2 Side Rd", email: "bob@example.test" },
    items,
    discountCents: 1000,
    taxRateBps: 1000,
    notes: "Thanks",
    customFields: [
      { id: "f1", label: "PO number", value: "PO-77", visible: true },
      { id: "f2", label: "Secret label", value: "hidden-value-xyz", visible: false },
    ],
    totals: computeTotals(items, 1000, 1000),
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildInvoiceEmail", () => {
  it("subject uses number and business name, with fallback", () => {
    expect(buildInvoiceEmail(make()).subject).toBe("Invoice INV-0001 from Acme & Co");
    const blank = make({ business: { name: " ", address: "", email: "" } });
    expect(buildInvoiceEmail(blank).subject).toBe("Invoice INV-0001 from Invoice Studio");
  });

  it("includes visible custom fields and omits hidden ones in html and text", () => {
    const { html, text } = buildInvoiceEmail(make());
    for (const out of [html, text]) {
      expect(out).toContain("PO number");
      expect(out).toContain("PO-77");
      expect(out).not.toContain("Secret label");
      expect(out).not.toContain("hidden-value-xyz");
    }
  });

  it("escapes user strings", () => {
    const { html } = buildInvoiceEmail(
      make({ customer: { name: "<script>alert(1)</script>", address: "", email: "" } }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Design &lt;b&gt;work&lt;/b&gt;");
    expect(html).toContain("Acme &amp; Co");
  });

  it("preserves address line breaks", () => {
    expect(buildInvoiceEmail(make()).html).toContain("1 Main St<br>Springfield");
  });

  it("shows formatted totals ($99.00 case)", () => {
    const { html, text } = buildInvoiceEmail(make());
    for (const out of [html, text]) {
      expect(out).toContain("$100.00");
      expect(out).toContain("-$10.00");
      expect(out).toContain("$99.00");
    }
  });

  it("omits the discount line when zero", () => {
    const inv = make({ discountCents: 0, totals: computeTotals(items, 0, 1000) });
    expect(buildInvoiceEmail(inv).text).not.toContain("Discount");
  });

  it("shows dates as DD-MM-YYYY", () => {
    const { html, text } = buildInvoiceEmail(make());
    for (const out of [html, text]) {
      expect(out).toContain("20-10-2026");
      expect(out).toContain("03-11-2026");
      expect(out).not.toContain("2026-10-20");
    }
  });
});
