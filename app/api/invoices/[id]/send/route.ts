import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getInvoicesCollection, toInvoice } from "@/lib/db";
import { buildInvoiceEmail } from "@/lib/email";
import { computeTotals } from "@/lib/money";
import { validateInvoiceInput } from "@/lib/validation";
import type { SendResult } from "@/lib/types";
import { dbUnavailable, errorResponse, parseObjectId } from "../../../_lib/http";

type Ctx = { params: Promise<{ id: string }> };

function maskEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 0) return "***";
  return `${address.slice(0, Math.min(2, at))}***@${address.slice(at + 1)}`;
}

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const oid = parseObjectId(id);
  if (!oid) return errorResponse(404, "Invoice not found");

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.TEST_EMAIL_TO;
  if (!apiKey || !from || !to) {
    console.error("[send] RESEND_API_KEY, EMAIL_FROM or TEST_EMAIL_TO is missing");
    return errorResponse(500, "Email is not configured on the server");
  }

  let stored;
  try {
    const col = await getInvoicesCollection();
    stored = await col.findOne({ _id: oid });
  } catch (err) {
    return dbUnavailable(err);
  }
  if (!stored) return errorResponse(404, "Invoice not found");

  const invoice = toInvoice(stored);
  const check = validateInvoiceInput(invoice);
  if (!check.ok) {
    return errorResponse(422, "This invoice has errors. Fix them and save before sending.", check.errors);
  }
  const content = check.value;
  const toSend = {
    ...invoice,
    ...content,
    totals: computeTotals(content.items, content.discountCents, content.taxRateBps),
  };
  const { subject, html, text } = buildInvoiceEmail(toSend);

  try {
    const resend = new Resend(apiKey);
    // Recipient is ONLY the server-configured test address.
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) {
      console.error("[send] Resend rejected the email:", error.name, error.message);
      return errorResponse(
        502,
        "The email service rejected this message. Check the sender address and that the recipient is allowed on your Resend account.",
      );
    }
  } catch (err) {
    console.error("[send] Resend request failed:", err instanceof Error ? err.message : err);
    return errorResponse(502, "Could not reach the email service. Try again in a moment.");
  }

  const body: SendResult = { ok: true, sentTo: maskEmail(to) };
  return NextResponse.json(body);
}
