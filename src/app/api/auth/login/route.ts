import { NextResponse } from "next/server";
import { API_URL, setAuthCookies } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  const payload = (await request.json()) as { email?: string; password?: string };
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`${API_URL}/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (reason) {
    console.error("Não foi possível alcançar a API durante o login.", reason);
    return NextResponse.json({ detail: "A API está temporariamente indisponível. Tente novamente em instantes." }, { status: 503 });
  }
  const tokens = await tokenResponse.json().catch(() => ({ detail: "A API retornou uma resposta inválida." }));
  if (!tokenResponse.ok) return NextResponse.json(tokens, { status: tokenResponse.status });

  let userResponse: Response;
  try {
    userResponse = await fetch(`${API_URL}/auth/me/`, {
      headers: { Authorization: `Bearer ${tokens.access}` },
      cache: "no-store",
    });
  } catch (reason) {
    console.error("Não foi possível validar o usuário após o login.", reason);
    return NextResponse.json({ detail: "A API está temporariamente indisponível. Tente novamente em instantes." }, { status: 503 });
  }
  const user = await userResponse.json().catch(() => ({ detail: "A API retornou uma resposta inválida." }));
  if (!userResponse.ok) return NextResponse.json(user, { status: userResponse.status });
  const response = NextResponse.json(user, { status: userResponse.status });
  setAuthCookies(response, tokens.access, tokens.refresh);
  return response;
}
