"use client";

import { Building2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CompanyHubAdmin } from "./company-hub-admin";
import { HomeHeader } from "./home-header";

export function CompanyHubWorkspace() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function authorize() {
      try {
        const response = await fetch("/api/auth/me", { signal: controller.signal });
        if (!response.ok) {
          router.replace(`/entrar?next=${encodeURIComponent("/hub")}`);
          return;
        }

        setAuthorized(true);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Não foi possível validar o acesso ao hub da empresa.", error);
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    void authorize();
    return () => controller.abort();
  }, [router]);

  if (loading || !authorized) {
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
          <Link href="/">Voltar para o início</Link>
        </div>
        <section className="container hub-workspace-content">
          <CompanyHubAdmin />
        </section>
      </main>
    </>
  );
}
