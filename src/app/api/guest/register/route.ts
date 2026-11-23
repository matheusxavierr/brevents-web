import { NextResponse } from "next/server";
import { API_URL, requestLanguage } from "@/lib/backend-proxy";
import { translateMessage } from "@/lib/i18n";

function ticketCookieName(eventId: string) {
  return `brevents_ticket_${eventId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { event?: string; name?: string; email?: string };
  const { locale, acceptLanguage } = await requestLanguage();
  if (!payload.event) return NextResponse.json({ detail: translateMessage(locale, "Evento obrigatório.") }, { status: 400 });
  const backendResponse = await fetch(`${API_URL}/registrations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Language": acceptLanguage },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const registration = await backendResponse.json();
  if (!backendResponse.ok) return NextResponse.json(registration, { status: backendResponse.status });
  const response = NextResponse.json(registration, { status: 201 });
  response.cookies.set(ticketCookieName(payload.event), registration.ticket_code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
