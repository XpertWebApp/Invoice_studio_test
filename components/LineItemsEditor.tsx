import { useRef } from "react";
import { emptyLineItem } from "@/lib/invoice";
import { formatCents, lineTotalCents, parseQuantity, parseUnitPriceToMills } from "@/lib/money";
import type { LineItemDraft } from "@/lib/types";
import { Button } from "./Button";
import { MAX_ITEMS } from "@/lib/validation";
import { Field } from "./Field";
import { useFormContext } from "./FormContext";
import { AlertIcon, PlusIcon, TrashIcon } from "./icons";

interface LineItemsEditorProps {
  items: LineItemDraft[];
  onChange: (items: LineItemDraft[]) => void;
}

/** Read-only amount for one editor row. "-" when the inputs cannot be read. */
function lineAmount(item: LineItemDraft): string {
  const q = parseQuantity(item.quantity.trim() || "0");
  const p = parseUnitPriceToMills(item.unitPrice.trim() || "0");
  if (q === null || p === null || q < 0 || p < 0) return "-";
  return formatCents(lineTotalCents(q, p));
}

function focusField(name: string) {
  setTimeout(() => {
    document.querySelector<HTMLElement>(`[data-field="${name}"]`)?.focus();
  }, 0);
}

export function LineItemsEditor({ items, onChange }: LineItemsEditorProps) {
  const addRef = useRef<HTMLButtonElement>(null);
  const { errors, touch } = useFormContext();
  const listError = errors.items;
  const atLimit = items.length >= MAX_ITEMS;

  const update = (id: string, patch: Partial<LineItemDraft>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const add = () => {
    if (atLimit) {
      touch("items");
      return;
    }
    const item = emptyLineItem();
    onChange([...items, item]);
    focusField(`items.${item.id}.description`);
  };

  const remove = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
    setTimeout(() => addRef.current?.focus(), 0);
  };

  return (
    <div>
      {items.length === 0 && (
        <p className="mb-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-600">
          No line items yet. Add the first thing you are billing for.
        </p>
      )}
      <ol className="space-y-3">
        {items.map((item, i) => {
          const n = i + 1;
          return (
            <li
              key={item.id}
              className="rounded-md border border-stone-200 bg-stone-50/60 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Line {n}</span>
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={`Remove line ${n}`}
                  icon={<TrashIcon />}
                  onClick={() => remove(item.id)}
                >
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 @md:grid-cols-3">
                <Field
                  name={`items.${item.id}.description`}
                  label="Description"
                  value={item.description}
                  placeholder="Design workshop"
                  className="col-span-2 @md:col-span-3"
                  onChange={(description) => update(item.id, { description })}
                />
                <Field
                  name={`items.${item.id}.quantity`}
                  label="Qty"
                  numeric
                  value={item.quantity}
                  placeholder="1"
                  onChange={(quantity) => update(item.id, { quantity })}
                />
                <Field
                  name={`items.${item.id}.unitPrice`}
                  label="Unit price"
                  numeric
                  prefix="$"
                  value={item.unitPrice}
                  placeholder="0.00"
                  onChange={(unitPrice) => update(item.id, { unitPrice })}
                />
                <div className="col-span-2 min-w-0 @md:col-span-1">
                  <span className="mb-1.5 block text-right text-sm font-medium text-stone-800">
                    Amount
                  </span>
                  <output
                    aria-label={`Line ${n} amount`}
                    className="block min-w-0 rounded-md px-3 py-2 text-right text-sm font-medium break-all text-stone-900 tabular-nums"
                  >
                    {lineAmount(item)}
                  </output>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        ref={addRef}
        variant="secondary"
        className="mt-4"
        icon={<PlusIcon />}
        softDisabled={atLimit}
        aria-describedby={listError ? "line-items-error" : undefined}
        onClick={add}
      >
        Add line item
      </Button>
      {listError && (
        <p id="line-items-error" className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
          <AlertIcon className="mt-0.5 shrink-0" width={14} height={14} />
          <span>
            <span className="sr-only">Error: </span>
            {listError}
          </span>
        </p>
      )}
    </div>
  );
}
