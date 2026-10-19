export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[]
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

export function qs(params?: Params): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// VITE_API_BASE_URL is an origin (https://eventboard-api.onrender.com), no /api suffix.
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const crossOriginApi = Boolean(apiOrigin);
const TOKEN_KEY = "eventboard-demo-access-token";

export function setAccessToken(token: string | null): void {
  if (!crossOriginApi) return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  const token = crossOriginApi ? sessionStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${apiOrigin}/api${path}${qs(params)}`, {
    method,
    credentials: crossOriginApi ? "omit" : "same-origin",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (res.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: { path: string; message: string }[] } } | null)?.error;
    if (res.status === 401 && path !== "/auth/login" && path !== "/auth/register") setAccessToken(null);
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? "صار خطأ، حاول مرة ثانية", err?.details);
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string, params?: Params) => request<T>("GET", path, undefined, params),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  del: <T,>(path: string) => request<T>("DELETE", path)
};
