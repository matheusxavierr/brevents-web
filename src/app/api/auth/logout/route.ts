import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/backend-proxy";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
