"use client";

import { Building2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CompanyHubAdmin } from "./company-hub-admin";
import { HomeHeader } from "./home-header";
import { useSession } from "./session-provider";

export function CompanyHubWorkspace() {
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (!user) router.replace(`/entrar?next=${encodeURIComponent("/hub/configurar")}`);
  }, [router, user]);

  if (!user) {
    return (
      <main className="hub-workspace-loading" aria-live="polite">
        <LoaderCircle className="spin" size={24} />
        <span>Preparando o hub da empresa…</span>
      </main>
    );
  }

  return (
    <>
      <HomeHeader />
      <main className="hub-workspace-page">
        <div className="container hub-workspace-breadcrumb">
          <span><Building2 size={15} /> Área da empresa</span>
          <Link href="/hub">Sobre o hub da empresa</Link>
        </div>
        <section className="container hub-workspace-content">
          <CompanyHubAdmin />
        </section>
      </main>
    </>
  );
}
