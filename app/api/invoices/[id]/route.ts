import { connection, NextResponse } from "next/server";
import { getInvoicesCollection, toInvoice } from "@/lib/db";
import { computeTotals } from "@/lib/money";
import { validateInvoiceInput } from "@/lib/validation";
import { dbUnavailable, errorResponse, parseObjectId, readJson, VALIDATION_MESSAGE } from "../../_lib/http";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "Invoice not found";

export async function GET(_request: Request, { params }: Ctx) {
  await connection();
  const { id } = await params;
  const oid = parseObjectId(id);
  if (!oid) return errorResponse(404, NOT_FOUND);
  try {
    const col = await getInvoicesCollection();
    const doc = await col.findOne({ _id: oid });
    if (!doc) return errorResponse(404, NOT_FOUND);
    return NextResponse.json(toInvoice(doc));
  } catch (err) {
    return dbUnavailable(err);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  const oid = parseObjectId(id);
  if (!oid) return errorResponse(404, NOT_FOUND);

  const parsed = await readJson(request);
  if (!parsed.ok) return errorResponse(400, "Invalid JSON");

  const result = validateInvoiceInput(parsed.body);
  if (!result.ok) return errorResponse(400, VALIDATION_MESSAGE, result.errors);

  const input = result.value;
  try {
    const col = await getInvoicesCollection();
    // $set only content fields so createdAt is kept.
    const doc = await col.findOneAndUpdate(
      { _id: oid },
      {
        $set: {
          ...input,
          totals: computeTotals(input.items, input.discountCents, input.taxRateBps),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
    if (!doc) return errorResponse(404, NOT_FOUND);
    return NextResponse.json(toInvoice(doc));
  } catch (err) {
    return dbUnavailable(err);
  }
}
