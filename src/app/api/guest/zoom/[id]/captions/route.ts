import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL } from "@/lib/backend-proxy";

function ticketCookieName(eventId: string) {
  return `brevents_ticket_${eventId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export async function GET(request: Request, context: RouteContext<"/api/guest/zoom/[id]/captions">) {
  const { id } = await context.params;
  const query = new URL(request.url).searchParams;
  const eventId = query.get("eventId");
  if (!eventId) return NextResponse.json({ detail: "Evento obrigatório." }, { status: 400 });
  const ticket = (await cookies()).get(ticketCookieName(eventId))?.value;
  if (!ticket) return NextResponse.json({ detail: "Inscrição não encontrada." }, { status: 401 });
  const cursor = new URLSearchParams();
  for (const key of ["before_at", "before_id"]) if (query.has(key)) cursor.set(key, query.get(key)!);
  const response = await fetch(`${API_URL}/public/zoom-sessions/${encodeURIComponent(id)}/transcript/?${cursor}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket_code: ticket }), cache: "no-store",
  });
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}

export async function POST(request: Request, context: RouteContext<"/api/guest/zoom/[id]/captions">) {
  const { id } = await context.params;
  const payload = (await request.json()) as { eventId?: string; source_language?: string; text?: string; message_id?: string };
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
      message_id: payload.message_id,
    }),
    cache: "no-store",
  });
  return new NextResponse(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    headers: { "Content-Type": backendResponse.headers.get("content-type") ?? "application/json" },
  });
}
