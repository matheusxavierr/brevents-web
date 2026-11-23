import { NextResponse } from "next/server";
import { API_URL, requestLanguage, setAuthCookies } from "@/lib/backend-proxy";
import { translateMessage } from "@/lib/i18n";

type TokenPayload = { access?: string; refresh?: string };

async function requestApi(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }
      return response;
    } catch (reason) {
      lastError = reason;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao acessar a API.");
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function invalidCredentials(locale: Parameters<typeof translateMessage>[0], status: number) {
  return NextResponse.json({ detail: translateMessage(locale, "E-mail ou senha inválidos.") }, { status });
}

function signInUnavailable(locale: Parameters<typeof translateMessage>[0], status = 502) {
  return NextResponse.json(
    { detail: translateMessage(locale, "Não foi possível concluir o acesso agora. Tente novamente em instantes.") },
    { status },
  );
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { email?: string; password?: string };
  const { locale, acceptLanguage } = await requestLanguage();
  let tokenResponse: Response;
  try {
    tokenResponse = await requestApi(`${API_URL}/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": acceptLanguage },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (reason) {
    console.error("Não foi possível alcançar a API durante o login.", reason);
    return NextResponse.json({ detail: translateMessage(locale, "A API está temporariamente indisponível. Tente novamente em instantes.") }, { status: 503 });
  }

  const tokens = await readJson<TokenPayload>(tokenResponse);
  if (!tokenResponse.ok) {
    if (tokenResponse.status === 401 || tokenResponse.status === 400) return invalidCredentials(locale, tokenResponse.status);
    if (tokenResponse.status === 429) {
      return NextResponse.json(
        { detail: translateMessage(locale, "Muitas tentativas de acesso. Aguarde alguns instantes e tente novamente.") },
        { status: 429 },
      );
    }
    console.error("A API recusou o login.", tokenResponse.status);
    return signInUnavailable(locale);
  }
  if (!tokens?.access || !tokens?.refresh) {
    console.error("A API respondeu ao login sem tokens válidos.", tokenResponse.status);
    return signInUnavailable(locale);
  }

  let userResponse: Response;
  try {
    userResponse = await requestApi(`${API_URL}/auth/me/`, {
      headers: { Authorization: `Bearer ${tokens.access}`, "Accept-Language": acceptLanguage },
      cache: "no-store",
    });
  } catch (reason) {
    console.error("Não foi possível validar o usuário após o login.", reason);
    return NextResponse.json({ detail: translateMessage(locale, "A API está temporariamente indisponível. Tente novamente em instantes.") }, { status: 503 });
  }

  const user = await readJson<Record<string, unknown>>(userResponse);
  if (!userResponse.ok) {
    console.error("A API recusou a validação do usuário após o login.", userResponse.status);
    return signInUnavailable(locale);
  }
  if (!user) {
    console.error("A API respondeu à validação do usuário com conteúdo inválido.", userResponse.status);
    return signInUnavailable(locale);
  }
  const response = NextResponse.json(user, { status: userResponse.status });
  setAuthCookies(response, tokens.access, tokens.refresh);
  return response;
}
