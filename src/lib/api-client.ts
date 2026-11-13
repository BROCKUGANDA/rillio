/**
 * Shared client-side types + fetch helpers for Rillio UI.
 */

export type Session = {
  id: string;
  email: string;
  displayName: string | null;
  baseCurrency: string;
  locale: string;
  timezone: string;
};

export type Counts = {
  imports: number;
  transactions: number;
  goals: number;
  wallets: number;
};

export type MeResponse = {
  user: Session;
  counts: Counts;
};

export async function apiFetch<T = unknown>(
  url: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = (data as { code?: string; detail?: string; message?: string; fieldErrors?: unknown[] }) ?? {};
    const e = new Error(err.detail ?? err.message ?? `Request failed with status ${res.status}`) as Error & {
      code?: string;
      status?: number;
      fieldErrors?: unknown[];
    };
    e.code = err.code;
    e.status = res.status;
    e.fieldErrors = err.fieldErrors;
    throw e;
  }
  return data as T;
}
