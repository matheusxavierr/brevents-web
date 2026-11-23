import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("Criar conta") };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t } = await getTranslator();
  return <AuthShell title={t("Crie sua conta")} description={t("Participe de eventos e abra reuniões colaborativas na BR Events.")}><AuthForm mode="register" nextPath={next ?? "/"} /></AuthShell>;
}
