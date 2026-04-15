import { getToken, clearAuth } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}

export const api = {
  async get(path: string) {
    const res = await request(path);
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Request failed"); }
    return res.json();
  },
  async post(path: string, body?: unknown) {
    const res = await request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Request failed"); }
    return res.json();
  },
  async postForm(path: string, formData: FormData) {
    const res = await request(path, { method: "POST", body: formData });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Request failed"); }
    return res.json();
  },
  async postRaw(path: string, body?: unknown): Promise<Response> {
    return request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  },
  async del(path: string) {
    const res = await request(path, { method: "DELETE" });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Request failed"); }
    return res.json();
  },
  async put(path: string, body?: unknown) {
    const res = await request(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Request failed"); }
    return res.json();
  },
  async login(email: string, password: string) {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
    const res = await fetch(`${BASE_URL}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Login failed"); }
    return res.json();
  },
};
