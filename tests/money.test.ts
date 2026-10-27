import { describe, expect, it } from "vitest";
import {
  bpsToInput,
  centsToInput,
  computeTotals,
  formatBps,
  formatCents,
  formatMills,
  formatQuantity,
  lineTotalCents,
  millsToInput,
  parseMoneyToCents,
  parsePercentToBps,
  parseQuantity,
  parseUnitPriceToMills,
  quantityToInput,
} from "@/lib/money";

describe("computeTotals", () => {
  it("2 x $50.00, $10 discount, 10% tax = $99.00", () => {
    const t = computeTotals([{ quantity: 2, unitPriceMills: 50000 }], 1000, 1000);
    expect(t.lineTotalsCents).toEqual([10000]);
    expect(t.subtotalCents).toBe(10000);
    expect(t.discountCents).toBe(1000);
    expect(t.discountedCents).toBe(9000);
    expect(t.taxCents).toBe(900);
    expect(t.totalCents).toBe(9900);
  });

  it("rounds each line to cents: 3 x $0.333 = 100 cents", () => {
    expect(lineTotalCents(3, 333)).toBe(100);
    expect(computeTotals([{ quantity: 3, unitPriceMills: 333 }], 0, 0).totalCents).toBe(100);
  });

  it("rounds half up: 1.5 x $0.333 = 49.95 cents -> 50", () => {
    expect(lineTotalCents(1.5, 333)).toBe(50);
    expect(lineTotalCents(0.333, 1)).toBe(0);
    expect(lineTotalCents(1, 5)).toBe(1); // exactly half a cent
    expect(lineTotalCents(1, 4)).toBe(0);
  });

  it("handles fractional quantities exactly", () => {
    expect(lineTotalCents(0.1, 30000)).toBe(300);
    expect(lineTotalCents(1.005, 100000)).toBe(10050);
  });

  it("zero items gives all zeros", () => {
    expect(computeTotals([], 0, 0)).toEqual({
      lineTotalsCents: [],
      subtotalCents: 0,
      discountCents: 0,
      discountedCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("discount equal to subtotal gives zero discounted, tax and total", () => {
    const t = computeTotals([{ quantity: 1, unitPriceMills: 25000 }], 2500, 1000);
    expect(t.discountedCents).toBe(0);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(0);
  });

  it("does not throw or go negative when discount exceeds subtotal", () => {
    const t = computeTotals([{ quantity: 1, unitPriceMills: 1000 }], 5000, 1000);
    expect(t.discountedCents).toBe(0);
    expect(t.totalCents).toBe(0);
  });

  it("rounds tax half up", () => {
    // $0.05 at 10% = 0.5 cents -> 1
    const a = computeTotals([{ quantity: 1, unitPriceMills: 50 }], 0, 1000);
    expect(a.taxCents).toBe(1);
    expect(a.totalCents).toBe(6);
    // 8.25% on $19.99 = 164.9175 -> 165
    const b = computeTotals([{ quantity: 1, unitPriceMills: 19990 }], 0, 825);
    expect(b.taxCents).toBe(165);
    expect(b.totalCents).toBe(2164);
  });

  it("subtotal sums ROUNDED line totals", () => {
    const t = computeTotals(
      [
        { quantity: 1, unitPriceMills: 5 },
        { quantity: 1, unitPriceMills: 5 },
      ],
      0,
      0,
    );
    expect(t.lineTotalsCents).toEqual([1, 1]);
    expect(t.subtotalCents).toBe(2);
  });

  it("stays exact for large amounts", () => {
    const t = computeTotals([{ quantity: 999999.999, unitPriceMills: 999999999 }], 0, 825);
    expect(Number.isSafeInteger(t.totalCents)).toBe(true);
  });
});

describe("parsers", () => {
  it("parseMoneyToCents", () => {
    expect(parseMoneyToCents("10")).toBe(1000);
    expect(parseMoneyToCents("10.5")).toBe(1050);
    expect(parseMoneyToCents("1,000.25")).toBe(100025);
    expect(parseMoneyToCents(" $12.34 ")).toBe(1234);
    expect(parseMoneyToCents("10.")).toBe(1000);
    expect(parseMoneyToCents(".5")).toBe(50);
    expect(parseMoneyToCents("-3")).toBe(-300);
    expect(parseMoneyToCents("-0")).toBe(0);
    expect(Object.is(parseMoneyToCents("-0"), 0)).toBe(true);
  });

  it("parseMoneyToCents rejects bad input", () => {
    for (const s of ["", "  ", "abc", "1.234", "1.2.3", "1,00", "12,34.5", "1e3", "Infinity", "NaN", ".", "-", "$", "1 000", "--1"]) {
      expect(parseMoneyToCents(s), s).toBeNull();
    }
    expect(parseMoneyToCents("99999999999999999999")).toBeNull();
  });

  it("parseUnitPriceToMills", () => {
    expect(parseUnitPriceToMills("0.333")).toBe(333);
    expect(parseUnitPriceToMills("50")).toBe(50000);
    expect(parseUnitPriceToMills("$1,200.5")).toBe(1200500);
    expect(parseUnitPriceToMills("0.0001")).toBeNull();
    expect(parseUnitPriceToMills("-1")).toBe(-1000);
  });

  it("parseQuantity", () => {
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity("0.333")).toBe(0.333);
    expect(parseQuantity("1,000")).toBe(1000);
    expect(parseQuantity("-2")).toBe(-2);
    expect(parseQuantity("1.2345")).toBeNull();
    expect(parseQuantity("$2")).toBeNull();
    expect(parseQuantity("two")).toBeNull();
  });

  it("parsePercentToBps", () => {
    expect(parsePercentToBps("10")).toBe(1000);
    expect(parsePercentToBps("8.25")).toBe(825);
    expect(parsePercentToBps("8.25%")).toBe(825);
    expect(parsePercentToBps("0.5")).toBe(50);
    expect(parsePercentToBps("8.255")).toBeNull();
    expect(parsePercentToBps("-1")).toBe(-100);
  });
});

describe("formatters", () => {
  it("formatCents", () => {
    expect(formatCents(123450)).toBe("$1,234.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(-100)).toBe("-$1.00");
    expect(formatCents(100000000)).toBe("$1,000,000.00");
  });

  it("formatMills", () => {
    expect(formatMills(333)).toBe("$0.333");
    expect(formatMills(50000)).toBe("$50.00");
    expect(formatMills(12500)).toBe("$12.50");
    expect(formatMills(1234567)).toBe("$1,234.567");
  });

  it("formatQuantity and formatBps", () => {
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(0.333)).toBe("0.333");
    expect(formatBps(1000)).toBe("10");
    expect(formatBps(825)).toBe("8.25");
    expect(formatBps(50)).toBe("0.5");
  });

  it("*ToInput produce plain editable strings that round trip", () => {
    expect(centsToInput(1050)).toBe("10.5");
    expect(centsToInput(1000)).toBe("10");
    expect(centsToInput(5)).toBe("0.05");
    expect(millsToInput(333)).toBe("0.333");
    expect(millsToInput(50000)).toBe("50");
    expect(quantityToInput(1.5)).toBe("1.5");
    expect(quantityToInput(1234)).toBe("1234");
    expect(bpsToInput(825)).toBe("8.25");
    expect(bpsToInput(0)).toBe("0");
    expect(parseMoneyToCents(centsToInput(123456))).toBe(123456);
    expect(parseUnitPriceToMills(millsToInput(1234567))).toBe(1234567);
    expect(parseQuantity(quantityToInput(0.001))).toBe(0.001);
  });
});
