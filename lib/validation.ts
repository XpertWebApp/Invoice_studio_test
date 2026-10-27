import { formatDate, isIsoDate, parseDate } from "./invoice";
import {
  bpsToInput,
  centsToInput,
  computeTotals,
  formatCents,
  lineTotalCents,
  millsToInput,
  parseMoneyToCents,
  parsePercentToBps,
  parseQuantity,
  parseUnitPriceToMills,
  quantityToInput,
} from "./money";
import type {
  CustomField,
  FieldErrors,
  InvoiceDraft,
  InvoiceInput,
  LineItem,
  Party,
  ValidationResult,
} from "./types";

/** Sanity limits so totals always stay inside safe integer range. */
const MAX_LINE_CENTS = 1_000_000_000_000; // $10 billion per line
const MAX_TAX_BPS = 1_000_000; // 10000%
export const MAX_TEXT = 2000;
export const MAX_ITEMS = 200;
export const MAX_CUSTOM_FIELDS = 50;

const MSG_NUMBER = "Enter a number like 12.50";
const MSG_DATE = "Enter a date as DD-MM-YYYY";

const msgTooLong = () => `Use at most ${MAX_TEXT} characters`;
const msgTooManyItems = () => `Use at most ${MAX_ITEMS} line items`;
const msgTooManyFields = () => `Use at most ${MAX_CUSTOM_FIELDS} custom fields`;

type Parser = (s: string) => number | null;

type Parsed = { ok: true; value: number } | { ok: false; error: string };

/**
 * Parses a typed numeric string. Empty means 0. Negative values are reported
 * as "<label> cannot be negative".
 */
function parseField(raw: string, parser: Parser, label: string, maxDp: number): Parsed {
  const s = raw.trim();
  if (s === "") return { ok: true, value: 0 };
  const v = parser(s);
  if (v === null) {
    // Distinguish "too many decimals" from "not a number".
    const m = /^(.*)\.(\d+)$/.exec(s);
    if (m && m[2].length > maxDp && parser(`${m[1]}.${m[2].slice(0, maxDp)}`) !== null) {
      return { ok: false, error: `Use at most ${maxDp} decimal places` };
    }
    return { ok: false, error: MSG_NUMBER };
  }
  if (v < 0) return { ok: false, error: `${label} cannot be negative` };
  return { ok: true, value: v };
}

/**
 * A line is blank only when it has no description, no unit price (empty or 0)
 * and a quantity that would not raise a validation error (empty or a valid
 * non-negative number). Anything else must still be validated and reported.
 */
function isBlankLine(item: { description: string; unitPrice: string; quantity: string }): boolean {
  if (item.description.trim() !== "") return false;
  const price = item.unitPrice.trim();
  if (price !== "" && parseUnitPriceToMills(price) !== 0) return false;
  const qty = item.quantity.trim();
  if (qty === "") return true;
  const q = parseQuantity(qty);
  return q !== null && q >= 0;
}

function parseDraftDate(raw: string, emptyMsg: string): { value: string } | { error: string } {
  if (raw.trim() === "") return { error: emptyMsg };
  const iso = parseDate(raw);
  return iso ? { value: iso } : { error: MSG_DATE };
}

