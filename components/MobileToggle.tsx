import type { KeyboardEvent } from "react";
import { focusRing } from "./Field";

export type StudioView = "edit" | "preview";

const TABS: { id: StudioView; label: string }[] = [
  { id: "edit", label: "Edit" },
  { id: "preview", label: "Preview" },
];

interface MobileToggleProps {
  view: StudioView;
  onChange: (view: StudioView) => void;
}

export function MobileToggle({ view, onChange }: MobileToggleProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = TABS.findIndex((t) => t.id === view);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    onChange(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Invoice view"
      className="app-chrome sticky top-0 z-20 border-b border-stone-200 bg-stone-100 px-4 py-2 lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-2 gap-1 rounded-lg bg-stone-200/80 p-1">
        {TABS.map((t) => {
          const selected = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={onKeyDown}
              className={`min-h-9 rounded-md px-4 text-sm font-medium transition-colors ${focusRing} ${
                selected ? "bg-white text-accent" : "text-stone-700 hover:text-stone-900"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
