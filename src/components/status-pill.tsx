"use client";

import { useI18n } from "./i18n-provider";
import type { SessionStatus } from "@/lib/demo-data";

export function StatusPill({ status }: { status: SessionStatus }) {
  const { t } = useI18n();
  const labels: Record<SessionStatus, string> = {
    live: t("Ao vivo"),
    soon: t("Em breve"),
    recorded: t("Gravado"),
  };
  return (
    <span className={`status-pill status-${status}`}>
      {status === "live" && <span className="live-dot" aria-hidden="true" />}
      {labels[status]}
    </span>
  );
}
