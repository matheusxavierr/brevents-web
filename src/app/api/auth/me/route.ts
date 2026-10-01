import { forwardToBackend } from "@/lib/backend-proxy";

export async function GET(request: Request) {
  return forwardToBackend(request, "auth/me/");
}