export function validateDraft(draft: InvoiceDraft): ValidationResult {
  const errors: FieldErrors = {};

  if (draft.number.length > MAX_TEXT) errors.number = msgTooLong();
  else if (draft.number.trim() === "") errors.number = "Enter an invoice number";

  const issue = parseDraftDate(draft.issueDate, "Enter an issue date as DD-MM-YYYY");
  const due = parseDraftDate(draft.dueDate, "Enter a due date as DD-MM-YYYY");
  if ("error" in issue) errors.issueDate = issue.error;
  if ("error" in due) errors.dueDate = due.error;
  if ("value" in issue && "value" in due && due.value < issue.value) {
    errors.dueDate = "Due date cannot be before the issue date";
  }

  for (const party of ["business", "customer"] as const) {
    for (const key of ["name", "address", "email"] as const) {
      if (draft[party][key].length > MAX_TEXT) errors[`${party}.${key}`] = msgTooLong();
    }
  }
  if (draft.notes.length > MAX_TEXT) errors.notes = msgTooLong();

  const items: LineItem[] = [];
  let itemsOk = true;
  const keptCount = draft.items.filter((i) => !isBlankLine(i)).length;
  if (keptCount > MAX_ITEMS) {
    errors.items = msgTooManyItems();
    itemsOk = false;
  }
  for (const item of draft.items) {
    if (isBlankLine(item)) continue;
    if (item.description.length > MAX_TEXT) {
      errors[`items.${item.id}.description`] = msgTooLong();
      itemsOk = false;
    }
    const qty = parseField(item.quantity, parseQuantity, "Quantity", 3);
    const price = parseField(item.unitPrice, parseUnitPriceToMills, "Unit price", 3);
    if (!qty.ok) {
      errors[`items.${item.id}.quantity`] = qty.error;
      itemsOk = false;
    }
    if (!price.ok) {
      errors[`items.${item.id}.unitPrice`] = price.error;
      itemsOk = false;
    }
    if (qty.ok && price.ok) {
      if (lineTotalCents(qty.value, price.value) > MAX_LINE_CENTS) {
        errors[`items.${item.id}.unitPrice`] = "This amount is too large";
        itemsOk = false;
      } else {
        items.push({
          id: item.id,
          description: item.description,
          quantity: qty.value,
          unitPriceMills: price.value,
        });
      }
    }
  }

  const discount = parseField(draft.discount, parseMoneyToCents, "Discount", 2);
  if (!discount.ok) errors.discount = discount.error;
  const tax = parseField(draft.taxRate, parsePercentToBps, "Tax rate", 2);
  if (!tax.ok) errors.taxRate = tax.error;
  else if (tax.value > MAX_TAX_BPS) errors.taxRate = "Enter a tax rate of 10000% or less";

  if (itemsOk && discount.ok) {
    const subtotal = computeTotals(items, 0, 0).subtotalCents;
    if (discount.value > subtotal) {
      errors.discount = `Discount cannot be more than the subtotal (${formatCents(subtotal)})`;
    }
  }

  if (draft.customFields.length > MAX_CUSTOM_FIELDS) errors.customFields = msgTooManyFields();
  for (const f of draft.customFields) {
    if (f.label.length > MAX_TEXT) errors[`customFields.${f.id}.label`] = msgTooLong();
    if (f.value.length > MAX_TEXT) errors[`customFields.${f.id}.value`] = msgTooLong();
    if (!errors[`customFields.${f.id}.label`] && f.label.trim() === "" && f.value.trim() !== "") {
      errors[`customFields.${f.id}.label`] = "Add a label or remove this field";
    }
  }

  if (Object.keys(errors).length > 0 || !("value" in issue) || !("value" in due) || !discount.ok || !tax.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      number: draft.number.trim(),
      issueDate: issue.value,
      dueDate: due.value,
      business: { ...draft.business },
      customer: { ...draft.customer },
      items,
      discountCents: discount.value,
      taxRateBps: tax.value,
      notes: draft.notes,
      customFields: draft.customFields.map((f) => ({ ...f })),
    },
  };
}

/** Lenient parse for the live preview. Never fails. */
export function previewFromDraft(draft: InvoiceDraft): InvoiceInput {
  const lenient = (raw: string, parser: Parser): number => {
    const s = raw.trim();
    if (s === "") return 0;
    const v = parser(s);
    return v === null || v < 0 ? 0 : v;
  };
  const items: LineItem[] = draft.items
    .filter((i) => !isBlankLine(i))
    .map((i) => ({
      id: i.id,
      description: i.description,
      quantity: lenient(i.quantity, parseQuantity),
      unitPriceMills: lenient(i.unitPrice, parseUnitPriceToMills),
    }));
  return {
    number: draft.number,
    issueDate: parseDate(draft.issueDate) ?? "",
    dueDate: parseDate(draft.dueDate) ?? "",
    business: { ...draft.business },
    customer: { ...draft.customer },
    items,
    discountCents: lenient(draft.discount, parseMoneyToCents),
    taxRateBps: Math.min(lenient(draft.taxRate, parsePercentToBps), MAX_TAX_BPS),
    notes: draft.notes,
    customFields: draft.customFields.map((f) => ({ ...f })),
  };
}

