import { useId } from "react";
import { AlertIcon } from "./icons";
import { useFormContext } from "./FormContext";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const inputBase = `block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-500 ${focusRing} aria-[invalid=true]:border-red-700 aria-[invalid=true]:bg-red-50/40`;

interface FieldProps {
  /** Error key from FieldErrors, e.g. "business.name" or "items.<id>.quantity". */
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  type?: "text" | "email";
  /** Right aligned, tabular, decimal keypad. Stays type="text" so "-" can be typed. */
  numeric?: boolean;
  multiline?: boolean;
  rows?: number;
  prefix?: string;
  suffix?: string;
  autoComplete?: string;
  className?: string;
}

export function Field({
  name,
  label,
  value,
  onChange,
  hint,
  placeholder,
  type = "text",
  numeric = false,
  multiline = false,
  rows = 3,
  prefix,
  suffix,
  autoComplete,
  className = "",
}: FieldProps) {
  const id = useId();
  const { errors, touch } = useFormContext();
  const error = errors[name];
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    value,
    placeholder,
    autoComplete: autoComplete ?? "off",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "data-field": name,
    onBlur: () => touch(name),
  } as const;

  const align = numeric ? "text-right tabular-nums" : "";
  const padding = `${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-800">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-600"
          >
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea
            {...shared}
            rows={rows}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputBase} resize-y`}
          />
        ) : (
          <input
            {...shared}
            type={type}
            inputMode={numeric ? "decimal" : undefined}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputBase} ${align} ${padding}`}
          />
        )}
        {suffix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-600"
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-stone-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700">
          <AlertIcon className="mt-0.5 shrink-0" width={14} height={14} />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      )}
    </div>
  );
}
