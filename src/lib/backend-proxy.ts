import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.BREVENTS_API_URL ?? "http://127.0.0.1:8000/api";
const ACCESS_COOKIE = "brevents_access";
const REFRESH_COOKIE = "brevents_refresh";

function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}

export function setAuthCookies(response: NextResponse, access: string, refresh?: string) {
  response.cookies.set(ACCESS_COOKIE, access, cookieOptions(60 * 60));
  if (refresh) response.cookies.set(REFRESH_COOKIE, refresh, cookieOptions(7 * 24 * 60 * 60));
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", cookieOptions(0));
  response.cookies.set(REFRESH_COOKIE, "", cookieOptions(0));
}

async function refreshAccess(refresh: string) {
  const response = await fetch(`${API_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as { access: string };
}

async function requestBackend(request: Request, path: string, access?: string, body?: ArrayBuffer) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (access) headers.set("Authorization", `Bearer ${access}`);
  const url = new URL(request.url);
  return fetch(`${API_URL}/${path}${url.search}`, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : body,
    cache: "no-store",
  });
}

export async function forwardToBackend(request: Request, path: string) {
  const cookieStore = await cookies();
  let access = cookieStore.get(ACCESS_COOKIE)?.value;
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  let backendResponse = await requestBackend(request, path, access, body);

  let refreshedAccess: string | undefined;
  if (backendResponse.status === 401 && refresh) {
    const refreshed = await refreshAccess(refresh);
    if (refreshed) {
      refreshedAccess = refreshed.access;
      access = refreshed.access;
      backendResponse = await requestBackend(request, path, access, body);
    }
  }

  const responseBody = backendResponse.status === 204 ? null : await backendResponse.arrayBuffer();
  const response = new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: { "Content-Type": backendResponse.headers.get("content-type") ?? "application/json" },
  });
  if (refreshedAccess) setAuthCookies(response, refreshedAccess);
  if (backendResponse.status === 401 && refresh && !refreshedAccess) clearAuthCookies(response);
  return response;
}

export { API_URL };