export function draftFromInvoice(invoice: InvoiceInput): InvoiceDraft {
  return {
    number: invoice.number,
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    business: { ...invoice.business },
    customer: { ...invoice.customer },
    items: invoice.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: quantityToInput(i.quantity),
      unitPrice: millsToInput(i.unitPriceMills),
    })),
    discount: centsToInput(invoice.discountCents),
    taxRate: bpsToInput(invoice.taxRateBps),
    notes: invoice.notes,
    customFields: invoice.customFields.map((f) => ({ ...f })),
  };
}

// ------------------------------------------------------- server-side check

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readText(obj: Rec, key: string, path: string, errors: FieldErrors, label: string): string {
  const v = obj[key];
  if (typeof v !== "string") {
    errors[path] = `${label} must be text`;
    return "";
  }
  if (v.length > MAX_TEXT) {
    errors[path] = msgTooLong();
  }
  return v;
}

function readParty(raw: unknown, name: "business" | "customer", errors: FieldErrors): Party {
  if (!isRec(raw)) {
    errors[name] = "Details are missing";
    return { name: "", address: "", email: "" };
  }
  return {
    name: readText(raw, "name", `${name}.name`, errors, "Name"),
    address: readText(raw, "address", `${name}.address`, errors, "Address"),
    email: readText(raw, "email", `${name}.email`, errors, "Email"),
  };
}

function readCents(v: unknown, path: string, label: string, errors: FieldErrors): number {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
    errors[path] = `${label} must be a whole number of cents`;
    return 0;
  }
  if (v < 0) {
    errors[path] = `${label} cannot be negative`;
    return 0;
  }
  if (!Number.isSafeInteger(v)) {
    errors[path] = `${label} is too large`;
    return 0;
  }
  return v;
}

/** Server-side check of an untrusted payload. Never throws. */
export function validateInvoiceInput(payload: unknown): ValidationResult {
  try {
    return validateInvoiceInputUnsafe(payload);
  } catch {
    return { ok: false, errors: { payload: "Invoice data could not be read" } };
  }
}

