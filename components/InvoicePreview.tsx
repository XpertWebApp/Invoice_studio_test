import { formatDate, visibleCustomFields } from "@/lib/invoice";
import { formatCents, formatMills, formatQuantity } from "@/lib/money";
import type { InvoiceInput, Party, Totals } from "@/lib/types";
import { TotalsBlock } from "./TotalsBlock";

interface InvoicePreviewProps {
  input: InvoiceInput;
  totals: Totals;
}

function Placeholder({ children }: { children: string }) {
  return <span className="text-stone-500 italic print:hidden">{children}</span>;
}

function PartyLines({ party }: { party: Party }) {
  return (
    <>
      {party.address.trim() && (
        <p className="mt-1 text-sm whitespace-pre-line text-stone-600">
          {party.address}
        </p>
      )}
      {party.email.trim() && (
        <p className="text-sm break-words text-stone-600">{party.email}</p>
      )}
    </>
  );
}

export function InvoicePreview({ input, totals }: InvoicePreviewProps) {
  const details = visibleCustomFields(input.customFields);
  const hasItems = input.items.length > 0;

  return (
    <div className="@container w-full">
      <article
        aria-label="Invoice preview"
        className="invoice-sheet sheet-shadow mx-auto flex w-full max-w-[794px] flex-col bg-white px-6 py-8 text-stone-900 [aspect-ratio:210/297] @lg:px-10 @lg:py-10 @2xl:px-14"
      >
        <header className="flex flex-col gap-6 @xl:flex-row @xl:items-start @xl:justify-between">
          <div className="min-w-0">
            <p className="font-serif text-2xl leading-tight font-semibold break-words">
              {input.business.name.trim() ? (
                input.business.name
              ) : (
                <span className="font-normal text-stone-500 italic print:hidden">
                  Your business name
                </span>
              )}
            </p>
            <PartyLines party={input.business} />
          </div>

          <div className="@xl:text-right">
            <h2 className="font-serif text-4xl leading-none font-semibold tracking-tight">
              Invoice
            </h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm @xl:ml-auto @xl:w-fit">
              <dt className="text-stone-600 @xl:text-right">Number</dt>
              <dd className="font-medium tabular-nums @xl:text-right">
                {input.number.trim() || <Placeholder>INV-0000</Placeholder>}
              </dd>
              <dt className="text-stone-600 @xl:text-right">Issued</dt>
              <dd className="tabular-nums @xl:text-right">
                {input.issueDate ? (
                  formatDate(input.issueDate)
                ) : (
                  <Placeholder>DD-MM-YYYY</Placeholder>
                )}
              </dd>
              <dt className="text-stone-600 @xl:text-right">Due</dt>
              <dd className="tabular-nums @xl:text-right">
                {input.dueDate ? (
                  formatDate(input.dueDate)
                ) : (
                  <Placeholder>DD-MM-YYYY</Placeholder>
                )}
              </dd>
            </dl>

            {details.length > 0 && (
              <dl
                aria-label="Invoice details"
                className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-stone-200 pt-3 text-sm @xl:ml-auto @xl:w-fit"
              >
                {details.map((f) => (
                  <div key={f.id} className="contents">
                    <dt className="text-stone-600 @xl:text-right">
                      {f.label.trim() || "Detail"}
                    </dt>
                    <dd className="break-words @xl:text-right">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </header>

        <section className="mt-10" aria-label="Bill to">
          <h3 className="text-xs font-medium tracking-normal text-stone-600">
            Bill to
          </h3>
          <p className="mt-1 text-base font-medium break-words">
            {input.customer.name.trim() ? (
              input.customer.name
            ) : (
              <span className="font-normal text-stone-500 italic print:hidden">
                Customer name
              </span>
            )}
          </p>
          <PartyLines party={input.customer} />
        </section>

        <table className="mt-10 w-full table-fixed border-collapse text-xs @lg:text-sm">
          <colgroup>
            <col />
            <col className="w-10 @lg:w-16" />
            <col className="w-[4.5rem] @lg:w-28" />
            <col className="w-[4.5rem] @lg:w-28" />
          </colgroup>
          <thead>
            <tr className="border-b border-stone-900 text-xs text-stone-600">
              <th
                scope="col"
                className="py-2 pr-2 text-left font-medium @lg:pr-3"
              >
                Description
              </th>
              <th
                scope="col"
                className="px-1 py-2 text-right font-medium @lg:px-3"
              >
                Qty
              </th>
              <th
                scope="col"
                className="px-1 py-2 text-right font-medium @lg:px-3"
              >
                Unit price
              </th>
              <th
                scope="col"
                className="py-2 pl-1 text-right font-medium @lg:pl-3"
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? (
              input.items.map((item, i) => (
                <tr
                  key={item.id}
                  className="border-b border-stone-200 align-top"
                >
                  <th
                    scope="row"
                    className="py-3 pr-2 text-left font-normal break-words @lg:pr-3"
                  >
                    {item.description.trim() || (
                      <Placeholder>Untitled item</Placeholder>
                    )}
                  </th>
                  <td className="px-1 py-3 text-right whitespace-nowrap tabular-nums @lg:px-3">
                    {formatQuantity(item.quantity)}
                  </td>
                  <td className="px-1 py-3 text-right whitespace-nowrap tabular-nums @lg:px-3">
                    {formatMills(item.unitPriceMills)}
                  </td>
                  <td className="py-3 pl-1 text-right font-medium whitespace-nowrap tabular-nums @lg:pl-3">
                    {formatCents(totals.lineTotalsCents[i] ?? 0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-stone-200 print:hidden">
                <td
                  colSpan={4}
                  className="py-6 text-center text-stone-500 italic"
                >
                  Line items will appear here
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-8">
          <TotalsBlock
            totals={totals}
            taxRateBps={input.taxRateBps}
            dueDateLabel={input.dueDate ? formatDate(input.dueDate) : null}
          />
        </div>

        <footer className="avoid-break mt-auto pt-10">
          {input.notes.trim() ? (
            <>
              <h3 className="text-xs font-medium text-stone-600">Notes</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-stone-600">
                {input.notes}
              </p>
            </>
          ) : (
            <p className="text-sm text-stone-500 italic print:hidden">
              Notes will appear here
            </p>
          )}
        </footer>
      </article>
    </div>
  );
}
