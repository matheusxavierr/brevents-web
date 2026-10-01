"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationFeedback() {
  const pathname = usePathname();
  const router = useRouter();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigating = targetPath !== null && targetPath !== pathname;

  useEffect(() => {
    function beginNavigation(destination: string) {
      setTargetPath(destination);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setTargetPath(null), 8_000);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href || destination.hash) return;
      beginNavigation(destination.pathname);
    }

    function handleHistoryNavigation() { beginNavigation(window.location.pathname); }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handleHistoryNavigation);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handleHistoryNavigation);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function goBack() {
    setTargetPath("__history__");
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <>
      {pathname !== "/" && <button className="route-back-button" type="button" onClick={goBack} aria-label="Voltar para a página anterior"><ArrowLeft size={17} /><span>Voltar</span></button>}
      {navigating && <div className="navigation-overlay" role="status" aria-live="polite" aria-label="Carregando página"><span className="navigation-spinner" /><strong>Abrindo página…</strong></div>}
    </>
  );
}
