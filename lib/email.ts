import { visibleCustomFields, formatDate } from "./invoice";
import { formatBps, formatCents, formatMills, formatQuantity } from "./money";
import type { Invoice, Party } from "./types";

const ACCENT = "#0f766e";
const INK = "#1c1917";
const MUTED = "#78716c";
const RULE = "#e7e5e4";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Helvetica, Arial, sans-serif";
const NUM = "font-variant-numeric: tabular-nums;";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape, then keep user line breaks. */
function multiline(value: string): string {
  return escapeHtml(value.trim()).replace(/\r?\n/g, "<br>");
}

function senderName(invoice: Invoice): string {
  return invoice.business.name.trim() || "Invoice Studio";
}

function partyHtml(label: string, party: Party): string {
  const lines = [
    party.name.trim() ? `<div style="font-weight:bold;color:${INK};">${escapeHtml(party.name.trim())}</div>` : "",
    party.address.trim() ? `<div>${multiline(party.address)}</div>` : "",
    party.email.trim() ? `<div>${escapeHtml(party.email.trim())}</div>` : "",
  ].join("");
  return `<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${ACCENT};font-weight:bold;margin-bottom:6px;">${label}</div>
<div style="font-size:14px;line-height:1.5;color:${MUTED};">${lines || "&mdash;"}</div>`;
}

export function buildInvoiceEmail(invoice: Invoice): { subject: string; html: string; text: string } {
  const sender = senderName(invoice);
  const subject = `Invoice ${invoice.number} from ${sender}`;
  const { totals } = invoice;
  const fields = visibleCustomFields(invoice.customFields);
  const taxLabel = `Tax (${formatBps(invoice.taxRateBps)}%)`;
  const showDiscount = totals.discountCents > 0;

  const th = (text: string, align: "left" | "right") =>
    `<th align="${align}" style="padding:8px 0;border-bottom:2px solid ${INK};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};text-align:${align};font-family:${SANS};">${text}</th>`;
  const td = (content: string, align: "left" | "right") =>
    `<td align="${align}" style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:14px;color:${INK};text-align:${align};font-family:${SANS};${align === "right" ? NUM : ""}">${content}</td>`;

  const rows = invoice.items
    .map(
      (item, i) =>
        `<tr>${td(escapeHtml(item.description) || "&mdash;", "left")}${td(formatQuantity(item.quantity), "right")}${td(formatMills(item.unitPriceMills), "right")}${td(formatCents(totals.lineTotalsCents[i] ?? 0), "right")}</tr>`,
    )
    .join("");

  const totalRow = (label: string, value: string, strong = false) =>
    `<tr>
<td align="right" style="padding:6px 16px 6px 0;font-size:${strong ? 16 : 14}px;color:${strong ? INK : MUTED};font-family:${SANS};${strong ? "font-weight:bold;" : ""}">${label}</td>
<td align="right" width="120" style="padding:6px 0;font-size:${strong ? 18 : 14}px;color:${strong ? ACCENT : INK};font-family:${SANS};${NUM}${strong ? "font-weight:bold;" : ""}">${value}</td>
</tr>`;

  const totalsRows = [
    totalRow("Subtotal", formatCents(totals.subtotalCents)),
    showDiscount ? totalRow("Discount", `-${formatCents(totals.discountCents)}`) : "",
    totalRow(escapeHtml(taxLabel), formatCents(totals.taxCents)),
    `<tr><td colspan="2" style="padding:4px 0 0;border-top:2px solid ${INK};font-size:0;line-height:0;">&nbsp;</td></tr>`,
    totalRow("Total", formatCents(totals.totalCents), true),
  ].join("");

  const detailsBlock = fields.length
    ? `<tr><td style="padding:0 0 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${RULE};">
${fields
  .map(
    (f) =>
      `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:${MUTED};font-family:${SANS};width:40%;">${escapeHtml(f.label)}</td><td style="padding:6px 0;font-size:13px;color:${INK};font-family:${SANS};">${escapeHtml(f.value)}</td></tr>`,
  )
  .join("")}
