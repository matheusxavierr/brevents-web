import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { API_URL } from "./backend-proxy";
import { localeCookieName, normalizeLocale } from "./i18n";
import type { User } from "./api-types";

const ACCESS_COOKIE = "brevents_access";
const REFRESH_COOKIE = "brevents_refresh";

async function fetchUser(access: string, acceptLanguage = "pt-BR"): Promise<User | null> {
  try {
    const response = await fetch(`${API_URL}/auth/me/`, {
      headers: { Authorization: `Bearer ${access}`, "Accept-Language": acceptLanguage },
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as User) : null;
  } catch {
    return null;
  }
}

async function renewAccess(refresh: string, acceptLanguage = "pt-BR"): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": acceptLanguage },
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
  const locale = normalizeLocale(cookieStore.get(localeCookieName)?.value);
  const acceptLanguage = locale === "pt" ? "pt-BR" : locale;
  const access = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!access) return null;

  const user = await fetchUser(access, acceptLanguage);
  if (user) return user;

  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  const renewed = await renewAccess(refresh, acceptLanguage);
  return renewed ? fetchUser(renewed, acceptLanguage) : null;
});
