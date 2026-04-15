export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function clearAuth() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_id");
}

export function setUserInfo(role: string, name: string, id: number) {
  localStorage.setItem("user_role", role);
  localStorage.setItem("user_name", name);
  localStorage.setItem("user_id", String(id));
}

export function getUserRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("user_role");
}

export function getUserName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("user_name");
}

export function getUserId(): number | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("user_id");
  return id ? parseInt(id) : null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
