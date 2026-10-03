"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-transition">
      {children}
    </div>
  );
}
