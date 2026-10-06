import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthShell title="Crie sua conta" description="Participe de eventos e abra reuniões colaborativas na BR Events."><AuthForm mode="register" nextPath={next ?? "/"} /></AuthShell>;
}