function validateInvoiceInputUnsafe(payload: unknown): ValidationResult {
  if (!isRec(payload)) return { ok: false, errors: { payload: "Send the invoice as a JSON object" } };
  const errors: FieldErrors = {};

  const number = readText(payload, "number", "number", errors, "Invoice number");
  if (!errors.number && number.trim() === "") errors.number = "Enter an invoice number";

  const dateField = (key: "issueDate" | "dueDate", label: string): string => {
    const v = payload[key];
    if (typeof v !== "string" || !isIsoDate(v)) {
      errors[key] = `${label} must be a real date as YYYY-MM-DD`;
      return "";
    }
    return v;
  };
  const issueDate = dateField("issueDate", "Issue date");
  const dueDate = dateField("dueDate", "Due date");
  if (issueDate && dueDate && dueDate < issueDate) {
    errors.dueDate = "Due date cannot be before the issue date";
  }

  const business = readParty(payload.business, "business", errors);
  const customer = readParty(payload.customer, "customer", errors);

  // Items
  const items: LineItem[] = [];
  let itemsOk = true;
  if (!Array.isArray(payload.items)) {
    errors.items = "Items must be a list";
    itemsOk = false;
  } else if (payload.items.length > MAX_ITEMS) {
    errors.items = msgTooManyItems();
    itemsOk = false;
  } else {
    payload.items.forEach((raw: unknown, idx: number) => {
      if (!isRec(raw)) {
        errors[`items.${idx}`] = "Line item is not valid";
        itemsOk = false;
        return;
      }
      const id = typeof raw.id === "string" && raw.id !== "" ? raw.id : null;
      if (id === null) {
        errors[`items.${idx}.id`] = "Line item needs an id";
        itemsOk = false;
      }
      const key = id ?? String(idx);
      const before = Object.keys(errors).length;
      const description = readText(raw, "description", `items.${key}.description`, errors, "Description");

      const q = raw.quantity;
      let quantity = 0;
      if (typeof q !== "number" || !Number.isFinite(q)) {
        errors[`items.${key}.quantity`] = "Quantity must be a number";
      } else if (q < 0) {
        errors[`items.${key}.quantity`] = "Quantity cannot be negative";
      } else if (Math.abs(q * 1000 - Math.round(q * 1000)) > 1e-6) {
        errors[`items.${key}.quantity`] = "Use at most 3 decimal places";
      } else if (!Number.isSafeInteger(Math.round(q * 1000))) {
        errors[`items.${key}.quantity`] = "Quantity is too large";
      } else {
        quantity = Math.round(q * 1000) / 1000;
      }

      const unitPriceMills = readCents(raw.unitPriceMills, `items.${key}.unitPrice`, "Unit price", errors);

      if (
        !errors[`items.${key}.quantity`] &&
        !errors[`items.${key}.unitPrice`] &&
        lineTotalCents(quantity, unitPriceMills) > MAX_LINE_CENTS
      ) {
        errors[`items.${key}.unitPrice`] = "This amount is too large";
      }
      if (Object.keys(errors).length > before || id === null) {
        itemsOk = false;
      } else {
        items.push({ id, description, quantity, unitPriceMills });
      }
    });
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.id)) {
        errors[`items.${it.id}.description`] = "Line item ids must be unique";
        itemsOk = false;
      }
      seen.add(it.id);
    }
  }

  const discountCents = readCents(payload.discountCents, "discount", "Discount", errors);
  const taxRateBps = readCents(payload.taxRateBps, "taxRate", "Tax rate", errors);
  if (!errors.taxRate && taxRateBps > MAX_TAX_BPS) errors.taxRate = "Enter a tax rate of 10000% or less";

  if (itemsOk && !errors.discount) {
    const subtotal = computeTotals(items, 0, 0).subtotalCents;
    if (discountCents > subtotal) {
      errors.discount = `Discount cannot be more than the subtotal (${formatCents(subtotal)})`;
    }
  }

  const notes = readText(payload, "notes", "notes", errors, "Notes");

  // Custom fields
  const customFields: CustomField[] = [];
  if (!Array.isArray(payload.customFields)) {
    errors.customFields = "Custom fields must be a list";
  } else if (payload.customFields.length > MAX_CUSTOM_FIELDS) {
    errors.customFields = msgTooManyFields();
  } else {
    payload.customFields.forEach((raw: unknown, idx: number) => {
      if (!isRec(raw)) {
        errors[`customFields.${idx}`] = "Custom field is not valid";
        return;
      }
      const id = typeof raw.id === "string" && raw.id !== "" ? raw.id : null;
      if (id === null) errors[`customFields.${idx}.id`] = "Custom field needs an id";
      const key = id ?? String(idx);
      const label = readText(raw, "label", `customFields.${key}.label`, errors, "Label");
      const value = readText(raw, "value", `customFields.${key}.value`, errors, "Value");
      if (typeof raw.visible !== "boolean") {
        errors[`customFields.${key}.visible`] = "Visible must be true or false";
      }
      if (!errors[`customFields.${key}.label`] && label.trim() === "" && value.trim() !== "") {
        errors[`customFields.${key}.label`] = "Add a label or remove this field";
      }
      if (id !== null) customFields.push({ id, label, value, visible: raw.visible === true });
    });
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      number,
      issueDate,
      dueDate,
      business,
      customer,
      items,
      discountCents,
      taxRateBps,
      notes,
      customFields,
    },
  };
}
