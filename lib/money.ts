import type { LineItem, Totals } from "./types";

/**
 * All money logic. Pure integer math: cents for computed amounts, mills
 * (1/1000 dollar) for unit prices, thousandths for quantity during math,
 * basis points for tax. Rounding is always half up.
 */

/** Round-half-up division of integers (BigInt keeps huge products exact). */
function roundDiv(n: bigint, d: bigint): number {
  // floor((2n + d) / 2d) for d > 0, correct for negatives too.
  const zero = BigInt(0);
  const num = BigInt(2) * n + d;
  const den = BigInt(2) * d;
  let q = num / den;
  if (num % den !== zero && num < zero) q -= BigInt(1);
  return Number(q);
}

/** quantity x unit price (mills), rounded half up to whole cents. */
export function lineTotalCents(quantity: number, unitPriceMills: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPriceMills)) return 0;
  const qtyMilli = Math.round(quantity * 1000);
  // cents = (qtyMilli / 1000) * (mills / 1000) * 100 = qtyMilli * mills / 10000
  const product = BigInt(qtyMilli) * BigInt(Math.round(unitPriceMills));
  return roundDiv(product, BigInt(10000));
}

export function computeTotals(
  items: Pick<LineItem, "quantity" | "unitPriceMills">[],
  discountCents: number,
  taxRateBps: number,
): Totals {
  const lineTotalsCents = items.map((i) => lineTotalCents(i.quantity, i.unitPriceMills));
  const subtotalCents = lineTotalsCents.reduce((a, b) => a + b, 0);
  const discountedCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = roundDiv(BigInt(discountedCents) * BigInt(Math.round(taxRateBps)), BigInt(10000));
  return {
    lineTotalsCents,
    subtotalCents,
    discountCents,
    discountedCents,
    taxCents,
    totalCents: discountedCents + taxCents,
  };
}

// ---------------------------------------------------------------- parsing

const NUMBER_RE = /^(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d*))?$/;

/** Parses a decimal string into an integer scaled by 10^dp. Null if invalid. */
function parseScaled(input: string, dp: number, allowDollar: boolean, allowPercent = false): number | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (allowDollar && s.startsWith("$")) s = s.slice(1);
  if (allowPercent && s.endsWith("%")) s = s.slice(0, -1);
  const m = NUMBER_RE.exec(s);
  if (!m) return null;
  const intPart = m[1] ?? "";
  const fracPart = m[2] ?? "";
  if (intPart === "" && fracPart === "") return null;
  if (fracPart.length > dp) return null;
  const scale = 10 ** dp;
  const total =
    Number(intPart.replace(/,/g, "") || "0") * scale + Number(fracPart.padEnd(dp, "0") || "0");
  if (!Number.isSafeInteger(total)) return null;
  if (total === 0) return 0;
  return negative ? -total : total;
}

export function parseMoneyToCents(input: string): number | null {
  return parseScaled(input, 2, true);
}

export function parseUnitPriceToMills(input: string): number | null {
  return parseScaled(input, 3, true);
}

export function parseQuantity(input: string): number | null {
  const v = parseScaled(input, 3, false);
  return v === null ? null : v / 1000;
}

export function parsePercentToBps(input: string): number | null {
  return parseScaled(input, 2, false, true);
}

// ------------------------------------------------------------- formatting

/** Integer scaled by 10^dp -> decimal string with `minDp`..`dp` decimals. */
function scaledToString(n: number, dp: number, minDp: number): string {
  const negative = n < 0;
  const abs = Math.abs(Math.round(n));
  const scale = 10 ** dp;
  const whole = Math.floor(abs / scale);
  let frac = String(abs % scale).padStart(dp, "0");
  while (frac.length > minDp && frac.endsWith("0")) frac = frac.slice(0, -1);
  const body = frac ? `${whole}.${frac}` : String(whole);
  return negative && abs !== 0 ? `-${body}` : body;
}

function group(wholeAndFrac: string): string {
  const neg = wholeAndFrac.startsWith("-");
  const [w, f] = (neg ? wholeAndFrac.slice(1) : wholeAndFrac).split(".");
  const grouped = w.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${grouped}${f !== undefined ? `.${f}` : ""}`;
}

export function formatCents(cents: number): string {
  const s = group(scaledToString(cents, 2, 2));
  return s.startsWith("-") ? `-$${s.slice(1)}` : `$${s}`;
}

export function formatMills(mills: number): string {
  const s = group(scaledToString(mills, 3, 2));
  return s.startsWith("-") ? `-$${s.slice(1)}` : `$${s}`;
}

export function formatQuantity(quantity: number): string {
  return group(scaledToString(Math.round(quantity * 1000), 3, 0));
}

export function formatBps(bps: number): string {
  return scaledToString(bps, 2, 0);
}

export function centsToInput(cents: number): string {
  return scaledToString(cents, 2, 0);
}

export function millsToInput(mills: number): string {
  return scaledToString(mills, 3, 0);
}

export function quantityToInput(quantity: number): string {
  return scaledToString(Math.round(quantity * 1000), 3, 0);
}

export function bpsToInput(bps: number): string {
  return scaledToString(bps, 2, 0);
}
