import type { Metadata } from "next";
import { CreateEventForm } from "@/components/create-event-form";
import { getTranslator } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("Criar evento") };
}
export default function NewEventPage() { return <CreateEventForm />; }
