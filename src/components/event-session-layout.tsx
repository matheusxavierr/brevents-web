import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function EventSessionLayout({ children }: { children: ReactNode }) {
  if (!await getCurrentUser()) {
    const returnPath = (await headers()).get("x-brevents-return-path") ?? "/";
    redirect(`/entrar?${new URLSearchParams({ next: returnPath })}`);
  }
  return children;
}
