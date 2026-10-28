const BASE = ((import.meta.env.VITE_API_URL as string | undefined) || "").replace(/\/$/, "");
const USER_KEY = "avinor_user";

export function apiUrl(path: string) {
  return `${BASE}${path}`;
}

function currentToken(): string | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token || null;
  } catch {
    return null;
  }
}

async function parseError(res: Response) {
  try {
    const body = await res.json();
    const detail = body.detail;
    if (typeof detail === "string") return detail;
    return JSON.stringify(detail);
  } catch {
    return res.statusText;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = currentToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(path), { ...init, headers });
  if (res.status === 401 && path !== "/api/auth/login") {
    localStorage.removeItem(USER_KEY);
    if (window.location.pathname !== "/") {
      window.location.assign("/");
    }
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}
