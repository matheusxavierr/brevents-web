import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthShell title="Entre na sua conta" description="Acesse seus eventos, inscrições e transmissões."><AuthForm mode="login" nextPath={next} /></AuthShell>;
}
