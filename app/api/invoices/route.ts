import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getInvoicesCollection, toInvoice, type InvoiceDoc } from "@/lib/db";
import { computeTotals } from "@/lib/money";
import { validateInvoiceInput } from "@/lib/validation";
import type { InvoiceSummary } from "@/lib/types";
import { dbUnavailable, errorResponse, readJson, VALIDATION_MESSAGE } from "../_lib/http";

export async function GET() {
  // Opt out of build-time prerendering (cacheComponents): always run per request.
  await connection();
  try {
    const col = await getInvoicesCollection();
    const docs = await col
      .find({}, { projection: { number: 1, "customer.name": 1, issueDate: 1, "totals.totalCents": 1, updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    const list: InvoiceSummary[] = docs.map((d) => ({
      id: d._id.toHexString(),
      number: d.number,
      customerName: d.customer?.name ?? "",
      issueDate: d.issueDate,
      totalCents: d.totals?.totalCents ?? 0,
      updatedAt: d.updatedAt.toISOString(),
    }));
    return NextResponse.json(list);
  } catch (err) {
    return dbUnavailable(err);
  }
}

export async function POST(request: Request) {
  const parsed = await readJson(request);
  if (!parsed.ok) return errorResponse(400, "Invalid JSON");

  const result = validateInvoiceInput(parsed.body);
  if (!result.ok) return errorResponse(400, VALIDATION_MESSAGE, result.errors);

  const input = result.value;
  const now = new Date();
  try {
    const col = await getInvoicesCollection();
    const doc = {
      ...input,
      totals: computeTotals(input.items, input.discountCents, input.taxRateBps),
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await col.insertOne(doc as InvoiceDoc);
    return NextResponse.json(toInvoice({ ...doc, _id: insertedId }), { status: 201 });
  } catch (err) {
    return dbUnavailable(err);
  }
}
