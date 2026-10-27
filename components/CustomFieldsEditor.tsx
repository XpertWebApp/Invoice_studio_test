import { useRef } from "react";
import { emptyCustomField } from "@/lib/invoice";
import type { CustomField } from "@/lib/types";
import { Button } from "./Button";
import { MAX_CUSTOM_FIELDS } from "@/lib/validation";
import { Field } from "./Field";
import { useFormContext } from "./FormContext";
import { AlertIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "./icons";

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

export function CustomFieldsEditor({ fields, onChange }: CustomFieldsEditorProps) {
  const addRef = useRef<HTMLButtonElement>(null);
  const { errors, touch } = useFormContext();
  const listError = errors.customFields;
  const atLimit = fields.length >= MAX_CUSTOM_FIELDS;

  const update = (id: string, patch: Partial<CustomField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const add = () => {
    if (atLimit) {
      touch("customFields");
      return;
    }
    const field = emptyCustomField();
    onChange([...fields, field]);
    setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-field="customFields.${field.id}.label"]`)
        ?.focus();
    }, 0);
  };

  const remove = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
    setTimeout(() => addRef.current?.focus(), 0);
  };

  return (
    <div>
      {fields.length === 0 && (
        <p className="mb-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-600">
          Nothing extra yet. Add a purchase order number, project name or payment terms.
        </p>
      )}
      <ul className="space-y-3">
        {fields.map((f, i) => {
          const n = i + 1;
          return (
            <li
              key={f.id}
              className="rounded-md border border-stone-200 bg-stone-50/60 p-4"
            >
              <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2">
                <Field
                  name={`customFields.${f.id}.label`}
                  label="Label"
                  value={f.label}
                  placeholder="PO number"
                  onChange={(label) => update(f.id, { label })}
                />
                <Field
                  name={`customFields.${f.id}.value`}
                  label="Value"
                  value={f.value}
                  placeholder="PO-48213"
                  onChange={(value) => update(f.id, { value })}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={f.visible}
                  aria-label={`Show on invoice, custom field ${n}`}
                  icon={f.visible ? <EyeIcon /> : <EyeOffIcon />}
                  onClick={() => update(f.id, { visible: !f.visible })}
                >
                  Show on invoice
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  aria-label={`Remove custom field ${n}`}
                  icon={<TrashIcon />}
                  onClick={() => remove(f.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        ref={addRef}
        variant="secondary"
        className="mt-4"
        icon={<PlusIcon />}
        softDisabled={atLimit}
        aria-describedby={listError ? "custom-fields-error" : undefined}
        onClick={add}
      >
        Add custom field
      </Button>
      {listError && (
        <p id="custom-fields-error" className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
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
