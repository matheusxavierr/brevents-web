"use client";

import { useI18n } from "./i18n-provider";
import { Brand } from "./brand";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Brand />
        <span>{t("© 2026 BR Events. Experiências que aproximam pessoas.")}</span>
      </div>
    </footer>
  );
}
