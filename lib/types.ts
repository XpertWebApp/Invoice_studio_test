/**
 * Shared contract for the whole app. UI, API routes, money and validation
 * modules all import from here.
 *
 * Units (all integers unless noted):
 * - Computed money (line totals, subtotal, discount, tax, total): cents.
 * - Unit price: mills, i.e. thousandths of a dollar ($0.333 = 333). This keeps
 *   sub-cent rates exact so per-line rounding to cents is meaningful.
 * - Quantity: decimal number with at most 3 decimal places.
 * - Tax rate: basis points (10% = 1000, 8.25% = 825).
 * - Dates: ISO "YYYY-MM-DD" in storage and API. Shown and typed as "DD-MM-YYYY".
 *
 * Function contracts implemented elsewhere:
 *
 * lib/money.ts (pure, no UI code)
 *   lineTotalCents(quantity: number, unitPriceMills: number): number
 *   computeTotals(items: Pick<LineItem, "quantity" | "unitPriceMills">[],
 *                 discountCents: number, taxRateBps: number): Totals
 *   parseMoneyToCents(input: string): number | null     // "10", "10.5", "1,000.25"; null if not a number or > 2 dp
 *   parseUnitPriceToMills(input: string): number | null // up to 3 dp
 *   parseQuantity(input: string): number | null         // up to 3 dp
 *   parsePercentToBps(input: string): number | null     // up to 2 dp
 *   (parsers accept a leading "-" and return a negative number, so validation
 *    can show "cannot be negative" rather than "not a number")
 *   formatCents(cents: number): string                  // "$1,234.50"
 *   formatMills(mills: number): string                  // "$0.333", "$50.00" (min 2, max 3 dp)
 *   formatQuantity(quantity: number): string            // "2", "1.5", "0.333"
 *   formatBps(bps: number): string                      // "10", "8.25" (no % sign)
 *   centsToInput / millsToInput / quantityToInput / bpsToInput: number -> string
 *     (plain editable strings without "$" or grouping, used to build a draft)
 *
 * lib/validation.ts (pure, shared by client and server)
 *   validateDraft(draft: InvoiceDraft): ValidationResult
 *   validateInvoiceInput(payload: unknown): ValidationResult
 *   previewFromDraft(draft: InvoiceDraft): InvoiceInput
 *     Lenient parse for the live preview: never fails, anything unparseable
 *     or negative becomes 0, unparseable dates become "". Totals for the
 *     preview come from computeTotals on this result.
 *   draftFromInvoice(invoice: InvoiceInput): InvoiceDraft
 *
 * Draft rules (validateDraft):
 *   - Empty numeric strings mean 0 (discount, tax rate, unit price, quantity).
 *   - Lines with empty description AND zero unit price are dropped from the
 *     value (and from previewFromDraft), so a fresh blank row is harmless.
 *   - Required: number, issueDate, dueDate. Nothing else is required.
 *   - Errors: negative or unparseable numbers, too many decimals, discount >
 *     subtotal, due date before issue date, invalid DD-MM-YYYY dates.
 *
 * lib/invoice.ts
 *   see that file.
 */

export interface Party {
  name: string;
  address: string;
  email: string;
}

export interface LineItem {
  /** Stable client-generated id. Used as React key and in error keys. */
  id: string;
  description: string;
  quantity: number;
  unitPriceMills: number;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
  visible: boolean;
}

/** Validated, typed invoice content. What the client sends to the API. */
export interface InvoiceInput {
  number: string;
  issueDate: string; // ISO YYYY-MM-DD
  dueDate: string; // ISO YYYY-MM-DD
  business: Party;
  customer: Party;
  items: LineItem[];
  discountCents: number;
  taxRateBps: number;
  notes: string;
  customFields: CustomField[];
}

export interface Totals {
  /** Same order as items. */
  lineTotalsCents: number[];
  subtotalCents: number;
  discountCents: number;
  /** subtotal - discount */
  discountedCents: number;
  taxCents: number;
  totalCents: number;
}

/** Invoice as returned by the API. Totals are always server-computed. */
export interface Invoice extends InvoiceInput {
  id: string;
  totals: Totals;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/** Row in the saved invoices list (GET /api/invoices). */
export interface InvoiceSummary {
  id: string;
  number: string;
  customerName: string;
  issueDate: string; // ISO YYYY-MM-DD
  totalCents: number;
  updatedAt: string;
}

/** Editor state. Numeric and date fields are raw strings exactly as typed. */
export interface LineItemDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string; // dollars, e.g. "50" or "0.333"
}

export interface InvoiceDraft {
  number: string;
  issueDate: string; // "DD-MM-YYYY" as typed
  dueDate: string; // "DD-MM-YYYY" as typed
  business: Party;
  customer: Party;
  items: LineItemDraft[];
  discount: string; // dollars
  taxRate: string; // percent
  notes: string;
  customFields: CustomField[];
}

/**
 * Error messages keyed by field path. Item and custom field keys use the
 * stable id, never the array index:
 *   "number", "issueDate", "dueDate", "discount", "taxRate",
 *   "business.name", "customer.email",
 *   "items.<id>.description", "items.<id>.quantity", "items.<id>.unitPrice",
 *   "customFields.<id>.label"
 * Messages say what to do, e.g. "Quantity cannot be negative".
 */
export type FieldErrors = Record<string, string>;

export type ValidationResult =
  | { ok: true; value: InvoiceInput }
  | { ok: false; errors: FieldErrors };

/** Error body for any non-2xx API response. */
export interface ApiError {
  error: string;
  fieldErrors?: FieldErrors;
}

/** Body of a successful POST /api/invoices/[id]/send. */
export interface SendResult {
  ok: true;
  /** Masked recipient, e.g. "te***@example.com". */
  sentTo: string;
}
