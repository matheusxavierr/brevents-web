import type { Metadata } from "next";

import { MyEventsPage } from "@/components/my-events-page";

export const metadata: Metadata = { title: "Meus eventos" };

export default function MyEventsRoute() {
  return <MyEventsPage />;
}
