"use client";

import Image from "next/image";
import { PRODUCT_PREVIEWS, type ProductPreviewKind } from "@/lib/product-previews";
import { useI18n } from "./i18n-provider";

export function ProductPreviewImage({ kind, sizes, className, preload = false }: {
  kind: ProductPreviewKind;
  sizes: string;
  className?: string;
  preload?: boolean;
}) {
  const { t } = useI18n();
  const preview = PRODUCT_PREVIEWS[kind];
  return <Image src={preview.src} alt={t(preview.alt)} width={2160} height={1350} sizes={sizes} className={className} preload={preload} />;
}
