import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("Entrar") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t } = await getTranslator();
  return <AuthShell title={t("Entre na sua conta")} description={t("Acesse seus eventos, inscrições e transmissões.")}><AuthForm mode="login" nextPath={next} /></AuthShell>;
}
