import type {
  ApiError,
  FieldErrors,
  Invoice,
  InvoiceInput,
  InvoiceSummary,
  SendResult,
} from "./types";

/** Thrown for any non-2xx response or network failure. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly fieldErrors?: FieldErrors;

  constructor(message: string, status: number, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(NETWORK_MESSAGE, 0);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body: fall through to the generic message below.
  }

  if (!res.ok) {
    const err = (body ?? {}) as Partial<ApiError>;
    throw new ApiClientError(
      typeof err.error === "string" && err.error
        ? err.error
        : "Something went wrong on our side. Please try again.",
      res.status,
      err.fieldErrors,
    );
  }
  return body as T;
}

export function listInvoices(): Promise<InvoiceSummary[]> {
  return request<InvoiceSummary[]>("/api/invoices");
}

export function getInvoice(id: string): Promise<Invoice> {
  return request<Invoice>(`/api/invoices/${encodeURIComponent(id)}`);
}

export function createInvoice(input: InvoiceInput): Promise<Invoice> {
  return request<Invoice>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateInvoice(id: string, input: InvoiceInput): Promise<Invoice> {
  return request<Invoice>(`/api/invoices/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function sendInvoice(id: string): Promise<SendResult> {
  return request<SendResult>(`/api/invoices/${encodeURIComponent(id)}/send`, {
    method: "POST",
  });
}
