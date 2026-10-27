import { useId } from "react";
import { Button } from "./Button";
import { PrinterIcon, SaveIcon, SendIcon } from "./icons";

export type BusyState = null | "save" | "send-saving" | "send-sending";

interface ActionBarProps {
  busy: BusyState;
  errorCount: number;
  onSave: () => void;
  onSend: () => void;
  onPrint: () => void;
  /** "header" shows from lg up; "footer" is the fixed mobile bar. */
  placement: "header" | "footer";
}

/** Fixed to the bottom on mobile, inline in the header on desktop. */
export function ActionBar({ busy, errorCount, onSave, onSend, onPrint, placement }: ActionBarProps) {
  const blocked = errorCount > 0;
  const working = busy !== null;
  const reasonId = `action-reason-${useId()}`;
  const reason = blocked
    ? `Fix ${errorCount} ${errorCount === 1 ? "field" : "fields"} to save or send`
    : null;

  return (
    <div
      className={`app-chrome ${
        placement === "footer"
          ? "fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-stone-200 bg-white px-4 py-3 lg:hidden"
          : "hidden lg:flex lg:flex-row lg:items-center lg:gap-4"
      }`}
    >
      {reason && (
        <p id={reasonId} className="text-sm font-medium text-red-700 lg:text-right lg:whitespace-nowrap">
          {reason}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1 lg:flex-none"
          icon={<SaveIcon />}
          loading={busy === "save"}
          softDisabled={blocked || (working && busy !== "save")}
          aria-describedby={reason ? reasonId : undefined}
          onClick={onSave}
        >
          {busy === "save" ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="secondary"
          className="flex-1 lg:flex-none"
          icon={<SendIcon />}
          loading={busy === "send-saving" || busy === "send-sending"}
          softDisabled={blocked || (working && busy === "save")}
          aria-describedby={reason ? reasonId : undefined}
          onClick={onSend}
        >
          {busy === "send-saving" ? "Saving..." : busy === "send-sending" ? "Sending..." : "Send"}
        </Button>
        <Button
          variant="ghost"
          className="flex-1 lg:flex-none"
          icon={<PrinterIcon />}
          onClick={onPrint}
        >
          <span className="hidden sm:inline">Print / Save as PDF</span>
          <span className="sm:hidden">Print / PDF</span>
        </Button>
      </div>
    </div>
  );
}
