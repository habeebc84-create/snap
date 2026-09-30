/**
 * Tiny API client. Every error surfaces as an `ApiError` carrying the
 * backend's friendly message — stack traces never reach the UI.
 */

export class ApiError extends Error {
  code: string;
  hint?: string;
  status: number;

  constructor(message: string, code: string, status: number, hint?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.hint = hint;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let code = "request_failed";
  let message = "Something went wrong while talking to the local service.";
  let hint: string | undefined;
  try {
    const body = await response.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      hint = body.error.hint;
    }
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  return new ApiError(message, code, response.status, hint);
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}