</table></td></tr>`
    : "";

  const notesBlock = invoice.notes.trim()
    ? `<tr><td style="padding:24px 0 0;font-family:${SANS};">
<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${ACCENT};font-weight:bold;margin-bottom:6px;">Notes</div>
<div style="font-size:14px;line-height:1.5;color:${MUTED};">${multiline(invoice.notes)}</div></td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f3ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-top:4px solid ${ACCENT};">
<tr><td style="padding:32px;font-family:${SANS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 24px;"><div style="font-family:${SERIF};font-size:28px;color:${INK};">Invoice</div>
<div style="font-size:14px;color:${MUTED};margin-top:4px;">${escapeHtml(invoice.number)}</div></td></tr>
<tr><td style="padding:0 0 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top" width="50%" style="padding-right:12px;font-family:${SANS};">${partyHtml("From", invoice.business)}</td>
<td valign="top" width="50%" style="padding-left:12px;font-family:${SANS};">${partyHtml("Bill to", invoice.customer)}</td>
</tr></table></td></tr>
<tr><td style="padding:0 0 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${RULE};border-bottom:1px solid ${RULE};"><tr>
<td style="padding:12px 0;font-size:13px;color:${MUTED};font-family:${SANS};">Invoice number<br><span style="font-size:14px;color:${INK};font-weight:bold;">${escapeHtml(invoice.number)}</span></td>
<td style="padding:12px 0;font-size:13px;color:${MUTED};font-family:${SANS};">Issue date<br><span style="font-size:14px;color:${INK};font-weight:bold;${NUM}">${formatDate(invoice.issueDate)}</span></td>
<td style="padding:12px 0;font-size:13px;color:${MUTED};font-family:${SANS};">Due date<br><span style="font-size:14px;color:${INK};font-weight:bold;${NUM}">${formatDate(invoice.dueDate)}</span></td>
</tr></table></td></tr>
${detailsBlock}
<tr><td style="padding:8px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>${th("Description", "left")}${th("Qty", "right")}${th("Unit price", "right")}${th("Amount", "right")}</tr>
${rows}
</table></td></tr>
<tr><td style="padding:16px 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${totalsRows}</table></td></tr>
${notesBlock}
</table>
</td></tr></table>
<div style="font-family:${SANS};font-size:12px;color:${MUTED};padding-top:16px;">Sent with Invoice Studio</div>
</td></tr></table>
</body></html>`;

  const partyText = (label: string, p: Party) =>
    [label, p.name.trim(), p.address.trim(), p.email.trim()].filter(Boolean).join("\n");

  const itemLines = invoice.items.map(
    (item, i) =>
      `- ${item.description || "(no description)"}: ${formatQuantity(item.quantity)} x ${formatMills(item.unitPriceMills)} = ${formatCents(totals.lineTotalsCents[i] ?? 0)}`,
  );

  const text = [
    `Invoice ${invoice.number}`,
    "",
    partyText("From:", invoice.business),
    "",
    partyText("Bill to:", invoice.customer),
    "",
    `Issue date: ${formatDate(invoice.issueDate)}`,
    `Due date: ${formatDate(invoice.dueDate)}`,
    ...(fields.length ? ["", ...fields.map((f) => `${f.label}: ${f.value}`)] : []),
    "",
    "Items",
    ...itemLines,
    "",
    `Subtotal: ${formatCents(totals.subtotalCents)}`,
    ...(showDiscount ? [`Discount: -${formatCents(totals.discountCents)}`] : []),
    `${taxLabel}: ${formatCents(totals.taxCents)}`,
    `Total: ${formatCents(totals.totalCents)}`,
    ...(invoice.notes.trim() ? ["", "Notes", invoice.notes.trim()] : []),
    "",
  ].join("\n");

  return { subject, html, text };
}
