import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/money";
import type { InvoiceDraft, InvoiceInput } from "@/lib/types";
import {
  draftFromInvoice,
  previewFromDraft,
  validateDraft,
  validateInvoiceInput,
} from "@/lib/validation";

function draft(over: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    number: "INV-0001",
    issueDate: "01-10-2026",
    dueDate: "15-10-2026",
    business: { name: "Acme Studio", address: "1 Fake St", email: "hi@acme.test" },
    customer: { name: "Globex", address: "2 Fake Ave", email: "pay@globex.test" },
    items: [{ id: "a", description: "Design", quantity: "2", unitPrice: "50" }],
    discount: "10",
    taxRate: "10",
    notes: "Thanks",
    customFields: [],
    ...over,
  };
}

function errorsOf(d: InvoiceDraft) {
  const r = validateDraft(d);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
}

function input(over: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    number: "INV-0001",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    business: { name: "Acme", address: "A", email: "a@acme.test" },
    customer: { name: "Globex", address: "B", email: "b@globex.test" },
    items: [{ id: "a", description: "Design", quantity: 2, unitPriceMills: 50000 }],
    discountCents: 1000,
    taxRateBps: 1000,
    notes: "",
    customFields: [],
    ...over,
  };
}

describe("validateDraft", () => {
  it("valid draft gives the right InvoiceInput", () => {
    const r = validateDraft(draft());
    expect(r).toEqual({
      ok: true,
      value: {
        number: "INV-0001",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        business: { name: "Acme Studio", address: "1 Fake St", email: "hi@acme.test" },
        customer: { name: "Globex", address: "2 Fake Ave", email: "pay@globex.test" },
        items: [{ id: "a", description: "Design", quantity: 2, unitPriceMills: 50000 }],
        discountCents: 1000,
        taxRateBps: 1000,
        notes: "Thanks",
        customFields: [],
      },
    });
  });

  it("empty numeric strings mean 0", () => {
    const r = validateDraft(
      draft({ discount: "", taxRate: "", items: [{ id: "a", description: "X", quantity: "", unitPrice: "" }] }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.discountCents).toBe(0);
      expect(r.value.taxRateBps).toBe(0);
      expect(r.value.items[0]).toMatchObject({ quantity: 0, unitPriceMills: 0 });
    }
  });

  it("drops blank lines (no description, zero price)", () => {
    const r = validateDraft(
      draft({
        items: [
          { id: "a", description: "Design", quantity: "2", unitPrice: "50" },
          { id: "blank", description: "  ", quantity: "1", unitPrice: "" },
          { id: "blank2", description: "", quantity: "1", unitPrice: "0" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("requires number, issue date and due date", () => {
    const e = errorsOf(draft({ number: "  ", issueDate: "", dueDate: "" }));
    expect(e.number).toBe("Enter an invoice number");
    expect(e.issueDate).toBeTruthy();
    expect(e.dueDate).toBeTruthy();
  });

  it("negative values produce keyed messages", () => {
    const e = errorsOf(
      draft({
        items: [{ id: "x", description: "Thing", quantity: "-1", unitPrice: "-5" }],
        discount: "-2",
        taxRate: "-1",
      }),
    );
    expect(e["items.x.quantity"]).toBe("Quantity cannot be negative");
    expect(e["items.x.unitPrice"]).toBe("Unit price cannot be negative");
    expect(e.discount).toBe("Discount cannot be negative");
    expect(e.taxRate).toBe("Tax rate cannot be negative");
  });

  it("negative price on a line with no description is still an error", () => {
    const e = errorsOf(draft({ items: [{ id: "x", description: "", quantity: "1", unitPrice: "-5" }] }));
    expect(e["items.x.unitPrice"]).toBe("Unit price cannot be negative");
  });

  it("unparseable and too many decimals", () => {
    const e = errorsOf(
      draft({
        items: [{ id: "x", description: "T", quantity: "1.2345", unitPrice: "abc" }],
        discount: "1.234",
        taxRate: "ten",
      }),
    );
    expect(e["items.x.quantity"]).toBe("Use at most 3 decimal places");
    expect(e["items.x.unitPrice"]).toBe("Enter a number like 12.50");
    expect(e.discount).toBe("Use at most 2 decimal places");
    expect(e.taxRate).toBe("Enter a number like 12.50");
  });

  it("discount greater than subtotal", () => {
    const e = errorsOf(
      draft({ items: [{ id: "a", description: "D", quantity: "2", unitPrice: "50" }], discount: "100.01" }),
    );
    expect(e.discount).toBe("Discount cannot be more than the subtotal ($100.00)");
  });

  it("discount equal to subtotal is fine", () => {
    expect(validateDraft(draft({ discount: "100" })).ok).toBe(true);
  });

  it("skips the discount check when a line has errors", () => {
    const e = errorsOf(
      draft({ items: [{ id: "x", description: "D", quantity: "zzz", unitPrice: "50" }], discount: "999" }),
    );
    expect(e.discount).toBeUndefined();
    expect(e["items.x.quantity"]).toBeTruthy();
  });

  it("due date before issue date", () => {
    const e = errorsOf(draft({ issueDate: "15-10-2026", dueDate: "01-10-2026" }));
    expect(e.dueDate).toBe("Due date cannot be before the issue date");
  });

  it("same-day due date is allowed", () => {
    expect(validateDraft(draft({ dueDate: "01-10-2026" })).ok).toBe(true);
  });

  it("invalid date 31-02-2026", () => {
    const e = errorsOf(draft({ issueDate: "31-02-2026" }));
    expect(e.issueDate).toBe("Enter a date as DD-MM-YYYY");
  });

  it("custom field with value but no label errors; never affects totals", () => {
    const e = errorsOf(draft({ customFields: [{ id: "c1", label: " ", value: "PO 7", visible: true }] }));
    expect(e["customFields.c1.label"]).toBe("Add a label or remove this field");

    const base = validateDraft(draft());
    const withFields = validateDraft(
      draft({
        customFields: [
          { id: "c1", label: "PO", value: "1000000", visible: true },
          { id: "c2", label: "Hidden", value: "999", visible: false },
          { id: "c3", label: "", value: "", visible: true },
        ],
      }),
    );
    expect(base.ok && withFields.ok).toBe(true);
    if (base.ok && withFields.ok) {
      const t = (v: InvoiceInput) => computeTotals(v.items, v.discountCents, v.taxRateBps);
      expect(t(withFields.value)).toEqual(t(base.value));
      expect(withFields.value.customFields).toHaveLength(3);
    }
  });

  it("rejects absurdly large amounts instead of overflowing", () => {
    const e = errorsOf(draft({ items: [{ id: "x", description: "D", quantity: "999999.999", unitPrice: "9007199254740" }] }));
    expect(e["items.x.unitPrice"]).toBeTruthy();
  });

  it("reports a bad quantity on an otherwise blank row", () => {
    const blank = { id: "b", description: "", quantity: "-3", unitPrice: "" };
    const e = errorsOf(draft({ items: [...draft().items, blank] }));
    expect(e["items.b.quantity"]).toBe("Quantity cannot be negative");
    const e2 = errorsOf(draft({ items: [...draft().items, { ...blank, quantity: "abc" }] }));
    expect(e2["items.b.quantity"]).toBeTruthy();
  });

  it("still drops a blank row with the default quantity", () => {
    const blank = { id: "b", description: "", quantity: "1", unitPrice: "" };
    const r = validateDraft(draft({ items: [...draft().items, blank] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.items.map((i) => i.id)).toEqual(["a"]);
  });
});

describe("validateDraft size limits", () => {
  it("rejects too many line items on the items key", () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      id: `i${i}`,
      description: "X",
      quantity: "1",
      unitPrice: "1",
    }));
    expect(errorsOf(draft({ items, discount: "" })).items).toBe("Use at most 200 line items");
  });

  it("rejects over-long notes on the notes key", () => {
    const e = errorsOf(draft({ notes: "x".repeat(2001) }));
    expect(e.notes).toBe("Use at most 2000 characters");
  });
});

describe("previewFromDraft", () => {
  it("is lenient: bad and negative values become 0, bad dates become empty", () => {
    const p = previewFromDraft(
      draft({
        issueDate: "31-02-2026",
        dueDate: "nope",
        items: [
          { id: "a", description: "A", quantity: "abc", unitPrice: "5" },
          { id: "b", description: "B", quantity: "-2", unitPrice: "-5" },
          { id: "blank", description: "", quantity: "1", unitPrice: "" },
        ],
        discount: "x",
        taxRate: "-4",
      }),
    );
    expect(p.issueDate).toBe("");
    expect(p.dueDate).toBe("");
    expect(p.items).toEqual([
      { id: "a", description: "A", quantity: 0, unitPriceMills: 5000 },
      { id: "b", description: "B", quantity: 0, unitPriceMills: 0 },
    ]);
    expect(p.discountCents).toBe(0);
    expect(p.taxRateBps).toBe(0);
  });

  it("matches the validated value for a valid draft", () => {
    const r = validateDraft(draft());
    expect(r.ok && r.value).toEqual(previewFromDraft(draft()));
  });
});

describe("draftFromInvoice", () => {
  it("round trips through validateDraft", () => {
    const inv = input({
      items: [{ id: "a", description: "Fine", quantity: 1.5, unitPriceMills: 333 }],
      discountCents: 5,
      taxRateBps: 825,
      customFields: [{ id: "c", label: "PO", value: "9", visible: false }],
    });
    const d = draftFromInvoice(inv);
    expect(d.issueDate).toBe("01-10-2026");
    expect(d.items[0]).toEqual({ id: "a", description: "Fine", quantity: "1.5", unitPrice: "0.333" });
    expect(d.discount).toBe("0.05");
    expect(d.taxRate).toBe("8.25");
    const r = validateDraft(d);
    expect(r.ok && r.value).toEqual(inv);
  });
});

describe("validateInvoiceInput", () => {
  it("accepts a valid payload", () => {
    const r = validateInvoiceInput(input());
    expect(r).toEqual({ ok: true, value: input() });
  });

  it("strips unknown keys at every level", () => {
    const payload = {
      ...input({ discountCents: 0 }),
      totals: { totalCents: 1 },
      _id: "evil",
      business: { name: "A", address: "B", email: "c", extra: 1 },
      items: [{ id: "a", description: "D", quantity: 1, unitPriceMills: 1000, totalCents: 5 }],
      customFields: [{ id: "c", label: "L", value: "V", visible: true, x: 1 }],
    };
    const r = validateInvoiceInput(payload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value).sort()).toEqual(
        ["business", "customFields", "customer", "discountCents", "dueDate", "issueDate", "items", "notes", "number", "taxRateBps"].sort(),
      );
      expect(r.value.business).toEqual({ name: "A", address: "B", email: "c" });
      expect(r.value.items[0]).toEqual({ id: "a", description: "D", quantity: 1, unitPriceMills: 1000 });
      expect(r.value.customFields[0]).toEqual({ id: "c", label: "L", value: "V", visible: true });
    }
  });

  it("rejects non-integer cents, mills and bps", () => {
    const r = validateInvoiceInput(
      input({
        discountCents: 10.5,
        taxRateBps: 8.25,
        items: [{ id: "a", description: "D", quantity: 1, unitPriceMills: 0.5 }],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.discount).toBeTruthy();
      expect(r.errors.taxRate).toBeTruthy();
      expect(r.errors["items.a.unitPrice"]).toBeTruthy();
    }
  });

  it("rejects negatives, 4 dp quantity and NaN/Infinity", () => {
    const r = validateInvoiceInput(
      input({
        discountCents: -1,
        taxRateBps: -5,
        items: [
          { id: "a", description: "D", quantity: -1, unitPriceMills: -1 },
          { id: "b", description: "D", quantity: 1.0001, unitPriceMills: 1 },
          { id: "c", description: "D", quantity: Infinity, unitPriceMills: 1 },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["items.a.quantity"]).toBe("Quantity cannot be negative");
      expect(r.errors["items.a.unitPrice"]).toBe("Unit price cannot be negative");
      expect(r.errors["items.b.quantity"]).toBe("Use at most 3 decimal places");
      expect(r.errors["items.c.quantity"]).toBeTruthy();
      expect(r.errors.discount).toBe("Discount cannot be negative");
      expect(r.errors.taxRate).toBe("Tax rate cannot be negative");
    }
  });

  it("checks discount, dates and number", () => {
    const r = validateInvoiceInput(
      input({ discountCents: 10001, dueDate: "2026-09-30", number: "  ", issueDate: "2026-02-31" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.discount).toBe("Discount cannot be more than the subtotal ($100.00)");
      expect(r.errors.number).toBe("Enter an invoice number");
      expect(r.errors.issueDate).toBeTruthy();
    }
    const r2 = validateInvoiceInput(input({ dueDate: "2026-09-30" }));
    expect(!r2.ok && r2.errors.dueDate).toBe("Due date cannot be before the issue date");
  });

  it("rejects bad shapes without throwing", () => {
    const bad: unknown[] = [
      null,
      undefined,
      42,
      "str",
      [],
      {},
      { ...input(), items: "nope" },
      { ...input(), items: [null, 5, "x"] },
      { ...input(), business: null },
      { ...input(), customer: "x" },
      { ...input(), customFields: {} },
      { ...input(), customFields: [{ id: "c", label: 1, value: null, visible: "yes" }] },
      { ...input(), notes: 5 },
      { ...input(), number: 5 },
      { ...input(), discountCents: "10" },
    ];
    for (const b of bad) {
      expect(() => validateInvoiceInput(b)).not.toThrow();
      expect(validateInvoiceInput(b).ok).toBe(false);
    }
  });

  it("enforces size caps", () => {
    const longNote = validateInvoiceInput(input({ notes: "x".repeat(2001) }));
    expect(!longNote.ok && longNote.errors.notes).toBeTruthy();
    const manyItems = validateInvoiceInput(
      input({ items: Array.from({ length: 201 }, (_, i) => ({ id: `i${i}`, description: "", quantity: 1, unitPriceMills: 0 })), discountCents: 0 }),
    );
    expect(!manyItems.ok && manyItems.errors.items).toBeTruthy();
    const manyFields = validateInvoiceInput(
      input({ customFields: Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, label: "L", value: "V", visible: true })) }),
    );
    expect(!manyFields.ok && manyFields.errors.customFields).toBeTruthy();
  });

  it("custom field with a value but no label is rejected; fields do not change totals", () => {
    const r = validateInvoiceInput(input({ customFields: [{ id: "c1", label: "", value: "x", visible: true }] }));
    expect(!r.ok && r.errors["customFields.c1.label"]).toBe("Add a label or remove this field");

    const a = validateInvoiceInput(input());
    const b = validateInvoiceInput(input({ customFields: [{ id: "c1", label: "Total", value: "999999", visible: true }] }));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      const t = (v: InvoiceInput) => computeTotals(v.items, v.discountCents, v.taxRateBps);
      expect(t(b.value)).toEqual(t(a.value));
    }
  });

  it("does not trim values it keeps", () => {
    const r = validateInvoiceInput(input({ number: " INV-9 " }));
    expect(r.ok && r.value.number).toBe(" INV-9 ");
  });
});
