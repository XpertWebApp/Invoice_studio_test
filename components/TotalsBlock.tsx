import { formatBps, formatCents } from "@/lib/money";
import type { Totals } from "@/lib/types";

interface TotalsBlockProps {
  totals: Totals;
  taxRateBps: number;
  dueDateLabel: string | null;
}

export function TotalsBlock({ totals, taxRateBps, dueDateLabel }: TotalsBlockProps) {
  return (
    <div className="avoid-break ml-auto w-full max-w-[18rem]">
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
        <dt className="text-stone-600">Subtotal</dt>
        <dd className="text-right text-stone-900 tabular-nums">
          {formatCents(totals.subtotalCents)}
        </dd>

        {totals.discountCents > 0 && (
          <>
            <dt className="text-stone-600">Discount</dt>
            <dd className="text-right text-stone-900 tabular-nums">
              -{formatCents(totals.discountCents)}
            </dd>
          </>
        )}

        <dt className="text-stone-600">Tax ({formatBps(taxRateBps)}%)</dt>
        <dd className="text-right text-stone-900 tabular-nums">
          {formatCents(totals.taxCents)}
        </dd>
      </dl>

      <div className="mt-4 grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t-2 border-stone-900 pt-4">
        <span className="font-serif text-base font-semibold text-stone-900">Total</span>
        <span className="text-right font-serif text-3xl leading-none font-semibold text-stone-900 tabular-nums">
          {formatCents(totals.totalCents)}
        </span>
      </div>

      {dueDateLabel && (
        <p className="mt-3 text-right text-sm text-stone-600">
          Amount due by <span className="font-medium text-stone-800">{dueDateLabel}</span>
        </p>
      )}
    </div>
  );
}
