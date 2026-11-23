import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, requestLanguage } from "@/lib/backend-proxy";
import { translateMessage } from "@/lib/i18n";

function ticketCookieName(eventId: string) {
  return `brevents_ticket_${eventId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export async function POST(request: Request, context: RouteContext<"/api/guest/zoom/[id]/accept-stage">) {
  const { id } = await context.params;
  const payload = (await request.json()) as { eventId?: string };
  const { locale, acceptLanguage } = await requestLanguage();
  if (!payload.eventId) return NextResponse.json({ detail: translateMessage(locale, "Evento obrigatório.") }, { status: 400 });
  const ticket = (await cookies()).get(ticketCookieName(payload.eventId))?.value;
  if (!ticket) return NextResponse.json({ detail: translateMessage(locale, "Ingresso não encontrado.") }, { status: 401 });
  const backendResponse = await fetch(`${API_URL}/public/zoom-sessions/${encodeURIComponent(id)}/accept-stage/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Language": acceptLanguage },
    body: JSON.stringify({ ticket_code: ticket }),
    cache: "no-store",
  });
  return new NextResponse(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    headers: { "Content-Type": backendResponse.headers.get("content-type") ?? "application/json" },
  });
}
