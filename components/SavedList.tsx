import { useId, useState } from "react";
import { formatDate } from "@/lib/invoice";
import { formatCents } from "@/lib/money";
import type { InvoiceSummary } from "@/lib/types";
import { Button } from "./Button";
import { focusRing } from "./Field";
import { AlertIcon, ChevronIcon, PlusIcon, SpinnerIcon } from "./icons";

interface SavedListProps {
  invoices: InvoiceSummary[];
  loading: boolean;
  error: string | null;
  currentId: string | null;
  openingId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRetry: () => void;
}

export function SavedList({
  invoices,
  loading,
  error,
  currentId,
  openingId,
  onOpen,
  onNew,
  onRetry,
}: SavedListProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <nav aria-label="Saved invoices" className="rounded-lg border border-stone-200 bg-white lg:border-0 lg:bg-transparent">
      {/* Mobile disclosure */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-stone-900 lg:hidden ${focusRing}`}
      >
        <span>
          Saved invoices
          {!loading && !error && (
            <span className="ml-2 font-normal text-stone-600">({invoices.length})</span>
          )}
        </span>
        <ChevronIcon className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div id={listId} className={`${open ? "block" : "hidden"} px-3 pb-3 lg:block lg:p-0`}>
        <div className="mb-3 hidden items-center justify-between lg:flex">
          <h2 className="font-serif text-lg font-semibold text-stone-900">Saved invoices</h2>
        </div>

        <Button
          variant="primary"
          className="mb-3 w-full"
          icon={<PlusIcon />}
          onClick={() => {
            onNew();
            setOpen(false);
          }}
        >
          New invoice
        </Button>

        {loading && (
          <ul aria-label="Loading saved invoices" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[3.75rem] animate-pulse rounded-md bg-stone-200/70 motion-reduce:animate-none"
              />
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="flex items-start gap-2">
              <AlertIcon className="mt-0.5 shrink-0" width={14} height={14} />
              <span>{error}</span>
            </p>
            <Button variant="ghost" size="sm" className="mt-2 bg-white" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && invoices.length === 0 && (
          <p className="rounded-md border border-dashed border-stone-300 px-3 py-6 text-center text-sm text-stone-600">
            No saved invoices yet.
            <br />
            Save one and it will appear here.
          </p>
        )}

        {!loading && !error && invoices.length > 0 && (
          <ul className="space-y-1.5">
            {invoices.map((inv) => {
              const active = inv.id === currentId;
              const opening = inv.id === openingId;
              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      onOpen(inv.id);
                      setOpen(false);
                    }}
                    className={`block w-full rounded-md border px-3 py-2.5 text-left transition-colors ${focusRing} ${
                      active
                        ? "border-accent bg-accent-soft"
                        : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-stone-900">{inv.number}</span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-stone-900 tabular-nums">
                        {opening && <SpinnerIcon width={12} height={12} />}
                        {formatCents(inv.totalCents)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-stone-600">
                      <span className="truncate">{inv.customerName || "No customer name"}</span>
                      <span className="shrink-0 tabular-nums">{formatDate(inv.issueDate)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
