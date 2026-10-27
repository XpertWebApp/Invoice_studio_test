import { AlertIcon, CheckIcon, CloseIcon } from "./icons";
import { focusRing } from "./Field";

export interface Status {
  tone: "success" | "error";
  text: string;
}

interface StatusMessageProps {
  status: Status | null;
  onDismiss: () => void;
}

/** Toast-style live region. The region stays mounted so screen readers announce changes. */
export function StatusMessage({ status, onDismiss }: StatusMessageProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="app-chrome pointer-events-none fixed inset-x-4 bottom-28 z-40 flex justify-center lg:bottom-6"
    >
      {status && (
        <div
          className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            status.tone === "success"
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {status.tone === "success" ? (
            <CheckIcon className="mt-0.5 shrink-0" />
          ) : (
            <AlertIcon className="mt-0.5 shrink-0" />
          )}
          {status.tone === "error" ? (
            <p role="alert">{status.text}</p>
          ) : (
            <p>{status.text}</p>
          )}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={onDismiss}
            className={`-m-1 ml-1 shrink-0 rounded p-1 hover:bg-black/5 ${focusRing}`}
          >
            <CloseIcon width={14} height={14} />
          </button>
        </div>
      )}
    </div>
  );
}
