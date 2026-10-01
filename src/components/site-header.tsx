import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";

export function SiteHeader({ current, eventSlug = "future-summit-2026" }: { current?: "inicio" | "agenda"; eventSlug?: string }) {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Brand />
        <nav className="site-nav" aria-label="Navegação principal">
          <Link href={`/eventos/${eventSlug}`} aria-current={current === "inicio" ? "page" : undefined}>Início</Link>
          <Link href={`/eventos/${eventSlug}/agenda`} aria-current={current === "agenda" ? "page" : undefined}>Programação</Link>
          <Link href={`/eventos/${eventSlug}#palestrantes`}>Palestrantes</Link>
          <Link className="button button-primary" href={`/eventos/${eventSlug}/ao-vivo`}>
            Entrar no evento <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
