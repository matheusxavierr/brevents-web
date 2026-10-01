import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL } from "@/lib/backend-proxy";

function ticketCookieName(eventId: string) {
  return `brevents_ticket_${eventId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export async function POST(request: Request, context: RouteContext<"/api/guest/zoom/[id]/captions">) {
  const { id } = await context.params;
  const payload = (await request.json()) as { eventId?: string; source_language?: string; text?: string };
  if (!payload.eventId) return NextResponse.json({ detail: "Evento obrigatório." }, { status: 400 });
  const ticket = (await cookies()).get(ticketCookieName(payload.eventId))?.value;
  if (!ticket) return NextResponse.json({ detail: "Inscrição não encontrada." }, { status: 401 });
  const backendResponse = await fetch(`${API_URL}/public/zoom-sessions/${encodeURIComponent(id)}/captions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticket_code: ticket,
      source_language: payload.source_language,
      text: payload.text,
    }),
    cache: "no-store",
  });
  return new NextResponse(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    headers: { "Content-Type": backendResponse.headers.get("content-type") ?? "application/json" },
  });
}
