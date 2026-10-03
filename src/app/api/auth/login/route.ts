import { NextResponse } from "next/server";
import { API_URL, setAuthCookies } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const payload = (await request.json()) as { email?: string; password?: string };
  const tokenResponse = await fetch(`${API_URL}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) return NextResponse.json(tokens, { status: tokenResponse.status });

  const userResponse = await fetch(`${API_URL}/auth/me/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    cache: "no-store",
  });
  const user = await userResponse.json();
  const response = NextResponse.json(user, { status: userResponse.status });
  setAuthCookies(response, tokens.access, tokens.refresh);
  return response;
}
