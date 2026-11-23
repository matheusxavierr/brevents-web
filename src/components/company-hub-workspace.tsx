"use client";

import { Building2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CompanyHubAdmin } from "./company-hub-admin";
import { HomeHeader } from "./home-header";
import { useI18n } from "./i18n-provider";
import { useSession } from "./session-provider";

export function CompanyHubWorkspace() {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useSession();

  useEffect(() => {
    if (!user) router.replace(`/entrar?next=${encodeURIComponent("/hub/configurar")}`);
  }, [router, user]);

  if (!user) {
    return (
      <main className="hub-workspace-loading" aria-live="polite">
        <LoaderCircle className="spin" size={24} />
        <span>{t("Preparando o hub da empresa…")}</span>
      </main>
    );
  }

  return (
    <>
      <HomeHeader />
      <main className="hub-workspace-page">
        <div className="container hub-workspace-breadcrumb">
          <span><Building2 size={15} /> {t("Área da empresa")}</span>
          <Link href="/hub">{t("Sobre o hub da empresa")}</Link>
        </div>
        <section className="container hub-workspace-content">
          <CompanyHubAdmin />
        </section>
      </main>
    </>
  );
}
