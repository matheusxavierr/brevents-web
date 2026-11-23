"use client";

import Link from "next/link";

import { useI18n } from "./i18n-provider";

export function Brand({ href = "/" }: { href?: string }) {
  const { t } = useI18n();
  return (
    <Link className="brand" href={href} aria-label={t("BR Events — página inicial")}>
      BR Events
    </Link>
  );
}
