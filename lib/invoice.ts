import type { CustomField, InvoiceDraft, LineItemDraft } from "./types";

/** Random id for line items and custom fields. Works in browser and Node. */
export function newId(): string {
  const c: Crypto | undefined = typeof crypto === "undefined" ? undefined : crypto;
  // randomUUID only exists in secure contexts (HTTPS or localhost).
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The only filter for custom fields. Preview, print and email all use it. */
export function visibleCustomFields(fields: CustomField[]): CustomField[] {
  return fields.filter((f) => f.visible && (f.label.trim() || f.value.trim()));
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** "2026-10-20" -> "20-10-2026". Returns the input unchanged if not ISO. */
export function formatDate(iso: string): string {
  const m = ISO_RE.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** "20-10-2026" (or "5-1-2026") -> "2026-10-20". Null if not a real date. */
export function parseDate(dmy: string): string | null {
  const m = DMY_RE.exec(dmy.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!isRealDate(y, mo, d)) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** True for a real calendar date in ISO "YYYY-MM-DD" form. */
export function isIsoDate(iso: string): boolean {
  const m = ISO_RE.exec(iso);
  return !!m && isRealDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Today in the user's local timezone, ISO. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds whole days to an ISO date. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Next number in the INV-0001 sequence, based on existing numbers. */
export function suggestInvoiceNumber(existing: string[]): string {
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)\s*$/.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

export function emptyLineItem(): LineItemDraft {
  return { id: newId(), description: "", quantity: "1", unitPrice: "" };
}

export function emptyCustomField(): CustomField {
  return { id: newId(), label: "", value: "", visible: true };
}

/** A fresh draft: issued today, due in 14 days, one blank line. */
export function emptyDraft(number = "INV-0001", now: Date = new Date()): InvoiceDraft {
  const issue = todayIso(now);
  return {
    number,
    issueDate: formatDate(issue),
    dueDate: formatDate(addDaysIso(issue, 14)),
    business: { name: "", address: "", email: "" },
    customer: { name: "", address: "", email: "" },
    items: [emptyLineItem()],
    discount: "0",
    taxRate: "0",
    notes: "",
    customFields: [],
  };
}
