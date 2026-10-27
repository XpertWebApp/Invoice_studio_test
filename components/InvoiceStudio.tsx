"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiClientError,
  createInvoice,
  getInvoice,
  listInvoices,
  sendInvoice,
  updateInvoice,
} from "@/lib/api-client";
import { emptyDraft, suggestInvoiceNumber } from "@/lib/invoice";
import { computeTotals } from "@/lib/money";
import type { FieldErrors, Invoice, InvoiceDraft, InvoiceSummary } from "@/lib/types";
import { draftFromInvoice, previewFromDraft, validateDraft } from "@/lib/validation";
import { ActionBar, type BusyState } from "./ActionBar";
import { EditorPanel } from "./EditorPanel";
import { FormContext } from "./FormContext";
import { InvoicePreview } from "./InvoicePreview";
import { MobileToggle, type StudioView } from "./MobileToggle";
import { SavedList } from "./SavedList";
import { StatusMessage, type Status } from "./StatusMessage";

/** Errors worth showing the moment they appear, before the field is touched. */
const IMMEDIATE_ERROR = /negative|more than|before/i;

function messageFrom(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export function InvoiceStudio() {
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<BusyState>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [view, setView] = useState<StudioView>("edit");

  const loadList = useCallback(async (): Promise<InvoiceSummary[] | null> => {
    try {
      const list = await listInvoices();
      setInvoices(list);
      setListError(null);
      return list;
    } catch (err) {
      setListError(messageFrom(err));
      return null;
    } finally {
      setListLoading(false);
    }
  }, []);

  // First load: fetch saved invoices, then start a fresh draft with the next number.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadList();
      if (cancelled) return;
      setDraft(emptyDraft(suggestInvoiceNumber((list ?? []).map((i) => i.number))));
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList]);

  // Success messages fade on their own; errors stay until dismissed.
  useEffect(() => {
    if (status?.tone !== "success") return;
    const t = setTimeout(() => setStatus(null), 8000);
    return () => clearTimeout(t);
  }, [status]);

  const validation = useMemo(() => (draft ? validateDraft(draft) : null), [draft]);
  const errors: FieldErrors = useMemo(
    () => (validation && !validation.ok ? validation.errors : {}),
    [validation],
  );
  const errorCount = Object.keys(errors).length;

  const visibleErrors: FieldErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const [key, msg] of Object.entries(errors)) {
      if (attempted || touched.has(key) || IMMEDIATE_ERROR.test(msg)) out[key] = msg;
    }
    return { ...out, ...serverErrors };
  }, [errors, touched, attempted, serverErrors]);

  const preview = useMemo(() => {
    if (!draft) return null;
    const input = previewFromDraft(draft);
    return { input, totals: computeTotals(input.items, input.discountCents, input.taxRateBps) };
  }, [draft]);

  const touch = useCallback((key: string) => {
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const patchDraft = useCallback((patch: Partial<InvoiceDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setServerErrors({});
  }, []);

  const resetFormState = () => {
    setTouched(new Set());
    setAttempted(false);
    setServerErrors({});
    setStatus(null);
  };

  const startNew = () => {
    setDraft(emptyDraft(suggestInvoiceNumber(invoices.map((i) => i.number))));
    setCurrentId(null);
    resetFormState();
    setView("edit");
  };

  const openInvoice = async (id: string) => {
    if (openingId) return;
    setOpeningId(id);
    try {
      const inv = await getInvoice(id);
      setDraft(draftFromInvoice(inv));
      setCurrentId(inv.id);
      resetFormState();
      setView("edit");
    } catch (err) {
      setStatus({ tone: "error", text: `Could not open that invoice. ${messageFrom(err)}` });
    } finally {
      setOpeningId(null);
    }
  };

  /** Reveals all errors and moves focus to the first invalid field. */
  const revealErrors = () => {
    setAttempted(true);
    setView("edit");
    setTimeout(() => {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, 0);
  };

  /** Validates, then creates or updates. Returns the saved invoice or null. */
  const persist = async (): Promise<Invoice | null> => {
    if (!draft) return null;
    const result = validateDraft(draft);
    if (!result.ok) {
      revealErrors();
      return null;
    }
    try {
      const saved = currentId
        ? await updateInvoice(currentId, result.value)
        : await createInvoice(result.value);
      setCurrentId(saved.id);
      setServerErrors({});
      void loadList();
      return saved;
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        setServerErrors(err.fieldErrors);
        setView("edit");
        const unmatched = Object.entries(err.fieldErrors).find(
          ([key]) => !document.querySelector(`[data-field="${key}"]`),
        );
        if (unmatched) throw new Error(`${err.message} ${unmatched[1]}`);
      }
      throw err;
    }
  };

  const handleSave = async () => {
    if (busy) return;
    if (errorCount > 0) return revealErrors();
    setBusy("save");
    setStatus(null);
    try {
      const saved = await persist();
      if (saved) setStatus({ tone: "success", text: `Saved ${saved.number}` });
    } catch (err) {
      setStatus({ tone: "error", text: `Could not save. ${messageFrom(err)}` });
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    if (busy) return;
    if (errorCount > 0) return revealErrors();
    setBusy("send-saving");
    setStatus(null);
    let saved: Invoice | null = null;
    try {
      saved = await persist();
      if (!saved) return;
      setBusy("send-sending");
      const sent = await sendInvoice(saved.id);
      setStatus({ tone: "success", text: `Sent to ${sent.sentTo} (test inbox)` });
    } catch (err) {
      setStatus({
        tone: "error",
        text: saved
          ? `Saved ${saved.number}, but it was not sent. ${messageFrom(err)}`
          : `Could not save, so nothing was sent. ${messageFrom(err)}`,
      });
    } finally {
      setBusy(null);
    }
  };

  const form = useMemo(() => ({ errors: visibleErrors, touch }), [visibleErrors, touch]);

  if (!draft || !preview) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-stone-600" role="status">
        Loading Invoice Studio...
      </div>
    );
  }

  return (
    <FormContext.Provider value={form}>
      <div className="studio-root min-h-dvh pb-32 lg:pb-0">
        <header className="app-chrome z-20 border-b border-stone-200 bg-stone-50 lg:sticky lg:top-0">
          <div className="mx-auto flex max-w-[1680px] flex-wrap items-center lg:flex-nowrap justify-between gap-x-6 gap-y-2 px-4 py-3 lg:px-6">
            <div className="flex items-baseline gap-3">
              <h1 className="font-serif text-xl font-semibold text-stone-900">
                Invoice <span className="text-accent">Studio</span>
              </h1>
              <p className="text-sm text-stone-600">
                {currentId ? `Editing ${draft.number || "invoice"}` : "New invoice"}
              </p>
            </div>
            <ActionBar
              busy={busy}
              errorCount={errorCount}
              onSave={handleSave}
              onSend={handleSend}
              onPrint={() => window.print()}
              placement="header"
            />
          </div>
        </header>

        <MobileToggle view={view} onChange={setView} />

        <div className="studio-grid mx-auto grid max-w-[1680px] gap-5 px-4 py-5 lg:grid-cols-[13rem_minmax(0,1.1fr)_minmax(0,1fr)] lg:px-6 xl:grid-cols-[17rem_minmax(0,34rem)_minmax(0,1fr)]">
          <aside className="app-chrome lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-6rem)] lg:-m-1.5 lg:self-start lg:overflow-y-auto lg:p-1.5">
            <SavedList
              invoices={invoices}
              loading={listLoading}
              error={listError}
              currentId={currentId}
              openingId={openingId}
              onOpen={openInvoice}
              onNew={startNew}
              onRetry={() => {
                setListLoading(true);
                void loadList();
              }}
            />
          </aside>

          <main
            id="panel-edit"
            role="tabpanel"
            aria-labelledby="tab-edit"
            className={`app-chrome ${view === "edit" ? "block" : "hidden"} min-w-0 lg:block`}
          >
            <EditorPanel draft={draft} onChange={patchDraft} />
          </main>

          <section
            id="panel-preview"
            role="tabpanel"
            aria-labelledby="tab-preview"
            className={`preview-pane ${view === "preview" ? "block" : "hidden"} min-w-0 rounded-lg bg-stone-200/60 p-3 sm:p-6 lg:block lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto`}
          >
            <InvoicePreview input={preview.input} totals={preview.totals} />
          </section>
        </div>

        <ActionBar
          busy={busy}
          errorCount={errorCount}
          onSave={handleSave}
          onSend={handleSend}
          onPrint={() => window.print()}
          placement="footer"
        />

        <StatusMessage status={status} onDismiss={() => setStatus(null)} />
      </div>
    </FormContext.Provider>
  );
}
