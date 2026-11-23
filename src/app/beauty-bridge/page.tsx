import { redirect } from "next/navigation";

import { getLocale } from "@/lib/i18n/server";

export default async function BeautyBridgePage() {
  const locale = await getLocale();
  redirect(`/beauty-bridge/${locale}.html`);
}
