import { NextResponse } from "next/server";
import { API_URL, setAuthCookies } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const payload = (await request.json()) as { name?: string; email?: string; password?: string };
  const registerResponse = await fetch(`${API_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const user = await registerResponse.json();
  if (!registerResponse.ok) return NextResponse.json(user, { status: registerResponse.status });

  const tokenResponse = await fetch(`${API_URL}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.username, password: payload.password }),
    cache: "no-store",
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) return NextResponse.json(tokens, { status: tokenResponse.status });
  const response = NextResponse.json(user, { status: 201 });
  setAuthCookies(response, tokens.access, tokens.refresh);
  return response;
}
