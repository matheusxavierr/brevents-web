import type { Metadata } from "next";
import { CreateEventForm } from "@/components/create-event-form";
export const metadata: Metadata = { title: "Criar evento" };
export default function NewEventPage() { return <CreateEventForm />; }
