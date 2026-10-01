import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; tipo?: string }> }) {
  const { next, tipo } = await searchParams;
  const organizer = tipo === "organizer";
  return <AuthShell title="Crie sua conta" description="Comece organizando um evento ou participe de uma experiência ao vivo."><AuthForm mode="register" nextPath={next ?? (organizer ? "/painel" : "/")} defaultAccountType={organizer ? "organizer" : "attendee"} /></AuthShell>;
}
