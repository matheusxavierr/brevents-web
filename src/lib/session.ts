import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { API_URL } from "./backend-proxy";
import type { User } from "./api-types";

const ACCESS_COOKIE = "brevents_access";
const REFRESH_COOKIE = "brevents_refresh";

async function fetchUser(access: string): Promise<User | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me/`, {
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as User) : null;
  } catch {
    return null;
  }
}

async function renewAccess(refresh: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { access?: string };
    return payload.access ?? null;
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const access = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!access) return null;

  const user = await fetchUser(access);
  if (user) return user;

  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  const renewed = await renewAccess(refresh);
  return renewed ? fetchUser(renewed) : null;
});
